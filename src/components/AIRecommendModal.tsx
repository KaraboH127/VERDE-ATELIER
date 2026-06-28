import { Send, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { products as allProducts } from "../data/store";
import { supabase } from "../lib/supabase";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface AIRecommendModalProps {
  onClose: () => void;
}

const GREETING = `Hi! I'm your Verde Atelier style assistant. 🌿

Tell me what you're looking for — whether it's a budget, an occasion, a style, or just a mood — and I'll find the right products for you.

What can I help you with today?`;

export function AIRecommendModal({ onClose }: AIRecommendModalProps) {
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Lock background scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Auto scroll to latest message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const sendMessage = async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: Message = { role: "user", content: trimmed };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      // Fetch order stats from Supabase
      const { data: orderItems } = await supabase
        .from("order_items")
        .select("product_id, quantity");

      // Tally order counts per product
      const orderStats: Record<string, number> = {};
      for (const row of orderItems ?? []) {
        orderStats[row.product_id] = (orderStats[row.product_id] ?? 0) + row.quantity;
      }

      // Strip images to keep the payload lean
      const leanProducts = allProducts.map(({ images: _images, ...rest }) => rest);

      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/recommend`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: updatedMessages,
            products: leanProducts,
            orderStats,
          }),
        }
      );

      const data = await response.json();

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.reply || "Sorry, I couldn't get a response. Try again." },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Sorry, something went wrong. Please try again." },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") sendMessage();
  };

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col"
        style={{ height: "80vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-100 flex-shrink-0">
          <div>
            <p className="text-xs uppercase tracking-widest text-[var(--accent)]">Style Assistant</p>
            <h2 className="text-base font-semibold text-neutral-900">Verde Atelier AI</h2>
          </div>
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          {messages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                  msg.role === "user"
                    ? "bg-[var(--accent)] text-white rounded-br-sm"
                    : "bg-neutral-100 text-neutral-800 rounded-bl-sm"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
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

          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-neutral-100 flex-shrink-0">
          <div className="flex items-center gap-3 rounded-full border border-neutral-200 px-4 py-2 focus-within:border-[var(--accent)] transition">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="e.g. something warm for under R500..."
              disabled={loading}
              className="flex-1 text-sm bg-transparent outline-none text-neutral-800 placeholder:text-neutral-400 disabled:opacity-50"
            />
            <button
              onClick={sendMessage}
              disabled={loading || !input.trim()}
              className="text-[var(--accent)] disabled:opacity-30 transition hover:opacity-70"
            >
              <Send size={16} />
            </button>
          </div>
          <p className="mt-2 text-center text-xs text-neutral-400">
            Powered by Verde Atelier AI · Press Enter to send
          </p>
        </div>
      </div>
    </div>
  );
}