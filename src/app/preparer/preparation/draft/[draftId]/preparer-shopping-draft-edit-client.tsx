"use client";

import { useActionState, useMemo, useRef, useState } from "react";
import { submitPreparerShoppingDraft, updatePreparerShoppingDraft, type PreparerActionState } from "@/app/preparer/actions";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";

const initial: PreparerActionState = {};
const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

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

function parseProducts(raw: unknown): { line: string; buyAlf: number | ""; sellAlf: number | "" }[] {
  if (!raw || typeof raw !== "object") return [];
  const o = raw as Record<string, unknown>;
  const arr = Array.isArray(o.products) ? o.products : [];
  return arr
    .map((x) => {
      if (!x || typeof x !== "object") return null;
      const r = x as Record<string, unknown>;
      const line = String(r.line ?? "").trim();
      if (!line) return null;
      const b = r.buyAlf == null ? "" : Number(r.buyAlf);
      const s = r.sellAlf == null ? "" : Number(r.sellAlf);
      return { line, buyAlf: Number.isFinite(b) ? b : "", sellAlf: Number.isFinite(s) ? s : "" };
    })
    .filter((x): x is { line: string; buyAlf: number | ""; sellAlf: number | "" } => x != null);
}

export function PreparerShoppingDraftEditClient({
  auth,
  draft,
}: {
  auth: { p: string; exp: string; s: string };
  draft: DraftWithRegion;
}) {
  const [saveState, saveAction, savePending] = useActionState(updatePreparerShoppingDraft, initial);
  const [submitState, submitAction, submitPending] = useActionState(submitPreparerShoppingDraft, initial);

  const [titleLine, setTitleLine] = useState(draft.titleLine);
  const [customerPhone, setCustomerPhone] = useState(draft.customerPhone);
  const [customerName, setCustomerName] = useState(draft.customerName);
  const [customerLandmark, setCustomerLandmark] = useState(draft.customerLandmark);
  const [orderTime, setOrderTime] = useState(draft.orderTime || "فوري");
  const [showCustomerInfo, setShowCustomerInfo] = useState(false);
  const [placesCount, setPlacesCount] = useState<number | "">(draft.placesCount ?? "");
  const [products, setProducts] = useState(parseProducts(draft.data));
  const [selectedPriceIndex, setSelectedPriceIndex] = useState<number | null>(null);
  const [pricingLinesText, setPricingLinesText] = useState("");
  const [pricingErr, setPricingErr] = useState<string | null>(null);
  const pricingTextareaRef = useRef<HTMLTextAreaElement>(null);

  // وضع حذف منتج: عند تفعيله، النقر على زر المنتج يحذفه مباشرة.
  const [deleteMode, setDeleteMode] = useState(false);
  // وضع إضافة منتجات: يفتح مربع كتابة الرسالة (كل منتج بسطر).
  const [showAddProductsPanel, setShowAddProductsPanel] = useState(false);
  const [addProductsText, setAddProductsText] = useState("");

  const productsJson = useMemo(
    () =>
      JSON.stringify(
        products.map((p) => ({
          line: p.line,
          buyAlf: p.buyAlf === "" ? null : p.buyAlf,
          sellAlf: p.sellAlf === "" ? null : p.sellAlf,
        })),
      ),
    [products],
  );
  const canSubmit =
    products.length > 0 &&
    products.every((p) => p.buyAlf !== "" && p.sellAlf !== "") &&
    typeof placesCount === "number" &&
    placesCount >= 1 &&
    placesCount <= 10;

  function applyPricingPanel() {
    setPricingErr(null);
    if (selectedPriceIndex == null) return;
    const lines = pricingLinesText
      .split(/\r?\n/)
      .map((x) => x.replace(/,/g, ".").trim())
      .filter(Boolean);
    if (lines.length === 0) {
      setPricingErr("اكتب سعر الشراء أو سطرين: شراء ثم بيع.");
      return;
    }
    const buy = lines[0]!;
    const sell = lines[1] ?? lines[0]!;
    const bn = parseFloat(buy);
    const sn = parseFloat(sell);
    if (!Number.isFinite(bn) || !Number.isFinite(sn) || bn < 0 || sn < 0) {
      setPricingErr("تأكد أن الأسعار أرقام صحيحة (بالألف).");
      return;
    }
    setProducts((prev) => {
      const next = [...prev];
      next[selectedPriceIndex] = { ...next[selectedPriceIndex]!, buyAlf: bn, sellAlf: sn };
      return next;
    });
    setSelectedPriceIndex(null);
    setPricingLinesText("");
  }

  function removeProductByIndex(index: number) {
    setProducts((prev) => prev.filter((_, idx) => idx !== index));
    setSelectedPriceIndex(null);
    setPricingLinesText("");
    setPricingErr(null);
    setDeleteMode(false);
  }

  function addProductsFromText() {
    const lines = addProductsText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length === 0) return;

    setProducts((prev) => [
      ...prev,
      ...lines.map(
        (line): { line: string; buyAlf: number | ""; sellAlf: number | "" } => ({
          line,
          buyAlf: "" as const,
          sellAlf: "" as const,
        }),
      ),
    ]);
    setAddProductsText("");
    setShowAddProductsPanel(false);
    setDeleteMode(false);
    setSelectedPriceIndex(null);
    setPricingLinesText("");
    setPricingErr(null);
  }

  const allProductsPriced = products.length > 0 && products.every((p) => p.buyAlf !== "" && p.sellAlf !== "");
  const orderedForButtons = useMemo(() => {
    const withIndex = products.map((p, idx) => ({ p, idx }));
    return withIndex.sort((a, b) => {
      const aPriced = a.p.buyAlf !== "" && a.p.sellAlf !== "";
      const bPriced = b.p.buyAlf !== "" && b.p.sellAlf !== "";
      if (aPriced === bPriced) return a.idx - b.idx;
      return aPriced ? -1 : 1;
    });
  }, [products]);

  return (
    <div className="space-y-4">
      <section className="kse-glass-dark rounded-2xl border border-violet-200 p-4 shadow-sm">
        <h1 className="text-base font-black text-violet-950">تسعير مسودة تجهيز</h1>
        <p className="mt-1 text-xs text-slate-600">المنطقة: {draft.customerRegion?.name ?? "—"}</p>
      </section>

      <section className="kse-glass-dark rounded-2xl border border-sky-200 p-4 shadow-sm">
        <button
          type="button"
          onClick={() => setShowCustomerInfo((v) => !v)}
          className="flex w-full items-center justify-between rounded-xl border border-sky-200 bg-white px-3 py-2 text-sm font-black text-sky-950"
        >
          <span>معلومات الزبون</span>
          <span aria-hidden>{showCustomerInfo ? "−" : "+"}</span>
        </button>
        {showCustomerInfo ? (
          <>
            <label className="mt-3 flex flex-col gap-1">
              <span className="text-xs font-medium text-slate-800">عنوان المنطقة</span>
              <input value={titleLine} onChange={(e) => setTitleLine(e.target.value)} className={inputClass} />
            </label>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-800">هاتف الزبون</span>
                <input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-medium text-slate-800">وقت الطلب</span>
                <input value={orderTime} onChange={(e) => setOrderTime(e.target.value)} className={inputClass} />
              </label>
            </div>
          </>
        ) : null}
      </section>

      <section className="kse-glass-dark rounded-2xl border border-indigo-200 p-4 shadow-sm">
        <h2 className="text-sm font-black text-indigo-950">المنتجات والتسعير</h2>
        {products.length > 0 ? (
          <>
            <p className="mt-1 text-xs text-slate-600">
              نفس نظام البوت: اختر منتجاً من الأزرار، ثم اكتب السعر بسطر واحد أو سطرين (شراء ثم بيع).
            </p>

            <div className="mt-3 flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddProductsPanel((v) => !v);
                  setDeleteMode(false);
                  setSelectedPriceIndex(null);
                  setPricingErr(null);
                  setPricingLinesText("");
                }}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-black transition ${
                  showAddProductsPanel
                    ? "border-indigo-600 bg-indigo-600 text-white"
                    : "border-slate-300 bg-white text-slate-800 hover:bg-slate-50"
                }`}
              >
                إضافة منتجات
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteMode((v) => !v);
                  setShowAddProductsPanel(false);
                  setSelectedPriceIndex(null);
                  setPricingErr(null);
                  setPricingLinesText("");
                }}
                className={`flex-1 rounded-xl border px-3 py-2 text-xs font-black transition ${
                  deleteMode
                    ? "border-rose-600 bg-rose-600 text-white"
                    : "border-rose-300 bg-rose-50 text-rose-800 hover:bg-rose-100"
                }`}
              >
                حذف منتج
              </button>
            </div>

            {showAddProductsPanel ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-xs font-bold text-slate-800">اكتب منتجاتك (كل منتج بسطر):</p>
                <textarea
                  value={addProductsText}
                  onChange={(e) => setAddProductsText(e.target.value)}
                  rows={5}
                  dir="rtl"
                  placeholder={"خيار\nطماطة\nخبز"}
                  className={`${inputClass} mt-2 font-mono`}
                />
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={addProductsFromText}
                    className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"
                  >
                    إضافة للائحة
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddProductsPanel(false);
                      setAddProductsText("");
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-800"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : null}

            {deleteMode ? (
              <p className="mt-2 text-xs font-bold text-rose-700">وضع الحذف فعّال: اضغط على المنتج الذي تريد حذفه.</p>
            ) : null}

            <div className="mt-3 flex flex-col gap-2">
              {orderedForButtons.map(({ p, idx: i }) => {
                const priced = p.buyAlf !== "" && p.sellAlf !== "";
                const active = i === selectedPriceIndex;
                return (
                  <button
                    key={`${i}-${p.line}`}
                    type="button"
                    onClick={() => {
                      if (deleteMode) {
                        removeProductByIndex(i);
                        return;
                      }
                      const b = p.buyAlf === "" ? "" : String(p.buyAlf);
                      const s = p.sellAlf === "" ? "" : String(p.sellAlf);
                      setSelectedPriceIndex(i);
                      setPricingErr(null);
                      setPricingLinesText(b === s ? b : `${b}\n${s}`);
                      // بعد إعادة الرسم، نقل المؤشر لصندوق السعر
                      window.setTimeout(() => pricingTextareaRef.current?.focus(), 0);
                    }}
                    className={`rounded-xl border px-3 py-2 text-xs font-bold transition ${
                      active
                        ? "border-indigo-500 bg-indigo-600 text-white"
                        : priced
                          ? "border-emerald-300 bg-emerald-50 text-emerald-800"
                          : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                    }`}
                  >
                    {p.line}
                  </button>
                );
              })}
            </div>

            {selectedPriceIndex != null ? (
              <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
                <p className="text-sm font-bold text-slate-900">
                  {selectedPriceIndex + 1}) {products[selectedPriceIndex]?.line}
                </p>
                <textarea
                  ref={pricingTextareaRef}
                  value={pricingLinesText}
                  onChange={(e) => setPricingLinesText(e.target.value)}
                  rows={4}
                  dir="ltr"
                  placeholder={"سطر 1: شراء\nسطر 2: بيع"}
                  className={`${inputClass} mt-2 font-mono`}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    // منع إنشاء "سطر ثالث": بمجرد وجود سطرين (حتى لو السطر الثاني فارغ)
                    // نقبل السعر مباشرة ونغلق لوحة تسعير هذا المنتج.
                    const rawLines = pricingLinesText.split(/\r?\n/);
                    if (rawLines.length <= 1) return; // يسمح بإضافة السطر الثاني أولاً
                    e.preventDefault();
                    applyPricingPanel();
                  }}
                />
                {pricingErr ? <p className="mt-2 text-xs font-bold text-rose-700">{pricingErr}</p> : null}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={applyPricingPanel}
                    className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-black text-white"
                  >
                    حفظ تسعير المنتج
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPriceIndex(null);
                      setPricingErr(null);
                      setPricingLinesText("");
                    }}
                    className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <p className="mt-2 text-sm text-slate-700">لا توجد منتجات داخل هذه المسودة.</p>
        )}
      </section>

      <form action={saveAction} className="space-y-3">
        <input type="hidden" name="p" value={auth.p} />
        <input type="hidden" name="exp" value={auth.exp} />
        <input type="hidden" name="s" value={auth.s} />
        <input type="hidden" name="draftId" value={draft.id} />
        <input type="hidden" name="titleLine" value={titleLine} />
        <input type="hidden" name="customerPhone" value={customerPhone} />
        <input type="hidden" name="customerName" value={customerName} />
        <input type="hidden" name="customerLandmark" value={customerLandmark} />
        <input type="hidden" name="orderTime" value={orderTime} />
        <input type="hidden" name="placesCount" value={placesCount === "" ? "" : String(placesCount)} />
        <input type="hidden" name="productsJson" value={productsJson} />
        {saveState.error ? <p className="text-sm font-bold text-rose-700">{saveState.error}</p> : null}
        <button type="submit" disabled={savePending} className="w-full rounded-xl bg-sky-600 px-4 py-3 text-sm font-black text-white">
          {savePending ? "جارٍ الحفظ..." : "حفظ التسعير"}
        </button>
      </form>

      {allProductsPriced ? (
        <section className="kse-glass-dark rounded-2xl border border-amber-200 p-4 shadow-sm">
          <h2 className="text-sm font-black text-amber-950">كم محل كلفك تجهيز هاي الطلبية؟</h2>
          <p className="mt-1 text-xs text-slate-700">اختر عدد المحلات من 1 إلى 10.</p>
          <div className="mt-3 grid grid-cols-5 gap-2">
            {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setPlacesCount(n)}
                className={`rounded-xl border px-2 py-2 text-xs font-black ${
                  placesCount === n ? "border-amber-600 bg-amber-600 text-white" : "border-slate-300 bg-white text-slate-800"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs text-slate-800">
            <p>تكلفة التجهيز حسب عدد المحلات:</p>
            <p className="mt-1">
              {typeof placesCount === "number"
                ? `اخترت ${placesCount} محل/محلات = ${calculateExtraAlfFromPlacesCount(placesCount)} ألف`
                : "اختر عدد المحلات لعرض تكلفة التجهيز."}
            </p>
          </div>
          <p className="mt-3 text-sm font-bold text-emerald-900">هاي فاتورة الطلبية صح؟ عدلها لو ارفعها.</p>
        </section>
      ) : null}

      <form action={submitAction} className="space-y-3">
        <input type="hidden" name="p" value={auth.p} />
        <input type="hidden" name="exp" value={auth.exp} />
        <input type="hidden" name="s" value={auth.s} />
        <input type="hidden" name="draftId" value={draft.id} />
        <input type="hidden" name="placesCount" value={placesCount === "" ? "" : String(placesCount)} />
        {/* يجب إرسال نفس بيانات الشاشة مع الإرسال؛ وإلا يقرأ الخادم مسودة قديمة من DB دون «حفظ التسعير». */}
        <input type="hidden" name="titleLine" value={titleLine} />
        <input type="hidden" name="customerPhone" value={customerPhone} />
        <input type="hidden" name="customerName" value={customerName} />
        <input type="hidden" name="customerLandmark" value={customerLandmark} />
        <input type="hidden" name="orderTime" value={orderTime} />
        <input type="hidden" name="productsJson" value={productsJson} />
        {submitState.error ? <p className="text-sm font-bold text-rose-700">{submitState.error}</p> : null}
        {submitState.ok && submitState.orderNumber ? (
          <p className="text-sm font-black text-emerald-800">تم إرسال الطلب برقم #{submitState.orderNumber}</p>
        ) : null}
        <button
          type="submit"
          disabled={submitPending || !canSubmit}
          className="w-full rounded-xl bg-emerald-600 px-4 py-3 text-sm font-black text-white disabled:opacity-50"
        >
          {submitPending ? "جارٍ الإرسال..." : "إرسال الطلب للنظام"}
        </button>
      </form>
    </div>
  );
}
