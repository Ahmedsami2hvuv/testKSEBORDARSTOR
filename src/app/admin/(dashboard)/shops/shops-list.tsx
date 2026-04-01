"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ad } from "@/lib/admin-ui";
import { deleteShop } from "./actions";

export type ShopRow = {
  id: string;
  name: string;
  locationUrl: string;
  regionName: string;
};

export function ShopsList({ shops }: { shops: ShopRow[] }) {
  const [query, setQuery] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function copyLocation(url: string, id: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(null);
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return shops;
    return shops.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.regionName.toLowerCase().includes(q) ||
        s.locationUrl.toLowerCase().includes(q),
    );
  }, [shops, query]);

  return (
    <div className="space-y-3">
      <label className="flex flex-col gap-1 text-sm sm:flex-row sm:items-center sm:justify-between">
        <span className={ad.label}>بحث في المحلات</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="اسم المحل، المنطقة، أو جزء من الرابط…"
          className={`w-full max-w-md sm:ms-auto ${ad.input}`}
        />
      </label>

      {filtered.length === 0 ? (
        <p className={ad.muted}>
          {shops.length === 0
            ? "لا توجد محلات بعد."
            : "لا توجد نتائج مطابقة للبحث."}
        </p>
      ) : (
        <ul className={ad.listDivide}>
          {filtered.map((s) => (
            <li
              key={s.id}
              className="flex flex-wrap items-start justify-between gap-3 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className={ad.listTitle}>{s.name}</p>
                <p className={ad.listMuted}>{s.regionName}</p>
                <a
                  href={s.locationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`mt-1 block truncate text-sm ${ad.link}`}
                >
                  {s.locationUrl}
                </a>
                <button
                  type="button"
                  onClick={() => copyLocation(s.locationUrl, s.id)}
                  className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-900 transition hover:bg-amber-100"
                >
                  {copiedId === s.id ? "تم نسخ الرابط" : "نسخ رابط المحل"}
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  href={`/admin/shops/${s.id}/employees`}
                  className={`text-sm ${ad.link}`}
                >
                  الموظفون
                </Link>
                <Link
                  href={`/admin/shops/${s.id}/edit`}
                  className={`text-sm ${ad.link}`}
                >
                  تعديل المحل
                </Link>
                <form action={deleteShop}>
                  <input type="hidden" name="id" value={s.id} />
                  <button type="submit" className={ad.dangerLink}>
                    حذف
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
