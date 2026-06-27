// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

dotenv.config();

const app = express();
app.use(cors());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// ✅ Webhook route FIRST (needs raw body)
app.post(
  "/api/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
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

// 💰 Payment succeeded — mark as paid then send confirmation email
if (event.type === "payment.succeeded") {
  const checkoutId = event.payload?.metadata?.checkoutId;
  console.log("💰 Payment succeeded for checkoutId:", checkoutId);

  // ✅ Retry up to 5 times with a 1 second delay between each attempt
  let updatedOrder = null;

  for (let attempt = 1; attempt <= 5; attempt++) {
    const { data: updatedOrders, error: updateError } = await supabase
      .from("orders")
      .update({ status: "paid" })
      .eq("yoco_order_id", checkoutId)
      .select();

    if (updateError) {
      console.error("❌ Supabase update error:", updateError);
      break;
    }

    if (updatedOrders?.length > 0) {
      updatedOrder = updatedOrders[0];
      console.log(`✅ Order marked as paid on attempt ${attempt}:`, checkoutId);
      break;
    }

    console.warn(`⏳ Attempt ${attempt}: order not found yet, retrying in 1s...`);
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }

  if (!updatedOrder) {
    console.error("❌ Order still not found after all retries:", checkoutId);
  } else {
    const { data: orderItems, error: itemsError } = await supabase
      .from("order_items")
      .select("*")
      .eq("order_id", updatedOrder.id);

    if (itemsError) {
      console.error("❌ Could not fetch order items:", itemsError);
    } else {
      await sendConfirmationEmail(updatedOrder, orderItems);
    }
  }
}

    // ❌ Payment failed — update existing row to 'failed'
    if (event.type === "payment.failed") {
      const checkoutId = event.payload?.id;
      console.log("❌ Payment failed for checkoutId:", checkoutId);

      const { error } = await supabase
        .from("orders")
        .update({ status: "failed" })
        .eq("yoco_order_id", checkoutId);

      if (error) {
        console.error("❌ Supabase update error:", error);
      } else {
        console.log("🗑️ Order marked as failed for:", checkoutId);
      }
    }

    res.sendStatus(200);
  }
);

// ✅ Now express.json() applies to everything below
app.use(express.json());

// ✅ Create checkout — saves order + items to Supabase as 'pending'
app.post("/api/create-checkout", async (req, res) => {
  const {
    amount,
    firstName,
    lastName,
    address,
    city,
    postal,
    email,
    items,
  } = req.body;

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

    // ✅ Save order row first
    const { data: newOrder, error: orderError } = await supabase
      .from("orders")
      .insert({
        first_name: firstName,
        last_name: lastName,
        address,
        city,
        postal,
        email,
        yoco_order_id: data.id,
        amount: amountInCents,
        status: "pending",
      })
      .select()
      .single();

    if (orderError) {
      console.error("❌ Supabase insert error:", orderError);
      return res.status(500).json({ error: "Could not save order" });
    }

    // ✅ Save each cart item linked to the order
    const orderItems = items.map((item) => ({
      order_id: newOrder.id,
      product_id: item.productId,
      product_name: item.product.name,
      price: Math.round(item.product.price * 100),
      quantity: item.quantity,
      line_total: Math.round(item.lineTotal * 100),
      color: item.color ?? null,
      size: item.size ?? null,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) {
      console.error("❌ Supabase order_items insert error:", itemsError);
    } else {
      console.log(`📦 Saved ${orderItems.length} item(s) for order:`, newOrder.id);
    }

    res.json({ redirectUrl: data.redirectUrl, checkoutId: data.id });

  } catch (error) {
    console.error("Create checkout error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Confirmation email helper
async function sendConfirmationEmail(order, items) {
  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">${item.product_name}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">${item.color ?? "—"}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5;">${item.size ?? "—"}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">x${item.quantity}</td>
          <td style="padding: 8px 0; border-bottom: 1px solid #e5e5e5; text-align: right;">R${(item.line_total / 100).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const { error } = await resend.emails.send({
    from: "Verde Atelier <onboarding@resend.dev>",
    to: order.email,
    subject: `Your Verde Atelier order #${order.id} is confirmed 🌿`,  // ← order ID here
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a1a;">
        <h1 style="font-size: 24px; font-weight: 600; margin-bottom: 4px;">Order confirmed</h1>
        <p style="color: #555; margin-top: 0;">Thank you, ${order.first_name}. Your order has been received.</p>

        <p style="font-size: 13px; color: #888; margin-top: 0;">
          Order reference: <strong style="color: #1a1a1a;">#${order.id}</strong>
        </p>

        <h2 style="font-size: 16px; font-weight: 600; margin-top: 32px;">Shipping to</h2>
        <p style="color: #555; line-height: 1.6; margin: 0;">
          ${order.first_name} ${order.last_name}<br/>
          ${order.address}<br/>
          ${order.city}, ${order.postal}
        </p>

        <h2 style="font-size: 16px; font-weight: 600; margin-top: 32px;">Order summary</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="color: #888;">
              <th style="text-align: left; padding-bottom: 8px;">Product</th>
              <th style="text-align: left; padding-bottom: 8px;">Colour</th>
              <th style="text-align: left; padding-bottom: 8px;">Size</th>
              <th style="text-align: right; padding-bottom: 8px;">Qty</th>
              <th style="text-align: right; padding-bottom: 8px;">Total</th>
            </tr>
          </thead>
          <tbody>${itemRows}</tbody>
        </table>

        <div style="margin-top: 16px; text-align: right; font-size: 15px; font-weight: 600;">
          Order total: R${(order.amount / 100).toFixed(2)}
        </div>

        <p style="margin-top: 40px; font-size: 13px; color: #888;">
          If you have any questions, reply to this email or contact us at support@yourdomain.com
        </p>
      </div>
    `,
  });

  if (error) {
    console.error("❌ Resend email error:", error);
  } else {
    console.log("📧 Confirmation email sent to:", order.email);
  }
}

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));