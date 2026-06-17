const http = require('http');

function makeRequest(options, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve({ statusCode: res.statusCode, body: JSON.parse(data) });
        } catch (e) {
          resolve({ statusCode: res.statusCode, body: data });
        }
      });
    });
    req.on('error', reject);
    if (body) {
      req.write(typeof body === 'string' ? body : JSON.stringify(body));
    }
    req.end();
  });
}

async function test() {
  console.log("=== Testing Real Razorpay Order Creation ===");

  const orderPayload = {
    customerName: "Real Razorpay Tester",
    customerPhone: "9876543210",
    customerEmail: "real-razorpay@example.com",
    deliveryAddress: "Real Address",
    landmark: "Real Landmark",
    deliverySlot: "Morning (8 AM - 11 AM)",
    paymentMethod: "Online Payment",
    items: [
      {
        productId: "onion-diced",
        weight: "250g",
        quantity: 1
      }
    ]
  };

  const createRes = await makeRequest({
    hostname: 'localhost',
    port: 3000,
    path: '/api/orders',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  }, orderPayload);

  console.log("Order creation response status:", createRes.statusCode);
  console.log("Order creation response body:", createRes.body);

  if (createRes.statusCode === 200 && createRes.body.success) {
    const { razorpayOrderId } = createRes.body;
    console.log(`Successfully generated Razorpay Order ID: ${razorpayOrderId}`);
    if (razorpayOrderId && razorpayOrderId.startsWith('order_')) {
      console.log("Check: Valid Razorpay order ID format.");
      if (razorpayOrderId.startsWith('order_sim_')) {
        console.error("Test failed: Returned a simulated order ID instead of a real Razorpay API order ID!");
      } else {
        console.log("Test passed: Contacted Razorpay API successfully and returned a real order ID!");
      }
    }
  } else {
    console.error("Failed to create order on server!");
  }
}

test();
