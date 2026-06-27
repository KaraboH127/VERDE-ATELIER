import { Lock, ShieldCheck, Truck } from "lucide-react";
import { FormEvent, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SEO } from "../components/SEO";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { useCart } from "../context/CartContext";
import { formatCurrency } from "../utils/format";

const steps = ["Shipping", "Payment"];

export function CheckoutPage() {
  const [step, setStep] = useState(0);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { detailedItems, subtotal, clearCart } = useCart();
  const shipping = subtotal > 150 ? 0 : 15;
  const total = subtotal + shipping;

  const canCheckout = detailedItems.length > 0;

  // ✅ Shipping form state
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
    setIsProcessing(true);
    setPaymentError("");

    try {
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || "http://localhost:3001"}/api/create-checkout`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: total,        // ✅ server multiplies by 100
            currency: "ZAR",
            firstName,            // ✅ shipping fields
            lastName,
            address,
            city,
            postal,
            email,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setPaymentError(data.error || "Could not start payment.");
        setIsProcessing(false);
        return;
      }

      // Redirect customer to Yoco's hosted payment page
      window.location.href = data.redirectUrl;

    } catch {
      setPaymentError("Could not connect to payment server.");
      setIsProcessing(false);
    }
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step === 0) {
      setStep(1);
      return;
    }

    if (step === 1) {
      handleYocoPayment();
    }
  };

  return (
    <>
      <SEO
        title="Checkout"
        description="Complete your order with secure and streamlined checkout."
        path="/checkout"
      />

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

        {success ? (
          <div className="mt-12 max-w-2xl space-y-4">
            <h2 className="text-3xl font-semibold">Order confirmed</h2>
            <p className="text-neutral-600">
              Thanks for shopping with us. A confirmation email has been sent with your order details.
            </p>
            <Button onClick={() => navigate("/products")}>Continue shopping</Button>
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
            <div className="space-y-5">

              {/* ── Step 0: Shipping ── */}
              {step === 0 && (
                <>
                  <h2 className="text-xl font-semibold">Shipping details</h2>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      required
                      placeholder="First name"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                    />
                    <Input
                      required
                      placeholder="Last name"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                    />
                    <Input
                      required
                      className="sm:col-span-2"
                      placeholder="Address"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                    <Input
                      required
                      placeholder="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                    />
                    <Input
                      required
                      placeholder="Postal code"
                      value={postal}
                      onChange={(e) => setPostal(e.target.value)}
                    />
                    <Input
                      required
                      className="sm:col-span-2"
                      type="email"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </>
              )}

              {/* ── Step 1: Payment ── */}
              {step === 1 && (
                <>
                  <h2 className="text-xl font-semibold">Ready to pay</h2>
                  <p className="text-neutral-600">
                    Clicking "Pay now" will take you to a secure Yoco-hosted payment page.
                    You'll be brought back here once complete.
                  </p>
                  <p className="text-lg font-medium text-neutral-900">
                    Total: {formatCurrency(total)}
                  </p>
                  {paymentError && (
                    <p className="text-sm text-red-600">{paymentError}</p>
                  )}
                  {isProcessing && (
                    <p className="text-sm text-neutral-500">Redirecting to payment...</p>
                  )}
                </>
              )}

              <Button
                type="submit"
                disabled={isProcessing || !canCheckout}
                className="w-full sm:w-auto"
              >
                {step === 0
                  ? "Continue"
                  : isProcessing
                  ? "Redirecting..."
                  : "Pay now"}
              </Button>

              {/* These were duplicated in the original — keeping them only once, above the button */}
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
                  <p
                    key={point.label}
                    className="flex items-center gap-2 text-sm text-neutral-600"
                  >
                    <point.icon size={16} className="text-[var(--accent)]" />
                    {point.label}
                  </p>
                ))}
              </div>
            </aside>
          </form>
        )}
      </section>
    </>
  );
}