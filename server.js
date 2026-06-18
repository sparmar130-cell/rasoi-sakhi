const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const https = require('https');
const url = require('url');
const fs = require('fs');
const Razorpay = require('razorpay');
const webpush = require('web-push');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const db = require('./db');

// VAPID Keys for Browser Push Notifications
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ? process.env.VAPID_PUBLIC_KEY.trim() : undefined;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ? process.env.VAPID_PRIVATE_KEY.trim() : undefined;
const VAPID_EMAIL = process.env.VAPID_EMAIL ? process.env.VAPID_EMAIL.trim() : 'mailto:support@rasoisakhi.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
  console.log("Push Notifications: VAPID configured");
} else {
  console.log("Push Notifications: VAPID keys not set — push disabled");
}

// --- RAZORPAY INTEGRATION DISABLED ---
// Client uses their own QR Code / UPI for payments.
// To re-enable, uncomment the require above, restore the init block below,
// and restore the /api/payments/webhook and /api/orders/:id/verify-payment endpoints.
let razorpay = null;
const rzpKeyId = process.env.RAZORPAY_KEY_ID ? process.env.RAZORPAY_KEY_ID.trim() : undefined;
const rzpKeySecret = process.env.RAZORPAY_KEY_SECRET ? process.env.RAZORPAY_KEY_SECRET.trim() : undefined;
if (rzpKeyId && rzpKeySecret &&
    rzpKeyId !== 'rzp_test_placeholder_key_id' &&
    rzpKeySecret !== 'placeholder_key_secret') {
  razorpay = new Razorpay({ key_id: rzpKeyId, key_secret: rzpKeySecret });
}

// isRead state is now persisted permanently in the Supabase 'orders' table.
// No more ephemeral read_orders.json file that would reset on server restart.

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'rasoi-sakhi-secret-key-2026';

app.use(cors());
app.use(express.json({
  limit: '10mb',
  verify: (req, res, buf) => {
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ limit: '10mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// --- RATE LIMITERS ---
// Protects order creation from bots/spam (5 orders per 10 minutes per IP)
const orderLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many orders submitted from this connection. Please wait a few minutes and try again.' }
});

// Protects admin login from brute-force (10 attempts per 15 minutes per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Please wait 15 minutes before trying again.' }
});

// Protects contact form submissions from spam (5 submissions per 10 minutes per IP)
const contactLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many messages sent. Please wait a few minutes and try again.' }
});

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

// Send push notification to all subscribed admin devices
async function sendPushNotification(order) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("Push notifications: VAPID not configured, skipping");
    return;
  }
  try {
    const subscriptions = await db.getPushSubscriptions();
    if (!subscriptions || subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: 'Payment Received!',
      body: `Rs.${order.totalAmount} from ${order.customerName} — Order: ${order.id}`,
      tag: `payment-${order.id}`,
      url: '/#admin-section',
      orderId: order.id
    });

    const pushPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`Removing invalid push subscription: ${sub.endpoint.substring(0, 50)}...`);
          await db.deletePushSubscription(sub.endpoint);
        } else {
          console.error(`Push failed for subscription: ${err.message}`);
        }
      }
    });

    await Promise.allSettled(pushPromises);
    console.log(`Push notifications sent for order: ${order.id}`);
  } catch (err) {
    console.error("Error sending push notifications:", err);
  }
}

async function sendNewOrderPushNotification(order) {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.log("Push notifications: VAPID not configured, skipping new order alert");
    return;
  }
  try {
    const subscriptions = await db.getPushSubscriptions();
    if (!subscriptions || subscriptions.length === 0) return;

    const payload = JSON.stringify({
      title: 'New Order Received! 🥬',
      body: `${order.customerName} ordered for ₹${order.totalAmount} (Slot: ${order.deliverySlot})`,
      tag: `new-order-${order.id}`,
      url: '/#admin-section',
      orderId: order.id
    });

    const pushPromises = subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(sub, payload);
      } catch (err) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          console.log(`Removing invalid push subscription during new order: ${sub.endpoint.substring(0, 50)}...`);
          await db.deletePushSubscription(sub.endpoint);
        } else {
          console.error(`Push failed for subscription: ${err.message}`);
        }
      }
    });

    await Promise.allSettled(pushPromises);
    console.log(`New order push notifications sent for order: ${order.id}`);
  } catch (err) {
    console.error("Error sending new order push notifications:", err);
  }
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

// Get Public Configurations
app.get('/api/settings', async (req, res) => {
  try {
    const settings = await db.getSettings();
    res.json({
      whatsappNumber: settings.whatsappNumber || "919876543210",
      deliveryCharge: Number(settings.deliveryCharge) || 0,
      freeDeliveryThreshold: Number(settings.freeDeliveryThreshold) || 0,
      allowedPincodes: settings.allowedPincodes || "392011"
    });
  } catch (err) {
    console.error("Error fetching public settings:", err);
    res.status(500).json({ error: "Could not fetch system settings." });
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
app.post('/api/orders', orderLimiter, async (req, res) => {
  const {
    customerName,
    customerPhone,
    customerEmail,
    deliveryAddress,
    deliveryPincode,
    landmark,
    deliverySlot,
    paymentMethod,
    items
  } = req.body;

  // Simple validation
  if (!customerName || !customerPhone || !deliveryAddress || !deliveryPincode || !deliverySlot || !paymentMethod || !items || !items.length) {
    return res.status(400).json({ error: "Missing required order details." });
  }

  try {
    const settings = await db.getSettings();

    // Verify allowed pincodes dynamically from database settings configuration
    const allowed = (settings.allowedPincodes || "392011").split(',').map(p => p.trim());
    if (!allowed.includes(deliveryPincode.trim())) {
      return res.status(400).json({ error: `Sorry, delivery is only available for pincodes: ${settings.allowedPincodes || "392011"}.` });
    }

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

    const isOnlinePayment = paymentMethod === 'UPI Payment';

    const newOrder = {
      id: orderId,
      customerName,
      customerPhone,
      customerEmail: customerEmail || "",
      deliveryAddress,
      deliveryPincode,
      landmark: landmark || "",
      deliverySlot,
      paymentMethod,
      items: processedItems,
      subtotal,
      deliveryCharge,
      totalAmount,
      status: isOnlinePayment ? "Payment Pending" : "Pending",
      createdAt: new Date().toISOString()
    };

    const savedOrder = await db.addOrder(newOrder);

    if (!savedOrder) {
      return res.status(500).json({ error: "Could not save order." });
    }

    // Send push notification to admin about the new order (Option B)
    try {
      sendNewOrderPushNotification(savedOrder);
    } catch (pushErr) {
      console.error("Error triggering new order push notification:", pushErr);
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

    // Online Payment Handling with Razorpay
    if (isOnlinePayment) {
      if (!razorpay) {
        return res.status(503).json({ error: "Online payments are currently unavailable. Please select Cash On Delivery." });
      }

      let rzpOrderId = null;
      try {
        const options = {
          amount: Math.round(totalAmount * 100), // in paise
          currency: "INR",
          receipt: orderId
        };
        const rzpOrder = await razorpay.orders.create(options);
        rzpOrderId = rzpOrder.id;
      } catch (rzpErr) {
        console.error("Error creating Razorpay order:", rzpErr);
        return res.status(500).json({ 
          error: "Failed to initiate payment gateway order.",
          details: rzpErr.message || (rzpErr.error && rzpErr.error.description) || String(rzpErr)
        });
      }

      // Save mapping
      await db.savePaymentMapping(rzpOrderId, orderId, {
        amount: totalAmount,
        customerPhone,
        customerName
      });

      return res.json({
        success: true,
        paymentRequired: true,
        keyId: rzpKeyId,
        amount: Math.round(totalAmount * 100),
        currency: "INR",
        razorpayOrderId: rzpOrderId,
        orderId: orderId,
        whatsappUrl
      });
    }

    // COD Flow: Trigger Google Sheets Webhook immediately
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

// Razorpay Payment Webhook (Server-to-Server Verification)
app.post('/api/payments/webhook', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

  console.log("Payment webhook event received:", req.body);

  if (!webhookSecret) {
    console.warn("SECURITY: Webhook received but RAZORPAY_WEBHOOK_SECRET is not configured on the server.");
    return res.status(503).json({ error: "Webhook secret not configured on server. Set RAZORPAY_WEBHOOK_SECRET in environment variables." });
  }

  if (!signature) {
    console.warn("Webhook rejected: RAZORPAY_WEBHOOK_SECRET is set but no x-razorpay-signature header was provided.");
    return res.status(400).send("Webhook signature required.");
  }

  const crypto = require('crypto');
  const shasum = crypto.createHmac('sha256', webhookSecret);
  shasum.update(req.rawBody || JSON.stringify(req.body));
  const digest = shasum.digest('hex');
  if (digest !== signature) {
    console.warn("Invalid Razorpay webhook signature detected! Rejecting request.");
    return res.status(400).send("Invalid webhook signature.");
  }
  console.log("Razorpay webhook signature verified successfully.");

  try {
    let rzpOrderId = null;
    let eventName = null;

    if (req.body.event) {
      // Real Razorpay webhook format
      eventName = req.body.event;
      if (req.body.payload && req.body.payload.order) {
        rzpOrderId = req.body.payload.order.entity.id;
      } else if (req.body.payload && req.body.payload.payment) {
        rzpOrderId = req.body.payload.payment.entity.order_id;
      }
    }

    if (!rzpOrderId) {
      console.error("No Razorpay Order ID found in payload.");
      return res.status(400).json({ error: "No order ID found in payload." });
    }

    console.log(`Processing webhook payment for Razorpay Order ID: ${rzpOrderId}, Event: ${eventName}`);

    // Only process successful payments
    if (eventName === 'order.paid' || eventName === 'payment.captured') {
      const mapping = await db.getPaymentMapping(rzpOrderId);
      if (!mapping) {
        console.error(`No local order mapping found for Razorpay Order ID: ${rzpOrderId}`);
        return res.status(404).json({ error: "Order mapping not found in mappings table." });
      }

      const { orderId } = mapping;
      const orders = await db.getCollection('orders');
      const order = orders.find(o => o.id === orderId);

      if (!order) {
        console.error(`Mapped local order ${orderId} not found in database.`);
        return res.status(404).json({ error: "Local order not found." });
      }

      if (order.status === "Payment Pending") {
        console.log(`Payment confirmed for Order ${orderId}. Updating status to Payment Received.`);
        const updatedOrder = await db.updateOrderStatus(orderId, "Payment Received");
        
        // Sync to Google Sheets
        const settings = await db.getSettings();
        if (settings.googleSheetsWebhookUrl && updatedOrder) {
          triggerGoogleSheetsWebhook(settings.googleSheetsWebhookUrl, updatedOrder);
        }
      } else {
        console.log(`Order ${orderId} status is already '${order.status}'. Webhook skip double processing.`);
      }

      // Update mapping status to verified
      await db.savePaymentMapping(rzpOrderId, orderId, { ...mapping, status: 'verified', updatedAt: new Date().toISOString() });
    }

    res.json({ success: true });
  } catch (err) {
    console.error("Webhook processing failed:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

// Client-side Payment Verification Endpoint
app.get('/api/orders/:id/verify-payment', async (req, res) => {
  try {
    const orderId = req.params.id;
    const orders = await db.getCollection('orders');
    const order = orders.find(o => o.id === orderId);

    if (!order) {
      return res.status(404).json({ error: "Order not found." });
    }

    if (order.status !== "Payment Pending") {
      return res.json({ success: true, verified: true, status: order.status });
    }

    // Otherwise, still waiting for the real webhook transaction
    res.json({ success: true, verified: false, status: order.status });
  } catch (err) {
    console.error("Error verifying payment:", err);
    res.status(500).json({ error: "Internal server error." });
  }
});

/**
 * BROWSER PUSH NOTIFICATIONS
 */

// Serve VAPID public key to the client (no auth needed — key is public)
app.get('/api/admin/push-vapid-key', (req, res) => {
  if (!VAPID_PUBLIC_KEY) {
    return res.status(503).json({ error: "Push notifications not configured" });
  }
  res.json({ publicKey: VAPID_PUBLIC_KEY });
});

// Subscribe to push notifications (saves subscription so admin gets notified later)
app.post('/api/admin/push-subscribe', authenticateAdmin, async (req, res) => {
  const subscription = req.body;
  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Invalid subscription data" });
  }
  try {
    const saved = await db.savePushSubscription(subscription);
    if (saved) {
      res.json({ success: true, message: "Push notifications enabled" });
    } else {
      res.status(500).json({ error: "Failed to save subscription" });
    }
  } catch (err) {
    console.error("Error saving push subscription:", err);
    res.status(500).json({ error: "Failed to enable notifications" });
  }
});

// Unsubscribe from push notifications
app.post('/api/admin/push-unsubscribe', authenticateAdmin, async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) return res.status(400).json({ error: "Missing endpoint" });
  try {
    await db.deletePushSubscription(endpoint);
    res.json({ success: true, message: "Notifications disabled" });
  } catch (err) {
    console.error("Error removing push subscription:", err);
    res.status(500).json({ error: "Failed to disable notifications" });
  }
});

// Check if push is enabled for this admin
app.get('/api/admin/push-status', authenticateAdmin, async (req, res) => {
  const subscriptions = await db.getPushSubscriptions();
  res.json({ enabled: subscriptions.length > 0 });
});

/**
 * ADMIN AUTHENTICATION
 */
app.post('/api/admin/login', loginLimiter, async (req, res) => {
  const { username, password } = req.body;
  try {
    const users = await db.getCollection('users');
    const admin = users.find(u => u.username && u.username.toLowerCase() === username.toLowerCase());

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

// Get Admin Profile
app.get('/api/admin/profile', authenticateAdmin, async (req, res) => {
  try {
    const users = await db.getCollection('users');
    const admin = users.find(u => u.id === req.adminId);
    if (!admin) {
      return res.status(404).json({ error: "Admin user not found." });
    }
    res.json({ username: admin.username });
  } catch (err) {
    console.error("Error fetching admin profile:", err);
    res.status(500).json({ error: "Failed to fetch admin profile." });
  }
});

// Update Admin Credentials
app.post('/api/admin/update-credentials', authenticateAdmin, async (req, res) => {
  const { username, currentPassword, newPassword } = req.body;
  if (!username || !currentPassword) {
    return res.status(400).json({ error: "Username and current password are required." });
  }

  try {
    const users = await db.getCollection('users');
    const adminIndex = users.findIndex(u => u.id === req.adminId);
    if (adminIndex === -1) {
      return res.status(404).json({ error: "Admin user not found." });
    }

    const admin = users[adminIndex];

    // Verify current password
    if (!bcrypt.compareSync(currentPassword, admin.passwordHash)) {
      return res.status(401).json({ error: "Incorrect current password." });
    }

    // Update username if changed
    const trimmedUsername = username.trim();
    if (trimmedUsername) {
      admin.username = trimmedUsername;
    }

    // Update password if new password is provided
    if (newPassword && newPassword.trim()) {
      admin.passwordHash = bcrypt.hashSync(newPassword.trim(), 10);
    }

    users[adminIndex] = admin;
    const saved = await db.saveCollection('users', users);
    if (!saved) {
      return res.status(500).json({ error: "Failed to save updated credentials." });
    }

    // Generate new token with updated username so it remains valid
    const token = jwt.sign({ id: admin.id, username: admin.username }, JWT_SECRET, {
      expiresIn: '24h'
    });

    res.json({ success: true, message: "Credentials updated successfully.", token });
  } catch (err) {
    console.error("Error updating admin credentials:", err);
    res.status(500).json({ error: "Failed to update credentials." });
  }
});

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
  const { googleSheetsWebhookUrl, whatsappNumber, deliveryCharge, freeDeliveryThreshold, allowedPincodes } = req.body;

  // Validate WhatsApp number (10-14 digits only, must include country code)
  const phoneRegex = /^\d{10,14}$/;
  if (whatsappNumber && !phoneRegex.test(whatsappNumber)) {
    return res.status(400).json({ error: "Invalid WhatsApp number. Must contain only digits with country code (e.g. 919099113823)." });
  }

  // Validate allowedPincodes (comma-separated list of 6-digit numbers)
  const pinRegex = /^\d{6}(?:\s*,\s*\d{6})*$/;
  if (allowedPincodes && !pinRegex.test(allowedPincodes.trim())) {
    return res.status(400).json({ error: "Invalid allowed pincodes. Must be a comma-separated list of 6-digit numbers (e.g. 392011, 392012)." });
  }

  try {
    const updated = await db.saveSettings({
      googleSheetsWebhookUrl: googleSheetsWebhookUrl || "",
      whatsappNumber: whatsappNumber || "919876543210",
      deliveryCharge: Number(deliveryCharge) || 0,
      freeDeliveryThreshold: Number(freeDeliveryThreshold) || 0,
      allowedPincodes: allowedPincodes ? allowedPincodes.trim() : "392011"
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

// Get Orders (Paginated)
app.get('/api/admin/orders', authenticateAdmin, async (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const offset = parseInt(req.query.offset) || 0;

  try {
    const { orders, total } = await db.getOrdersPaginated(limit, offset);
    res.json({ orders, total });
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
      // Automatically mark as read when admin updates the status
      await db.updateOrderRead(req.params.id, true);

      res.json({ success: true, order: { ...updatedOrder, isRead: true } });

      // Send browser push notification when payment is confirmed
      if (status === 'Payment Received') {
        sendPushNotification(updatedOrder);
      }

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

// Mark Order as Read (persists permanently in DB)
app.post('/api/admin/orders/:id/read', authenticateAdmin, async (req, res) => {
  try {
    await db.updateOrderRead(req.params.id, true);
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

// Upload Product Image — auto-converts to WebP for optimal performance
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

    const inputBuffer = Buffer.from(matches[2], 'base64');

    // ── Auto-convert to WebP for every upload ──────────────────────────────
    // Regardless of what the client uploads (PNG, JPG, HEIC, etc.),
    // we store it as a compressed WebP. Quality 82 is visually lossless
    // but typically 70–90% smaller than the original.
    let webpBuffer;
    try {
      const sharp = require('sharp');
      webpBuffer = await sharp(inputBuffer)
        .webp({ quality: 82, effort: 4 })
        .toBuffer();
    } catch (sharpErr) {
      // sharp unavailable (shouldn't happen) — fall back to original
      console.warn("sharp WebP conversion failed, storing original:", sharpErr.message);
      webpBuffer = inputBuffer;
    }
    // ───────────────────────────────────────────────────────────────────────

    // Always use .webp extension — original extension is discarded
    const baseName = path.basename(filename, path.extname(filename));
    const cleanFilename = `${Date.now()}_${Math.random().toString(36).slice(-5)}_${baseName}.webp`;

    const imageUrl = await db.uploadProductImage(cleanFilename, webpBuffer, 'image/webp');
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

// Submit Contact Message
app.post('/api/contact', contactLimiter, async (req, res) => {
  const { name, email, phone, message } = req.body;
  if (!name || !phone || !message) {
    return res.status(400).json({ error: "Name, phone, and message are required." });
  }

  try {
    const contactMsg = {
      name,
      phone,
      email: email || "",
      message,
      createdAt: new Date().toISOString(),
      isResolved: false
    };

    const saved = await db.saveContactMessage(contactMsg);
    if (!saved) {
      return res.status(500).json({ error: "Failed to save contact message." });
    }

    // Send push notification to admin if webpush is configured
    try {
      if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        const subscriptions = await db.getPushSubscriptions();
        if (subscriptions && subscriptions.length > 0) {
          const payload = JSON.stringify({
            title: 'New Contact Message!',
            body: `From ${name}: "${message.substring(0, 50)}${message.length > 50 ? '...' : ''}"`,
            tag: `contact-${Date.now()}`,
            url: '/#admin-section'
          });
          const pushPromises = subscriptions.map(async (sub) => {
            try {
              await webpush.sendNotification(sub, payload);
            } catch (err) {
              if (err.statusCode === 404 || err.statusCode === 410) {
                await db.deletePushSubscription(sub.endpoint);
              }
            }
          });
          await Promise.allSettled(pushPromises);
        }
      }
    } catch (pushErr) {
      console.error("Error sending contact push notification:", pushErr);
    }

    res.json({ success: true, message: "Message sent successfully!" });
  } catch (err) {
    console.error("Error submitting contact form:", err);
    res.status(500).json({ error: "Failed to process contact message." });
  }
});

// Get Contact Messages (Admin only)
app.get('/api/admin/contact-messages', authenticateAdmin, async (req, res) => {
  try {
    const messages = await db.getContactMessages();
    res.json(messages);
  } catch (err) {
    console.error("Error fetching contact messages:", err);
    res.status(500).json({ error: "Failed to fetch contact messages." });
  }
});

// Delete Contact Message (Admin only)
app.delete('/api/admin/contact-messages/:id', authenticateAdmin, async (req, res) => {
  try {
    const deleted = await db.deleteContactMessage(req.params.id);
    if (deleted) {
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "Message not found." });
    }
  } catch (err) {
    console.error("Error deleting contact message:", err);
    res.status(500).json({ error: "Failed to delete contact message." });
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
