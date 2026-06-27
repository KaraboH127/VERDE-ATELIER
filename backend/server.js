// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js"; // ← new

dotenv.config();

const app = express();
app.use(cors());

// ✅ Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ✅ Temporary store for shipping details while customer is paying
const pendingOrders = {};

// ✅ Webhook route FIRST (needs raw body)
app.post(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => { // ← added async
    const secret = process.env.YOCO_WEBHOOK_SECRET;
    const signature = req.headers["x-yoco-signature"];

    if (secret && signature) {
      const expected = crypto
        .createHmac("sha256", secret)
        .update(req.body)
        .digest("hex");

      if (signature !== expected) {
        console.log("❌ Invalid webhook signature");
        return res.status(401).send("Invalid signature");
      }
    }

    const event = JSON.parse(req.body.toString());
    console.log("✅ Webhook received:", event.type);

    // 💰 Payment succeeded — save to Supabase
    if (event.type === "payment.succeeded") {
      console.log("💰 Payment succeeded:", event.payload?.metadata);

      const checkoutId = event.payload?.id;
      const shipping = pendingOrders[checkoutId];

      if (shipping) {
        const { error } = await supabase.from("orders").insert({
          first_name: shipping.firstName,
          last_name: shipping.lastName,
          address: shipping.address,
          city: shipping.city,
          postal: shipping.postal,
          email: shipping.email,
          yoco_order_id: checkoutId,
          amount: shipping.amount,
        });

        if (error) {
          console.error("❌ Supabase insert error:", error);
        } else {
          console.log("✅ Order saved to Supabase for:", shipping.email);
        }

        // Clean up — no longer needed in memory
        delete pendingOrders[checkoutId];
      } else {
        console.warn("⚠️ No shipping details found for checkoutId:", checkoutId);
      }
    }

    if (event.type === "payment.failed") {
      console.log("❌ Payment failed:", event.payload);
    }

    res.sendStatus(200);
  }
);

// ✅ Now express.json() applies to everything below
app.use(express.json());

// ✅ Create checkout — now also stores shipping details
app.post("/api/create-checkout", async (req, res) => {
  const { amount, currency, firstName, lastName, address, city, postal, email } = req.body;

  const amountInCents = amount * 100;

  try {
    const response = await fetch("https://payments.yoco.com/api/checkouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}`,
      },
      body: JSON.stringify({
        amount: amountInCents,
        currency: "ZAR",
        successUrl: `${process.env.FRONTEND_URL}/order-success`,
        cancelUrl: `${process.env.FRONTEND_URL}/checkout`,
        failureUrl: `${process.env.FRONTEND_URL}/checkout?payment=failed`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: data.displayMessage || "Could not create checkout" });
    }

    // ✅ Store shipping details using Yoco's checkout ID as the key
    pendingOrders[data.id] = {
      firstName,
      lastName,
      address,
      city,
      postal,
      email,
      amount: amountInCents, // storing in cents, consistent with Yoco
    };

    console.log("📦 Shipping details stored for checkoutId:", data.id);

    res.json({ redirectUrl: data.redirectUrl, checkoutId: data.id });
  } catch (error) {
    console.error("Create checkout error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));