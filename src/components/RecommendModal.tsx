import { ArrowRight, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { products as allProducts } from "../data/store";
import { supabase } from "../lib/supabase";
import { Product } from "../types";
import { formatCurrency } from "../utils/format";
import { Badge } from "./ui/Badge";

const CATEGORIES = ["Footwear", "Apparel", "Accessories", "All"];
const BUDGETS = [
  { label: "Under R500", max: 500 },
  { label: "R500 – R1000", max: 1000 },
  { label: "R1000+", max: Infinity },
];
const OCCASIONS = ["Everyday", "Active", "Formal", "Gift"];

interface RecommendModalProps {
  onClose: () => void;
}

export function RecommendModal({ onClose }: RecommendModalProps) {
  const [step, setStep] = useState(0);
  const [budget, setBudget] = useState<number | null>(null);
  const [category, setCategory] = useState<string | null>(null);
  const [occasion, setOccasion] = useState<string | null>(null);
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // ✅ Lock background scroll when modal is open
  useEffect(() => {
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, []);

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const fetchRecommendations = async () => {
    setLoading(true);

    const { data, error } = await supabase
      .from("order_items")
      .select("product_id, quantity");

    if (error || !data) {
      setLoading(false);
      return;
    }

    const tally: Record<string, number> = {};
    for (const row of data) {
      tally[row.product_id] = (tally[row.product_id] ?? 0) + row.quantity;
    }

    const rankedIds = Object.entries(tally)
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => id);

    const filtered = allProducts
      .filter((p) => {
        const inBudget = budget === null || p.price <= budget;
        const inCategory = !category || category === "All" || p.category === category;
        return inBudget && inCategory;
      })
      .sort((a, b) => {
        const aRank = rankedIds.indexOf(a.id);
        const bRank = rankedIds.indexOf(b.id);
        if (aRank === -1 && bRank === -1) return b.popularity - a.popularity;
        if (aRank === -1) return 1;
        if (bRank === -1) return -1;
        return aRank - bRank;
      })
      .slice(0, 4);

    setResults(filtered);
    setLoading(false);
    setStep(3);
  };

  return (
    // ✅ Backdrop — clicking outside closes modal
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* ✅ Modal box — max height set, inner content scrolls */}
      <div
        className="relative w-full max-w-lg rounded-2xl bg-white shadow-2xl flex flex-col"
        style={{ maxHeight: "85vh" }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* ✅ Fixed header — always visible, never scrolls away */}
        <div className="flex items-center justify-between px-8 pt-7 pb-4 border-b border-neutral-100 flex-shrink-0">
          <p className="text-xs uppercase tracking-widest text-[var(--accent)]">
            {step === 0 && "Find your fit"}
            {step === 1 && "Find your fit"}
            {step === 2 && "Almost there"}
            {step === 3 && "Picked for you"}
          </p>
          {/* ✅ X button — always visible in the header */}
          <button
            onClick={onClose}
            className="rounded-full p-1.5 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700 transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* ✅ Scrollable body */}
        <div className="overflow-y-auto px-8 py-6 flex flex-col gap-6">

          {/* Step 0 — Budget */}
          {step === 0 && (
            <>
              <h2 className="text-2xl font-semibold text-neutral-900">What's your budget?</h2>
              <div className="grid gap-3">
                {BUDGETS.map((b) => (
                  <button
                    key={b.label}
                    onClick={() => { setBudget(b.max); setStep(1); }}
                    className="rounded-xl border border-neutral-200 px-5 py-3 text-left text-sm font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 1 — Category */}
          {step === 1 && (
            <>
              <h2 className="text-2xl font-semibold text-neutral-900">What are you looking for?</h2>
              <div className="grid grid-cols-2 gap-3">
                {CATEGORIES.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setCategory(c); setStep(2); }}
                    className="rounded-xl border border-neutral-200 px-5 py-3 text-sm font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {c}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 2 — Occasion */}
          {step === 2 && (
            <>
              <h2 className="text-2xl font-semibold text-neutral-900">What's the occasion?</h2>
              <div className="grid grid-cols-2 gap-3">
                {OCCASIONS.map((o) => (
                  <button
                    key={o}
                    onClick={() => { setOccasion(o); fetchRecommendations(); }}
                    className="rounded-xl border border-neutral-200 px-5 py-3 text-sm font-medium text-neutral-700 transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
                  >
                    {o}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Step 3 — Results */}
          {step === 3 && (
            <>
              <h2 className="text-2xl font-semibold text-neutral-900">
                {loading ? "Finding your picks..." : "Here's what we recommend"}
              </h2>

              {loading ? (
                <div className="flex h-32 items-center justify-center">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-200 border-t-[var(--accent)]" />
                </div>
              ) : results.length === 0 ? (
                <p className="text-sm text-neutral-500">
                  No products matched your criteria. Try different answers!
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {results.map((product) => (
                    <Link
                      key={product.id}
                      to={`/products/${product.slug}`}
                      onClick={onClose}
                      className="group overflow-hidden rounded-xl border border-neutral-100 bg-neutral-50 transition hover:border-[var(--accent)]"
                    >
                      <img
                        src={product.images[0]}
                        alt={product.name}
                        className="aspect-[4/5] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                      />
                      <div className="p-3">
                        <Badge text={product.category} />
                        <p className="mt-2 text-sm font-medium leading-snug text-neutral-900">{product.name}</p>
                        <p className="mt-1 text-sm text-neutral-500">{formatCurrency(product.price)}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              )}

              {/* ✅ Bottom actions */}
              <div className="flex flex-col gap-3 pt-2">
                {/* ✅ Explore more products button */}
                <Link
                  to="/products"
                  onClick={onClose}
                  className="flex items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 text-sm font-medium text-white transition hover:opacity-90"
                >
                  Explore all products
                  <ArrowRight size={15} />
                </Link>

                <button
                  onClick={() => { setStep(0); setResults([]); }}
                  className="text-xs text-neutral-400 underline underline-offset-2 hover:text-neutral-600"
                >
                  Start over
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}