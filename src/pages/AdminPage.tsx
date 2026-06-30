import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { Send, LogOut, ShoppingBag, TrendingUp, DollarSign, Package, Search, ChevronLeft } from "lucide-react";
import { products as allProducts } from "../data/store";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from "recharts";

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

// AI Chat Start State
const GREETING = `Hi! I'm your Verde Atelier business analyst. 📊

I have access to all your order data. You can ask me things like:

- "What's my total revenue?"
- "Which product sells the most?"
- "How many orders are pending?"
- "What was my best day?"

What would you like to know?`;

const STATUS_COLORS: Record<string, string> = {
  Paid: "#2d6a4f",
  Pending: "#f0ad4e",
  Failed: "#dc3545",
};

export function AdminPage() {
  // Auth
  const [session, setSession] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  // Orders
  const [orders, setOrders] = useState<Order[]>([]);
  const [orderItems, setOrderItems] = useState<OrderItem[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Inventory
  const [inventory, setInventory] = useState<InventoryRow[]>([]);
  const [inventorySearch, setInventorySearch] = useState("");

  // Restock flow
  const [selectedProduct, setSelectedProduct] = useState<typeof allProducts[0] | null>(null);
  const [productSearch, setProductSearch] = useState("");
  const [selectedCombos, setSelectedCombos] = useState<Set<string>>(new Set());
  const [restockQty, setRestockQty] = useState<number>(10);
  const [restockLoading, setRestockLoading] = useState(false);
  const [restockSuccess, setRestockSuccess] = useState(false);

  // AI Chat
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);

  // Tab
  const [tab, setTab] = useState<"orders" | "inventory" | "analytics" | "analyst">("orders");

  // ── Session on load ────────────────────────────────
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

  // ── Restock selected combos ────────────────────────
  const handleRestock = async () => {
    if (!selectedProduct || selectedCombos.size === 0) return;
    setRestockLoading(true);
    setRestockSuccess(false);

    for (const combo of selectedCombos) {
      const [size, color] = combo.split("||");
      await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/admin/inventory/add`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: session.access_token,
            product_id: selectedProduct.id,
            size,
            color,
            quantity: restockQty,
          }),
        }
      );
    }

    await fetchInventory(session.access_token);
    setRestockLoading(false);
    setRestockSuccess(true);
    setSelectedCombos(new Set());
    setTimeout(() => setRestockSuccess(false), 3000);
  };

  // ── Toggle a size+color combo ──────────────────────
  const toggleCombo = (size: string, color: string) => {
    const key = `${size}||${color}`;
    setSelectedCombos((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // ── Select / deselect all combos ───────────────────
  const toggleAll = () => {
    if (!selectedProduct) return;
    const allKeys = selectedProduct.sizes.flatMap((size) =>
      selectedProduct.colors.map((color) => `${size}||${color}`)
    );
    if (selectedCombos.size === allKeys.length) {
      setSelectedCombos(new Set());
    } else {
      setSelectedCombos(new Set(allKeys));
    }
  };

  // ── Get stock for a specific combo ────────────────
  const getStock = (productId: string, size: string, color: string): number => {
    const row = inventory.find(
      (r) => r.product_id === productId && r.size === size && r.color === color
    );
    return row?.quantity ?? 0;
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
  const outOfStockCount = inventory.filter((r) => r.quantity === 0).length;

  // ── Filtered products for restock search ──────────
  const filteredProducts = allProducts.filter((p) =>
    p.name.toLowerCase().includes(productSearch.toLowerCase())
  );

  // ── Filtered inventory rows for inventory search ───
  const filteredInventory = inventory.filter((row) => {
    const product = allProducts.find((p) => p.id === row.product_id);
    const name = product?.name.toLowerCase() ?? row.product_id;
    return (
      name.includes(inventorySearch.toLowerCase()) ||
      row.size.toLowerCase().includes(inventorySearch.toLowerCase()) ||
      row.color.toLowerCase().includes(inventorySearch.toLowerCase())
    );
  });

  // ── Analytics data prep ────────────────────────────
  const revenueByDate = paidOrders.reduce((acc: Record<string, number>, order) => {
    const date = new Date(order.created_at).toLocaleDateString("en-ZA", { day: "2-digit", month: "short" });
    acc[date] = (acc[date] ?? 0) + order.amount / 100;
    return acc;
  }, {});

  const revenueChartData = Object.entries(revenueByDate)
    .map(([date, revenue]) => ({ date, revenue: Math.round(revenue * 100) / 100 }))
    .reverse();

  const productSales = orderItems.reduce((acc: Record<string, number>, item) => {
    acc[item.product_name] = (acc[item.product_name] ?? 0) + item.quantity;
    return acc;
  }, {});

  const topProductsData = Object.entries(productSales)
    .map(([name, qty]) => ({ name, quantity: qty }))
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 6);

  const statusCounts = orders.reduce((acc: Record<string, number>, order) => {
    acc[order.status] = (acc[order.status] ?? 0) + 1;
    return acc;
  }, {});

  const statusChartData = Object.entries(statusCounts).map(([status, count]) => ({
    name: status.charAt(0).toUpperCase() + status.slice(1),
    value: count,
  }));

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
      <header className="border-b border-neutral-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-[var(--accent)] truncate">Verde Atelier</p>
            <h1 className="text-base font-semibold text-neutral-900 sm:text-lg">Admin Dashboard</h1>
          </div>
          <button
            onClick={handleLogout}
            className="flex flex-shrink-0 items-center gap-2 rounded-full border border-neutral-200 px-3 py-2 text-xs text-neutral-600 transition hover:border-neutral-400 sm:px-4 sm:text-sm"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-[1280px] px-4 py-6 space-y-6 sm:px-6 sm:py-8 sm:space-y-8">

        {/* Stats */}
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

        {/* Tabs — horizontally scrollable on mobile, no cutoff */}
        <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:px-0 sm:pb-0 scrollbar-hide">
          {(["orders", "inventory", "analytics", "analyst"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-shrink-0 whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition sm:px-5 ${
                tab === t
                  ? "bg-[var(--accent)] text-white"
                  : "bg-white border border-neutral-200 text-neutral-600 hover:border-neutral-400"
              }`}
            >
              {t === "orders" ? "Orders" : t === "inventory" ? "Inventory" : t === "analytics" ? "Analytics" : "AI Analyst"}
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
                              <div key={i.id}>{i.product_name} x{i.quantity}</div>
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
          <div className="space-y-8">

            {/* ── RESTOCK FLOW ── */}
            <div className="rounded-2xl bg-white border border-neutral-100 shadow-sm p-6 space-y-6">
              <h2 className="text-sm font-semibold text-neutral-900">Restock products</h2>

              {!selectedProduct && (
                <div className="space-y-4">
                  <p className="text-xs text-neutral-500">Step 1 — Select a product</p>

                  <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 focus-within:border-[var(--accent)] transition">
                    <Search size={14} className="text-neutral-400 flex-shrink-0" />
                    <input
                      type="text"
                      placeholder="Search products..."
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      className="flex-1 text-sm bg-transparent outline-none text-neutral-800 placeholder:text-neutral-400"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                    {filteredProducts.map((product) => {
                      const totalStock = inventory
                        .filter((r) => r.product_id === product.id)
                        .reduce((sum, r) => sum + r.quantity, 0);
                      const hasOutOfStock = inventory.some(
                        (r) => r.product_id === product.id && r.quantity === 0
                      );

                      return (
                        <button
                          key={product.id}
                          onClick={() => {
                            setSelectedProduct(product);
                            setSelectedCombos(new Set());
                            setRestockSuccess(false);
                          }}
                          className="group text-left overflow-hidden rounded-xl border border-neutral-200 hover:border-[var(--accent)] transition"
                        >
                          <div className="relative">
                            <img
                              src={product.images[0]}
                              alt={product.name}
                              className="aspect-[4/3] w-full object-cover"
                            />
                            {hasOutOfStock && (
                              <span className="absolute top-2 left-2 rounded-full bg-red-500 px-2 py-0.5 text-xs font-medium text-white">
                                Low stock
                              </span>
                            )}
                          </div>
                          <div className="p-3">
                            <p className="text-xs font-medium text-neutral-900 leading-snug">{product.name}</p>
                            <p className="mt-1 text-xs text-neutral-400">{totalStock} units total</p>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {selectedProduct && (
                <div className="space-y-5">
                  <button
                    onClick={() => { setSelectedProduct(null); setSelectedCombos(new Set()); }}
                    className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-800 transition"
                  >
                    <ChevronLeft size={16} />
                    Back to products
                  </button>

                  <p className="text-xs text-neutral-500">
                    Step 2 — Choose which sizes and colours to restock for{" "}
                    <strong className="text-neutral-900">{selectedProduct.name}</strong>
                  </p>

                  <div className="flex items-center justify-between">
                    <button
                      onClick={toggleAll}
                      className="text-xs font-medium text-[var(--accent)] hover:opacity-70 transition"
                    >
                      {selectedCombos.size ===
                      selectedProduct.sizes.length * selectedProduct.colors.length
                        ? "Deselect all"
                        : "Select all"}
                    </button>
                    <p className="text-xs text-neutral-400">
                      {selectedCombos.size} selected
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead>
                        <tr>
                          <th className="text-left text-xs font-medium text-neutral-500 pb-2 pr-4">
                            Size / Colour
                          </th>
                          {selectedProduct.colors.map((color) => (
                            <th
                              key={color}
                              className="text-center text-xs font-medium text-neutral-500 pb-2 px-2"
                            >
                              {color}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {selectedProduct.sizes.map((size) => (
                          <tr key={size} className="border-t border-neutral-100">
                            <td className="py-2 pr-4 text-xs font-medium text-neutral-700">
                              {size}
                            </td>
                            {selectedProduct.colors.map((color) => {
                              const key = `${size}||${color}`;
                              const stock = getStock(selectedProduct.id, size, color);
                              const selected = selectedCombos.has(key);
                              return (
                                <td key={color} className="py-2 px-2 text-center">
                                  <button
                                    onClick={() => toggleCombo(size, color)}
                                    className={`w-full rounded-lg border px-2 py-1.5 text-xs transition ${
                                      selected
                                        ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                                        : stock === 0
                                        ? "border-red-200 bg-red-50 text-red-500"
                                        : stock <= 3
                                        ? "border-amber-200 bg-amber-50 text-amber-600"
                                        : "border-neutral-200 bg-neutral-50 text-neutral-600"
                                    }`}
                                  >
                                    {selected ? "✓" : stock === 0 ? "0" : stock}
                                  </button>
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {selectedCombos.size > 0 && (
                    <div className="flex items-center gap-4 pt-2 border-t border-neutral-100">
                      <div className="flex items-center gap-2">
                        <label className="text-xs text-neutral-500">Set quantity to:</label>
                        <input
                          type="number"
                          min={1}
                          value={restockQty}
                          onChange={(e) => setRestockQty(Number(e.target.value))}
                          className="w-20 rounded-xl border border-neutral-200 px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                        />
                      </div>
                      <button
                        onClick={handleRestock}
                        disabled={restockLoading}
                        className="rounded-xl bg-[var(--accent)] px-5 py-2 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
                      >
                        {restockLoading
                          ? "Restocking..."
                          : `Restock ${selectedCombos.size} variant${selectedCombos.size > 1 ? "s" : ""}`}
                      </button>
                      {restockSuccess && (
                        <p className="text-sm text-green-600 font-medium">✅ Restocked!</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* ── INVENTORY TABLE ── */}
            <div className="rounded-2xl bg-white border border-neutral-100 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-neutral-100">
                <div className="flex items-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 focus-within:border-[var(--accent)] transition">
                  <Search size={14} className="text-neutral-400 flex-shrink-0" />
                  <input
                    type="text"
                    placeholder="Search by product, size or colour..."
                    value={inventorySearch}
                    onChange={(e) => setInventorySearch(e.target.value)}
                    className="flex-1 text-sm bg-transparent outline-none text-neutral-800 placeholder:text-neutral-400"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-neutral-50 border-b border-neutral-100">
                    <tr>
                      {["Product", "Size", "Colour", "Stock"].map((h) => (
                        <th key={h} className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-neutral-500">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-neutral-50">
                    {filteredInventory.map((row) => {
                      const product = allProducts.find((p) => p.id === row.product_id);
                      return (
                        <tr key={row.id} className="hover:bg-neutral-50 transition">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              {product && (
                                <img
                                  src={product.images[0]}
                                  alt={product.name}
                                  className="h-8 w-8 rounded-lg object-cover flex-shrink-0"
                                />
                              )}
                              <span className="text-neutral-700 font-medium">
                                {product?.name ?? row.product_id}
                              </span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-neutral-600">{row.size}</td>
                          <td className="px-4 py-3 text-neutral-600">{row.color}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${
                              row.quantity === 0
                                ? "bg-red-100 text-red-600"
                                : row.quantity <= 3
                                ? "bg-amber-100 text-amber-600"
                                : "bg-green-100 text-green-700"
                            }`}>
                              {row.quantity === 0 ? "Out of stock" : `${row.quantity} in stock`}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredInventory.length === 0 && (
                      <tr>
                        <td colSpan={4} className="px-4 py-10 text-center text-sm text-neutral-400">
                          No results found.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ── Analytics tab ── */}
        {tab === "analytics" && (
          <div className="space-y-6">

            {/* Revenue over time */}
            <div className="rounded-2xl bg-white border border-neutral-100 shadow-sm p-6">
              <h2 className="text-sm font-semibold text-neutral-900 mb-1">Revenue over time</h2>
              <p className="text-xs text-neutral-400 mb-6">Daily revenue from paid orders</p>

              {revenueChartData.length === 0 ? (
                <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
                  No revenue data yet.
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={280}>
                  <LineChart data={revenueChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 12, fill: "#a3a3a3" }} />
                    <YAxis tick={{ fontSize: 12, fill: "#a3a3a3" }} tickFormatter={(v) => `R${v}`} />
                    <Tooltip
                      formatter={(value: number) => [`R${value.toFixed(2)}`, "Revenue"]}
                      contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 13 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#2d6a4f"
                      strokeWidth={2.5}
                      dot={{ fill: "#2d6a4f", r: 4 }}
                      activeDot={{ r: 6 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Two-column: top products + status breakdown */}
            <div className="grid gap-6 md:grid-cols-2">

              {/* Top products */}
              <div className="rounded-2xl bg-white border border-neutral-100 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-neutral-900 mb-1">Top products</h2>
                <p className="text-xs text-neutral-400 mb-6">By units sold</p>

                {topProductsData.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
                    No sales data yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <BarChart data={topProductsData} layout="vertical" margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" horizontal={false} />
                      <XAxis type="number" tick={{ fontSize: 12, fill: "#a3a3a3" }} allowDecimals={false} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11, fill: "#525252" }}
                        width={110}
                      />
                      <Tooltip
                        formatter={(value: number) => [`${value} sold`, ""]}
                        contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 13 }}
                      />
                      <Bar dataKey="quantity" fill="#2d6a4f" radius={[0, 6, 6, 0]} barSize={18} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Order status breakdown */}
              <div className="rounded-2xl bg-white border border-neutral-100 shadow-sm p-6">
                <h2 className="text-sm font-semibold text-neutral-900 mb-1">Order status</h2>
                <p className="text-xs text-neutral-400 mb-6">Breakdown of all orders</p>

                {statusChartData.length === 0 ? (
                  <div className="flex h-64 items-center justify-center text-sm text-neutral-400">
                    No orders yet.
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={statusChartData}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={95}
                        paddingAngle={3}
                      >
                        {statusChartData.map((entry) => (
                          <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? "#a3a3a3"} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 12, border: "1px solid #e5e5e5", fontSize: 13 }} />
                      <Legend
                        verticalAlign="bottom"
                        height={36}
                        iconType="circle"
                        wrapperStyle={{ fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                )}
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