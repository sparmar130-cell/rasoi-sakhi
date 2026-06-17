const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const https = require('https');
const url = require('url');
const fs = require('fs');
// const Razorpay = require('razorpay'); // RAZORPAY COMMENTED OUT — client uses QR Code / UPI instead
require('dotenv').config();

const db = require('./db');

// --- RAZORPAY INTEGRATION DISABLED ---
// Client uses their own QR Code / UPI for payments.
// To re-enable, uncomment the require above, restore the init block below,
// and restore the /api/payments/webhook and /api/orders/:id/verify-payment endpoints.
// let razorpay = null;
// if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET &&
//     process.env.RAZORPAY_KEY_ID !== 'rzp_test_placeholder_key_id' &&
//     process.env.RAZORPAY_KEY_SECRET !== 'placeholder_key_secret') {
//   razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
// }

const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
const dataDir = isVercel ? '/tmp' : path.join(__dirname, 'data');
const READ_ORDERS_PATH = path.join(dataDir, 'read_orders.json');

// Ensure data directory exists safely (won't crash on read-only filesystems)
try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch (err) {
  console.warn("Unable to create data directory, falling back to runtime memory:", err.message);
}

let inMemoryReadOrders = [];

function getReadOrders() {
  try {
    if (fs.existsSync(READ_ORDERS_PATH)) {
      return JSON.parse(fs.readFileSync(READ_ORDERS_PATH, 'utf8'));
    }
  } catch (e) {
    console.error("Error reading read_orders.json:", e);
  }
  return inMemoryReadOrders;
}

function markOrderAsRead(orderId) {
  try {
    const readOrders = getReadOrders();
    if (!readOrders.includes(orderId)) {
      readOrders.push(orderId);
      if (!inMemoryReadOrders.includes(orderId)) {
        inMemoryReadOrders.push(orderId);
      }
      fs.writeFileSync(READ_ORDERS_PATH, JSON.stringify(readOrders, null, 2));
    }
    return true;
  } catch (e) {
    console.warn("Error writing read_orders.json, using in-memory backup:", e.message);
    if (!inMemoryReadOrders.includes(orderId)) {
      inMemoryReadOrders.push(orderId);
    }
    return true;
  }
}

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'rasoi-sakhi-secret-key-2026';

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware to authenticate Admin JWT
function authenticateAdmin(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: "Access denied. Token missing." });
  }

  jwt.verify(token, JWT_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).json({ error: "Invalid or expired token." });
    }
    req.adminId = decoded.id;
    next();
  });
}

// Trigger Webhook helper (Google Sheets Integration)
function triggerGoogleSheetsWebhook(webhookUrl, order) {
  if (!webhookUrl) return;

  try {
    const parsedUrl = url.parse(webhookUrl);
    
    // Format the payload nicely for Google Sheets rows
    const payload = {
      orderId: order.id,
      date: order.createdAt,
      customerName: order.customerName,
      phone: order.customerPhone,
      email: order.customerEmail || 'N/A',
      address: order.deliveryAddress,
      landmark: order.landmark || 'N/A',
      deliverySlot: order.deliverySlot,
      paymentMethod: order.paymentMethod,
      items: order.items.map(item => `${item.name} (${item.weight} x ${item.quantity})`).join(', '),
      subtotal: order.subtotal,
      deliveryCharge: order.deliveryCharge,
      totalAmount: order.totalAmount,
      status: order.status
    };

    const postData = JSON.stringify(payload);
    const options = {
      hostname: parsedUrl.hostname,
      port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
      path: parsedUrl.path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = https.request(options, (res) => {
      res.on('data', () => {}); // Consume data
    });

    req.on('error', (e) => {
      console.error(`Google Sheets webhook request failed: ${e.message}`);
    });

    req.write(postData);
    req.end();
  } catch (error) {
    console.error("Failed to trigger Google Sheets Webhook:", error);
  }
}

/**
 * PUBLIC APIS
 */

// Get Products
app.get('/api/products', async (req, res) => {
  try {
    const products = await db.getCollection('products');
    res.json(products);
  } catch (err) {
    console.error("Error fetching products:", err);
    res.status(500).json({ error: "Could not fetch products." });
  }
});

// Get Testimonials
app.get('/api/testimonials', async (req, res) => {
  try {
    const testimonials = await db.getCollection('testimonials');
    res.json(testimonials);
  } catch (err) {
    console.error("Error fetching testimonials:", err);
    res.status(500).json({ error: "Could not fetch testimonials." });
  }
});

// Create Order (Checkout)
app.post('/api/orders', async (req, res) => {
  const {
    customerName,
    customerPhone,
    customerEmail,
    deliveryAddress,
    landmark,
    deliverySlot,
    paymentMethod,
    items
  } = req.body;

  // Simple validation
  if (!customerName || !customerPhone || !deliveryAddress || !deliverySlot || !paymentMethod || !items || !items.length) {
    return res.status(400).json({ error: "Missing required order details." });
  }

  try {
    const settings = await db.getSettings();
    const products = await db.getCollection('products');

    // Verify and calculate order prices based on current database configurations (Backend source of truth)
    let subtotal = 0;
    const processedItems = items.map(cartItem => {
      const dbProduct = products.find(p => p.id === cartItem.productId);
      if (!dbProduct) {
        throw new Error(`Product ${cartItem.productId} not found.`);
      }

      // Find correct weight option price
      const weightOpt = dbProduct.weightOptions.find(o => o.weight === cartItem.weight);
      const pricePerUnit = weightOpt ? weightOpt.price : dbProduct.price;
      const itemTotal = pricePerUnit * cartItem.quantity;
      subtotal += itemTotal;

      return {
        productId: cartItem.productId,
        name: dbProduct.name,
        quantity: cartItem.quantity,
        weight: cartItem.weight,
        price: pricePerUnit,
        total: itemTotal
      };
    });

    const deliveryCharge = subtotal >= settings.freeDeliveryThreshold ? 0 : settings.deliveryCharge;
    const totalAmount = subtotal + deliveryCharge;

    // Generate unique order ID
    const orderNum = Math.floor(1000 + Math.random() * 9000);
    const orderId = `RS-${Date.now().toString().slice(-6)}-${orderNum}`;

    const newOrder = {
      id: orderId,
      customerName,
      customerPhone,
      customerEmail: customerEmail || "",
      deliveryAddress,
      landmark: landmark || "",
      deliverySlot,
      paymentMethod,
      items: processedItems,
      subtotal,
      deliveryCharge,
      totalAmount,
      status: (paymentMethod.toLowerCase().includes('online') || paymentMethod.toLowerCase().includes('razorpay')) ? "Payment Pending" : "Pending",
      createdAt: new Date().toISOString()
    };

    const savedOrder = await db.addOrder(newOrder);

    if (!savedOrder) {
      return res.status(500).json({ error: "Could not save order." });
    }

    // Generate WhatsApp link for redirection
    const itemsText = savedOrder.items.map(item => `- ${item.name} (${item.weight} x ${item.quantity})`).join('\n');
    const whatsappMessage = `*Rasoi Sakhi Order* 🥬🥗\n\n` +
                            `*Order ID:* ${savedOrder.id}\n` +
                            `*Customer Name:* ${savedOrder.customerName}\n` +
                            `*Phone Number:* ${savedOrder.customerPhone}\n` +
                            `*Address:* ${savedOrder.deliveryAddress}\n` +
                            `*Landmark:* ${savedOrder.landmark || 'None'}\n\n` +
                            `*Products Ordered:*\n${itemsText}\n\n` +
                            `*Subtotal:* ₹${savedOrder.subtotal}\n` +
                            `*Delivery:* ₹${savedOrder.deliveryCharge}\n` +
                            `*Total Amount:* ₹${savedOrder.totalAmount}\n` +
                            `*Payment Method:* ${savedOrder.paymentMethod}\n` +
                            `*Delivery Slot:* ${savedOrder.deliverySlot}\n\n` +
                            `Thank you for shopping with Rasoi Sakhi!`;

    const encodedMsg = encodeURIComponent(whatsappMessage);
    
    // Sanitize phone number (remove any non-digits like +, spaces, etc.)
    let targetPhone = (settings.whatsappNumber || "").replace(/[^0-9]/g, '');
    // If it's a 10-digit Indian number without a country code, prepend '91'
    if (targetPhone.length === 10 && /^[6-9]/.test(targetPhone)) {
      targetPhone = '91' + targetPhone;
    }
    // Fallback if empty or invalid
    if (!targetPhone) {
      targetPhone = '919099113823';
    }
    const whatsappUrl = `https://wa.me/${targetPhone}?text=${encodedMsg}`;

    // --- RAZORPAY ONLINE PAYMENT BRANCH DISABLED ---
    // All orders (including QR Code / UPI) now go through the standard flow below.
    // Razorpay gateway integration is commented out; client uses their own QR Code.
    //
    // const isOnlinePayment = paymentMethod.toLowerCase().includes('online') || paymentMethod.toLowerCase().includes('razorpay');
    // if (isOnlinePayment) { ... razorpay.orders.create(...) ... }

    // Trigger Google Sheets Webhook for all orders
    if (settings.googleSheetsWebhookUrl) {
      triggerGoogleSheetsWebhook(settings.googleSheetsWebhookUrl, savedOrder);
    }

    res.json({
      success: true,
      paymentRequired: false,
      order: savedOrder,
      whatsappUrl
    });
  } catch (error) {
    console.error("Order processing error:", error);
    res.status(500).json({ error: error.message || "Failed to process order." });
  }
});

// =============================================================================
// RAZORPAY WEBHOOK & VERIFY ENDPOINTS — DISABLED (client uses QR Code / UPI)
// To re-enable: uncomment the blocks below.
// =============================================================================
//
// app.post('/api/payments/webhook', async (req, res) => {
//   const signature = req.headers['x-razorpay-signature'];
//   ... (full webhook logic removed — see git history to restore)
// });
//
// app.get('/api/orders/:id/verify-payment', async (req, res) => {
//   ... (full verify-payment logic removed — see git history to restore)
// });
// =============================================================================

/**
 * ADMIN AUTHENTICATION
 */
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const users = await db.getCollection('users');
    const admin = users.find(u => u.username === username);

    if (!admin || !bcrypt.compareSync(password, admin.passwordHash)) {
      return res.status(401).json({ error: "Invalid username or password." });
    }

    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, {
      expiresIn: '24h'
    });

    res.json({ success: true, token });
  } catch (err) {
    console.error("Login call error:", err);
    res.status(500).json({ error: "Authentication failed." });
  }
});

/**
 * SECURE ADMIN APIS
 */

// Get Admin Settings
app.get('/api/admin/settings', authenticateAdmin, async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json(settings);
  } catch (err) {
    console.error("Error fetching settings:", err);
    res.status(500).json({ error: "Could not fetch settings." });
  }
});

// Update Admin Settings
app.post('/api/admin/settings', authenticateAdmin, async (req, res) => {
  const { googleSheetsWebhookUrl, whatsappNumber, deliveryCharge, freeDeliveryThreshold } = req.body;

  try {
    const updated = await db.saveSettings({
      googleSheetsWebhookUrl: googleSheetsWebhookUrl || "",
      whatsappNumber: whatsappNumber || "919876543210",
      deliveryCharge: Number(deliveryCharge) || 0,
      freeDeliveryThreshold: Number(freeDeliveryThreshold) || 0
    });

    if (updated) {
      const settings = await db.getSettings();
      res.json({ success: true, settings });
    } else {
      res.status(500).json({ error: "Could not save settings." });
    }
  } catch (err) {
    console.error("Error saving settings:", err);
    res.status(500).json({ error: "Failed to save settings." });
  }
});

// Get Orders
app.get('/api/admin/orders', authenticateAdmin, async (req, res) => {
  try {
    const orders = await db.getCollection('orders');
    const readOrders = getReadOrders();
    const ordersWithReadStatus = orders.map(order => ({
      ...order,
      isRead: readOrders.includes(order.id)
    }));
    res.json(ordersWithReadStatus);
  } catch (err) {
    console.error("Error fetching orders:", err);
    res.status(500).json({ error: "Could not fetch orders." });
  }
});

// Update Order Status
app.post('/api/admin/orders/:id/status', authenticateAdmin, async (req, res) => {
  const { status } = req.body;
  if (!status) {
    return res.status(400).json({ error: "Status missing." });
  }

  try {
    const updatedOrder = await db.updateOrderStatus(req.params.id, status);
    if (updatedOrder) {
      // Automatically mark as read when status is updated
      markOrderAsRead(req.params.id);
      
      res.json({ success: true, order: { ...updatedOrder, isRead: true } });
      
      // Sync status change to Google Sheets webhook
      try {
        const settings = await db.getSettings();
        if (settings && settings.googleSheetsWebhookUrl) {
          triggerGoogleSheetsWebhook(settings.googleSheetsWebhookUrl, updatedOrder);
        }
      } catch (webhookErr) {
        console.error("Error triggering Google Sheets webhook on status change:", webhookErr);
      }
    } else {
      res.status(404).json({ error: "Order not found." });
    }
  } catch (err) {
    console.error("Error updating order status:", err);
    res.status(500).json({ error: "Failed to update order status." });
  }
});

// Mark Order as Read
app.post('/api/admin/orders/:id/read', authenticateAdmin, async (req, res) => {
  try {
    markOrderAsRead(req.params.id);
    res.json({ success: true });
  } catch (err) {
    console.error("Error marking order as read:", err);
    res.status(500).json({ error: "Failed to mark order as read." });
  }
});

// Export Orders to CSV (Excel Friendly)
app.get('/api/admin/orders/export', authenticateAdmin, async (req, res) => {
  try {
    const orders = await db.getCollection('orders');
    
    // Create CSV header
    let csvContent = "\uFEFF"; // UTF-8 BOM to open correctly in Excel
    csvContent += "Order ID,Date,Customer Name,Phone,Email,Address,Landmark,Items,Subtotal,Delivery,Total,Payment Method,Delivery Slot,Status\n";

    orders.forEach(order => {
      const itemsStr = order.items.map(item => `${item.name} (${item.weight}x${item.quantity})`).join('; ');
      
      // Escape double quotes and enclose fields in quotes to handle commas
      const row = [
        order.id,
        order.createdAt,
        `"${order.customerName.replace(/"/g, '""')}"`,
        `"${order.customerPhone}"`,
        `"${(order.customerEmail || '').replace(/"/g, '""')}"`,
        `"${order.deliveryAddress.replace(/"/g, '""')}"`,
        `"${(order.landmark || '').replace(/"/g, '""')}"`,
        `"${itemsStr.replace(/"/g, '""')}"`,
        order.subtotal,
        order.deliveryCharge,
        order.totalAmount,
        `"${order.paymentMethod}"`,
        `"${order.deliverySlot}"`,
        `"${order.status}"`
      ].join(',');
      
      csvContent += row + "\n";
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=rasoi_sakhi_orders.csv');
    res.send(csvContent);
  } catch (err) {
    console.error("Error exporting orders:", err);
    res.status(500).json({ error: "Failed to export orders." });
  }
});

// Create/Update Product
app.post('/api/admin/products', authenticateAdmin, async (req, res) => {
  const { id, name, category, description, freshnessInfo, storageInstructions, price, baseWeight, weightOptions, popular } = req.body;

  if (!id || !name || !category || !price || !baseWeight) {
    return res.status(400).json({ error: "Missing required product fields." });
  }

  const productObj = {
    id,
    name,
    category,
    description: description || "",
    freshnessInfo: freshnessInfo || "",
    storageInstructions: storageInstructions || "",
    price: Number(price),
    baseWeight,
    weightOptions: weightOptions || [{ weight: baseWeight, price: Number(price) }],
    popular: !!popular,
    soldOut: !!req.body.soldOut,
    image: req.body.image || id
  };

  try {
    const saved = await db.updateProduct(productObj);
    if (saved) {
      res.json({ success: true, product: saved });
    } else {
      res.status(500).json({ error: "Failed to save product." });
    }
  } catch (err) {
    console.error("Error creating product:", err);
    res.status(500).json({ error: "Failed to save product." });
  }
});

// Upload Product Image
app.post('/api/admin/upload-image', authenticateAdmin, async (req, res) => {
  const { imageBase64, filename } = req.body;
  if (!imageBase64 || !filename) {
    return res.status(400).json({ error: "Missing image data or filename." });
  }

  try {
    const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return res.status(400).json({ error: "Invalid base64 image data format." });
    }

    const mimeType = matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    
    // Generate clean filename to avoid collision
    const fileExt = path.extname(filename) || '.png';
    const cleanFilename = `${Date.now()}_${Math.random().toString(36).slice(-5)}${fileExt}`;

    const imageUrl = await db.uploadProductImage(cleanFilename, buffer, mimeType);
    res.json({ success: true, imageUrl });
  } catch (err) {
    console.error("Error in image upload API:", err);
    res.status(500).json({ error: "Failed to upload image." });
  }
});

// Update Product
app.put('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
  const { name, category, description, freshnessInfo, storageInstructions, price, baseWeight, weightOptions, popular } = req.body;

  const productObj = {
    id: req.params.id,
    name,
    category,
    description: description || "",
    freshnessInfo: freshnessInfo || "",
    storageInstructions: storageInstructions || "",
    price: Number(price),
    baseWeight,
    weightOptions: weightOptions || [{ weight: baseWeight, price: Number(price) }],
    popular: !!popular,
    soldOut: !!req.body.soldOut,
    image: req.body.image || req.params.id
  };

  try {
    const saved = await db.updateProduct(productObj);
    if (saved) {
      res.json({ success: true, product: saved });
    } else {
      res.status(500).json({ error: "Failed to update product." });
    }
  } catch (err) {
    console.error("Error updating product:", err);
    res.status(500).json({ error: "Failed to update product." });
  }
});

// Delete Product
app.delete('/api/admin/products/:id', authenticateAdmin, async (req, res) => {
  try {
    const deleted = await db.deleteProduct(req.params.id);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Product not found." });
    }
  } catch (err) {
    console.error("Error deleting product:", err);
    res.status(500).json({ error: "Failed to delete product." });
  }
});

// Get Analytics
app.get('/api/admin/analytics', authenticateAdmin, async (req, res) => {
  try {
    const orders = await db.getCollection('orders');
    const products = await db.getCollection('products');
    
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((sum, o) => o.status !== 'Cancelled' ? sum + o.totalAmount : sum, 0);
    
    // Calculate product sales
    const productSales = {};
    orders.forEach(o => {
      if (o.status !== 'Cancelled') {
        o.items.forEach(item => {
          productSales[item.name] = (productSales[item.name] || 0) + item.quantity;
        });
      }
    });

    const popularProducts = Object.keys(productSales)
      .map(name => ({ name, quantity: productSales[name] }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);

    // Growth by day
    const dailyOrders = {};
    orders.slice(0, 30).forEach(o => {
      const day = o.createdAt.split('T')[0];
      dailyOrders[day] = (dailyOrders[day] || 0) + 1;
    });

    res.json({
      totalOrders,
      totalRevenue,
      popularProducts,
      dailyOrders,
      productCount: products.length
    });
  } catch (err) {
    console.error("Error compiling analytics:", err);
    res.status(500).json({ error: "Failed to fetch analytics." });
  }
});

// Fallback for HTML5 SPA Routing: serve index.html for all non-API requests
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`Rasoi Sakhi server is running securely on http://localhost:${PORT}`);
});
