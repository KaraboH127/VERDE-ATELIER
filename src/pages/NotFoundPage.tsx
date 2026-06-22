import { Link } from "react-router-dom";
import { SEO } from "../components/SEO";
import { Button } from "../components/ui/Button";

export function NotFoundPage() {
  return (
    <section className="mx-auto flex min-h-[70vh] w-full max-w-[1280px] flex-col items-start justify-center px-4 md:px-10">
      <SEO title="Page Not Found" description="The page you are looking for does not exist." path="/404" />
      <p className="text-sm tracking-[0.2em] text-[var(--accent)]">404</p>
      <h1 className="mt-2 text-4xl font-semibold">Page not found</h1>
      <p className="mt-3 text-neutral-600">The page may have moved or no longer exists.</p>
      <Link to="/" className="mt-6">
        <Button>Back home</Button>
      </Link>
    </section>
  );
}