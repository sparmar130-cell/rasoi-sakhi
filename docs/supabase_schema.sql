-- ==========================================
-- RASOI SAKHI - DATABASE SCHEMA FOR SUPABASE
-- Run this in the Supabase SQL Editor
-- ==========================================

-- 1. Create 'settings' table
CREATE TABLE IF NOT EXISTS settings (
  id INT8 PRIMARY KEY,
  "googleSheetsWebhookUrl" TEXT DEFAULT '',
  "whatsappNumber" TEXT DEFAULT '919876543210',
  "deliveryCharge" NUMERIC DEFAULT 30,
  "freeDeliveryThreshold" NUMERIC DEFAULT 299,
  "allowedPincodes" TEXT DEFAULT '392011'
);

-- 2. Create 'users' table (Admin access)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "createdAt" TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Create 'products' table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT DEFAULT '',
  "freshnessInfo" TEXT DEFAULT '',
  "storageInstructions" TEXT DEFAULT '',
  price NUMERIC DEFAULT 0,
  "baseWeight" TEXT DEFAULT '',
  "weightOptions" JSONB DEFAULT '[]'::jsonb,
  image TEXT DEFAULT '',
  popular BOOLEAN DEFAULT false
);

-- 4. Create 'orders' table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  "customerName" TEXT NOT NULL,
  "customerPhone" TEXT NOT NULL,
  "customerEmail" TEXT DEFAULT '',
  "customerAddress" TEXT NOT NULL,
  "customerLandmark" TEXT DEFAULT '',
  items JSONB DEFAULT '[]'::jsonb,
  "subtotalAmount" NUMERIC DEFAULT 0,
  "deliveryAmount" NUMERIC DEFAULT 0,
  "totalAmount" NUMERIC DEFAULT 0,
  "paymentMethod" TEXT DEFAULT 'COD',
  "deliverySlot" TEXT DEFAULT '',
  status TEXT DEFAULT 'Payment Pending',
  "createdAt" TIMESTAMPTZ DEFAULT NOW(),
  "isRead" BOOLEAN DEFAULT false
);

-- 5. Create 'testimonials' table
CREATE TABLE IF NOT EXISTS testimonials (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT DEFAULT '',
  quote TEXT DEFAULT '',
  rating INT8 DEFAULT 5
);

-- 6. Create 'payment_mappings' table (Razorpay Order-to-Local Order mappings)
CREATE TABLE IF NOT EXISTS payment_mappings (
  razorpay_order_id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Create 'pushSubscriptions' table (camelCase)
CREATE TABLE IF NOT EXISTS "pushSubscriptions" (
  endpoint TEXT PRIMARY KEY,
  "expirationTime" TEXT,
  keys JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Create 'contact_messages' table
CREATE TABLE IF NOT EXISTS contact_messages (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  message TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  is_resolved BOOLEAN DEFAULT false
);
