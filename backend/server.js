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
          <td style="padding: 12px 8px; border-bottom: 1px solid #e8f0e8;">
            <span style="font-weight: 500; color: #1a1a1a;">${item.product_name}</span>
          </td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e8f0e8; color: #555;">${item.color ?? "—"}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e8f0e8; color: #555;">${item.size ?? "—"}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e8f0e8; color: #555; text-align: center;">x${item.quantity}</td>
          <td style="padding: 12px 8px; border-bottom: 1px solid #e8f0e8; color: #1a1a1a; text-align: right; font-weight: 500;">R${(item.line_total / 100).toFixed(2)}</td>
        </tr>`
    )
    .join("");

  const { error } = await resend.emails.send({
    from: "Verde Atelier <onboarding@resend.dev>",
    to: order.email,
    subject: `Your Verde Atelier order #${order.id} is confirmed 🌿`,
    html: `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Order Confirmed</title>
      </head>
      <body style="margin: 0; padding: 0; background-color: #f4f7f4; font-family: 'Georgia', serif;">

        <!-- Wrapper -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f4; padding: 40px 16px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">

                <!-- Header -->
                <tr>
                  <td style="background-color: #2d6a4f; padding: 40px 48px; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #95d5b2;">Order Confirmed</p>
                    <h1 style="margin: 0; font-size: 32px; font-weight: 400; color: #ffffff; letter-spacing: 1px;">Verde Atelier</h1>
                    <div style="margin: 20px auto 0; width: 40px; height: 2px; background-color: #95d5b2;"></div>
                  </td>
                </tr>

                <!-- Thank you banner -->
                <tr>
                  <td style="background-color: #d8f3dc; padding: 24px 48px; text-align: center;">
                    <p style="margin: 0; font-size: 15px; color: #2d6a4f; line-height: 1.6;">
                      Thank you, <strong>${order.first_name}</strong>. Your order has been received and is being prepared.
                    </p>
                    <p style="margin: 8px 0 0; font-size: 13px; color: #52796f;">
                      Order reference: <strong>#${order.id}</strong>
                    </p>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="padding: 40px 48px;">

                    <!-- Shipping details -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 36px;">
                      <tr>
                        <td>
                          <p style="margin: 0 0 12px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #2d6a4f; font-family: sans-serif;">Shipping To</p>
                          <div style="background-color: #f4f7f4; border-left: 3px solid #2d6a4f; border-radius: 4px; padding: 16px 20px;">
                            <p style="margin: 0; font-size: 15px; color: #1a1a1a; line-height: 1.8; font-family: sans-serif;">
                              ${order.first_name} ${order.last_name}<br/>
                              ${order.address}<br/>
                              ${order.city}, ${order.postal}
                            </p>
                          </div>
                        </td>
                      </tr>
                    </table>

                    <!-- Order items -->
                    <p style="margin: 0 0 12px; font-size: 11px; letter-spacing: 2px; text-transform: uppercase; color: #2d6a4f; font-family: sans-serif;">Order Summary</p>
                    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-family: sans-serif;">
                      <thead>
                        <tr style="background-color: #f4f7f4;">
                          <th style="padding: 10px 8px; text-align: left; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #52796f; font-weight: 600;">Product</th>
                          <th style="padding: 10px 8px; text-align: left; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #52796f; font-weight: 600;">Colour</th>
                          <th style="padding: 10px 8px; text-align: left; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #52796f; font-weight: 600;">Size</th>
                          <th style="padding: 10px 8px; text-align: center; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #52796f; font-weight: 600;">Qty</th>
                          <th style="padding: 10px 8px; text-align: right; font-size: 11px; letter-spacing: 1px; text-transform: uppercase; color: #52796f; font-weight: 600;">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${itemRows}
                      </tbody>
                    </table>

                    <!-- Order total -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 8px; font-family: sans-serif;">
                      <tr>
                        <td style="padding: 16px 8px; text-align: right; border-top: 2px solid #2d6a4f;">
                          <span style="font-size: 15px; font-weight: 700; color: #2d6a4f;">
                            Order Total: R${(order.amount / 100).toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    </table>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background-color: #2d6a4f; padding: 32px 48px; text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 13px; color: #d8f3dc; line-height: 1.6;">
                      Questions about your order?
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #95d5b2;">
                      support@verdeatelier.com
                    </p>
                    <div style="margin: 20px auto; width: 40px; height: 1px; background-color: #52796f;"></div>
                    <p style="margin: 0; font-size: 11px; color: #52796f; letter-spacing: 1px; text-transform: uppercase;">
                      Verde Atelier &mdash; Thoughtfully made
                    </p>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>

      </body>
      </html>
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