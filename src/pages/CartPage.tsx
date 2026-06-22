import { Minus, Plus, Trash2 } from "lucide-react";
import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";
import { Button } from "../components/ui/Button";
import { useCart } from "../context/CartContext";
import { formatCurrency } from "../utils/format";

export function CartPage() {
  const { detailedItems, subtotal, updateQuantity, removeItem } = useCart();
  const shipping = subtotal > 150 ? 0 : 15;
  const total = subtotal + shipping;

  return (
    <>
      <SEO
        title="Your Cart"
        description="Review selected items and proceed to secure checkout."
        path="/cart"
      />

      <section className="mx-auto w-full max-w-[1280px] px-4 py-12 md:px-10 md:py-14">
        <h1 className="text-3xl font-semibold md:text-4xl">Shopping cart</h1>

        {detailedItems.length === 0 ? (
          <div className="py-16">
            <p className="text-lg text-neutral-600">Your cart is currently empty.</p>
            <Link to="/products" className="mt-5 inline-flex">
              <Button>Explore products</Button>
            </Link>
          </div>
        ) : (
          <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_340px]">
            <div className="space-y-8">
              {detailedItems.map((item) => (
                <article key={`${item.productId}-${item.color}-${item.size}`} className="grid grid-cols-[96px_1fr] gap-4">
                  <img
                    src={item.product.images[0]}
                    alt={item.product.name}
                    loading="lazy"
                    className="aspect-square w-24 rounded-xl object-cover"
                  />
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium">{item.product.name}</p>
                        <p className="text-sm text-neutral-500">
                          {item.color} / {item.size}
                        </p>
                      </div>
                      <p className="font-medium">{formatCurrency(item.lineTotal)}</p>
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-3">
                      <div className="inline-flex h-11 items-center rounded-full border border-neutral-300">
                        <button
                          className="inline-flex h-11 w-11 items-center justify-center"
                          onClick={() => updateQuantity(item, Math.max(1, item.quantity - 1))}
                          aria-label="Decrease quantity"
                        >
                          <Minus size={16} />
                        </button>
                        <span className="min-w-10 text-center text-sm">{item.quantity}</span>
                        <button
                          className="inline-flex h-11 w-11 items-center justify-center"
                          onClick={() => updateQuantity(item, item.quantity + 1)}
                          aria-label="Increase quantity"
                        >
                          <Plus size={16} />
                        </button>
                      </div>

                      <button
                        onClick={() => removeItem(item)}
                        className="inline-flex min-h-11 items-center gap-2 text-sm text-neutral-500 hover:text-red-600"
                      >
                        <Trash2 size={16} /> Remove
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>

            <aside className="h-fit rounded-2xl bg-neutral-50 p-6">
              <h2 className="text-lg font-semibold">Summary</h2>
              <dl className="mt-5 space-y-3 text-sm text-neutral-600">
                <div className="flex items-center justify-between">
                  <dt>Subtotal</dt>
                  <dd>{formatCurrency(subtotal)}</dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt>Shipping</dt>
                  <dd>{shipping === 0 ? "Free" : formatCurrency(shipping)}</dd>
                </div>
                <div className="flex items-center justify-between border-t border-neutral-200 pt-3 text-base font-semibold text-neutral-900">
                  <dt>Total</dt>
                  <dd>{formatCurrency(total)}</dd>
                </div>
              </dl>
              <Link to="/checkout" className="mt-6 inline-flex w-full">
                <Button className="w-full">Continue to checkout</Button>
              </Link>
            </aside>
          </div>
        )}
      </section>
    </>
  );
}