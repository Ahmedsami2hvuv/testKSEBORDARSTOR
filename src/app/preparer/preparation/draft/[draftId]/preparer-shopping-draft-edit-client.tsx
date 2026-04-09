"use client";
// v4-bulletproof-fix: ضمان الحفظ الفوري ومنع التضارب + الخروج التلقائي عند النجاح

import { useActionState, useMemo, useRef, useState, useTransition, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { submitPreparerShoppingDraft, updatePreparerShoppingDraft, type PreparerActionState } from "@/app/preparer/actions";
import { suggestFixedPrices } from "@/lib/fixed-prices";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";
import { calculateAutoSellPrice, isMeatProduct } from "@/lib/auto-pricing";
import { preparerPath } from "@/lib/preparer-portal-nav";

const initial: PreparerActionState = {};
const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

type ProductRow = { line: string; buyAlf: number | ""; sellAlf: number | ""; pricedBy?: string | null };

type DraftWithRegion = {
  id: string;
  titleLine: string;
  customerPhone: string;
  customerName: string;
  customerLandmark: string;
  orderTime: string;
  placesCount: number | null;
  data: unknown;
  customerRegion: { id: string; name: string } | null;
};

function parseProducts(raw: unknown): ProductRow[] {
  if (!raw || typeof raw !== "object" || raw === null) return[];
  const o = raw as Record<string, any>;
  const productsRaw = o.products;
  if (!Array.isArray(productsRaw)) return [];

  const results: ProductRow[] =[];
  for (const x of productsRaw) {
    if (!x || typeof x !== "object") continue;
    const r = x as Record<string, any>;
    const line = String(r.line ?? "").trim();
    if (!line) continue;

    const bRaw = r.buyAlf;
    const sRaw = r.sellAlf;

    const bNum = (bRaw === null || bRaw === undefined || bRaw === "") ? "" : Number(bRaw);
    const sNum = (sRaw === null || sRaw === undefined || sRaw === "") ? "" : Number(sRaw);

    results.push({
      line,
      buyAlf: (typeof bNum === "number" && Number.isFinite(bNum)) ? bNum : "",
      sellAlf: (typeof sNum === "number" && Number.isFinite(sNum)) ? sNum : "",
      pricedBy: typeof r.pricedBy === "string" ? r.pricedBy : null,
    });
  }
  return results;
}

export function PreparerShoppingDraftEditClient({
  auth,
  draft: initialDraft,
}: {
  auth: { p: string; exp: string; s: string };
  draft: DraftWithRegion;
}) {
  const router = useRouter();
  const[saveState, saveAction, savePending] = useActionState(updatePreparerShoppingDraft, initial);
  const[submitState, submitAction, submitPending] = useActionState(submitPreparerShoppingDraft, initial);
  const[isAutoSaving, startAutoSave] = useTransition();

  const[titleLine, setTitleLine] = useState(initialDraft.titleLine);
  const [customerPhone, setCustomerPhone] = useState(initialDraft.customerPhone);
  const[customerName, setCustomerName] = useState(initialDraft.customerName);
  const [customerLandmark, setCustomerLandmark] = useState(initialDraft.customerLandmark);
  const[orderTime, setOrderTime] = useState(initialDraft.orderTime || "فوري");
  const[showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [placesCount, setPlacesCount] = useState<number | "">(initialDraft.placesCount ?? "");
  const [products, setProducts] = useState<ProductRow[]>(() => parseProducts(initialDraft.data));
  const[selectedPriceIndex, setSelectedPriceIndex] = useState<number | null>(null);
  const[pricingLinesText, setPricingLinesText] = useState("");
  const [pricingErr, setPricingErr] = useState<string | null>(null);
  const pricingTextareaRef = useRef<HTMLTextAreaElement>(null);

  const[deleteMode, setDeleteMode] = useState(false);
  const [showAddProductsPanel, setShowAddProductsPanel] = useState(false);
  const [addProductsText, setAddProductsText] = useState("");

  const isDirtyRef = useRef(false);
  const lastSavedJsonRef = useRef(JSON.stringify(products));

  // التحويل التلقائي عند نجاح الإرسال
  useEffect(() => {
    if (submitState.ok) {
        const t = setTimeout(() => {
            router.push(preparerPath("/preparer", auth));
        }, 1500);
        return () => clearTimeout(t);
    }
  }, [submitState.ok, router, auth]);

  const allProductsPriced = products.length > 0 && products.every((p) => p.buyAlf !== "" && p.sellAlf !== "");

  const productsJson = useMemo(
    () =>
      JSON.stringify(
        products.map((p) => ({
          line: p.line,
          buyAlf: p.buyAlf === "" ? null : p.buyAlf,
          sellAlf: p.sellAlf === "" ? null : p.sellAlf,
          pricedBy: p.pricedBy
        })),
      ),
    [products],
  );

  const performSave = useCallback(async (jsonToSave: string) => {
    isDirtyRef.current = true;
    startAutoSave(() => {
        const fd = new FormData();
        fd.append("p", auth.p);
        fd.append("exp", auth.exp);
        fd.append("s", auth.s);
        fd.append("draftId", initialDraft.id);
        fd.append("titleLine", titleLine);
        fd.append("customerPhone", customerPhone);
        fd.append("customerName", customerName);
        fd.append("customerLandmark", customerLandmark);
        fd.append("orderTime", orderTime);
        fd.append("placesCount", placesCount === "" ? "" : String(placesCount));
        fd.append("productsJson", jsonToSave);

        updatePreparerShoppingDraft(initial, fd).then(res => {
            if (res.ok) {
                isDirtyRef.current = false;
                lastSavedJsonRef.current = jsonToSave;
            }
        }).catch(console.error);
    });
  },[auth, initialDraft.id, titleLine, customerPhone, customerName, customerLandmark, orderTime, placesCount]);

  function addProductsFromText() {
    const lines = addProductsText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (lines.length === 0) return;
    const next: ProductRow[] =[
        ...products,
        ...lines.map((line) => ({ line, buyAlf: "" as const, sellAlf: "" as const, pricedBy: null })),
    ];
    setProducts(next);
    const nextJson = JSON.stringify(next.map(p => ({
        line: p.line,
        buyAlf: p.buyAlf === "" ? null : p.buyAlf,
        sellAlf: p.sellAlf === "" ? null : p.sellAlf,
        pricedBy: p.pricedBy
    })));
    performSave(nextJson);
    setAddProductsText("");
    setShowAddProductsPanel(false);
  }

  function removeProductByIndex(idx: number) {
    const next = products.filter((_, i) => i !== idx);
    setProducts(next);
    const nextJson = JSON.stringify(next.map(p => ({
        line: p.line,
        buyAlf: p.buyAlf === "" ? null : p.buyAlf,
        sellAlf: p.sellAlf === "" ? null : p.sellAlf,
        pricedBy: p.pricedBy
    })));
    performSave(nextJson);
  }

  const fetchLatestData = useCallback(async () => {
    if (selectedPriceIndex !== null || showAddProductsPanel || deleteMode || isDirtyRef.current || isAutoSaving) {
        return;
    }
    try {
      const res = await fetch(`/api/preparer/draft?id=${initialDraft.id}&p=${auth.p}&exp=${auth.exp}&s=${auth.s}`);
      if (res.ok) {
        const latest = await res.json();

        // إخراج المستخدم فوراً إذا قام المجهز الآخر بإرسال الطلب للنظام!
        if (latest.status === "sent" || latest.status === "archived") {
            router.push(preparerPath("/preparer", auth));
            return;
        }

        const latestJson = JSON.stringify(parseProducts(latest.data));
        if (latestJson !== lastSavedJsonRef.current) {
            setProducts(parseProducts(latest.data));
            setPlacesCount(latest.placesCount ?? "");
            lastSavedJsonRef.current = latestJson;
        }
      }
    } catch (e) {
      console.error("Polling failed", e);
    }
  },[initialDraft.id, auth, selectedPriceIndex, showAddProductsPanel, deleteMode, isAutoSaving, router]);

  useEffect(() => {
    const timer = setInterval(fetchLatestData, 5000);
    return () => clearInterval(timer);
  }, [fetchLatestData]);

  const isMounted = useRef(false);
  useEffect(() => {
    if (!isMounted.current) {
      isMounted.current = true;
      return;
    }
    const t = setTimeout(() => {
        if (isDirtyRef.current) {
            performSave(productsJson);
        }
    }, 2000);
    return () => clearTimeout(t);
  },[titleLine, customerPhone, customerName, customerLandmark, orderTime, placesCount, performSave, productsJson]);

  function applyPricingPanel() {
    setPricingErr(null);
    if (selectedPriceIndex == null) return;
    const lines = pricingLinesText.split(/\r?\n/).map((x) => x.replace(/,/g, ".").trim()).filter(Boolean);
    if (lines.length === 0) {
      setPricingErr("اكتب سعر الشراء (بالألف).");
      return;
    }
    const buy = parseFloat(lines[0]!);
    if (!Number.isFinite(buy) || buy < 0) {
      setPricingErr("تأكد أن السعر رقم صحيح.");
      return;
    }
    let sell = lines[1] ? parseFloat(lines[1]) : calculateAutoSellPrice(products[selectedPriceIndex]!.line, buy);

    const nextProducts =[...products];
    const target = nextProducts[selectedPriceIndex];
    if (target) {
        nextProducts[selectedPriceIndex] = { ...target, buyAlf: buy, sellAlf: sell, pricedBy: "أنت الآن" };
        const nextJson = JSON.stringify(nextProducts.map(p => ({
            line: p.line,
            buyAlf: p.buyAlf === "" ? null : p.buyAlf,
            sellAlf: p.sellAlf === "" ? null : p.sellAlf,
            pricedBy: p.pricedBy
        })));
        setProducts(nextProducts);
        performSave(nextJson);
    }
    setSelectedPriceIndex(null);
    setPricingLinesText("");
  }

  function handleAutoPriceMeat(idx: number) {
    const p = products[idx];
    if (!p) return;
    const fixed = suggestFixedPrices(p.line);
    if (fixed) {
        const nextProducts = [...products];
        nextProducts[idx] = { ...p, buyAlf: fixed.buyAlf, sellAlf: fixed.sellAlf, pricedBy: "تسعير تلقائي (لحم)" };
        setProducts(nextProducts);
        const nextJson = JSON.stringify(nextProducts.map(pp => ({
            line: pp.line,
            buyAlf: pp.buyAlf === "" ? null : pp.buyAlf,
            sellAlf: pp.sellAlf === "" ? null : pp.sellAlf,
            pricedBy: pp.pricedBy
        })));
        performSave(nextJson);
    }
  }

  const orderedForButtons = useMemo(() => {
    const withIndex = products.map((p, idx) => ({ p, idx }));
    return withIndex.sort((a, b) => {
      const aPriced = a.p.buyAlf !== "" && a.p.sellAlf !== "";
      const bPriced = b.p.buyAlf !== "" && b.p.sellAlf !== "";
      if (aPriced === bPriced) return a.idx - b.idx;
      return aPriced ? -1 : 1;
    });
  }, [products]);

  const canSubmit = products.length > 0 && allProductsPriced && typeof placesCount === "number";

  if (submitState.ok) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4" dir="rtl">
            <div className="size-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                <svg className="size-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
            </div>
            <h2 className="text-2xl font-black text-slate-900">تم إرسال الطلب بنجاح!</h2>
            <p className="text-slate-500 font-bold">جاري العودة للرئيسية...</p>
        </div>
    );
  }

  return (
    <div className="space-y-4" dir="rtl">
      <section className="kse-glass-dark flex items-center justify-between rounded-2xl border border-violet-200 p-4 shadow-sm">
        <h1 className="text-base font-black text-violet-950">تجهيز مشترك: {initialDraft.customerRegion?.name}</h1>
        <div className="flex flex-col items-end">
            {isAutoSaving || isDirtyRef.current ? (
                <p className="text-[10px] text-amber-600 font-bold animate-pulse">⏳ جاري الحفظ...</p>
            ) : (
                <p className="text-[10px] text-emerald-600 font-bold">✅ تم حفظ التغييرات</p>
            )}
        </div>
      </section>

      <section className="kse-glass-dark rounded-2xl border border-sky-200 p-4 shadow-sm">
        <button type="button" onClick={() => setShowCustomerInfo((v) => !v)} className="flex w-full items-center justify-between rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-black text-sky-950">
          <span>بيانات الزبون: {customerPhone}</span>
          <span>{showCustomerInfo ? "−" : "+"}</span>
        </button>
        {showCustomerInfo && (
          <div className="mt-3 space-y-3">
            <input value={titleLine} onChange={(e) => { setTitleLine(e.target.value); isDirtyRef.current = true; }} className={inputClass} placeholder="العنوان" />
            <input value={orderTime} onChange={(e) => { setOrderTime(e.target.value); isDirtyRef.current = true; }} className={inputClass} placeholder="الوقت" />
          </div>
        )}
      </section>

      <section className="kse-glass-dark rounded-2xl border border-indigo-200 p-4 shadow-sm">
        <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-black text-indigo-950">قائمة المنتجات</h2>
            <div className="flex gap-1">
                <button type="button" onClick={() => { setShowAddProductsPanel(!showAddProductsPanel); setDeleteMode(false); }} className="rounded-lg bg-emerald-600 text-white px-2 py-1 text-[10px] font-bold">+ مادة</button>
                <button type="button" onClick={() => { setDeleteMode(!deleteMode); setShowAddProductsPanel(false); }} className={`rounded-lg px-2 py-1 text-[10px] font-bold ${deleteMode ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>حذف</button>
            </div>
        </div>

        {showAddProductsPanel && (
            <div className="mb-3 p-3 bg-white rounded-xl border-2 border-emerald-200 shadow-inner">
                <textarea value={addProductsText} onChange={(e) => setAddProductsText(e.target.value)} rows={3} className={inputClass} placeholder="اكتب المواد الجديدة هنا..." />
                <button type="button" onClick={addProductsFromText} className="mt-2 w-full bg-emerald-600 text-white rounded-lg py-2 text-xs font-black">إضافة للمجموعة</button>
            </div>
        )}

        <div className="flex flex-col gap-2">
          {orderedForButtons.map(({ p, idx: i }) => {
            const isMeat = isMeatProduct(p.line);
            const priced = p.buyAlf !== "" && p.sellAlf !== "";
            const active = i === selectedPriceIndex;
            return (
              <button
                key={`${i}-${p.line}`}
                type="button"
                onClick={() => {
                  if (deleteMode) { removeProductByIndex(i); return; }
                  if (isMeat) {
                      if (!priced) handleAutoPriceMeat(i);
                      return;
                  }
                  if (priced && p.pricedBy && !p.pricedBy.includes("أنت")) return;
                  setSelectedPriceIndex(i);
                  setPricingLinesText(priced ? `${p.buyAlf}` : "");
                  setTimeout(() => pricingTextareaRef.current?.focus(), 50);
                }}
                className={`w-full flex items-center justify-between rounded-xl border-2 px-4 py-3 text-start transition ${
                  active ? "border-indigo-500 bg-indigo-50 ring-2 ring-indigo-200" : priced ? "border-emerald-800 bg-emerald-900 text-white" : "border-slate-200 bg-white shadow-sm"
                } ${isMeat && priced ? "opacity-90 cursor-default" : ""}`}
              >
                <div className="min-w-0 flex-1">
                    <p className={`text-xs font-black ${priced ? "text-white" : "text-slate-800"}`}>{p.line}</p>
                    {priced && <p className="text-[10px] text-emerald-300 font-bold">بواسطة: {p.pricedBy || "غير معروف"}</p>}
                </div>
                {isMeat ? (
                    priced ? (
                        <span className="text-[10px] font-bold text-emerald-400 bg-emerald-950/50 px-2 py-1 rounded">✅ تسعير تلقائي</span>
                    ) : (
                        <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-1 rounded">📝 اضغط للتسعير التلقائي</span>
                    )
                ) : priced ? (
                    <span className="font-mono text-xs font-black text-emerald-400">{p.buyAlf} ألف (شراء)</span>
                ) : (
                    <span className="text-[10px] text-slate-400">📝 اضغط للتسعير</span>
                )}
              </button>
            );
          })}
        </div>

        {selectedPriceIndex !== null && (
            <div className="mt-4 p-4 bg-white rounded-2xl border-2 border-indigo-500 shadow-xl animate-in zoom-in-95">
                <p className="text-xs font-black text-slate-500 mb-2">تسعير: {products[selectedPriceIndex]?.line}</p>
                {pricingErr && <p className="text-[10px] text-rose-600 font-bold mb-2">{pricingErr}</p>}
                <textarea
                  ref={pricingTextareaRef}
                  value={pricingLinesText}
                  onChange={(e) => setPricingLinesText(e.target.value)}
                  className={`${inputClass} text-center font-black text-lg`}
                  placeholder="سعر الشراء بالألف"
                  inputMode="decimal"
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); applyPricingPanel(); } }}
                />
                <div className="grid grid-cols-2 gap-2 mt-3">
                    <button type="button" onClick={applyPricingPanel} className="bg-indigo-600 text-white rounded-xl py-3 text-sm font-black">حفظ السعر</button>
                    <button type="button" onClick={() => setSelectedPriceIndex(null)} className="bg-slate-100 text-slate-600 rounded-xl py-3 text-sm font-bold">إلغاء</button>
                </div>
            </div>
        )}
      </section>

      {allProductsPriced && (
        <section className="kse-glass-dark rounded-2xl border border-amber-300 p-4 shadow-sm">
          <h2 className="text-sm font-black text-amber-950 mb-3">كم محل كلفك تجهيز الطلبية؟</h2>
          <div className="grid grid-cols-5 gap-2">
            {[1,2,3,4,5,6,7,8,9,10].map((n) => (
              <button key={n} type="button" onClick={() => { setPlacesCount(n); isDirtyRef.current = true; }} className={`rounded-xl py-3 text-sm font-black border-2 transition ${placesCount === n ? 'border-amber-600 bg-amber-600 text-white shadow-md' : 'border-slate-200 bg-white text-slate-800'}`}>{n}</button>
            ))}
          </div>
          {placesCount !== "" && <p className="mt-3 text-[10px] font-black text-emerald-700 bg-emerald-50 p-2 rounded-lg text-center">أحسنت! اكتملت القائمة. يمكنك الآن إرسال الطلب النهائي للنظام. (المجموع الكلي مع العمولات سيحسب تلقائياً)</p>}
        </section>
      )}

      <div className="fixed bottom-4 inset-x-4 z-50">
          <form action={submitAction}>
            <input type="hidden" name="p" value={auth.p} />
            <input type="hidden" name="exp" value={auth.exp} />
            <input type="hidden" name="s" value={auth.s} />
            <input type="hidden" name="draftId" value={initialDraft.id} />
            <input type="hidden" name="placesCount" value={placesCount} />
            <input type="hidden" name="productsJson" value={productsJson} />
            <button type="submit" disabled={submitPending || !canSubmit || isDirtyRef.current} className="w-full rounded-2xl bg-gradient-to-r from-emerald-600 to-emerald-800 py-4 text-white font-black shadow-2xl active:scale-95 disabled:opacity-50 transition-all border-b-4 border-emerald-900">
                {isDirtyRef.current ? "⏳ جاري حفظ الأسعار..." : submitPending ? "جارٍ إرسال الطلب..." : "✅ إرسال الطلب النهائي للنظام 🚀"}
            </button>
          </form>
      </div>
    </div>
  );
}
