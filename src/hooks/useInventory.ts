import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

interface StockRow {
  product_id: string;
  size: string;
  color: string;
  quantity: number;
}

export function useInventory(productId: string) {
  const [stock, setStock] = useState<StockRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("inventory")
      .select("product_id, size, color, quantity")
      .eq("product_id", productId)
      .then(({ data }) => {
        setStock(data ?? []);
        setLoading(false);
      });
  }, [productId]);

  const getStock = (size: string, color: string): number => {
    const row = stock.find((s) => s.size === size && s.color === color);
    return row?.quantity ?? 0;
  };

  const isOutOfStock = (size: string, color: string): boolean => {
    return getStock(size, color) === 0;
  };

  // Is entire product out of stock across all variants?
  const isProductOutOfStock = (): boolean => {
    if (stock.length === 0) return false;
    return stock.every((s) => s.quantity === 0);
  };

  return { stock, loading, getStock, isOutOfStock, isProductOutOfStock };
}