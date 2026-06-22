import { FormEvent, useState } from "react";
import { SEO } from "../components/SEO";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { faqs } from "../data/store";

export function ContactPage() {
  const [sent, setSent] = useState(false);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSent(true);
  };

  return (
    <>
      <SEO
        title="Contact"
        description="Get in touch with Verde Atelier support and read common FAQs."
        path="/contact"
      />

      <section className="mx-auto w-full max-w-[1280px] px-4 py-12 md:px-10 md:py-14">
        <h1 className="text-3xl font-semibold md:text-4xl">Contact support</h1>
        <p className="mt-3 max-w-2xl text-neutral-600">
          Our team replies within one business day. For order updates, include your order number.
        </p>

        <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_360px]">
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input required placeholder="Name" />
            <Input required type="email" placeholder="Email" />
            <Input placeholder="Order number (optional)" />
            <textarea
              required
              placeholder="How can we help?"
              className="min-h-40 w-full rounded-xl border border-neutral-300 p-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            />
            <Button type="submit">Send message</Button>
            {sent ? <p className="text-sm text-[var(--accent)]">Message sent. We will reply shortly.</p> : null}
          </form>

          <aside className="space-y-5 rounded-2xl bg-neutral-50 p-6">
            <h2 className="text-lg font-semibold">Support details</h2>
            <p className="text-sm text-neutral-600">support@verdeatelier.com</p>
            <p className="text-sm text-neutral-600">+1 (888) 014-2213</p>
            <p className="text-sm text-neutral-600">Mon-Fri 8am-7pm PST</p>
          </aside>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-4 pb-24 pt-8 md:px-10">
        <h2 className="text-2xl font-semibold md:text-3xl">Frequently asked questions</h2>
        <div className="mt-6 space-y-4">
          {faqs.map((faq) => (
            <details key={faq.question} className="rounded-xl border border-neutral-200 px-4 py-3">
              <summary className="min-h-11 cursor-pointer text-sm font-medium leading-6">{faq.question}</summary>
              <p className="pt-3 text-sm text-neutral-600">{faq.answer}</p>
            </details>
          ))}
        </div>
      </section>
    </>
  );
}