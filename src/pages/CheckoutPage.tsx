import { Lock, ShieldCheck, Truck } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "../components/SEO";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useCart } from "../context/CartContext";
import { formatCurrency } from "../utils/format";

const steps = ["Shipping", "Payment"];

// ── Processing overlay ──────────────────────────────────────────
function ProcessingOverlay() {
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-emerald-600">
      {/* Spinner */}
      <div className="relative flex items-center justify-center">
        <div className="h-16 w-16 animate-spin rounded-full border-4 border-white/30 border-t-white" />
        <Lock size={20} className="absolute text-white" />
      </div>

      {/* Text */}
      <p className="mt-6 text-xl font-semibold text-white">Securing your payment</p>
      <p className="mt-2 text-sm text-emerald-100">
        Please don't close this tab — you'll be redirected shortly.
      </p>

      {/* Trust badges */}
      <div className="mt-10 flex gap-6 text-emerald-100">
        <span className="flex items-center gap-1.5 text-xs">
          <ShieldCheck size={14} /> Buyer protection
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <Lock size={14} /> 256-bit encryption
        </span>
        <span className="flex items-center gap-1.5 text-xs">
          <Truck size={14} /> Tracked delivery
        </span>
      </div>
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────
export function CheckoutPage() {
  const [step, setStep] = useState(0);
  const navigate = useNavigate();
  const { detailedItems, subtotal, clearCart } = useCart();
  const shipping = subtotal > 150 ? 0 : 15;
  const total = subtotal + shipping;
  const canCheckout = detailedItems.length > 0;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [postal, setPostal] = useState("");
  const [email, setEmail] = useState("");

  const [paymentError, setPaymentError] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const trustPoints = useMemo(
    () => [
      { icon: Lock, label: "Encrypted payment" },
      { icon: ShieldCheck, label: "Buyer protection" },
      { icon: Truck, label: "Tracked delivery" },
    ],
    []
  );

  const handleYocoPayment = async () => {
    setIsProcessing(true); // ← overlay appears immediately
    setPaymentError("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/create-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: total,
            currency: "ZAR",
            firstName,
            lastName,
            address,
            city,
            postal,
            email,
            items: detailedItems,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setPaymentError(data.error || "Could not start payment.");
        setIsProcessing(false); // ← hide overlay on error
        return;
      }

      // Auto-redirect — overlay stays visible until Yoco loads
      window.location.href = data.redirectUrl;

    } catch {
      setPaymentError("Could not connect to payment server.");
      setIsProcessing(false); // ← hide overlay on error
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step === 0) { setStep(1); return; }
    if (step === 1) { handleYocoPayment(); }
  };

  return (
    <>
      <SEO
        title="Checkout"
        description="Complete your order with secure and streamlined checkout."
        path="/checkout"
      />

      {/* ── Processing overlay — renders on top of everything ── */}
      {isProcessing && <ProcessingOverlay />}

      <section className="mx-auto w-full max-w-[1280px] px-4 py-12 md:px-10 md:py-14">
        <h1 className="text-3xl font-semibold md:text-4xl">Checkout</h1>

        <ol className="mt-6 flex flex-wrap gap-3 text-sm">
          {steps.map((label, index) => (
            <li
              key={label}
              className={`min-h-11 rounded-full px-4 py-2 ${
                index <= step
                  ? "bg-[var(--accent)] text-white"
                  : "bg-neutral-100 text-neutral-500"
              }`}
            >
              {index + 1}. {label}
            </li>
          ))}
        </ol>

        <form onSubmit={onSubmit} className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          <div className="space-y-5">

            {/* ── Step 0: Shipping ── */}
            {step === 0 && (
              <>
                <h2 className="text-xl font-semibold">Shipping details</h2>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input required placeholder="First name" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
                  <Input required placeholder="Last name" value={lastName} onChange={(e) => setLastName(e.target.value)} />
                  <Input required className="sm:col-span-2" placeholder="Address" value={address} onChange={(e) => setAddress(e.target.value)} />
                  <Input required placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} />
                  <Input required placeholder="Postal code" value={postal} onChange={(e) => setPostal(e.target.value)} />
                  <Input required className="sm:col-span-2" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
              </>
            )}

            {/* ── Step 1: Payment ── */}
            {step === 1 && (
              <>
                <h2 className="text-xl font-semibold">Ready to pay</h2>
                <p className="text-neutral-600">
                  You'll be taken to a secure Yoco payment page. We'll confirm your order the moment payment goes through.
                </p>
                <p className="text-lg font-medium text-neutral-900">
                  Total: {formatCurrency(total)}
                </p>
                {paymentError && (
                  <p className="text-sm text-red-600">{paymentError}</p>
                )}
              </>
            )}

            <Button type="submit" disabled={isProcessing || !canCheckout} className="w-full sm:w-auto">
              {step === 0 ? "Continue" : "Pay now"}
            </Button>

          </div>

          {/* ── Order summary sidebar ── */}
          <aside className="h-fit rounded-2xl bg-neutral-50 p-6">
            <h2 className="text-lg font-semibold">Order summary</h2>
            <div className="mt-5 space-y-3 text-sm text-neutral-600">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{shipping === 0 ? "Free" : formatCurrency(shipping)}</span>
              </div>
              <div className="flex justify-between border-t border-neutral-200 pt-3 text-base font-semibold text-neutral-900">
                <span>Total</span>
                <span>{formatCurrency(total)}</span>
              </div>
            </div>
            <div className="mt-6 space-y-3 border-t border-neutral-200 pt-5">
              {trustPoints.map((point) => (
                <p key={point.label} className="flex items-center gap-2 text-sm text-neutral-600">
                  <point.icon size={16} className="text-[var(--accent)]" />
                  {point.label}
                </p>
              ))}
            </div>
          </aside>
        </form>
      </section>
    </>
  );
}