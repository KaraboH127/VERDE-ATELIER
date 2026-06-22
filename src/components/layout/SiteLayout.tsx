import { House, LayoutGrid, Search, ShoppingBag } from "lucide-react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { useCart } from "../../context/CartContext";
import { cn } from "../../utils/cn";
import { Input } from "../ui/Input";

const navigation = [
  { label: "Home", to: "/" },
  { label: "Shop", to: "/products" },
  { label: "About", to: "/about" },
  { label: "Contact", to: "/contact" },
];

export function SiteLayout() {
  const { itemCount } = useCart();

  return (
    <div className="min-h-screen bg-[var(--surface)] text-neutral-900">
      <header className="sticky top-0 z-30 border-b border-neutral-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 w-full max-w-[1280px] items-center justify-between px-4 md:h-17 md:px-10">
          <Link to="/" className="text-base font-semibold tracking-[0.16em] text-[var(--accent)] md:text-[1.1rem] md:tracking-[0.22em]">
            VERDE ATELIER
          </Link>

          <nav className="hidden items-center gap-7 text-sm md:flex">
            {navigation.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === "/"}
                className={({ isActive }) =>
                  cn("transition-colors hover:text-[var(--accent)]", isActive ? "text-[var(--accent)]" : "")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <Link
            to="/cart"
            className="relative inline-flex h-11 min-w-11 items-center justify-center rounded-full hover:bg-neutral-100"
            aria-label="Open cart"
          >
            <ShoppingBag size={21} />
            {itemCount > 0 ? (
              <span className="absolute right-0 top-0 inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-xs text-white">
                {itemCount}
              </span>
            ) : null}
          </Link>
        </div>
      </header>

      <main className="pb-20 md:pb-0">
        <Outlet />
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 grid grid-cols-4 border-t border-neutral-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 backdrop-blur md:hidden">
        <NavLink
          to="/"
          end
          className={({ isActive }) =>
            cn(
              "flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg text-[11px]",
              isActive ? "text-[var(--accent)]" : "text-neutral-600"
            )
          }
        >
          <House size={17} />
          Home
        </NavLink>
        <Link
          to="/products?focusSearch=1"
          className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg text-[11px] text-neutral-600"
        >
          <Search size={17} />
          Search
        </Link>
        <Link
          to="/products"
          className="flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg text-[11px] text-neutral-600"
        >
          <LayoutGrid size={17} />
          Shop
        </Link>
        <NavLink
          to="/cart"
          className={({ isActive }) =>
            cn(
              "relative flex min-h-11 flex-col items-center justify-center gap-1 rounded-lg text-[11px]",
              isActive ? "text-[var(--accent)]" : "text-neutral-600"
            )
          }
        >
          <ShoppingBag size={17} />
          Cart
          {itemCount > 0 ? (
            <span className="absolute right-4 top-0 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[var(--accent)] px-1 text-[10px] text-white">
              {itemCount}
            </span>
          ) : null}
        </NavLink>
      </nav>

      <footer className="border-t border-neutral-200 py-14">
        <div className="mx-auto grid w-full max-w-[1280px] gap-10 px-4 md:grid-cols-3 md:px-10">
          <div>
            <p className="text-xs tracking-[0.2em] text-[var(--accent)]">VERDE ATELIER</p>
            <p className="mt-3 max-w-sm text-sm leading-relaxed text-neutral-600">
              Elevated essentials crafted for modern movement. Design-led performance with timeless restraint.
            </p>
          </div>

          <div className="space-y-3 text-sm text-neutral-600">
            <p className="font-medium text-neutral-900">Customer care</p>
            <p>support@verdeatelier.com</p>
            <p>+1 (888) 014-2213</p>
            <p>Mon-Fri, 8am-7pm PST</p>
          </div>

          <div>
            <p className="text-sm font-medium text-neutral-900">Get product drops and stories</p>
            <form className="mt-3 flex flex-col gap-3 sm:flex-row sm:gap-2">
              <Input type="email" aria-label="Email" placeholder="Email address" />
              <button className="h-11 rounded-full bg-[var(--accent)] px-4 text-sm text-white">Join</button>
            </form>
          </div>
        </div>
      </footer>
    </div>
  );
}