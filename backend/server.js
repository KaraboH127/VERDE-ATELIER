// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors());

// Step 1 of the new flow: React calls this to create a checkout session
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
        // Where Yoco sends the customer AFTER payment
        successUrl: `${process.env.FRONTEND_URL}/order-success`,
        cancelUrl: `${process.env.FRONTEND_URL}/checkout`,
        failureUrl: `${process.env.FRONTEND_URL}/checkout?payment=failed`,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(400).json({ error: data.displayMessage || "Could not create checkout" });
    }

    // Send the redirectUrl back to React
    res.json({ redirectUrl: data.redirectUrl, checkoutId: data.id });
  } catch (error) {
    console.error("Create checkout error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// Step 2: Yoco calls THIS endpoint after payment (webhook)
// You use this to confirm payment actually succeeded before fulfilling the order
app.post("/api/webhook", express.raw({ type: "application/json" }), (req, res) => {
  const event = JSON.parse(req.body);

  console.log("Webhook received:", event.type);

  if (event.type === "payment.succeeded") {
    // TODO: mark order as paid in your database
    console.log("Payment succeeded for checkout:", event.payload?.metadata);
  }

  res.sendStatus(200); // Always respond 200 so Yoco knows you got it
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));