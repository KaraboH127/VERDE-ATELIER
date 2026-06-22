import { motion } from "framer-motion";
import { Filter } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FilterDrawer } from "../components/FilterDrawer";
import { ProductCard } from "../components/ProductCard";
import { SEO } from "../components/SEO";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { categories, products } from "../data/store";

type SortValue = "featured" | "price-low" | "price-high" | "popular";

export function ProductsPage() {
  const [searchParams] = useSearchParams();
  const initialCategory = searchParams.get("category") ?? "All";
  const focusSearch = searchParams.get("focusSearch") === "1";
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState(initialCategory);
  const [maxPrice, setMaxPrice] = useState(300);
  const [sort, setSort] = useState<SortValue>("featured");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (focusSearch) {
      searchRef.current?.focus();
    }
  }, [focusSearch]);

  const filteredProducts = useMemo(() => {
    return [...products]
      .filter((product) => (category === "All" ? true : product.category === category))
      .filter((product) => product.price <= maxPrice)
      .filter((product) => {
        if (!query.trim()) return true;
        return `${product.name} ${product.description}`.toLowerCase().includes(query.toLowerCase());
      })
      .sort((a, b) => {
        if (sort === "price-low") return a.price - b.price;
        if (sort === "price-high") return b.price - a.price;
        if (sort === "popular") return b.popularity - a.popularity;
        return b.popularity - a.popularity;
      });
  }, [category, maxPrice, query, sort]);

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
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search products"
            aria-label="Search products"
            className="md:max-w-sm"
          />

          <div className="grid grid-cols-2 gap-3 md:flex">
            <Button variant="secondary" className="w-full min-[1025px]:hidden" onClick={() => setDrawerOpen(true)}>
              <Filter size={16} /> Filters
            </Button>
            <select
              aria-label="Sort products"
              value={sort}
              onChange={(event) => setSort(event.target.value as SortValue)}
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
          <aside className="hidden space-y-8 min-[1025px]:block">
            <div>
              <h2 className="text-sm font-medium text-neutral-900">Category</h2>
              <div className="mt-3 space-y-3">
                <label className="flex items-center gap-3 text-sm">
                  <input type="radio" checked={category === "All"} onChange={() => setCategory("All")} />
                  All
                </label>
                {categories.map((entry) => (
                  <label key={entry} className="flex items-center gap-3 text-sm">
                    <input
                      type="radio"
                      checked={category === entry}
                      onChange={() => setCategory(entry)}
                    />
                    {entry}
                  </label>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-sm font-medium text-neutral-900">Price up to ${maxPrice}</h2>
              <input
                type="range"
                min={60}
                max={300}
                step={10}
                value={maxPrice}
                onChange={(event) => setMaxPrice(Number(event.target.value))}
                className="mt-3 w-full accent-[var(--accent)]"
              />
            </div>
          </aside>

          <div>
            <p className="mb-5 text-sm text-neutral-500">{filteredProducts.length} products</p>
            <motion.div layout className="grid grid-cols-2 gap-4 min-[641px]:grid-cols-3 min-[1025px]:grid-cols-4 md:gap-6 lg:gap-8">
              {filteredProducts.map((product) => (
                <motion.div key={product.id} layout>
                  <ProductCard product={product} />
                </motion.div>
              ))}
            </motion.div>
            {filteredProducts.length === 0 ? (
              <p className="py-10 text-center text-neutral-600">No products found. Try adjusting your filters.</p>
            ) : null}
          </div>
        </div>
      </section>

      <FilterDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        selectedCategory={category}
        onCategoryChange={setCategory}
        maxPrice={maxPrice}
        onPriceChange={setMaxPrice}
      />
    </>
  );
}