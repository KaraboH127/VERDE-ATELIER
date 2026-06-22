import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { ProductCard } from "../components/ProductCard";
import { SEO } from "../components/SEO";
import { Button } from "../components/ui/Button";
import { benefits, categories, products, testimonials } from "../data/store";

const categoryVisuals: Record<string, string> = {
  Footwear:
    "https://images.unsplash.com/photo-1606107557195-0e29a4b5b4aa?auto=format&fit=crop&w=1000&q=80",
  Apparel:
    "https://images.unsplash.com/photo-1551232864-3f0890e580d9?auto=format&fit=crop&w=1000&q=80",
  Accessories:
    "https://images.unsplash.com/photo-1576053139778-7e32f2ae3cfd?auto=format&fit=crop&w=1000&q=80",
  Outdoor:
    "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=1000&q=80",
};

export function HomePage() {
  const featured = products.slice(0, 4);

  return (
    <>
      <SEO
        title="Modern Technical Retail"
        description="Discover premium essentials engineered for everyday movement and elevated style."
        path="/"
      />

      <section className="relative isolate min-h-[78vh] overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1441984904996-e0b6ba687e04?auto=format&fit=crop&w=2200&q=80"
          alt="Verde Atelier storefront"
          className="absolute inset-0 h-full w-full object-cover"
          fetchPriority="high"
        />
        <div className="absolute inset-0 bg-black/38" />

        <motion.div
          className="relative mx-auto flex min-h-[78vh] w-full max-w-[1280px] flex-col justify-center px-4 py-16 text-white md:px-10 md:py-20"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7 }}
        >
          <p className="text-sm tracking-[0.28em]">VERDE ATELIER</p>
          <h1 className="mt-5 max-w-3xl text-3xl font-semibold leading-tight min-[420px]:text-4xl md:text-6xl">
            Intentional essentials for movement, city, and weekend escape.
          </h1>
          <p className="mt-5 max-w-xl text-base text-white/90 md:text-lg">
            Technical craft meets editorial form. Designed to perform and built to last.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/products">
              <Button className="bg-white text-neutral-900 hover:bg-neutral-100">
                Shop collection <ArrowRight size={16} />
              </Button>
            </Link>
            <Link to="/about">
              <Button variant="ghost" className="border border-white/70 text-white hover:bg-white/10">
                Our story
              </Button>
            </Link>
          </div>
        </motion.div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-4 py-16 md:px-10 md:py-20">
        <h2 className="text-2xl font-semibold md:text-3xl">Featured categories</h2>
        <p className="mt-3 max-w-xl text-neutral-600">Explore curated essentials for each part of your week.</p>
        <div className="mt-8 grid grid-cols-2 gap-4 min-[641px]:grid-cols-3 min-[1025px]:grid-cols-4 md:gap-6 lg:gap-8">
          {categories.map((category, index) => (
            <motion.article
              key={category}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.35 }}
              transition={{ delay: index * 0.06, duration: 0.35 }}
              className="group"
            >
              <Link to={`/products?category=${category}`} className="block overflow-hidden rounded-2xl bg-neutral-100">
                <img
                  src={categoryVisuals[category]}
                  alt={category}
                  loading="lazy"
                  className="aspect-[4/5] w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
              </Link>
              <h3 className="mt-4 text-xl font-medium">{category}</h3>
            </motion.article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-4 py-16 md:px-10">
        <h2 className="text-2xl font-semibold md:text-3xl">Featured products</h2>
        <p className="mt-3 max-w-xl text-neutral-600">Bestsellers selected by our product specialists.</p>
        <div className="mt-8 grid grid-cols-2 gap-4 min-[641px]:grid-cols-3 min-[1025px]:grid-cols-4 md:gap-6 lg:gap-8">
          {featured.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section className="mx-auto grid w-full max-w-[1280px] gap-8 px-4 py-16 md:grid-cols-2 md:px-10 md:py-20">
        <img
          src="https://images.unsplash.com/photo-1483985988355-763728e1935b?auto=format&fit=crop&w=1400&q=80"
          alt="Design studio"
          loading="lazy"
          className="h-full min-h-[360px] w-full rounded-2xl object-cover"
        />
        <div className="flex flex-col justify-center">
          <h2 className="text-2xl font-semibold md:text-3xl">Built with fewer, better decisions</h2>
          <p className="mt-4 text-neutral-600">
            Our product team works from first principles: lasting materials, practical silhouettes, and precision in the details. Each launch is refined through wear-testing and customer feedback.
          </p>
          <Link to="/about" className="mt-6 text-sm font-medium text-[var(--accent)]">
            Learn about the atelier
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-4 py-16 md:px-10">
        <h2 className="text-2xl font-semibold md:text-3xl">Why customers stay</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-3">
          {benefits.map((benefit) => (
            <article key={benefit.title} className="space-y-2">
              <h3 className="text-lg font-medium">{benefit.title}</h3>
              <p className="text-neutral-600">{benefit.description}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-4 pb-24 pt-16 md:px-10">
        <h2 className="text-2xl font-semibold md:text-3xl">What people are saying</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {testimonials.map((testimonial) => (
            <blockquote key={testimonial.id} className="space-y-4">
              <p className="text-lg leading-relaxed text-neutral-700">"{testimonial.quote}"</p>
              <footer className="text-sm text-neutral-500">
                {testimonial.author}, {testimonial.location}
              </footer>
            </blockquote>
          ))}
        </div>
      </section>
    </>
  );
}