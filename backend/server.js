// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto"; // ← new import

dotenv.config();

const app = express();
app.use(cors());
// ← express.json() is NOT here anymore

// ✅ Webhook route FIRST (needs raw body)
app.post(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  (req, res) => {
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

    if (event.type === "payment.succeeded") {
      console.log("💰 Payment succeeded:", event.payload?.metadata);
    }

    if (event.type === "payment.failed") {
      console.log("❌ Payment failed:", event.payload);
    }

    res.sendStatus(200);
  }
);

// ✅ Now express.json() applies to everything below
app.use(express.json());

// Step 1: create checkout (unchanged)
app.post("/api/create-checkout", async (req, res) => {
  const { amountInCents } = req.body;

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

    res.json({ redirectUrl: data.redirectUrl, checkoutId: data.id });
  } catch (error) {
    console.error("Create checkout error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));