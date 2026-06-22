export type Category = "Footwear" | "Apparel" | "Accessories" | "Outdoor";

export interface Product {
  id: string;
  slug: string;
  name: string;
  category: Category;
  price: number;
  popularity: number;
  rating: number;
  reviewCount: number;
  description: string;
  features: string[];
  colors: string[];
  sizes: string[];
  images: string[];
}

export interface Testimonial {
  id: string;
  quote: string;
  author: string;
  location: string;
}

export interface CartItem {
  productId: string;
  quantity: number;
  color: string;
  size: string;
}