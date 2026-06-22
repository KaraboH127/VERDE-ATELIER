import { Link } from "react-router-dom";
import { Product } from "../types";
import { formatCurrency } from "../utils/format";
import { Badge } from "./ui/Badge";

interface ProductCardProps {
  product: Product;
}

export function ProductCard({ product }: ProductCardProps) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white">
      <Link
        to={`/products/${product.slug}`}
        className="block overflow-hidden rounded-2xl bg-neutral-100"
        aria-label={`View ${product.name}`}
      >
        <img
          src={product.images[0]}
          alt={product.name}
          loading="lazy"
          className="aspect-[4/5] w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
        />
      </Link>

      <div className="flex flex-1 flex-col gap-3 px-3 pb-3 pt-4 sm:px-4 sm:pb-4">
        <div className="flex items-center justify-between gap-2">
          <Badge text={product.category} />
        </div>

        <div className="flex flex-1 flex-col gap-2">
          <Link to={`/products/${product.slug}`} className="text-base font-medium leading-snug text-neutral-900 sm:text-lg">
            {product.name}
          </Link>
          <p className="mt-auto text-sm font-medium text-neutral-700 sm:text-base">{formatCurrency(product.price)}</p>
        </div>
      </div>
    </article>
  );
}