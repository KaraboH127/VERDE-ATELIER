// backend/server.js
import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import twilio from "twilio";

dotenv.config();

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const app = express();
app.use(cors());

// ── Yoco webhook FIRST (needs raw body) ───────────────────────
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

    // 💰 Payment succeeded
    if (event.type === "payment.succeeded") {
      const checkoutId = event.payload?.metadata?.checkoutId; // ✅ fixed — was event.payload?.id
      console.log("💰 Payment succeeded for checkoutId:", checkoutId);

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
        const { data: paidOrderItems, error: itemsError } = await supabase
          .from("order_items")
          .select("*")
          .eq("order_id", updatedOrder.id);

        if (itemsError) {
          console.error("❌ Could not fetch order items:", itemsError);
        } else {
          // ✅ Decrement inventory for each item
          for (const item of paidOrderItems) {
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

          // ✅ Send confirmation email
          await sendConfirmationEmail(updatedOrder, paidOrderItems);

          // ✅ Send WhatsApp order slip if this order came from WhatsApp
          // ✅ Fixed — renamed variable to avoid collision with paidOrderItems above
          const { data: whatsappSession } = await supabase
            .from("whatsapp_sessions")
            .select("*")
            .eq("data->>yocoId", checkoutId)
            .single();

            if (whatsappSession) {
            const slip = formatOrderSlip(updatedOrder, paidOrderItems);
            // ✅ Use Twilio to send the slip
            await twilioClient.messages.create({
              from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
              to: `whatsapp:${whatsappSession.phone}`,
              body: slip,
            });
            await saveSession(whatsappSession.phone, "greeting", {});
            console.log("📲 WhatsApp order slip sent to:", whatsappSession.phone);
          }
        }
      }
    }

    // ❌ Payment failed
    if (event.type === "payment.failed") {
      const checkoutId = event.payload?.metadata?.checkoutId; // ✅ fixed — was event.payload?.id
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

// ✅ express.json() applies to everything below
app.use(express.json());

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const resend = new Resend(process.env.RESEND_API_KEY);

// ── Product catalogue (kept in sync with frontend store.ts) ───
const PRODUCTS = [
  { id: "p1", name: "Aero Knit Runner", category: "Footwear", price: 190, sizes: ["7","8","9","10","11","12"], colors: ["Forest","Sand","Onyx"] },
  { id: "p2", name: "Terra Hike Shell", category: "Outdoor", price: 260, sizes: ["S","M","L","XL"], colors: ["Moss","Slate","Bone"] },
  { id: "p3", name: "Linen Flight Shirt", category: "Apparel", price: 120, sizes: ["S","M","L","XL"], colors: ["Sage","Clay","White"] },
  { id: "p4", name: "Summit Crossbody", category: "Accessories", price: 140, sizes: ["One Size"], colors: ["Olive","Black","Mist"] },
  { id: "p5", name: "Drift Wide Leg Pant", category: "Apparel", price: 170, sizes: ["XS","S","M","L"], colors: ["Stone","Deep Green","Charcoal"] },
  { id: "p6", name: "Pulse Trail Mid", category: "Footwear", price: 220, sizes: ["7","8","9","10","11","12"], colors: ["Pine","Granite","Sand"] },
  { id: "p7", name: "Studio Heavy Tee", category: "Apparel", price: 68, sizes: ["S","M","L","XL"], colors: ["Ivory","Forest","Ink"] },
  { id: "p8", name: "Atlas Weekend Duffel", category: "Accessories", price: 240, sizes: ["40L"], colors: ["Olive","Black"] },
  { id: "p9", name: "Meridian Leather Boot", category: "Footwear", price: 1350, sizes: ["7","8","9","10","11","12"], colors: ["Tan","Dark Brown","Black"] },
  { id: "p10", name: "Altitude Insulated Jacket", category: "Outdoor", price: 1800, sizes: ["S","M","L","XL"], colors: ["Forest","Slate","Black"] },
  { id: "p11", name: "Vela Structured Tote", category: "Accessories", price: 1200, sizes: ["One Size"], colors: ["Camel","Black","Forest"] },
  { id: "p12", name: "Canyon Technical Trouser", category: "Outdoor", price: 1100, sizes: ["S","M","L","XL"], colors: ["Stone","Slate","Olive"] },
  { id: "p13", name: "Grove Merino Crew", category: "Apparel", price: 380, sizes: ["S","M","L","XL"], colors: ["Sage","Oat","Charcoal"] },
  { id: "p14", name: "Field Canvas Cap", category: "Accessories", price: 85, sizes: ["One Size"], colors: ["Khaki","Olive","Black"] },
  { id: "p15", name: "Form Zip Hoodie", category: "Apparel", price: 210, sizes: ["S","M","L","XL","XXL"], colors: ["Ivory","Moss","Ink"] },
  { id: "p16", name: "Base Trail Short", category: "Outdoor", price: 145, sizes: ["S","M","L","XL"], colors: ["Pine","Sand","Black"] },
  { id: "p17", name: "Cord Slim Trouser", category: "Apparel", price: 195, sizes: ["28","30","32","34","36"], colors: ["Rust","Forest","Navy"] },
  { id: "p18", name: "Peak Softshell Vest", category: "Outdoor", price: 320, sizes: ["S","M","L","XL"], colors: ["Slate","Moss","Black"] },
];

// ── WhatsApp helpers ───────────────────────────────────────────

async function getSession(phone) {
  const { data } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .eq("phone", phone)
    .single();

  if (data) return data;

  const { data: newSession } = await supabase
    .from("whatsapp_sessions")
    .insert({ phone, step: "greeting", data: {} })
    .select()
    .single();

  return newSession;
}

async function saveSession(phone, step, data) {
  await supabase
    .from("whatsapp_sessions")
    .update({ step, data, updated_at: new Date().toISOString() })
    .eq("phone", phone);
}

async function sendWAMessage(to, text) {
  await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    }),
  });
}

async function sendButtons(to, bodyText, buttons) {
  await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: bodyText },
        action: {
          buttons: buttons.map((b, i) => ({
            type: "reply",
            reply: { id: `btn_${i}`, title: b },
          })),
        },
      },
    }),
  });
}

async function sendList(to, bodyText, buttonLabel, items) {
  await fetch(`https://graph.facebook.com/v19.0/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: bodyText },
        action: {
          button: buttonLabel.substring(0, 20), // ✅ WhatsApp 20 char limit on button label
          sections: [
            {
              title: "Options",
              rows: items.map((item, i) => ({
                id: `item_${i}`,
                title: item.title.substring(0, 24),
                description: (item.description ?? "").substring(0, 72),
              })),
            },
          ],
        },
      },
    }),
  });
}

async function aiProductMatch(userText) {
  const systemPrompt = `
You are a shopping assistant for Verde Atelier, a high-end sustainable fashion store.
The customer has typed a free-text message. Match it to the most relevant products from this list and return a JSON array of up to 3 product IDs.

Products:
${JSON.stringify(PRODUCTS.map(p => ({ id: p.id, name: p.name, category: p.category, price: p.price })))}

Respond ONLY with a JSON array of product IDs, nothing else. Example: ["p1","p3"]
If nothing matches, return an empty array: []
`;

  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.FRONTEND_URL,
        "X-Title": "Verde Atelier WhatsApp",
      },
      body: JSON.stringify({
        model: "poolside/laguna-m.1:free",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userText },
        ],
      }),
    });

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content ?? "[]";
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return [];
  }
}

async function aiFallback(userText, step) {
  try {
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.FRONTEND_URL,
        "X-Title": "Verde Atelier WhatsApp",
      },
      body: JSON.stringify({
        model: "poolside/laguna-m.1:free",
        messages: [
          {
            role: "system",
            content: `You are a friendly WhatsApp shopping assistant for Verde Atelier, a high-end sustainable fashion store. The customer is currently at step: "${step}". Respond warmly and helpfully in 1-2 short sentences, guiding them back to the conversation.`,
          },
          { role: "user", content: userText },
        ],
      }),
    });

    const data = await response.json();
    return data.choices?.[0]?.message?.content ?? "Sorry, I didn't quite get that. Could you try again? 😊";
  } catch {
    return "Sorry, I didn't quite get that. Could you try again? 😊";
  }
}

function formatOrderSlip(order, items) {
  const itemLines = items.map(i =>
    `  • ${i.product_name} (${i.size}, ${i.color}) x${i.quantity} — R${(i.line_total / 100).toFixed(2)}`
  ).join("\n");

  return (
    `✅ *Order Confirmed!*\n\n` +
    `📦 *Order #${order.id}*\n\n` +
    `*Items:*\n${itemLines}\n\n` +
    `*Total:* R${(order.amount / 100).toFixed(2)}\n\n` +
    `*Shipping to:*\n${order.first_name} ${order.last_name}\n${order.address}\n${order.city}, ${order.postal}\n\n` +
    `Thank you for shopping with Verde Atelier 🌿\nWe'll be in touch with your tracking details soon.`
  );
}

// ── Confirmation email helper ──────────────────────────────────
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

console.log("🚀 Server routes loaded — WhatsApp bot v2");
// ── Create checkout ────────────────────────────────────────────
app.post("/api/create-checkout", async (req, res) => {
  const { amount, firstName, lastName, address, city, postal, email, items } = req.body;

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

    const { error: itemsError } = await supabase.from("order_items").insert(orderItems);

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

// ── AI recommendation route ────────────────────────────────────
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
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error("❌ OpenRouter error:", data);
      return res.status(500).json({ error: "AI service unavailable" });
    }

    res.json({ reply: data.choices?.[0]?.message?.content });

  } catch (error) {
    console.error("❌ Recommend route error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin — fetch all orders + items ──────────────────────────
app.post("/api/admin/data", async (req, res) => {
  const { token } = req.body;
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { data: orders, error: ordersError } = await supabase
    .from("orders").select("*").order("created_at", { ascending: false });
  if (ordersError) return res.status(500).json({ error: "Could not fetch orders" });

  const { data: orderItems, error: itemsError } = await supabase.from("order_items").select("*");
  if (itemsError) return res.status(500).json({ error: "Could not fetch order items" });

  res.json({ orders, orderItems });
});

// ── Admin — AI business analyst ────────────────────────────────
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
        messages: [{ role: "system", content: systemPrompt }, ...messages],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      console.error("❌ OpenRouter error:", data);
      return res.status(500).json({ error: "AI service unavailable" });
    }

    res.json({ reply: data.choices?.[0]?.message?.content });

  } catch (error) {
    console.error("❌ Analyse route error:", error);
    res.status(500).json({ error: "Server error" });
  }
});

// ── Admin — fetch inventory ────────────────────────────────────
app.post("/api/admin/inventory", async (req, res) => {
  const { token } = req.body;
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { data, error } = await supabase.from("inventory").select("*").order("product_id");
  if (error) return res.status(500).json({ error: "Could not fetch inventory" });

  res.json({ inventory: data });
});

// ── Admin — update a single inventory row ─────────────────────
app.post("/api/admin/inventory/update", async (req, res) => {
  const { token, id, quantity } = req.body;
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: "Unauthorized" });

  const { error } = await supabase.from("inventory").update({ quantity }).eq("id", id);
  if (error) return res.status(500).json({ error: "Could not update stock" });

  res.json({ success: true });
});

// ── Admin — add / upsert inventory row ────────────────────────
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

// ── WhatsApp webhook verification ─────────────────────────────
app.get("/api/whatsapp/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.WHATSAPP_VERIFY_TOKEN) {
    console.log("✅ WhatsApp webhook verified");
    res.status(200).send(challenge);
  } else {
    console.log("❌ WhatsApp webhook verification failed");
    res.sendStatus(403);
  }
});

// ── WhatsApp webhook — receives incoming messages ─────────────
app.post("/api/whatsapp/webhook", express.json(), async (req, res) => {
  res.sendStatus(200);
  console.log("🟢 WHATSAPP HIT — body keys:", Object.keys(req.body || {}));
  console.log("🟢 FULL BODY:", JSON.stringify(req.body));
});

// ── Twilio WhatsApp webhook ────────────────────────────────────
app.post("/api/twilio/webhook", express.urlencoded({ extended: false }), async (req, res) => {
  // Twilio sends form data, not JSON
  const from = req.body.From?.replace("whatsapp:", ""); // e.g. +27648000276
  const text = (req.body.Body ?? "").trim();

  console.log(`📲 Twilio message from ${from}: ${text}`);

  // Helper to send a reply via Twilio
  async function reply(message) {
    await twilioClient.messages.create({
      from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
      to: `whatsapp:${from}`,
      body: message,
    });
  }

  // Always respond 200 to Twilio immediately
  res.sendStatus(200);

  try {
    const session = await getSession(from);
    const step = session.step;
    const data = session.data ?? {};

    // ── GREETING ──────────────────────────────────
    if (step === "greeting" || ["hi","hello","hey","start","menu"].includes(text.toLowerCase())) {
      await reply(
        `👋 Welcome to *Verde Atelier* — thoughtfully made fashion.\n\nI'm your personal shopping assistant.\n\nReply with a category to browse:\n\n1️⃣ Footwear\n2️⃣ Apparel\n3️⃣ Accessories\n4️⃣ Outdoor\n✨ Recommend me something\n\nOr just tell me what you're looking for!`
      );
      await saveSession(from, "browse", data);
      return;
    }

    // ── BROWSE / CATEGORY SELECTION ───────────────
    if (step === "browse") {
      const lower = text.toLowerCase();

      const categoryMap = {
        "1": "Footwear", "footwear": "Footwear",
        "2": "Apparel", "apparel": "Apparel",
        "3": "Accessories", "accessories": "Accessories",
        "4": "Outdoor", "outdoor": "Outdoor",
      };

      const matchedCategory = Object.entries(categoryMap).find(([key]) => lower === key)?.[1];

      if (matchedCategory) {
        const categoryProducts = PRODUCTS.filter(p => p.category === matchedCategory);
        const productList = categoryProducts
          .map((p, i) => `${i + 1}. ${p.name} — R${p.price}`)
          .join("\n");

        await reply(`Here's our *${matchedCategory}* collection 👇\n\n${productList}\n\nReply with the product name or number to select it.`);
        await saveSession(from, "pick_product", { ...data, category: matchedCategory, categoryProducts: categoryProducts.map(p => p.id) });
        return;
      }

      if (lower.includes("recommend") || lower.includes("✨") || lower === "5") {
        await reply("Tell me what you're looking for — budget, style, occasion, anything! 😊");
        await saveSession(from, "ai_search", data);
        return;
      }

      // Free text — use AI to match
      const matchedIds = await aiProductMatch(text);
      if (matchedIds.length > 0) {
        const matched = PRODUCTS.filter(p => matchedIds.includes(p.id));
        const productList = matched.map((p, i) => `${i + 1}. ${p.name} — R${p.price}`).join("\n");
        await reply(`Here's what I found for you 🌿\n\n${productList}\n\nReply with the product name or number to select it.`);
        await saveSession(from, "pick_product", { ...data, categoryProducts: matched.map(p => p.id) });
      } else {
        const fallback = await aiFallback(text, step);
        await reply(fallback);
      }
      return;
    }

    // ── AI SEARCH ─────────────────────────────────
    if (step === "ai_search") {
      const matchedIds = await aiProductMatch(text);
      if (matchedIds.length > 0) {
        const matched = PRODUCTS.filter(p => matchedIds.includes(p.id));
        const productList = matched.map((p, i) => `${i + 1}. ${p.name} — R${p.price}`).join("\n");
        await reply(`Here's what I'd recommend for you 🌿\n\n${productList}\n\nReply with the product name or number to select it.`);
        await saveSession(from, "pick_product", { ...data, categoryProducts: matched.map(p => p.id) });
      } else {
        await reply("Hmm, I couldn't find a match. Try browsing by category:\n\n1️⃣ Footwear\n2️⃣ Apparel\n3️⃣ Accessories\n4️⃣ Outdoor");
        await saveSession(from, "browse", data);
      }
      return;
    }

    // ── PICK PRODUCT ──────────────────────────────
    if (step === "pick_product") {
      // Customer can reply with number or product name
      const categoryProducts = (data.categoryProducts ?? [])
        .map(id => PRODUCTS.find(p => p.id === id))
        .filter(Boolean);

      let product = null;

      // Try number selection first
      const num = parseInt(text);
      if (!isNaN(num) && num >= 1 && num <= categoryProducts.length) {
        product = categoryProducts[num - 1];
      } else {
        // Try name match
        product = PRODUCTS.find(p => p.name.toLowerCase() === text.toLowerCase());
      }

      if (!product) {
        const fallback = await aiFallback(text, step);
        await reply(fallback);
        return;
      }

      if (product.sizes.length === 1) {
        await saveSession(from, "pick_color", {
          ...data,
          productId: product.id,
          productName: product.name,
          productPrice: product.price,
          size: product.sizes[0],
        });
        const colorList = product.colors.map((c, i) => `${i + 1}. ${c}`).join("\n");
        await reply(`Great choice! 🎉 *${product.name}*\n\nNow pick a colour:\n\n${colorList}`);
      } else {
        await saveSession(from, "pick_size", {
          ...data,
          productId: product.id,
          productName: product.name,
          productPrice: product.price,
        });
        const sizeList = product.sizes.map((s, i) => `${i + 1}. ${s}`).join("\n");
        await reply(`Great choice! 🎉 *${product.name}*\n\nWhat size would you like?\n\n${sizeList}`);
      }
      return;
    }

    // ── PICK SIZE ─────────────────────────────────
    if (step === "pick_size") {
      const product = PRODUCTS.find(p => p.id === data.productId);
      const num = parseInt(text);
      let size = null;

      if (!isNaN(num) && num >= 1 && num <= product.sizes.length) {
        size = product.sizes[num - 1];
      } else {
        size = product?.sizes.find(s => s.toLowerCase() === text.toLowerCase());
      }

      if (!size) {
        const sizeList = product.sizes.map((s, i) => `${i + 1}. ${s}`).join("\n");
        await reply(`Please choose a valid size:\n\n${sizeList}`);
        return;
      }

      await saveSession(from, "pick_color", { ...data, size });
      const colorList = product.colors.map((c, i) => `${i + 1}. ${c}`).join("\n");
      await reply(`Perfect! Now choose a colour:\n\n${colorList}`);
      return;
    }

    // ── PICK COLOUR ───────────────────────────────
    if (step === "pick_color") {
      const product = PRODUCTS.find(p => p.id === data.productId);
      const num = parseInt(text);
      let color = null;

      if (!isNaN(num) && num >= 1 && num <= product.colors.length) {
        color = product.colors[num - 1];
      } else {
        color = product?.colors.find(c => c.toLowerCase() === text.toLowerCase());
      }

      if (!color) {
        const colorList = product.colors.map((c, i) => `${i + 1}. ${c}`).join("\n");
        await reply(`Please choose a valid colour:\n\n${colorList}`);
        return;
      }

      await saveSession(from, "pick_quantity", { ...data, color });
      await reply("How many would you like? Reply with a number (1–10).");
      return;
    }

    // ── PICK QUANTITY ─────────────────────────────
    if (step === "pick_quantity") {
      const qty = parseInt(text);
      if (isNaN(qty) || qty < 1 || qty > 10) {
        await reply("Please reply with a number between 1 and 10.");
        return;
      }

      await saveSession(from, "get_firstname", { ...data, quantity: qty });
      await reply("Almost there! I just need your shipping details. 📦\n\nWhat's your *first name*?");
      return;
    }

    // ── SHIPPING DETAILS ──────────────────────────
    if (step === "get_firstname") {
      await saveSession(from, "get_lastname", { ...data, firstName: text });
      await reply(`Nice to meet you, ${text}! 😊 What's your *last name*?`);
      return;
    }

    if (step === "get_lastname") {
      await saveSession(from, "get_address", { ...data, lastName: text });
      await reply("What's your *street address*?");
      return;
    }

    if (step === "get_address") {
      await saveSession(from, "get_city", { ...data, address: text });
      await reply("What *city* are you in?");
      return;
    }

    if (step === "get_city") {
      await saveSession(from, "get_postal", { ...data, city: text });
      await reply("What's your *postal code*?");
      return;
    }

    if (step === "get_postal") {
      await saveSession(from, "get_email", { ...data, postal: text });
      await reply("Last one! What's your *email address*? (We'll send your order confirmation here)");
      return;
    }

    if (step === "get_email") {
      const updatedData = { ...data, email: text };
      await saveSession(from, "confirm_order", updatedData);

      const product = PRODUCTS.find(p => p.id === updatedData.productId);
      const lineTotal = (product?.price ?? 0) * updatedData.quantity;

      await reply(
        `📋 *Order Summary*\n\n` +
        `*Product:* ${updatedData.productName}\n` +
        `*Size:* ${updatedData.size}\n` +
        `*Colour:* ${updatedData.color}\n` +
        `*Quantity:* ${updatedData.quantity}\n` +
        `*Price:* R${lineTotal.toFixed(2)}\n\n` +
        `*Shipping to:*\n` +
        `${updatedData.firstName} ${updatedData.lastName}\n` +
        `${updatedData.address}\n` +
        `${updatedData.city}, ${updatedData.postal}\n` +
        `${updatedData.email}\n\n` +
        `Reply *yes* to confirm and get your payment link, or *cancel* to start over.`
      );
      return;
    }

    // ── CONFIRM ORDER ─────────────────────────────
    if (step === "confirm_order") {
      if (text.toLowerCase() === "cancel") {
        await saveSession(from, "greeting", {});
        await reply("No problem! Your order has been cancelled. Reply *hi* to start again anytime. 😊");
        return;
      }

      if (text.toLowerCase() === "yes") {
        const product = PRODUCTS.find(p => p.id === data.productId);
        const lineTotal = (product?.price ?? 0) * data.quantity;

        await reply("Creating your payment link... ⏳");

        const checkoutRes = await fetch("https://payments.yoco.com/api/checkouts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.YOCO_SECRET_KEY}`,
          },
          body: JSON.stringify({
            amount: lineTotal * 100,
            currency: "ZAR",
            successUrl: `${process.env.FRONTEND_URL}/order-success`,
            cancelUrl: `${process.env.FRONTEND_URL}`,
            failureUrl: `${process.env.FRONTEND_URL}`,
          }),
        });

        const checkoutData = await checkoutRes.json();

        if (!checkoutRes.ok) {
          await reply("Sorry, I couldn't create your payment link. Please try again or visit our website.");
          return;
        }

        const { data: newOrder } = await supabase
          .from("orders")
          .insert({
            first_name: data.firstName,
            last_name: data.lastName,
            address: data.address,
            city: data.city,
            postal: data.postal,
            email: data.email,
            yoco_order_id: checkoutData.id,
            amount: lineTotal * 100,
            status: "pending",
          })
          .select()
          .single();

        await supabase.from("order_items").insert({
          order_id: newOrder.id,
          product_id: data.productId,
          product_name: data.productName,
          price: (product?.price ?? 0) * 100,
          quantity: data.quantity,
          line_total: lineTotal * 100,
          color: data.color,
          size: data.size,
        });

        await saveSession(from, "awaiting_payment", {
          ...data,
          orderId: newOrder.id,
          yocoId: checkoutData.id,
        });

        await reply(
          `🎉 *Your payment link is ready!*\n\n` +
          `👉 ${checkoutData.redirectUrl}\n\n` +
          `This link is secure and powered by Yoco. Once you've paid, I'll send your order confirmation right here. 🌿`
        );
        return;
      }

      const fallback = await aiFallback(text, step);
      await reply(fallback);
      return;
    }

    // ── AWAITING PAYMENT ──────────────────────────
    if (step === "awaiting_payment") {
      await reply(
        `Your order is still waiting for payment. 😊\n\nUse the link I sent you to complete your purchase.\n\nReply *cancel* to start over.`
      );
      return;
    }

    // ── GLOBAL FALLBACK ───────────────────────────
    const fallback = await aiFallback(text, step);
    await reply(fallback);

  } catch (error) {
    console.error("❌ Twilio bot error:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
  }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`Backend running on port ${PORT}`));