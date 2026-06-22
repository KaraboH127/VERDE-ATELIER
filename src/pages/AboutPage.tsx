import { SEO } from "../components/SEO";

const values = [
  {
    title: "Purposeful design",
    text: "We remove excess and keep what improves fit, function, and longevity.",
  },
  {
    title: "Responsible sourcing",
    text: "We prioritize traceable mills and factory partners with fair labor standards.",
  },
  {
    title: "Built to repair",
    text: "Our core line includes replaceable and repairable elements to extend lifecycle.",
  },
];

export function AboutPage() {
  return (
    <>
      <SEO
        title="About"
        description="Learn about Verde Atelier's mission, values, and design approach."
        path="/about"
      />

      <section className="mx-auto w-full max-w-[1280px] px-4 py-12 md:px-10 md:py-14">
        <h1 className="text-3xl font-semibold leading-tight md:text-4xl">A brand built around intentional living</h1>
        <p className="mt-5 max-w-3xl text-lg text-neutral-600">
          Verde Atelier began with one idea: modern life needs fewer products, but each product should do more. We blend technical performance with quiet aesthetics for people who move between city pace and outdoor reset.
        </p>
      </section>

      <section className="mx-auto grid w-full max-w-[1280px] gap-8 px-4 py-12 md:grid-cols-2 md:px-10 md:py-14">
        <img
          src="https://images.unsplash.com/photo-1497215842964-222b430dc094?auto=format&fit=crop&w=1400&q=80"
          alt="Verde Atelier studio"
          className="h-full min-h-[360px] w-full rounded-2xl object-cover"
          loading="lazy"
        />
        <div className="flex flex-col justify-center">
          <h2 className="text-2xl font-semibold md:text-3xl">From atelier to everyday wear</h2>
          <p className="mt-4 text-neutral-600">
            Every release starts in our material lab and field testing program. We study movement patterns, climate variability, and customer feedback, then refine details until products feel effortless.
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-[1280px] px-4 pb-24 pt-10 md:px-10">
        <h2 className="text-2xl font-semibold md:text-3xl">Our values</h2>
        <div className="mt-8 grid gap-8 md:grid-cols-3">
          {values.map((value) => (
            <article key={value.title} className="space-y-2">
              <h3 className="text-xl font-medium">{value.title}</h3>
              <p className="text-neutral-600">{value.text}</p>
            </article>
          ))}
        </div>
      </section>
    </>
  );
}