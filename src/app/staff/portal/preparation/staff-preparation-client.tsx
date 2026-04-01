"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { extractPhoneNumberFromText, parseSiteOrderMessage } from "@/lib/site-order-parse";
import { parseFlexibleOrderLines } from "@/lib/flexible-order-parse";
import { normalizeRegionNameForMatch } from "@/lib/region-name-normalize";
import { submitStaffPreparationDraft, type StaffPrepState } from "../actions";

type RegionHit = { id: string; name: string; deliveryPrice: string };

const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

const initial: StaffPrepState = {};

const PASTE_HELP = `مثال:\nشيخ ابراهيم\n07718285825\n٢ كيلو بطاطا\n٢ كيلو طماطة\nخبز`;

export function StaffPreparationClient({
  staffName,
  auth,
  preparers,
}: {
  staffName: string;
  auth: { se: string; exp: string; s: string };
  preparers: Array<{ id: string; name: string; available: boolean }>;
}) {
  const [state, formAction, pending] = useActionState(submitStaffPreparationDraft, initial);
  const regionSearchRef = useRef<HTMLInputElement>(null);

  const [pasteText, setPasteText] = useState("");
  const [parseError, setParseError] = useState<string | null>(null);
  const [titleLine, setTitleLine] = useState("");
  const [products, setProducts] = useState<string[]>([]);
  const [rawListText, setRawListText] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderTime, setOrderTime] = useState("فوري");

  const [preparerId, setPreparerId] = useState(preparers.find((p) => p.available)?.id ?? "");

  const [q, setQ] = useState("");
  const [hits, setHits] = useState<RegionHit[]>([]);
  const [selected, setSelected] = useState<RegionHit | null>(null);

  // Money summary simulation/fetch for UI consistency
  const [money, setMoney] = useState({ ward: "0 ألف", sader: "0 ألف", remain: "0 ألف" });

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(`/api/regions/search?q=${encodeURIComponent(q.trim())}`);
          const j = (await r.json()) as { regions?: RegionHit[] };
          setHits(j.regions ?? []);
        } catch {
          setHits([]);
        }
      })();
    }, 280);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    const err = state.error?.trim();
    if (!err) return;
    if (err.includes("منطقة")) regionSearchRef.current?.focus();
  }, [state.error]);

  function extractRegionCandidates(rawText: string, knownProducts?: string[]) {
    const lines = rawText
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    const productSet = new Set((knownProducts ?? []).map((x) => x.trim()).filter(Boolean));

    return lines.filter((line) => {
      if (line.length < 2) return false;
      if (/\d/.test(line)) return false;
      if (productSet.has(line)) return false;
      if (line.includes("كيلو") || line.includes("قطعة") || line.includes("حبة")) return false;
      return true;
    });
  }

  async function resolveRegionAfterParse(rawText: string, fallbackTitle: string, knownProducts?: string[]) {
    const candidates = extractRegionCandidates(rawText, knownProducts);
    const fallback = fallbackTitle.trim();
    if (fallback && fallback.length >= 2 && !candidates.includes(fallback)) candidates.unshift(fallback);
    const limited = candidates.slice(0, 6);

    for (const cand of limited) {
      const qq = cand.trim();
      if (qq.length < 2) continue;
      try {
        const r = await fetch(`/api/regions/search?q=${encodeURIComponent(qq)}`);
        const j = (await r.json()) as { regions?: RegionHit[] };
        const list = j.regions ?? [];
        if (list.length === 1) {
          setSelected(list[0]!);
          setQ(list[0]!.name);
          setTitleLine(list[0]!.name);
          return;
        }
        const normTitle = normalizeRegionNameForMatch(qq);
        const exact = list.find((x) => normalizeRegionNameForMatch(x.name) === normTitle);
        if (exact) {
          setSelected(exact);
          setQ(exact.name);
          setTitleLine(exact.name);
          return;
        }
      } catch {
      }
    }
  }

  function runParse() {
    setParseError(null);
    const t = pasteText.trim();
    if (!t) {
      setParseError("الصق نص الطلب أولاً.");
      return;
    }
    const flex = parseFlexibleOrderLines(t);
    if (flex) {
      setTitleLine(flex.title);
      setProducts([...flex.products]);
      setCustomerPhone(flex.phone);
      setRawListText(t);
      setQ(flex.title);
      setSelected(null);
      void resolveRegionAfterParse(t, flex.title, flex.products);
      return;
    }
    const site = parseSiteOrderMessage(t);
    if (site && site.items.length > 0) {
      const title = (site.address || site.landmark || "طلب موقع").trim();
      const phone = extractPhoneNumberFromText(t) ?? "";
      setTitleLine(title);
      setProducts(site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim()));
      setCustomerPhone(phone);
      setRawListText(t);
      setQ(title);
      setSelected(null);
      void resolveRegionAfterParse(t, title, site.items.map((it) => `${it.name.trim()} ${it.qty}`.trim()));
      return;
    }
    setParseError("تعذّر تحليل النص. تأكد من وجود عنوان ورقم زبون ومنتجات.");
  }

  if (state.ok) {
    return (
      <div className="kse-glass-dark rounded-2xl border border-emerald-300 p-6 text-center">
        <h2 className="text-xl font-black text-emerald-800">تم تحويل طلب التجهيز</h2>
        <p className="mt-2 text-sm text-slate-700">
          تم إرسال المسودة إلى المجهّز:
          <span className="font-black text-slate-900"> {state.preparerName ?? "—"}</span>
        </p>
        <Link
          href={`/staff/portal?${new URLSearchParams(auth).toString()}`}
          className="mt-4 inline-flex items-center justify-center rounded-xl border border-sky-300 bg-white px-4 py-2.5 text-sm font-bold text-sky-900 hover:bg-sky-50"
        >
          العودة للبوابة
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Money Summary Boxes like Preparer */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl border-2 border-red-500 bg-red-50 p-2 text-center shadow-sm">
          <span className="text-[10px] font-bold text-red-900">الوارد</span>
          <span className="mt-1 block text-sm font-black text-red-800">{money.ward}</span>
        </div>
        <div className="rounded-xl border-2 border-emerald-600 bg-emerald-50 p-2 text-center shadow-sm">
          <span className="text-[10px] font-bold text-emerald-900">الصادر</span>
          <span className="mt-1 block text-sm font-black text-emerald-800">{money.sader}</span>
        </div>
        <div className="rounded-xl border-2 border-blue-600 bg-blue-50 p-2 text-center shadow-sm">
          <span className="text-[10px] font-bold text-blue-900">المتبقي</span>
          <span className="mt-1 block text-sm font-black text-blue-800">{money.remain}</span>
        </div>
      </div>

      <header className="kse-glass-dark rounded-2xl border border-violet-200 p-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-black text-slate-900">إنشاء طلب تجهيز (تحليل)</h1>
          <div className="rounded-lg bg-sky-100 px-2 py-1 text-xs font-bold text-sky-900">
            {staffName}
          </div>
        </div>
        <p className="mt-1 text-xs text-slate-600">
          الصق قائمة الواتساب هنا لتحليلها وتجهيزها.
        </p>
      </header>

      <section className="kse-glass-dark rounded-2xl border border-violet-200 p-4 shadow-sm">
        <h2 className="text-sm font-black text-violet-950">1) الصق قائمة الطلب</h2>
        <textarea
          value={pasteText}
          onChange={(ev) => setPasteText(ev.target.value)}
          rows={8}
          placeholder={PASTE_HELP}
          dir="rtl"
          className={`${inputClass} mt-3 min-h-[10rem] resize-y font-mono text-sm leading-relaxed`}
        />
        <button
          type="button"
          onClick={runParse}
          className="mt-3 w-full rounded-xl border-2 border-violet-500 bg-violet-600 px-4 py-3 text-sm font-black text-white hover:bg-violet-700"
        >
          تحليل القائمة
        </button>
        {parseError ? <p className="mt-2 text-sm font-semibold text-rose-700">{parseError}</p> : null}
      </section>

      <form action={formAction} className="kse-glass-dark rounded-2xl border border-indigo-200 p-4 shadow-sm">
        <input type="hidden" name="se" value={auth.se} />
        <input type="hidden" name="exp" value={auth.exp} />
        <input type="hidden" name="s" value={auth.s} />
        <input type="hidden" name="rawListText" value={rawListText} />
        <input type="hidden" name="productsCsv" value={products.join("\n")} />
        <input type="hidden" name="customerRegionId" value={selected?.id ?? ""} />
        <input type="hidden" name="customerName" value={""} />
        <input type="hidden" name="customerLandmark" value={""} />

        <h2 className="text-sm font-black text-indigo-950">2) بيانات الطلب واسناد المجهز</h2>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">المجهّز *</span>
          <select
            name="preparerId"
            value={preparerId}
            onChange={(e) => setPreparerId(e.target.value)}
            className={inputClass}
            required
          >
            <option value="" disabled>
              اختر المجهّز…
            </option>
            {preparers.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} {p.available ? "" : "(غير متاح)"}
              </option>
            ))}
          </select>
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">عنوان المنطقة *</span>
          <input
            name="titleLine"
            value={titleLine}
            onChange={(ev) => setTitleLine(ev.target.value)}
            className={inputClass}
            required
          />
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">رقم الزبون *</span>
          <input
            name="customerPhone"
            value={customerPhone}
            onChange={(ev) => setCustomerPhone(ev.target.value)}
            className={`${inputClass} font-mono`}
            required
          />
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">وقت الطلب *</span>
          <input
            name="orderTime"
            value={orderTime}
            onChange={(ev) => setOrderTime(ev.target.value)}
            className={inputClass}
            required
          />
        </label>

        <label className="mt-3 flex flex-col gap-1">
          <span className="text-xs font-medium text-slate-800">بحث المنطقة واختيارها *</span>
          <input
            ref={regionSearchRef}
            value={q}
            onChange={(ev) => {
              setQ(ev.target.value);
              setSelected(null);
            }}
            className={inputClass}
            placeholder="ابحث بالمنطقة"
          />
        </label>
        {hits.length > 0 && !selected ? (
          <ul className="mt-2 max-h-40 overflow-auto rounded-xl border border-sky-200 bg-white text-sm shadow-md">
            {hits.map((h) => (
              <li key={h.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2.5 text-end text-slate-800 hover:bg-sky-50"
                  onClick={() => {
                    setSelected(h);
                    setQ(h.name);
                    setHits([]);
                  }}
                >
                  {h.name}{" "}
                  <span className="text-xs text-slate-500">({formatDinarAsAlfWithUnit(h.deliveryPrice)})</span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        {selected ? (
          <p className="mt-2 text-xs font-bold text-emerald-800">تم اختيار المنطقة: {selected.name}</p>
        ) : null}

        {state.error ? <p className="mt-3 text-sm font-semibold text-rose-700">{state.error}</p> : null}

        <button
          type="submit"
          disabled={pending || products.length === 0}
          className="mt-4 w-full rounded-xl bg-gradient-to-r from-emerald-600 to-sky-600 px-4 py-3 text-sm font-black text-white disabled:opacity-60"
        >
          {pending ? "جارٍ الإرسال..." : "رفع طلب التجهيز واسناده"}
        </button>
        {products.length === 0 ? (
          <p className="mt-2 text-center text-xs text-slate-500">حلّل القائمة أولاً حتى يتفعّل زر الإرسال.</p>
        ) : null}
      </form>
    </div>
  );
}
