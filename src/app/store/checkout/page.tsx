"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { StoreCartEditor } from "@/components/store-cart";
import {
  loadCartFromStorage,
  saveCartToStorage,
  type StoreCartItem,
} from "@/lib/store-cart";

type CheckoutResult = { ok: true; orderNumber: number } | { ok: false; error: string };
type RegionHit = { id: string; name: string; deliveryPrice: string };

export default function StoreCheckoutPage() {
  const [items, setItems] = useState<StoreCartItem[]>([]);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [regionSearch, setRegionSearch] = useState("");
  const [regionHits, setRegionHits] = useState<RegionHit[]>([]);
  const [regionId, setRegionId] = useState("");
  const [regionName, setRegionName] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<CheckoutResult | null>(null);

  useEffect(() => {
    setItems(loadCartFromStorage());
  }, []);

  useEffect(() => {
    if (regionSearch.trim().length < 2 || regionId) {
      setRegionHits([]);
      return;
    }
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`/api/regions/search?q=${encodeURIComponent(regionSearch.trim())}`);
          const j = (await r.json()) as { regions?: RegionHit[] };
          setRegionHits(j.regions ?? []);
        } catch {
          setRegionHits([]);
        }
      })();
    }, 280);
    return () => window.clearTimeout(t);
  }, [regionSearch, regionId]);

  const canSubmit = useMemo(() => {
    if (items.length === 0) return false;
    if (!name.trim()) return false;
    if (!phone.trim()) return false;
    if (!regionId || !regionName.trim()) return false;
    return true;
  }, [items, name, phone, regionId, regionName]);

  async function submit() {
    setSubmitting(true);
    setResult(null);
    try {
      const r = await fetch("/api/store/checkout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          customerName: name.trim(),
          customerPhone: phone,
          addressText: regionName.trim(),
          notes,
          items,
        }),
      });
      const data = (await r.json()) as CheckoutResult;
      if (!data || typeof data !== "object") {
        setResult({ ok: false, error: "استجابة غير متوقعة." });
        return;
      }
      setResult(data);
      if (data.ok) {
        saveCartToStorage([]);
        setItems([]);
      }
    } catch {
      setResult({ ok: false, error: "فشل الاتصال بالخادم." });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="kse-app-bg min-h-screen">
      <div className="kse-app-inner mx-auto w-full max-w-3xl px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/store" className="text-sm font-semibold text-sky-700 underline underline-offset-4">
            ← متابعة التسوق
          </Link>
          <h1 className="text-lg font-extrabold text-slate-900">إتمام الطلب</h1>
        </div>

        <div className="mt-6 grid gap-4">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800">السلة</h2>
            <div className="mt-4">
              <StoreCartEditor
                initial={items}
                onChange={(next) => {
                  setItems(next);
                }}
              />
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-sm font-bold text-slate-800">بيانات الزبون</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div>
                <label className="text-sm font-semibold text-slate-800">الاسم (مطلوب)</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  required
                />
              </div>
              <div>
                <label className="text-sm font-semibold text-slate-800">رقم الهاتف (مطلوب)</label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  inputMode="tel"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-slate-800">المنطقة (مطلوب)</label>
                <input
                  value={regionSearch}
                  onChange={(e) => {
                    const next = e.target.value;
                    setRegionSearch(next);
                    if (regionId) {
                      setRegionId("");
                      setRegionName("");
                    }
                  }}
                  className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  placeholder="اكتب اسم منطقتك (حرفين على الأقل)"
                />
                {regionHits.length > 0 && !regionId ? (
                  <ul className="mt-1 max-h-40 overflow-auto rounded-xl border border-slate-200 bg-white text-sm shadow-md">
                    {regionHits.map((h) => (
                      <li key={h.id}>
                        <button
                          type="button"
                          className="w-full px-3 py-2.5 text-start text-slate-800 hover:bg-slate-50"
                          onClick={() => {
                            setRegionId(h.id);
                            setRegionName(h.name);
                            setRegionSearch(h.name);
                            setRegionHits([]);
                          }}
                        >
                          {h.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
                {regionId ? (
                  <p className="mt-1 text-xs font-medium text-emerald-300">تم اختيار المنطقة: {regionName}</p>
                ) : null}
              </div>
              <div className="sm:col-span-2">
                <label className="text-sm font-semibold text-slate-800">ملاحظات</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="mt-1 w-full min-h-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                />
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={submit}
                disabled={!canSubmit || submitting}
                className="rounded-xl bg-emerald-600 px-6 py-3 text-sm font-extrabold text-white shadow-md shadow-emerald-200 transition hover:bg-emerald-700 disabled:opacity-50"
              >
                {submitting ? "جارٍ الإرسال..." : "تأكيد الطلب"}
              </button>

              {result?.ok ? (
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-900">
                  تم استلام طلبك. رقم الطلب: #{result.orderNumber}
                </div>
              ) : null}
              {result && !result.ok ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-800">
                  {result.error}
                </div>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

