"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { StoreCartMiniLink } from "@/components/store-cart";

type Cat = { id: string; name: string; slug: string; parentId: string | null };

type SearchHit =
  | { kind: "product"; slug: string; title: string; subtitle?: string }
  | { kind: "category"; slug: string; title: string };

function useDebounced<T>(value: T, ms: number) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = window.setTimeout(() => setV(value), ms);
    return () => window.clearTimeout(t);
  }, [value, ms]);
  return v;
}

function buildTree(categories: Cat[]) {
  const byParent = new Map<string, Cat[]>();
  for (const c of categories) {
    const key = c.parentId ?? "__root__";
    const arr = byParent.get(key) ?? [];
    arr.push(c);
    byParent.set(key, arr);
  }
  return { byParent };
}

export function StoreShell({ children, categories }: { children: React.ReactNode; categories: Cat[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [q, setQ] = useState("");
  const qDebounced = useDebounced(q, 220);
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [loading, setLoading] = useState(false);

  const tree = useMemo(() => buildTree(categories), [categories]);
  const activeCategory = sp?.get("category") ?? "";

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    const query = qDebounced.trim();
    if (query.length < 2) {
      setHits([]);
      return;
    }
    setLoading(true);
    void (async () => {
      try {
        const r = await fetch(`/api/store/search?q=${encodeURIComponent(query)}`);
        const j = (await r.json()) as { ok?: boolean; hits?: SearchHit[] };
        if (j?.ok && Array.isArray(j.hits)) setHits(j.hits);
        else setHits([]);
      } catch {
        setHits([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [qDebounced]);

  function goToCategory(slug: string) {
    router.push(`/store?category=${encodeURIComponent(slug)}`);
    setQ("");
    setHits([]);
  }

  function goToProduct(slug: string) {
    router.push(`/store/product/${encodeURIComponent(slug)}`);
    setQ("");
    setHits([]);
  }

  return (
    <div className="kse-app-bg min-h-screen text-slate-900">
      <div className="kse-app-inner mx-auto w-full max-w-6xl px-4 py-6">
        <header className="sticky top-0 z-30 -mx-4 mb-4 bg-transparent px-4 pb-2 pt-2">
          <div className="rounded-3xl border border-slate-200/80 bg-white/90 backdrop-blur-xl shadow-[0_8px_24px_rgba(15,23,42,0.08)]">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  className="inline-flex items-center justify-center rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-900 hover:bg-slate-50"
                  onClick={() => setSidebarOpen((x) => !x)}
                  aria-label="فتح القائمة"
                >
                  ☰
                </button>
                <Link href="/store" className="min-w-0">
                  <div className="truncate text-base font-black text-slate-900">خصيب ستور</div>
                  <div className="truncate text-xs font-bold text-sky-700">ابو الاكبر للتوصيل</div>
                </Link>
              </div>

              <div className="relative w-full sm:w-[420px]">
                <input
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="ابحث عن أي شيء… (منتج/قسم/لون/قياس)"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-500 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                />
                {loading ? (
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">
                    ...
                  </div>
                ) : null}
                {hits.length > 0 ? (
                  <div className="absolute z-40 mt-2 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg">
                    <div className="max-h-72 overflow-auto">
                      {hits.map((h, idx) => (
                        <button
                          key={`${h.kind}-${idx}`}
                          type="button"
                          className="w-full px-4 py-3 text-start hover:bg-slate-50"
                          onClick={() => {
                            if (h.kind === "category") goToCategory(h.slug);
                            else goToProduct(h.slug);
                          }}
                        >
                          <div className="text-sm font-extrabold text-slate-900">{h.title}</div>
                          {"subtitle" in h && h.subtitle ? (
                            <div className="mt-0.5 text-xs font-semibold text-slate-600">{h.subtitle}</div>
                          ) : null}
                          <div className="mt-1 text-[11px] font-bold text-sky-700">
                            {h.kind === "product" ? "منتج" : "قسم"}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>

              <StoreCartMiniLink />
            </div>
          </div>
        </header>

        <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
          <aside
            className={[
              "lg:sticky lg:top-24 lg:h-[calc(100vh-7rem)]",
              sidebarOpen ? "block" : "hidden lg:block",
            ].join(" ")}
          >
            <div className="rounded-3xl border border-slate-200/80 bg-white/90 p-4 shadow-sm backdrop-blur-xl">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-black text-slate-900">الأقسام</div>
                <button
                  type="button"
                  className="lg:hidden rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-900"
                  onClick={() => setSidebarOpen(false)}
                >
                  إغلاق
                </button>
              </div>

              <nav className="mt-3 space-y-1">
                {(tree.byParent.get("__root__") ?? []).slice(0, 60).map((root) => (
                  <div key={root.id} className="rounded-2xl border border-slate-200 bg-white p-2">
                    <button
                      type="button"
                      onClick={() => goToCategory(root.slug)}
                      className={[
                        "w-full text-start rounded-xl px-3 py-2 text-sm font-extrabold",
                        activeCategory === root.slug ? "bg-sky-100 text-sky-900" : "hover:bg-slate-50 text-slate-900",
                      ].join(" ")}
                    >
                      {root.name}
                    </button>
                    {(tree.byParent.get(root.id) ?? []).slice(0, 20).length > 0 ? (
                      <div className="mt-1 space-y-1 pr-2">
                        {(tree.byParent.get(root.id) ?? []).slice(0, 20).map((child) => (
                          <button
                            key={child.id}
                            type="button"
                            onClick={() => goToCategory(child.slug)}
                            className={[
                              "w-full text-start rounded-xl px-3 py-2 text-xs font-bold",
                              activeCategory === child.slug
                                ? "bg-emerald-100 text-emerald-900"
                                : "hover:bg-slate-50 text-slate-700",
                            ].join(" ")}
                          >
                            {child.name}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </nav>
            </div>
          </aside>

          <main className="min-w-0">{children}</main>
        </div>
      </div>
    </div>
  );
}

