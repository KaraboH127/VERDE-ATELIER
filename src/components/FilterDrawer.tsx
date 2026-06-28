import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { X } from "lucide-react";
import { categories } from "../data/store";
import { PRICE_RANGES, PriceRange } from "../pages/ProductsPage";
import { Button } from "./ui/Button";

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  priceRange: PriceRange;
  onPriceRangeChange: (range: PriceRange) => void;
}

export function FilterDrawer({
  open,
  onClose,
  selectedCategory,
  onCategoryChange,
  priceRange,
  onPriceRangeChange,
}: FilterDrawerProps) {

  // ✅ Lock background scroll when drawer is open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            aria-label="Close filters"
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
          <motion.aside
            className="fixed right-0 top-0 z-50 h-full w-full bg-white sm:max-w-sm flex flex-col" // ✅ flex-col, no padding here
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            {/* ✅ Fixed header — never scrolls away */}
            <div className="flex items-center justify-between px-5 pt-4 pb-4 border-b border-neutral-100 flex-shrink-0">
              <h3 className="text-lg font-semibold">Filters</h3>
              <Button onClick={onClose} variant="ghost" className="h-11 w-11 rounded-full p-0">
                <X size={18} />
              </Button>
            </div>

            {/* ✅ Scrollable content area */}
            <div className="overflow-y-auto flex-1 px-5 py-6 space-y-8">

              {/* ── Category ── */}
              <fieldset>
                <legend className="text-sm font-medium text-neutral-900">Category</legend>
                <div className="mt-3 space-y-3">
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="radio"
                      name="category"
                      checked={selectedCategory === "All"}
                      onChange={() => { onCategoryChange("All"); onClose(); }}
                      className="h-4 w-4"
                    />
                    All
                  </label>
                  {categories.map((cat) => (
                    <label key={cat} className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="radio"
                        name="category"
                        checked={selectedCategory === cat}
                        onChange={() => { onCategoryChange(cat); onClose(); }}
                        className="h-4 w-4"
                      />
                      {cat}
                    </label>
                  ))}
                </div>
              </fieldset>

              {/* ── Price range buckets ── */}
              <fieldset>
                <legend className="text-sm font-medium text-neutral-900">Price range</legend>
                <div className="mt-3 space-y-3">
                  {PRICE_RANGES.map((range) => (
                    <label key={range.label} className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="radio"
                        name="price-range"
                        checked={priceRange.label === range.label}
                        onChange={() => { onPriceRangeChange(range); onClose(); }}
                        className="h-4 w-4"
                      />
                      {range.label}
                    </label>
                  ))}
                </div>
              </fieldset>

            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}