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

    // 💰 Payment succeeded — mark as paid, decrement stock, send email
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
          // ✅ Decrement inventory for each item purchased
          for (const item of orderItems) {
            const { error: stockError } = await supabase.rpc("decrement_stock", {
              p_product_id: item.product_id,
              p_size: item.size,
              p_color: item.color,
              p_quantity: item.quantity,
            });

            if (stockError) {
              console.error("❌ Stock decrement error:", stockError);
            } else {
              console.log(`📦 Stock decremented for ${item.product_name} (${item.size}, ${item.color})`);
            }
          }

          await sendConfirmationEmail(updatedOrder, orderItems);
        }
      }
    }

    // ❌ Payment failed — update existing row to 'failed'
    if (event.type === "payment.failed") {
      const checkoutId = event.payload?.metadata?.checkoutId; // or event.payload?.id;
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
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f7f4; padding: 40px 16px;">
          <tr>
            <td align="center">
              <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0,0,0,0.06);">
                <tr>
                  <td style="background-color: #2d6a4f; padding: 40px 48px; text-align: center;">
                    <p style="margin: 0 0 8px 0; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; color: #95d5b2;">Order Confirmed</p>
                    <h1 style="margin: 0; font-size: 32px; font-weight: 400; color: #ffffff; letter-spacing: 1px;">Verde Atelier</h1>
                    <div style="margin: 20px auto 0; width: 40px; height: 2px; background-color: #95d5b2;"></div>
                  </td>
                </tr>
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
                <tr>
                  <td style="padding: 40px 48px;">
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
                <tr>
                  <td style="background-color: #2d6a4f; padding: 32px 48px; text-align: center;">
                    <p style="margin: 0 0 8px; font-size: 13px; color: #d8f3dc; line-height: 1.6;">
                      Questions about your order?
                    </p>
                    <p style="margin: 0; font-size: 13px; color: #95d5b2;">
                      karabohlabangane@gmail.com
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

// ✅ AI recommendation route
app.post("/api/recommend", async (req, res) => {
  const { messages, products, orderStats } = req.body;

  const systemPrompt = `
You are a helpful shopping assistant for Verde Atelier, a high-end sustainable fashion store.
Your job is to recommend products to customers based on what they're looking for.

Here is the full product catalogue:
${JSON.stringify(products, null, 2)}

Here is real sales data showing how many times each product has been ordered (use this to identify what's popular):
${JSON.stringify(orderStats, null, 2)}

Rules:
- Only recommend products that exist in the catalogue above
- When recommending a product, always mention its name, price (in Rands), and one or two reasons why it suits the customer
- If a product is popular in the sales data, mention that customers love it
- Keep responses friendly, concise, and helpful
- If the customer's request is vague, ask one clarifying question
- Never make up products that aren't in the catalogue
- Format recommendations clearly, one product per line
`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.FRONTEND_URL,
        "X-Title": "Verde Atelier",
      },
      body: JSON.stringify({
        model: "poolside/laguna-m.1:free",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ OpenRouter error:", data);
      return res.status(500).json({ error: "AI service unavailable" });
    }

    const reply = data.choices?.[0]?.message?.content;
    res.json({ reply });

  } catch (error) {
    console.error("❌ Recommend route error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Admin — fetch all orders + items
app.post("/api/admin/data", async (req, res) => {
  const { token } = req.body;

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (ordersError) return res.status(500).json({ error: "Could not fetch orders" });

  const { data: orderItems, error: itemsError } = await supabase
    .from("order_items")
    .select("*");

  if (itemsError) return res.status(500).json({ error: "Could not fetch order items" });

  res.json({ orders, orderItems });
});

// ✅ Admin — AI business analyst
app.post("/api/admin/analyse", async (req, res) => {
  const { token, messages, orders, orderItems } = req.body;

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const systemPrompt = `
You are a business analyst AI for Verde Atelier, a high-end sustainable fashion store.
You have access to the store's complete order data.

Here are all orders:
${JSON.stringify(orders, null, 2)}

Here are all order items:
${JSON.stringify(orderItems, null, 2)}

Your job is to help the store owner understand their business. You can:
- Calculate total revenue (amounts are in cents, divide by 100 for Rands)
- Identify best selling products
- Spot trends in orders over time
- Break down orders by status (paid, pending, failed)
- Answer any business question about the data above

Be concise, use Rands (R) for all amounts, and format numbers clearly.
If asked something unrelated to the business data, politely redirect.
`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.FRONTEND_URL,
        "X-Title": "Verde Atelier Admin",
      },
      body: JSON.stringify({
        model: "poolside/laguna-m.1:free",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ OpenRouter error:", data);
      return res.status(500).json({ error: "AI service unavailable" });
    }

    const reply = data.choices?.[0]?.message?.content;
    res.json({ reply });

  } catch (error) {
    console.error("❌ Analyse route error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ✅ Admin — fetch inventory
app.post("/api/admin/inventory", async (req, res) => {
  const { token } = req.body;

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { data, error } = await supabase
    .from("inventory")
    .select("*")
    .order("product_id");

  if (error) return res.status(500).json({ error: "Could not fetch inventory" });

  res.json({ inventory: data });
});

// ✅ Admin — update a single inventory row
app.post("/api/admin/inventory/update", async (req, res) => {
  const { token, id, quantity } = req.body;

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { error } = await supabase
    .from("inventory")
    .update({ quantity })
    .eq("id", id);

  if (error) return res.status(500).json({ error: "Could not update stock" });

  res.json({ success: true });
});

// ✅ Admin — add a new inventory row
app.post("/api/admin/inventory/add", async (req, res) => {
  const { token, product_id, size, color, quantity } = req.body;

  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { error } = await supabase
    .from("inventory")
    .upsert({ product_id, size, color, quantity }, { onConflict: "product_id,size,color" });

  if (error) return res.status(500).json({ error: "Could not add stock" });

  res.json({ success: true });
});

// ✅ WhatsApp webhook verification (Meta calls this once to confirm the URL is yours)
app.get("/api/whatsapp/webhook", (req, res) => {
  const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("✅ WhatsApp webhook verified");
    res.status(200).send(challenge);
  } else {
    console.log("❌ WhatsApp webhook verification failed");
    res.sendStatus(403);
  }
});

// ✅ WhatsApp webhook — receives incoming messages
app.post("/api/whatsapp/webhook", async (req, res) => {
  const body = req.body;

  // Always respond 200 quickly so Meta doesn't retry
  res.sendStatus(200);

  try {
    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const message = change?.value?.messages?.[0];

    if (!message) return; // not a message event (could be a status update)

    const from = message.from; // customer's WhatsApp number
    const text = message.text?.body;

    console.log(`📲 WhatsApp message from ${from}: ${text}`);

    // We'll build the actual bot logic in the next step
    // For now, just log it to confirm the webhook works

  } catch (error) {
    console.error("❌ WhatsApp webhook error:", error);
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));