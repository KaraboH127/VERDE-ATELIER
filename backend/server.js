// backend/server.js

import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(express.json());
app.use(cors()); // allows your React app to call this server

// This is the route React will POST to after getting the Yoco token
app.post("/api/charge", async (req, res) => {
  const { token, amountInCents } = req.body;
  // token   = the one-time token Yoco gave to your React app
  // amountInCents = e.g. 15000 means R150.00

  try {
    const response = await fetch("https://payments.yoco.com/api/checkouts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        // This is your SECRET key — safe here on the server, never in React
        Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}`,
      },
      body: JSON.stringify({
        amount: amountInCents,
        currency: "ZAR",
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      // Yoco rejected the payment
      return res.status(400).json({ error: data.message || "Payment failed" });
    }

    // Payment succeeded — tell React
    res.json({ success: true, data });
  } catch (error) {
    console.error("Charge error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));