import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { categories } from "../data/store";
import { Button } from "./ui/Button";

interface FilterDrawerProps {
  open: boolean;
  onClose: () => void;
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
  maxPrice: number;
  onPriceChange: (value: number) => void;
}

export function FilterDrawer({
  open,
  onClose,
  selectedCategory,
  onCategoryChange,
  maxPrice,
  onPriceChange,
}: FilterDrawerProps) {
  return (
    <AnimatePresence>
      {open ? (
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
            className="fixed right-0 top-0 z-50 h-full w-full bg-white px-5 pb-8 pt-4 sm:max-w-sm"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
          >
            <div className="mb-8 flex items-center justify-between">
              <h3 className="text-lg font-semibold">Filters</h3>
              <Button onClick={onClose} variant="ghost" className="h-11 w-11 rounded-full p-0">
                <X size={18} />
              </Button>
            </div>

            <div className="space-y-8">
              <fieldset>
                <legend className="text-sm font-medium text-neutral-900">Category</legend>
                <div className="mt-3 space-y-3">
                  <label className="flex min-h-11 items-center gap-3 text-sm">
                    <input
                      type="radio"
                      name="category"
                      checked={selectedCategory === "All"}
                      onChange={() => onCategoryChange("All")}
                      className="h-4 w-4"
                    />
                    All
                  </label>
                  {categories.map((category) => (
                    <label key={category} className="flex min-h-11 items-center gap-3 text-sm">
                      <input
                        type="radio"
                        name="category"
                        checked={selectedCategory === category}
                        onChange={() => onCategoryChange(category)}
                        className="h-4 w-4"
                      />
                      {category}
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset>
                <legend className="text-sm font-medium text-neutral-900">Max price: R{maxPrice}</legend>
                <input
                  type="range"
                  min={60}
                  max={300}
                  step={10}
                  value={maxPrice}
                  onChange={(event) => onPriceChange(Number(event.target.value))}
                  className="mt-3 w-full accent-[var(--accent)]"
                />
              </fieldset>
            </div>
          </motion.aside>
        </>
      ) : null}
    </AnimatePresence>
  );
}