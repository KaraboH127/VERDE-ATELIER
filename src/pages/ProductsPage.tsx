import { motion } from "framer-motion";
import { Filter } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FilterDrawer } from "../components/FilterDrawer";
import { ProductCard } from "../components/ProductCard";
import { RecommendButton } from "../components/RecommendButton";
import { SEO } from "../components/SEO";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { categories, products } from "../data/store";

type SortValue = "featured" | "price-low" | "price-high" | "popular";

// ✅ Price range buckets
export const PRICE_RANGES = [
  { label: "All prices", min: 0, max: Infinity },
  { label: "Under R200", min: 0, max: 200 },
  { label: "R200 – R500", min: 200, max: 500 },
  { label: "R500 – R1000", min: 500, max: 1000 },
  { label: "R1000+", min: 1000, max: Infinity },
];

export type PriceRange = (typeof PRICE_RANGES)[number];

export function ProductsPage() {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get("category") ?? "All";
  const focusSearch = searchParams.get("focusSearch") === "1";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [priceRange, setPriceRange] = useState<PriceRange>(PRICE_RANGES[0]); // ✅ replaces maxPrice
  const [sort, setSort] = useState<SortValue>("featured");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSearch) searchRef.current?.focus();
  }, [focusSearch]);

  const filteredProducts = useMemo(() => {
    return [...products]
      .filter((p) => category === "All" || p.category === category)
      .filter((p) => p.price >= priceRange.min && p.price <= priceRange.max) // ✅ uses range
      .filter((p) => {
        if (!query.trim()) return true;
        return `${p.name} ${p.description}`.toLowerCase().includes(query.toLowerCase());
      })
      .sort((a, b) => {
        if (sort === "price-low") return a.price - b.price;
        if (sort === "price-high") return b.price - a.price;
        return b.popularity - a.popularity;
      });
  }, [category, priceRange, query, sort]);

  return (
    <>
      <SEO
        title="Shop Products"
        description="Browse premium apparel, footwear, accessories, and outdoor essentials."
        path="/products"
      />

      <section className="mx-auto w-full max-w-[1280px] px-4 py-12 md:px-10 md:py-16">
        <h1 className="text-3xl font-semibold leading-tight md:text-4xl">Shop the collection</h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Purpose-built products designed around comfort, durability, and refined aesthetics.
        </p>

        <div className="mt-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <Input
            ref={searchRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            className="md:max-w-sm"
          />
          <div className="grid grid-cols-2 gap-3 md:flex">
            <Button
              variant="secondary"
              className="w-full min-[1025px]:hidden"
              onClick={() => setDrawerOpen(true)}
            >
              <Filter size={16} /> Filters
            </Button>
            <select
              aria-label="Sort products"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortValue)}
              className="h-11 w-full min-w-0 rounded-full border border-neutral-300 px-4 text-sm"
            >
              <option value="featured">Featured</option>
              <option value="popular">Most popular</option>
              <option value="price-low">Price: Low to high</option>
              <option value="price-high">Price: High to low</option>
            </select>
          </div>
        </div>

        <div className="mt-10 grid gap-8 min-[1025px]:grid-cols-[260px_1fr]">

          {/* ── Desktop sidebar ── */}
          <aside className="hidden space-y-8 min-[1025px]:block">
            <div>
              <h2 className="text-sm font-medium text-neutral-900">Category</h2>
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="radio"
                    checked={category === "All"}
                    onChange={() => setCategory("All")}
                    className="h-4 w-4"
                  />
                  All
                </label>
                {categories.map((entry) => (
                  <label key={entry} className="flex items-center gap-3 text-sm">
                    <input
                      type="radio"
                      checked={category === entry}
                      onChange={() => setCategory(entry)}
                      className="h-4 w-4"
                    />
                    {entry}
                  </label>
                ))}
              </div>
            </div>

            {/* ✅ Price range buckets — desktop */}
            <div>
              <h2 className="text-sm font-medium text-neutral-900">Price range</h2>
              <div className="mt-3 space-y-3">
                {PRICE_RANGES.map((range) => (
                  <label key={range.label} className="flex items-center gap-3 text-sm">
                    <input
                      type="radio"
                      name="price-range-desktop"
                      checked={priceRange.label === range.label}
                      onChange={() => setPriceRange(range)}
                      className="h-4 w-4"
                    />
                    {range.label}
                  </label>
                ))}
              </div>
            </div>
          </aside>

          {/* ── Product grid ── */}
          <div>
            <p className="mb-5 text-sm text-neutral-500">{filteredProducts.length} products</p>
            <motion.div
              layout
              className="grid grid-cols-2 gap-4 min-[641px]:grid-cols-3 min-[1025px]:grid-cols-4 md:gap-6 lg:gap-8"
            >
              {filteredProducts.map((product) => (
                <motion.div key={product.id} layout>
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </motion.div>
            {filteredProducts.length === 0 && (
              <p className="py-10 text-center text-neutral-600">
                No products found. Try adjusting your filters.
              </p>
            )}
          </div>
        </div>

        <div className="mt-12">
          <RecommendButton />
        </div>
      </section>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selectedCategory={category}
        onCategoryChange={setCategory}
        priceRange={priceRange}           // ✅ replaces maxPrice
        onPriceRangeChange={(range) => {  // ✅ replaces onPriceChange
          setPriceRange(range);
        }}
      />
    </>
  );
}