import { useEffect } from "react";

interface SEOProps {
  title: string;
  description: string;
  path: string;
}

function upsertMeta(selector: string, attribute: "name" | "property", value: string, content: string) {
  let tag = document.head.querySelector(selector) as HTMLMetaElement | null;
  if (!tag) {
    tag = document.createElement("meta");
    tag.setAttribute(attribute, value);
    document.head.appendChild(tag);
  }
  tag.content = content;
}

export function SEO({ title, description, path }: SEOProps) {
  useEffect(() => {
    const fullTitle = `${title} | VERDE ATELIER`;
    const url = `https://verde-atelier.com${path}`;

    document.title = fullTitle;
    upsertMeta('meta[name="description"]', "name", "description", description);
    upsertMeta('meta[property="og:title"]', "property", "og:title", fullTitle);
    upsertMeta('meta[property="og:description"]', "property", "og:description", description);
    upsertMeta('meta[property="og:type"]', "property", "og:type", "website");
    upsertMeta('meta[property="og:url"]', "property", "og:url", url);
  }, [description, path, title]);

  return null;
}