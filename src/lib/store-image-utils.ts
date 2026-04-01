export function parseStoredProductImages(raw: string | null | undefined): string[] {
  if (!raw) return [];
  const t = String(raw).trim();
  if (!t) return [];

  // يدعم: JSON array أو نص مفصول بسطر جديد أو فاصلة.
  if (t.startsWith("[") && t.endsWith("]")) {
    try {
      const arr = JSON.parse(t) as unknown;
      if (Array.isArray(arr)) {
        return arr
          .map((x) => String(x ?? "").trim())
          .filter(Boolean);
      }
    } catch {
      // fallback below
    }
  }

  return t
    .split(/\r?\n|,/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

export function serializeStoredProductImages(urls: string[]): string {
  return urls.filter(Boolean).join("\n");
}

export function getPrimaryStoredProductImage(raw: string | null | undefined): string {
  return parseStoredProductImages(raw)[0] ?? "";
}

