import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Send, LogOut, ShoppingBag, TrendingUp, DollarSign, Package } from "lucide-react";

interface Order {
  id: number;
  created_at: string;
  first_name: string;
  last_name: string;
  email: string;
  address: string;
  city: string;
  postal: string;
  amount: number;
  status: string;
  yoco_order_id: string;
}

interface OrderItem {
  id: number;
  order_id: number;
  product_name: string;
  quantity: number;
  line_total: number;
  color: string;
  size: string;
}

interface InventoryRow {
  id: number;
  product_id: string;
  size: string;
  color: string;
  quantity: number;
}

interface Message {
  role: "user" | "assistant";
  content: string;
}

const GREETING = `Hi! I'm your Verde Atelier business analyst. 📊

I have access to all your order data. You can ask me things like:

- "What's my total revenue?"
- "Which product sells the most?"
- "How many orders are pending?"
- "What was my best day?"

What would you like to know?`;

export function AdminPage() {
  // Auth
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Orders data
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Inventory data
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editQty, setEditQty] = useState<number>(0);
  const [addForm, setAddForm] = useState({
    product_id: "",
    size: "",
    color: "",
    quantity: 0,
  });
  const [addLoading, setAddLoading] = useState(false);

  // AI Chat
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Tab
  const [tab, setTab] = useState<"orders" | "inventory" | "analyst">("orders");

  // ── Check session on load ──────────────────────────
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setSession(data.session);
        fetchData(data.session.access_token);
        fetchInventory(data.session.access_token);
      }
    });
  }, []);

  // ── Fetch orders ───────────────────────────────────
  const fetchData = async (token: string) => {
    setDataLoading(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/admin/data`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }
      );
      const data = await res.json();
      if (res.ok) {
        setOrders(data.orders);
        setOrderItems(data.orderItems);
      }
    } catch (err) {
      console.error("Failed to fetch admin data:", err);
    } finally {
      setDataLoading(false);
    }
  };

  // ── Fetch inventory ────────────────────────────────
  const fetchInventory = async (token: string) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/admin/inventory`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ token }),
        }
      );
      const data = await res.json();
      if (res.ok) setInventory(data.inventory);
    } catch (err) {
      console.error("Failed to fetch inventory:", err);
    }
  };

  // ── Update stock quantity ──────────────────────────
  const handleUpdateStock = async (id: number) => {
    await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/admin/inventory/update`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: session.access_token, id, quantity: editQty }),
      }
    );
    setEditingId(null);
    fetchInventory(session.access_token);
  };

  // ── Add / upsert stock row ─────────────────────────
  const handleAddStock = async () => {
    setAddLoading(true);
    await fetch(
      `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/admin/inventory/add`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: session.access_token, ...addForm }),
      }
    );
    setAddForm({ product_id: "", size: "", color: "", quantity: 0 });
    setAddLoading(false);
    fetchInventory(session.access_token);
  };

  // ── Auth ───────────────────────────────────────────
  const handleLogin = async () => {
    setAuthLoading(true);
    setAuthError("");

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setAuthError(error.message);
      setAuthLoading(false);
      return;
    }

    setSession(data.session);
    fetchData(data.session.access_token);
    fetchInventory(data.session.access_token);
    setAuthLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setOrders([]);
    setOrderItems([]);
    setInventory([]);
  };

  // ── AI chat ────────────────────────────────────────
  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || aiLoading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setAiLoading(true);

    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/admin/analyse`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: session.access_token,
            messages: updatedMessages,
            orders,
            orderItems,
          }),
        }
      );
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "Sorry, I couldn't get a response." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Something went wrong. Please try again." },
      ]);
    } finally {
      setAiLoading(false);
    }
  };

  // ── Stats ──────────────────────────────────────────
  const paidOrders = orders.filter((o) => o.status === "paid");
  const totalRevenue = paidOrders.reduce((sum, o) => sum + o.amount, 0);
  const pendingOrders = orders.filter((o) => o.status === "pending").length;
  const totalItems = orderItems.reduce((sum, i) => sum + i.quantity, 0);
  const outOfStockCount = inventory.filter((r) => r.quantity === 0).length;

  // ── Login screen ───────────────────────────────────
  if (!session) {
    return (
      <div className="flex h-screen items-center justify-center bg-neutral-50 px-4">
        <div className="w-full max-w-sm space-y-6 rounded-2xl bg-white p-8 shadow-lg">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--accent)]">Verde Atelier</p>
            <h1 className="mt-1 text-2xl font-semibold text-neutral-900">Admin Dashboard</h1>
            <p className="mt-1 text-sm text-neutral-500">Sign in to manage your store.</p>
          </div>
          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLogin(); }}
              className="w-full rounded-xl border border-neutral-200 px-4 py-3 text-sm outline-none focus:border-[var(--accent)]"
            />
            {authError && <p className="text-sm text-red-500">{authError}</p>}
            <button
              onClick={handleLogin}
              disabled={authLoading}
              className="w-full rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
            >
              {authLoading ? "Signing in..." : "Sign in"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Dashboard ──────────────────────────────────────
  return (
    <div className="min-h-screen bg-neutral-50">

      {/* Header */}
      <header className="border-b border-neutral-200 bg-white px-6 py-4">
        <div className="mx-auto flex max-w-[1280px] items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--accent)]">Verde Atelier</p>
            <h1 className="text-lg font-semibold text-neutral-900">Admin Dashboard</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-full border border-neutral-200 px-4 py-2 text-sm text-neutral-600 transition hover:border-neutral-400"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-6 py-8 space-y-8">

        {/* Stats — now includes out of stock count */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          {[
            { label: "Total revenue", value: `R${(totalRevenue / 100).toFixed(2)}`, icon: DollarSign },
            { label: "Paid orders", value: paidOrders.length, icon: ShoppingBag },
            { label: "Pending orders", value: pendingOrders, icon: TrendingUp },
            { label: "Out of stock", value: outOfStockCount, icon: Package },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-white p-5 shadow-sm border border-neutral-100">
              <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-500">{stat.label}</p>
                <stat.icon size={16} className="text-[var(--accent)]" />
              </div>
              <p className="mt-2 text-2xl font-semibold text-neutral-900">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2">
          {(["orders", "inventory", "analyst"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`rounded-full px-5 py-2 text-sm font-medium transition ${
                tab === t
                  ? "bg-[var(--accent)] text-white"
                  : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"
              }`}
            >
              {t === "orders" ? "Orders" : t === "inventory" ? "Inventory" : "AI Analyst"}
            </button>
          ))}
        </div>

        {/* ── Orders table ── */}
        {tab === "orders" && (
          <div className="rounded-2xl bg-white border border-neutral-100 shadow-sm overflow-hidden">
            {dataLoading ? (
              <div className="flex h-40 items-center justify-center text-sm text-neutral-400">
                Loading orders...
              </div>
            ) : orders.length === 0 ? (
              <div className="flex h-40 items-center justify-center text-sm text-neutral-400">
                No orders yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-100">
                    <tr>
                      {["Order", "Date", "Customer", "Email", "Items", "Amount", "Status"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {orders.map((order) => {
                      const items = orderItems.filter((i) => i.order_id === order.id);
                      return (
                        <tr key={order.id} className="hover:bg-neutral-50 transition">
                          <td className="px-4 py-3 font-medium text-neutral-900">#{order.id}</td>
                          <td className="px-4 py-3 text-neutral-500">
                            {new Date(order.created_at).toLocaleDateString("en-ZA")}
                          </td>
                          <td className="px-4 py-3 text-neutral-700">
                            {order.first_name} {order.last_name}
                          </td>
                          <td className="px-4 py-3 text-neutral-500">{order.email}</td>
                          <td className="px-4 py-3 text-neutral-500">
                            {items.map((i) => (
                              <div key={i.id}>
                                {i.product_name} x{i.quantity}
                              </div>
                            ))}
                          </td>
                          <td className="px-4 py-3 font-medium text-neutral-900">
                            R{(order.amount / 100).toFixed(2)}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              order.status === "paid"
                                ? "bg-green-100 text-green-700"
                                : order.status === "failed"
                                ? "bg-red-100 text-red-600"
                                : "bg-yellow-100 text-yellow-700"
                            }`}>
                              {order.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── Inventory tab ── */}
        {tab === "inventory" && (
          <div className="space-y-6">

            {/* Add / update stock form */}
            <div className="rounded-2xl bg-white border border-neutral-100 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-neutral-900 mb-4">Add / update stock</h2>
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <input
                  placeholder="Product ID (e.g. p1)"
                  value={addForm.product_id}
                  onChange={(e) => setAddForm((f) => ({ ...f, product_id: e.target.value }))}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
                <input
                  placeholder="Size (e.g. M or 9)"
                  value={addForm.size}
                  onChange={(e) => setAddForm((f) => ({ ...f, size: e.target.value }))}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
                <input
                  placeholder="Color (e.g. Forest)"
                  value={addForm.color}
                  onChange={(e) => setAddForm((f) => ({ ...f, color: e.target.value }))}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
                <input
                  type="number"
                  placeholder="Quantity"
                  value={addForm.quantity}
                  onChange={(e) => setAddForm((f) => ({ ...f, quantity: Number(e.target.value) }))}
                  className="rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <button
                onClick={handleAddStock}
                disabled={addLoading || !addForm.product_id || !addForm.size || !addForm.color}
                className="mt-3 rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
              >
                {addLoading ? "Saving..." : "Save stock"}
              </button>
            </div>

            {/* Stock table */}
            <div className="rounded-2xl bg-white border border-neutral-100 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-100">
                    <tr>
                      {["Product ID", "Size", "Color", "Quantity", ""].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {inventory.map((row) => (
                      <tr key={row.id} className="hover:bg-neutral-50 transition">
                        <td className="px-4 py-3 text-neutral-700">{row.product_id}</td>
                        <td className="px-4 py-3 text-neutral-700">{row.size}</td>
                        <td className="px-4 py-3 text-neutral-700">{row.color}</td>
                        <td className="px-4 py-3">
                          {editingId === row.id ? (
                            <input
                              type="number"
                              value={editQty}
                              onChange={(e) => setEditQty(Number(e.target.value))}
                              className="w-20 rounded-lg border border-neutral-200 px-2 py-1 text-sm outline-none focus:border-[var(--accent)]"
                            />
                          ) : (
                            <span className={`font-medium ${
                              row.quantity === 0
                                ? "text-red-500"
                                : row.quantity <= 3
                                ? "text-amber-500"
                                : "text-neutral-900"
                            }`}>
                              {row.quantity === 0 ? "Out of stock" : row.quantity}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          {editingId === row.id ? (
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => handleUpdateStock(row.id)}
                                className="rounded-lg bg-[var(--accent)] px-3 py-1 text-xs font-medium text-white"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingId(null)}
                                className="rounded-lg border border-neutral-200 px-3 py-1 text-xs text-neutral-600"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => { setEditingId(row.id); setEditQty(row.quantity); }}
                              className="rounded-lg border border-neutral-200 px-3 py-1 text-xs text-neutral-600 hover:border-neutral-400 transition"
                            >
                              Edit
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── AI Analyst ── */}
        {tab === "analyst" && (
          <div className="rounded-2xl bg-white border border-neutral-100 shadow-sm flex flex-col" style={{ height: "60vh" }}>
            <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
              {messages.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                    msg.role === "user"
                      ? "bg-[var(--accent)] text-white rounded-br-sm"
                      : "bg-neutral-100 text-neutral-800 rounded-bl-sm"
                  }`}>
                    {msg.content}
                  </div>
                </div>
              ))}
              {aiLoading && (
                <div className="flex justify-start">
                  <div className="bg-neutral-100 rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex gap-1 items-center h-4">
                      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                      <span className="w-1.5 h-1.5 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-neutral-100 flex-shrink-0">
              <div className="flex items-center gap-3 rounded-full border border-neutral-200 px-4 py-2 focus-within:border-[var(--accent)] transition">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") sendMessage(); }}
                  placeholder="Ask anything about your business..."
                  disabled={aiLoading}
                  className="flex-1 text-sm bg-transparent outline-none text-neutral-800 placeholder:text-neutral-400 disabled:opacity-50"
                />
                <button
                  onClick={sendMessage}
                  disabled={aiLoading || !input.trim()}
                  className="text-[var(--accent)] disabled:opacity-30 transition hover:opacity-70"
                >
                  <Send size={16} />
                </button>
              </div>
              <p className="mt-2 text-center text-xs text-neutral-400">
                Powered by Laguna M1 · Your data stays private
              </p>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}