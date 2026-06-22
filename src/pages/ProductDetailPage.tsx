import { Check, Minus, Plus, Truck } from "lucide-react";
import { useMemo, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { SEO } from "../components/SEO";
import { Button } from "../components/ui/Button";
import { useCart } from "../context/CartContext";
import { products } from "../data/store";
import { formatCurrency } from "../utils/format";

const reviewContent = [
  { author: "Nina L.", text: "Premium build and comfort from day one.", rating: 5 },
  { author: "Kai D.", text: "Exactly matches the photos and fits true to size.", rating: 5 },
  { author: "Sam P.", text: "Great quality and fast shipping experience.", rating: 4 },
];

export function ProductDetailPage() {
  const { slug } = useParams();
  const product = products.find((item) => item.slug === slug);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedColor, setSelectedColor] = useState(product?.colors[0] ?? "");
  const [selectedSize, setSelectedSize] = useState(product?.sizes[0] ?? "");
  const [quantity, setQuantity] = useState(1);
  const [zoomed, setZoomed] = useState(false);
  const { addToCart } = useCart();

  const related = useMemo(() => {
    if (!product) return [];
    return products.filter((entry) => entry.category === product.category && entry.id !== product.id).slice(0, 4);
  }, [product]);

  if (!product) {
    return <Navigate to="/products" replace />;
  }

  return (
    <>
      <SEO title={product.name} description={product.description} path={`/products/${product.slug}`} />

      <section className="mx-auto grid w-full max-w-[1280px] gap-10 px-4 py-12 md:grid-cols-2 md:px-10 md:py-14">
        <div>
          <div className="group relative overflow-hidden rounded-2xl bg-neutral-100">
            <img
              src={product.images[selectedImage]}
              alt={product.name}
              className={`aspect-[4/5] w-full object-cover transition-transform duration-500 ${zoomed ? "scale-125" : "scale-100"}`}
            />
            <button
              onClick={() => setZoomed((state) => !state)}
              className="absolute bottom-4 right-4 rounded-full bg-white px-4 py-2 text-xs font-medium text-neutral-900"
            >
              {zoomed ? "Reset zoom" : "Zoom image"}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-3">
            {product.images.map((image, index) => (
              <button
                key={image}
                onClick={() => setSelectedImage(index)}
                className={`overflow-hidden rounded-xl border ${selectedImage === index ? "border-[var(--accent)]" : "border-transparent"}`}
                aria-label={`View image ${index + 1}`}
              >
                <img src={image} alt={`${product.name} view ${index + 1}`} loading="lazy" className="aspect-square w-full object-cover" />
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="text-sm text-neutral-500">{product.category}</p>
          <h1 className="mt-2 text-3xl font-semibold leading-tight md:text-4xl">{product.name}</h1>
          <p className="mt-3 text-2xl font-medium">{formatCurrency(product.price)}</p>
          <p className="mt-4 max-w-xl text-neutral-600">{product.description}</p>

          <div className="mt-7 space-y-6">
            <div>
              <p className="mb-3 text-sm font-medium">Color</p>
              <div className="flex flex-wrap gap-2">
                {product.colors.map((color) => (
                  <button
                    key={color}
                    onClick={() => setSelectedColor(color)}
                    className={`min-h-11 rounded-full border px-4 text-sm ${
                      selectedColor === color ? "border-[var(--accent)] text-[var(--accent)]" : "border-neutral-300"
                    }`}
                  >
                    {color}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="mb-3 text-sm font-medium">Size</p>
              <div className="flex flex-wrap gap-2">
                {product.sizes.map((size) => (
                  <button
                    key={size}
                    onClick={() => setSelectedSize(size)}
                    className={`min-h-11 rounded-full border px-4 text-sm ${
                      selectedSize === size ? "border-[var(--accent)] text-[var(--accent)]" : "border-neutral-300"
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="inline-flex h-11 items-center rounded-full border border-neutral-300">
                <button
                  className="inline-flex h-11 w-11 items-center justify-center"
                  onClick={() => setQuantity((value) => Math.max(1, value - 1))}
                  aria-label="Decrease quantity"
                >
                  <Minus size={16} />
                </button>
                <span className="min-w-10 text-center text-sm">{quantity}</span>
                <button
                  className="inline-flex h-11 w-11 items-center justify-center"
                  onClick={() => setQuantity((value) => value + 1)}
                  aria-label="Increase quantity"
                >
                  <Plus size={16} />
                </button>
              </div>
              <Button
                className="flex-1"
                onClick={() =>
                  addToCart({
                    productId: product.id,
                    quantity,
                    color: selectedColor,
                    size: selectedSize,
                  })
                }
              >
                Add to cart
              </Button>
            </div>
          </div>

          <div className="mt-7 space-y-3 text-sm text-neutral-600">
            <div className="flex items-start gap-3">
              <Truck size={18} className="mt-0.5 text-[var(--accent)]" />
              Free delivery in 2-4 days, returns within 30 days.
            </div>
            <div className="flex items-start gap-3">
              <Check size={18} className="mt-0.5 text-[var(--accent)]" />
              Covered by lifetime repair program for functional defects.
            </div>
          </div>

          <ul className="mt-8 space-y-2 text-sm text-neutral-700">
            {product.features.map((feature) => (
              <li key={feature} className="flex gap-2">
                <span className="text-[var(--accent)]">-</span> {feature}
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-4 py-12 md:px-10">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Related products</h2>
          <Link to="/products" className="text-sm font-medium text-[var(--accent)]">
            View all
          </Link>
        </div>
        <div className="mt-8 grid grid-cols-2 gap-4 min-[641px]:grid-cols-3 min-[1025px]:grid-cols-4 md:gap-6 lg:gap-8">
          {related.map((entry) => (
            <ProductCard key={entry.id} product={entry} />
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-4 pb-24 pt-10 md:px-10">
        <h2 className="text-2xl font-semibold">Customer reviews</h2>
        <div className="mt-6 grid gap-6 md:grid-cols-3">
          {reviewContent.map((review) => (
            <article key={review.author} className="space-y-3">
              <p className="text-sm text-amber-500">{"★".repeat(review.rating)}</p>
              <p className="text-neutral-700">{review.text}</p>
              <p className="text-sm text-neutral-500">{review.author}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}