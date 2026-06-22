import { createContext, type ReactNode, useContext, useEffect, useMemo, useState } from "react";
import { products } from "../data/store";
import { CartItem, Product } from "../types";

interface DetailedCartItem extends CartItem {
  product: Product;
  lineTotal: number;
}

interface CartContextValue {
  items: CartItem[];
  detailedItems: DetailedCartItem[];
  itemCount: number;
  subtotal: number;
  addToCart: (item: CartItem) => void;
  updateQuantity: (item: CartItem, quantity: number) => void;
  removeItem: (item: CartItem) => void;
  clearCart: () => void;
}

const CART_KEY = "verde-cart";

const CartContext = createContext<CartContextValue | undefined>(undefined);

function isSameLine(a: CartItem, b: CartItem) {
  return a.productId === b.productId && a.color === b.color && a.size === b.size;
}

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem(CART_KEY);
    if (saved) {
      setItems(JSON.parse(saved) as CartItem[]);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(items));
  }, [items]);

  const addToCart = (newItem: CartItem) => {
    setItems((prev) => {
      const existing = prev.find((item) => isSameLine(item, newItem));
      if (!existing) {
        return [...prev, newItem];
      }

      return prev.map((item) =>
        isSameLine(item, newItem) ? { ...item, quantity: item.quantity + newItem.quantity } : item
      );
    });
  };

  const updateQuantity = (target: CartItem, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) =>
      prev.map((item) => (isSameLine(item, target) ? { ...item, quantity } : item))
    );
  };

  const removeItem = (target: CartItem) => {
    setItems((prev) => prev.filter((item) => !isSameLine(item, target)));
  };

  const clearCart = () => setItems([]);

  const detailedItems = useMemo(
    () =>
      items
        .map((item) => {
          const product = products.find((p) => p.id === item.productId);
          if (!product) return null;

          return {
            ...item,
            product,
            lineTotal: product.price * item.quantity,
          };
        })
        .filter(Boolean) as DetailedCartItem[],
    [items]
  );

  const subtotal = detailedItems.reduce((total, item) => total + item.lineTotal, 0);
  const itemCount = items.reduce((total, item) => total + item.quantity, 0);

  const value: CartContextValue = {
    items,
    detailedItems,
    itemCount,
    subtotal,
    addToCart,
    updateQuantity,
    removeItem,
    clearCart,
  };

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error("useCart must be used within CartProvider");
  }
  return context;
}