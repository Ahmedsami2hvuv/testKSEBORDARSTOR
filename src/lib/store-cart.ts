export type StoreCartItem = {
  variantId: string;
  quantity: number;
};

const KEY = "kse_store_cart_v1";
export const STORE_CART_CHANGED_EVENT = "kse:store-cart-changed";

function safeJsonParse<T>(raw: string | null): T | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function loadCartFromStorage(): StoreCartItem[] {
  if (typeof window === "undefined") return [];
  const parsed = safeJsonParse<unknown>(window.localStorage.getItem(KEY));
  if (!Array.isArray(parsed)) return [];
  return parsed
    .map((x) => {
      const o = x as Partial<StoreCartItem>;
      const variantId = String(o.variantId ?? "").trim();
      const quantity = Number(o.quantity ?? 0);
      if (!variantId) return null;
      if (!Number.isFinite(quantity) || quantity <= 0) return null;
      return { variantId, quantity: Math.floor(quantity) };
    })
    .filter(Boolean) as StoreCartItem[];
}

export function saveCartToStorage(items: StoreCartItem[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(items));
  window.dispatchEvent(new CustomEvent(STORE_CART_CHANGED_EVENT));
}

