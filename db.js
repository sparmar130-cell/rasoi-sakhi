const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');

const DB_PATH = path.join(__dirname, 'data', 'db.json');
let inMemoryPaymentMappings = {};

// Initialize database template
const defaultDatabase = {
  users: [
    {
      id: "admin",
      username: "admin",
      passwordHash: bcrypt.hashSync("admin123", 10), // Default password, can be changed via admin dashboard
      createdAt: new Date().toISOString()
    }
  ],
  settings: {
    googleSheetsWebhookUrl: "",
    whatsappNumber: "919876543210", // Default phone number for orders (with country code, e.g., 91 for India)
    deliveryCharge: 30,
    freeDeliveryThreshold: 299
  },
  products: [
    // Category 1: Fresh Cut Essentials
    {
      id: "onion-diced",
      name: "Onion Diced",
      category: "essentials",
      description: "Perfectly diced fresh onions. Cleaned, washed, and ready to toss into the pan.",
      freshnessInfo: "Chopped fresh daily, vacuum packed immediately to preserve sweetness and crunch.",
      storageInstructions: "Keep refrigerated between 2-4°C. Consume within 3 days.",
      price: 35,
      baseWeight: "250g",
      weightOptions: [
        { weight: "250g", price: 35 },
        { weight: "500g", price: 65 },
        { weight: "1kg", price: 120 }
      ],
      image: "onion-diced",
      popular: true
    },
    {
      id: "onion-sliced",
      name: "Onion Sliced",
      category: "essentials",
      description: "Thick, uniform slices of red onions, perfect for biryanis, salads, and curries.",
      freshnessInfo: "Sliced in a hygienic environment using precision cutting tools to maintain crunch.",
      storageInstructions: "Store in an airtight container in the fridge. Consume within 3 days.",
      price: 35,
      baseWeight: "250g",
      weightOptions: [
        { weight: "250g", price: 35 },
        { weight: "500g", price: 65 }
      ],
      image: "onion-sliced",
      popular: false
    },
    {
      id: "tomato-chopped",
      name: "Tomato Chopped",
      category: "essentials",
      description: "Juicy, firm tomatoes chopped finely. No messy cutting board, no waste.",
      freshnessInfo: "Sourced directly from local farms in Gujarat, sanitised and chopped fresh.",
      storageInstructions: "Refrigerate and use within 2 days for maximum freshness.",
      price: 30,
      baseWeight: "250g",
      weightOptions: [
        { weight: "250g", price: 30 },
        { weight: "500g", price: 55 }
      ],
      image: "tomato-chopped",
      popular: true
    },
    {
      id: "potato-cubes",
      name: "Potato Cubes",
      category: "essentials",
      description: "Peeled, washed, and cubed potatoes. Stored in purified water solution to prevent oxidation.",
      freshnessInfo: "Peeled and cut in an oxygen-controlled environment to maintain natural color.",
      storageInstructions: "Keep refrigerated. Use within 2 days.",
      price: 25,
      baseWeight: "250g",
      weightOptions: [
        { weight: "250g", price: 25 },
        { weight: "500g", price: 45 },
        { weight: "1kg", price: 80 }
      ],
      image: "potato-cubes",
      popular: true
    },
    {
      id: "bhindi-sliced",
      name: "Bhindi Sliced (Ladyfinger)",
      category: "essentials",
      description: "Perfectly washed, dried, and sliced ladyfingers. Completely moisture-free to avoid stickiness.",
      freshnessInfo: "De-seeded slightly and precision cut to ensure quick and non-slimy cooking.",
      storageInstructions: "Spread out on a paper towel inside a container, refrigerate. Use within 3 days.",
      price: 45,
      baseWeight: "250g",
      weightOptions: [
        { weight: "250g", price: 45 },
        { weight: "500g", price: 80 }
      ],
      image: "bhindi-sliced",
      popular: true
    },
    {
      id: "cabbage-sliced",
      name: "Cabbage Sliced",
      category: "essentials",
      description: "Finely shredded clean cabbage. Ideal for stir-fries, chow mein, and Gujarati sambharo.",
      freshnessInfo: "Outer leaves discarded, bubble washed, and shredded to a uniform 2mm thickness.",
      storageInstructions: "Keep refrigerated in a sealed package. Use within 4 days.",
      price: 25,
      baseWeight: "250g",
      weightOptions: [
        { weight: "250g", price: 25 },
        { weight: "500g", price: 45 }
      ],
      image: "cabbage-sliced",
      popular: false
    },
    {
      id: "loki-chopped",
      name: "Loki Chopped (Bottle Gourd)",
      category: "essentials",
      description: "Peeled and chopped bottle gourd. Ready for curries, soups, or koftas.",
      freshnessInfo: "Hygienically peeled, chopped, and vacuum-sealed immediately to prevent browning.",
      storageInstructions: "Keep refrigerated. Consume within 24-48 hours.",
      price: 30,
      baseWeight: "250g",
      weightOptions: [
        { weight: "250g", price: 30 },
        { weight: "500g", price: 55 }
      ],
      image: "loki-chopped",
      popular: false
    },
    {
      id: "cucumber-sliced",
      name: "Cucumber Sliced",
      category: "essentials",
      description: "Crisp, sliced cucumber rounds. Ready to serve in salads.",
      freshnessInfo: "Unpeeled/partially peeled, washed with UV purified water, sliced perfectly.",
      storageInstructions: "Refrigerate and consume within 24-36 hours.",
      price: 30,
      baseWeight: "250g",
      weightOptions: [
        { weight: "250g", price: 30 },
        { weight: "500g", price: 55 }
      ],
      image: "cucumber-sliced",
      popular: false
    },
    {
      id: "carrot-cubes",
      name: "Carrot Cubes",
      category: "essentials",
      description: "Sweet, crunchy orange carrots cubed for pulavs, soups, and mixed vegetables.",
      freshnessInfo: "Peeled, thoroughly washed, and chopped into clean 1cm cubes.",
      storageInstructions: "Store refrigerated in vacuum pack. Use within 4 days.",
      price: 35,
      baseWeight: "250g",
      weightOptions: [
        { weight: "250g", price: 35 },
        { weight: "500g", price: 65 }
      ],
      image: "carrot-cubes",
      popular: false
    },
    {
      id: "peas",
      name: "Green Peas (Shelled)",
      category: "essentials",
      description: "Sweet, tender green peas. No podding hassle. Just open and cook.",
      freshnessInfo: "Shelled manually under strict hygiene, sorted by size, washed, and packed.",
      storageInstructions: "Can be refrigerated for 3 days or frozen up to 30 days.",
      price: 60,
      baseWeight: "200g",
      weightOptions: [
        { weight: "200g", price: 60 },
        { weight: "500g", price: 140 }
      ],
      image: "peas",
      popular: true
    },
    {
      id: "capsicum-chopped",
      name: "Capsicum Chopped (Green Bell Pepper)",
      category: "essentials",
      description: "De-seeded and chopped green capsicum. Ideal for pizzas, pastas, and stir-fries.",
      freshnessInfo: "Core and seeds completely removed, washed, and diced.",
      storageInstructions: "Store in dry airtight container in the fridge. Use within 3 days.",
      price: 40,
      baseWeight: "250g",
      weightOptions: [
        { weight: "250g", price: 40 },
        { weight: "500g", price: 75 }
      ],
      image: "capsicum-chopped",
      popular: false
    },

    // Category 2: Ready To Cook Packs
    {
      id: "pav-bhaji-pack",
      name: "Pav Bhaji Preparation Pack",
      category: "ready_to_cook",
      description: "A perfect pre-portioned mix of potatoes (peeled/cubed), cauliflower florets, green peas, carrots, and onions.",
      freshnessInfo: "All ingredients washed separately, proportioned correctly for a family of 4.",
      storageInstructions: "Refrigerate immediately. Cook within 2 days of delivery.",
      price: 99,
      baseWeight: "600g",
      weightOptions: [
        { weight: "600g", price: 99 }
      ],
      image: "pav-bhaji-pack",
      popular: true
    },
    {
      id: "biryani-pack",
      name: "Biryani Preparation Pack",
      category: "ready_to_cook",
      description: "Includes diced carrots, French beans, green peas, sliced onions, mint leaves, and coriander.",
      freshnessInfo: "Aromatic herbs packed separately to retain their essential oils.",
      storageInstructions: "Keep refrigerated. Use within 2 days.",
      price: 110,
      baseWeight: "500g",
      weightOptions: [
        { weight: "500g", price: 110 }
      ],
      image: "biryani-pack",
      popular: true
    },
    {
      id: "mixed-veg-pack",
      name: "Mixed Vegetable Pack",
      category: "ready_to_cook",
      description: "A colorful blend of diced potatoes, carrots, French beans, cauliflower, and green peas.",
      freshnessInfo: "Individually sanitized vegetables mixed in culinary proportions.",
      storageInstructions: "Keep refrigerated. Use within 3 days.",
      price: 89,
      baseWeight: "500g",
      weightOptions: [
        { weight: "500g", price: 89 }
      ],
      image: "mixed-veg-pack",
      popular: true
    },
    {
      id: "stir-fry-pack",
      name: "Stir Fry Pack",
      category: "ready_to_cook",
      description: "Crispy mixture of shredded cabbage, carrot juliennes, sliced capsicum, and spring onions.",
      freshnessInfo: "Julienne cut vegetables packed in micro-perforated bags to keep them crunchy.",
      storageInstructions: "Keep refrigerated. Cook within 2 days for maximum crunch.",
      price: 79,
      baseWeight: "400g",
      weightOptions: [
        { weight: "400g", price: 79 }
      ],
      image: "stir-fry-pack",
      popular: false
    }
  ],
  orders: [],
  testimonials: [
    {
      id: "t1",
      name: "Priyanka Patel",
      role: "Working Professional, Bharuch",
      quote: "Rasoi Sakhi has saved me 30 minutes every evening! The vegetables are so clean and neatly packed. I just open the packet and start cooking.",
      rating: 5
    },
    {
      id: "t2",
      name: "Mehta Aunty",
      role: "Homemaker, Bharuch",
      quote: "At my age, peeling and chopping bhindi or cleaning peas is very tiring. Rasoi Sakhi is like a helper in my kitchen. Highly hygienic and fresh.",
      rating: 5
    },
    {
      id: "t3",
      name: "Rajesh Shah",
      role: "Busy Parent, Bharuch",
      quote: "The Pav Bhaji pack is a lifesaver. No peeling potatoes or cleaning cauliflower. Clean, chemical-free, and delicious results. Strongly recommended!",
      rating: 5
    }
  ],
  pushSubscriptions: []
};

// Note: Local file initialization is deferred until after Supabase check below.

/**
 * Local DB helper functions
 */
function readDB() {
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error("Error reading database:", err);
    return defaultDatabase;
  }
}

function writeDB(data) {
  try {
    const tempPath = DB_PATH + '.tmp';
    fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tempPath, DB_PATH);
    return true;
  } catch (err) {
    console.error("Error writing to database:", err);
    return false;
  }
}

// Supabase client initialization
const supabaseUrl = process.env.SUPABASE_URL ? process.env.SUPABASE_URL.trim() : undefined;
const supabaseKey = process.env.SUPABASE_KEY ? process.env.SUPABASE_KEY.trim() : undefined;
const useSupabase = !!(supabaseUrl && supabaseKey);
const supabase = useSupabase ? createClient(supabaseUrl, supabaseKey) : null;

if (useSupabase) {
  console.log("Database Mode: Remote Supabase Connection Active");
} else {
  console.log("Database Mode: Local JSON File Fallback Active");

  // Only initialize local JSON storage when Supabase is NOT configured.
  // On Vercel and similar serverless platforms, the project root is read-only,
  // so we must skip all local FS writes when useSupabase is true.
  const dataDir = path.dirname(DB_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDatabase, null, 2), 'utf-8');
  }
}

module.exports = {
  getCollection: async (name) => {
    if (useSupabase) {
      let query = supabase.from(name).select('*');
      if (name === 'orders') {
        query = query.order('createdAt', { ascending: false });
      }
      const { data, error } = await query;
      if (error) {
        console.error(`Supabase error fetching ${name}:`, error);
        throw error;
      }
      if (name === 'products' && data) {
        return data.map(p => {
          const isSoldOut = p.image && p.image.endsWith('_soldout');
          return {
            ...p,
            soldOut: isSoldOut,
            image: isSoldOut ? p.image.replace(/_soldout$/, '') : p.image
          };
        });
      }
      return data || [];
    } else {
      const db = readDB();
      const list = db[name] || [];
      if (name === 'products') {
        return list.map(p => {
          const isSoldOut = p.image && p.image.endsWith('_soldout');
          return {
            ...p,
            soldOut: isSoldOut || !!p.soldOut,
            image: isSoldOut ? p.image.replace(/_soldout$/, '') : p.image
          };
        });
      }
      return list;
    }
  },

  saveCollection: async (name, items) => {
    if (useSupabase) {
      const { error } = await supabase.from(name).upsert(items);
      if (error) {
        console.error(`Supabase error saving collection ${name}:`, error);
        return false;
      }
      return true;
    } else {
      const db = readDB();
      db[name] = items;
      return writeDB(db);
    }
  },

  getSettings: async () => {
    if (useSupabase) {
      const { data, error } = await supabase.from('settings').select('*').eq('id', 1).maybeSingle();
      if (error) {
        console.error("Supabase error fetching settings:", error);
        return defaultDatabase.settings;
      }
      return data || defaultDatabase.settings;
    } else {
      const db = readDB();
      return db.settings || defaultDatabase.settings;
    }
  },

  saveSettings: async (settings) => {
    if (useSupabase) {
      const { error } = await supabase.from('settings').upsert({ id: 1, ...settings });
      if (error) {
        console.error("Supabase error saving settings:", error);
        return false;
      }
      return true;
    } else {
      const db = readDB();
      db.settings = { ...db.settings, ...settings };
      return writeDB(db);
    }
  },

  updateProduct: async (product) => {
    const isSoldOut = !!product.soldOut;
    let imageEncoded = product.image || product.id;
    if (isSoldOut && !imageEncoded.endsWith('_soldout')) {
      imageEncoded = imageEncoded + '_soldout';
    } else if (!isSoldOut && imageEncoded.endsWith('_soldout')) {
      imageEncoded = imageEncoded.replace(/_soldout$/, '');
    }

    if (useSupabase) {
      const productToSave = {
        id: product.id,
        name: product.name,
        category: product.category,
        description: product.description || "",
        freshnessInfo: product.freshnessInfo || "",
        storageInstructions: product.storageInstructions || "",
        price: Number(product.price),
        baseWeight: product.baseWeight,
        weightOptions: product.weightOptions,
        popular: !!product.popular,
        image: imageEncoded
      };
      const { data, error } = await supabase.from('products').upsert(productToSave).select().single();
      if (error) {
        console.error("Supabase error updating product:", error);
        return null;
      }
      return {
        ...data,
        soldOut: isSoldOut,
        image: isSoldOut ? data.image.replace(/_soldout$/, '') : data.image
      };
    } else {
      const db = readDB();
      const productToSave = {
        ...product,
        image: imageEncoded,
        soldOut: isSoldOut
      };
      const index = db.products.findIndex(p => p.id === product.id);
      if (index !== -1) {
        db.products[index] = productToSave;
      } else {
        db.products.push(productToSave);
      }
      if (writeDB(db)) {
        return {
          ...productToSave,
          soldOut: isSoldOut,
          image: isSoldOut ? productToSave.image.replace(/_soldout$/, '') : productToSave.image
        };
      }
      return null;
    }
  },

  deleteProduct: async (id) => {
    if (useSupabase) {
      // Note: Use .select() to force Supabase JS client v2 to resolve the promise
      // Without it, the delete call can hang indefinitely in some environments
      const { error, data } = await supabase
        .from('products')
        .delete()
        .eq('id', id)
        .select('id');
      if (error) {
        console.error("Supabase error deleting product:", error);
        return false;
      }
      // data will be an array of deleted rows, or empty if not found
      return true;
    } else {
      const db = readDB();
      const filtered = db.products.filter(p => p.id !== id);
      if (filtered.length !== db.products.length) {
        db.products = filtered;
        return writeDB(db);
      }
      return false;
    }
  },

  getOrdersPaginated: async (limit, offset) => {
    if (useSupabase) {
      const { data, error, count } = await supabase
        .from('orders')
        .select('*', { count: 'exact' })
        .order('createdAt', { ascending: false })
        .range(offset, offset + limit - 1);
      if (error) {
        console.error("Supabase error fetching paginated orders:", error);
        throw error;
      }
      return { orders: data || [], total: count || 0 };
    } else {
      const db = readDB();
      const list = db.orders || [];
      const sliced = list.slice(offset, offset + limit);
      return { orders: sliced, total: list.length };
    }
  },

  addOrder: async (order) => {
    if (useSupabase) {
      const { deliveryPincode, ...supabaseOrder } = order;
      if (deliveryPincode && !supabaseOrder.deliveryAddress.includes(deliveryPincode)) {
        supabaseOrder.deliveryAddress = `${supabaseOrder.deliveryAddress} - ${deliveryPincode}`;
      }
      const { error } = await supabase.from('orders').insert(supabaseOrder);
      if (error) {
        console.error("Supabase error adding order:", error);
        return null;
      }
      return order;
    } else {
      const db = readDB();
      db.orders.unshift(order);
      if (writeDB(db)) {
        return order;
      }
      return null;
    }
  },

  updateOrderStatus: async (orderId, status) => {
    if (useSupabase) {
      const { data, error } = await supabase.from('orders').update({ status }).eq('id', orderId).select().single();
      if (error) {
        console.error("Supabase error updating order status:", error);
        return null;
      }
      return data;
    } else {
      const db = readDB();
      const order = db.orders.find(o => o.id === orderId);
      if (order) {
        order.status = status;
        writeDB(db);
        return order;
      }
      return null;
    }
  },

  // Persist the "read" flag permanently in the database
  updateOrderRead: async (orderId, isRead = true) => {
    if (useSupabase) {
      const { data, error } = await supabase
        .from('orders')
        .update({ isRead })
        .eq('id', orderId)
        .select()
        .single();
      if (error) {
        console.error("Supabase error marking order as read:", error);
        return false;
      }
      return true;
    } else {
      const db = readDB();
      const order = db.orders.find(o => o.id === orderId);
      if (order) {
        order.isRead = isRead;
        return writeDB(db);
      }
      return false;
    }
  },

  savePaymentMapping: async (razorpayOrderId, orderId, extraData = {}) => {
    const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
    const filePath = isVercel ? path.join('/tmp', 'payment_mappings.json') : path.join(__dirname, 'data', 'payment_mappings.json');
    try {
      let mappings = {};
      try {
        if (fs.existsSync(filePath)) {
          mappings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } else {
          mappings = { ...inMemoryPaymentMappings };
        }
      } catch (readErr) {
        mappings = { ...inMemoryPaymentMappings };
      }
      
      mappings[razorpayOrderId] = {
        orderId,
        createdAt: new Date().toISOString(),
        ...extraData
      };
      
      inMemoryPaymentMappings = mappings;

      const dataDir = path.dirname(filePath);
      try {
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }
        fs.writeFileSync(filePath, JSON.stringify(mappings, null, 2));
      } catch (writeErr) {
        console.warn("Error writing payment mapping to file, using in-memory:", writeErr.message);
      }
      return true;
    } catch (err) {
      console.error("Error saving payment mapping:", err);
      return false;
    }
  },

  getPaymentMapping: async (razorpayOrderId) => {
    const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
    const filePath = isVercel ? path.join('/tmp', 'payment_mappings.json') : path.join(__dirname, 'data', 'payment_mappings.json');
    try {
      if (fs.existsSync(filePath)) {
        const mappings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        return mappings[razorpayOrderId] || inMemoryPaymentMappings[razorpayOrderId] || null;
      }
    } catch (err) {
      console.error("Error reading payment mapping:", err);
    }
    return inMemoryPaymentMappings[razorpayOrderId] || null;
  },

  getPaymentMappingByOrderId: async (orderId) => {
    const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
    const filePath = isVercel ? path.join('/tmp', 'payment_mappings.json') : path.join(__dirname, 'data', 'payment_mappings.json');
    try {
      let mappings = {};
      try {
        if (fs.existsSync(filePath)) {
          mappings = JSON.parse(fs.readFileSync(filePath, 'utf8'));
        } else {
          mappings = { ...inMemoryPaymentMappings };
        }
      } catch (readErr) {
        mappings = { ...inMemoryPaymentMappings };
      }
      const rzpOrderId = Object.keys(mappings).find(key => mappings[key].orderId === orderId);
      return rzpOrderId ? mappings[rzpOrderId] : null;
    } catch (err) {
      console.error("Error retrieving mapping by order ID:", err);
    }
    const rzpOrderId = Object.keys(inMemoryPaymentMappings).find(key => inMemoryPaymentMappings[key].orderId === orderId);
    return rzpOrderId ? inMemoryPaymentMappings[rzpOrderId] : null;
  },

  uploadProductImage: async (filename, buffer, mimeType) => {
    if (useSupabase) {
      // Ensure 'product-images' bucket exists
      const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
      if (!bucketsError && !buckets.find(b => b.name === 'product-images')) {
        await supabase.storage.createBucket('product-images', {
          public: true
        });
      }

      const { data, error } = await supabase.storage
        .from('product-images')
        .upload(filename, buffer, {
          contentType: mimeType,
          upsert: true
        });

      if (error) {
        console.error("Supabase Storage upload error:", error);
        throw error;
      }

      const { data: publicUrlData } = supabase.storage
        .from('product-images')
        .getPublicUrl(filename);

      return publicUrlData.publicUrl;
    } else {
      const uploadDir = path.join(__dirname, 'public', 'assets', 'uploaded_products');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      const filepath = path.join(uploadDir, filename);
      fs.writeFileSync(filepath, buffer);
      return `/assets/uploaded_products/${filename}`;
    }
  },

  // Browser Push Notification Subscriptions
  savePushSubscription: async (subscription) => {
    if (!subscription || !subscription.endpoint) return false;
    if (useSupabase) {
      const { error } = await supabase
        .from('pushSubscriptions')
        .upsert(subscription, { onConflict: 'endpoint' });
      if (error) {
        console.error("Supabase error saving push subscription:", error);
        return false;
      }
      return true;
    } else {
      const db = readDB();
      if (!db.pushSubscriptions) db.pushSubscriptions = [];
      const index = db.pushSubscriptions.findIndex(s => s.endpoint === subscription.endpoint);
      if (index !== -1) {
        db.pushSubscriptions[index] = subscription;
      } else {
        db.pushSubscriptions.push(subscription);
      }
      return writeDB(db);
    }
  },

  getPushSubscriptions: async () => {
    if (useSupabase) {
      const { data, error } = await supabase.from('pushSubscriptions').select('*');
      if (error) {
        console.error("Supabase error fetching push subscriptions:", error);
        return [];
      }
      return data || [];
    } else {
      const db = readDB();
      return db.pushSubscriptions || [];
    }
  },

  deletePushSubscription: async (endpoint) => {
    if (!endpoint) return false;
    if (useSupabase) {
      const { error } = await supabase.from('pushSubscriptions').delete().eq('endpoint', endpoint);
      if (error) {
        console.error("Supabase error deleting push subscription:", error);
        return false;
      }
      return true;
    } else {
      const db = readDB();
      if (!db.pushSubscriptions) return true;
      db.pushSubscriptions = db.pushSubscriptions.filter(s => s.endpoint !== endpoint);
      return writeDB(db);
    }
  }
};
