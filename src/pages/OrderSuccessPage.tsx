import { useEffect } from "react";
import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";
import { Button } from "../components/ui/Button";
import { useCart } from "../context/CartContext";

export function OrderSuccessPage() {
  const { clearCart } = useCart();

  // Clear the cart when they land here
  useEffect(() => {
    clearCart();
  }, []);

  return (
    <>
      <SEO
        title="Order Confirmed"
        description="Your payment was successful."
        path="/order-success"
      />
      <section className="mx-auto flex min-h-[70vh] w-full max-w-[1280px] flex-col items-start justify-center px-4 md:px-10">
        <p className="text-sm tracking-[0.2em] text-[var(--accent)]">PAYMENT SUCCESSFUL</p>
        <h1 className="mt-2 text-4xl font-semibold">Order confirmed</h1>
        <p className="mt-3 max-w-md text-neutral-600">
          Thanks for shopping with Verde Atelier. A confirmation email will be sent shortly.
        </p>
        <Link to="/products" className="mt-6">
          <Button>Continue shopping</Button>
        </Link>
      </section>
    </>
  );
}