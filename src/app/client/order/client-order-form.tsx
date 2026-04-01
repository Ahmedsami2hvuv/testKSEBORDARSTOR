"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef, useState, type FormEvent } from "react";
import { compressImageFileForUpload } from "@/lib/client-image-compress";
import { resolvePublicImageSrc } from "@/lib/image-url";
import { ALF_PER_DINAR, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { clientOrderAccountPath, clientOrderHistoryPath } from "@/lib/client-order-portal-nav";
import { isReversePickupOrderType, withoutReversePickupPrefix } from "@/lib/order-type-flags";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { submitClientOrder, type ClientOrderState } from "./actions";
import { ClientVoiceNoteField } from "./client-voice-note-field";

type RegionHit = { id: string; name: string; deliveryPrice: string };

const initial: ClientOrderState = {};

const inputClass =
  "w-full rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-sm text-slate-800 shadow-sm outline-none transition placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200";

type ClientOrderFormProps = {
  shopName: string;
  /** موظف المحل — يُعرض في الترحيب فقط */
  employeeName: string;
  photoUrl: string;
  shopRegionName: string;
  /** أقل أجر توصيل للمحل بالألف (نفس وحدة إدخال السعر) */
  shopDeliveryAlf: number;
  e: string;
  exp: string;
  sig: string;
  initialOrder?: {
    orderNumber: number;
    customerPhone: string;
    orderType: string;
    orderSubtotal: string;
    alternatePhone: string;
    orderTime: string;
    notes: string;
    customerLocationUrl: string;
    customerLandmark: string;
    prepaidAll: boolean;
    customerRegion: { id: string; name: string; deliveryPrice: string };
  } | null;
};

function ClientOrderFormInner({
  shopName,
  employeeName,
  photoUrl,
  shopRegionName,
  shopDeliveryAlf,
  e,
  exp,
  sig,
  initialOrder,
  onResetForNewOrder,
}: ClientOrderFormProps & { onResetForNewOrder: () => void }) {
  const isEditMode = Boolean(initialOrder);
  const [state, formAction, pending] = useActionState(submitClientOrder, initial);
  const formRef = useRef<HTMLFormElement>(null);
  const orderPriceRef = useRef<HTMLInputElement>(null);
  const regionSearchRef = useRef<HTMLInputElement>(null);
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<RegionHit[]>([]);
  const [selected, setSelected] = useState<RegionHit | null>(
    initialOrder
      ? {
          id: initialOrder.customerRegion.id,
          name: initialOrder.customerRegion.name,
          deliveryPrice: initialOrder.customerRegion.deliveryPrice,
        }
      : null,
  );
  const [orderPrice, setOrderPrice] = useState(initialOrder?.orderSubtotal ?? "");
  const [orderType, setOrderType] = useState(
    withoutReversePickupPrefix(initialOrder?.orderType ?? ""),
  );
  const [customerPhone, setCustomerPhone] = useState(initialOrder?.customerPhone ?? "");
  const [alternatePhone, setAlternatePhone] = useState(initialOrder?.alternatePhone ?? "");
  const [orderTime, setOrderTime] = useState(initialOrder?.orderTime ?? "");
  const [notes, setNotes] = useState(initialOrder?.notes ?? "");
  const [customerLocationUrl, setCustomerLocationUrl] = useState(
    initialOrder?.customerLocationUrl ?? "",
  );
  const [customerLandmark, setCustomerLandmark] = useState(initialOrder?.customerLandmark ?? "");
  const [extraInfoOpen, setExtraInfoOpen] = useState(false);
  const [showNoPriceConfirm, setShowNoPriceConfirm] = useState(false);
  const [allowNoPriceSubmit, setAllowNoPriceSubmit] = useState(false);
  const [reversePickup, setReversePickup] = useState(
    isReversePickupOrderType(initialOrder?.orderType ?? ""),
  );

  const orderImageMainRef = useRef<HTMLInputElement>(null);
  const orderImageCamRef = useRef<HTMLInputElement>(null);
  const orderImageGalRef = useRef<HTMLInputElement>(null);
  const [orderImagePreview, setOrderImagePreview] = useState<string | null>(null);

  /** نسخ الملف من مدخل الكاميرا/المعرض إلى الحقل المرسل مع النموذج (يدعم الجوال + ضغط لتسريع الرفع) */
  async function syncOrderImageToMain(from: HTMLInputElement) {
    const file = from.files?.[0];
    const main = orderImageMainRef.current;
    if (!file || !main) {
      from.value = "";
      return;
    }
    let toUse = file;
    try {
      toUse = await compressImageFileForUpload(file);
    } catch {
      toUse = file;
    }
    const dt = new DataTransfer();
    dt.items.add(toUse);
    main.files = dt.files;
    if (orderImagePreview) URL.revokeObjectURL(orderImagePreview);
    setOrderImagePreview(URL.createObjectURL(toUse));
    from.value = "";
  }

  function clearOrderImage() {
    const main = orderImageMainRef.current;
    if (main) {
      const dt = new DataTransfer();
      main.files = dt.files;
    }
    if (orderImagePreview) URL.revokeObjectURL(orderImagePreview);
    setOrderImagePreview(null);
  }

  useEffect(() => {
    return () => {
      if (orderImagePreview) URL.revokeObjectURL(orderImagePreview);
    };
  }, [orderImagePreview]);

  /** عند اختيار منطقة + رقم صالح: تحميل مرجع (رقم+منطقة) فقط — منطقة أخرى لا تُعرض بياناتها هنا */
  useEffect(() => {
    if (isEditMode) return;
    const phone = normalizeIraqMobileLocal11(customerPhone);
    if (!selected?.id || !phone) return;
    const ac = new AbortController();
    const t = window.setTimeout(() => {
      void (async () => {
        try {
          const qs = new URLSearchParams({
            e,
            exp,
            s: sig,
            phone: customerPhone.trim(),
            regionId: selected.id,
          });
          const r = await fetch(`/api/customer-phone-profile?${qs.toString()}`, {
            signal: ac.signal,
          });
          const j = (await r.json()) as {
            profile?: {
              locationUrl: string;
              landmark: string;
              alternatePhone: string | null;
            } | null;
          };
          const p = j.profile;
          setCustomerLocationUrl(p?.locationUrl ?? "");
          setCustomerLandmark(p?.landmark ?? "");
          setAlternatePhone(p?.alternatePhone?.trim() ? p.alternatePhone.trim() : "");
        } catch {
          if (!ac.signal.aborted) {
            setCustomerLocationUrl("");
            setCustomerLandmark("");
            setAlternatePhone("");
          }
        }
      })();
    }, 320);
    return () => {
      window.clearTimeout(t);
      ac.abort();
    };
  }, [isEditMode, selected?.id, customerPhone, e, exp, sig]);

  useEffect(() => {
    if (q.trim().length < 2) {
      setHits([]);
      return;
    }
    const t = setTimeout(() => {
      void (async () => {
        try {
          const r = await fetch(
            `/api/regions/search?q=${encodeURIComponent(q.trim())}`,
          );
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
    const focusTarget = (el: HTMLInputElement | null) => {
      if (!el) return;
      el.scrollIntoView({ behavior: "smooth", block: "center" });
      window.setTimeout(() => el.focus(), 120);
    };
    if (err.includes("منطقة الزبون")) {
      focusTarget(regionSearchRef.current);
      return;
    }
    if (err.includes("سعر الطلب")) {
      focusTarget(orderPriceRef.current);
    }
  }, [state.error]);

  const custDelAlf = selected
    ? Number(selected.deliveryPrice) / ALF_PER_DINAR
    : NaN;
  const normalizedPrice = orderPrice.replace(/,/g, ".").trim();
  const hasOrderPrice = normalizedPrice.length > 0;
  const parsedPrice = hasOrderPrice ? parseFloat(normalizedPrice) : NaN;
  const delivery =
    selected && !Number.isNaN(custDelAlf)
      ? Math.max(shopDeliveryAlf, custDelAlf)
      : null;
  const total =
    delivery != null && hasOrderPrice && !Number.isNaN(parsedPrice)
      ? parsedPrice + delivery
      : null;

  const historyHrefNav = clientOrderHistoryPath(e, exp, sig, customerPhone);
  const accountHrefNav = clientOrderAccountPath(e, exp, sig);

  if (state.ok) {
    const historyHref = clientOrderHistoryPath(e, exp, sig, customerPhone);
    const accountHref = clientOrderAccountPath(e, exp, sig);
    return (
      <div className="mx-auto max-w-lg" role="status" aria-live="polite">
        <div className="kse-glass-dark rounded-2xl border border-emerald-300 p-8 text-center shadow-sm">
          <p className="text-4xl" aria-hidden>
            ✓
          </p>
          <h2 className="mt-3 text-xl font-bold text-emerald-800">
            {isEditMode ? "تم تعديل الطلب بنجاح" : "تم رفع الطلب بنجاح"}
          </h2>
          <div className="mt-5 flex flex-col gap-2">
            {!isEditMode ? (
              <button
                type="button"
                onClick={onResetForNewOrder}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-emerald-200/40 transition hover:bg-emerald-700 active:scale-[0.99]"
              >
                طلب جديد
              </button>
            ) : null}
            <Link
              href={historyHref}
              className="flex w-full items-center justify-center rounded-xl border-2 border-sky-500 bg-sky-50 px-4 py-3.5 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
            >
              سجل الطلبات
            </Link>
            <Link
              href={accountHref}
              className="flex w-full items-center justify-center rounded-xl border-2 border-emerald-400 bg-emerald-50 px-4 py-3.5 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100"
            >
              إحصائيات طلباتك
            </Link>
          </div>
        </div>
      </div>
    );
  }

  function onFormSubmit(e: FormEvent<HTMLFormElement>) {
    if (allowNoPriceSubmit) {
      setAllowNoPriceSubmit(false);
      return;
    }
    if (normalizedPrice) return;
    e.preventDefault();
    setShowNoPriceConfirm(true);
  }

  return (
    <div className="mx-auto max-w-lg">
      <form
        ref={formRef}
        action={formAction}
        onSubmit={onFormSubmit}
        encType="multipart/form-data"
        className="space-y-5"
      >
        <input type="hidden" name="e" value={e} />
        <input type="hidden" name="exp" value={exp} />
        <input type="hidden" name="s" value={sig} />
        <input type="hidden" name="customerRegionId" value={selected?.id ?? ""} />
        <input type="hidden" name="editOrderNumber" value={initialOrder?.orderNumber ?? ""} />
        <input type="hidden" name="reversePickup" value={reversePickup ? "on" : ""} />

        <header className="kse-glass-dark rounded-2xl border border-sky-200 p-6 text-center shadow-lg bg-gradient-to-b from-white/80 to-sky-50/30">
          <h1 className="text-3xl font-black text-sky-950 mb-4 tracking-tighter drop-shadow-sm">
            أبو الأكبر للتوصيل
          </h1>

          {resolvePublicImageSrc(photoUrl) ? (
            <div className="relative inline-block">
              <img
                src={resolvePublicImageSrc(photoUrl)!}
                alt=""
                className="mx-auto h-24 w-24 rounded-3xl object-cover ring-4 ring-white shadow-md"
              />
              <div className="absolute -bottom-1 -right-1 bg-emerald-500 text-white p-1 rounded-full text-[10px] ring-2 ring-white">
                ✓
              </div>
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            <div className="space-y-1">
              <p className="text-xl font-bold text-slate-800">
                أهلاً بك <span className="text-sky-700">{employeeName.trim() || "عميلنا"}</span> من <span className="text-emerald-800 font-black underline underline-offset-4 decoration-emerald-200">{shopName}</span>
              </p>

              <div className="flex flex-col items-center justify-center gap-2 sm:flex-row sm:gap-8">
                <p className="text-base font-bold text-slate-600">
                  {shopRegionName}
                </p>
              </div>
            </div>

            {isEditMode && (
              <p className="text-sm font-black text-amber-700 bg-amber-50 px-4 py-1.5 rounded-full inline-block ring-1 ring-amber-200 shadow-sm">
                وضع تعديل الطلب رقم #{initialOrder?.orderNumber}
              </p>
            )}

            <div className="pt-2">
              <p className="text-lg font-black text-sky-900 bg-gradient-to-r from-sky-100/80 via-white/90 to-sky-100/80 backdrop-blur-sm px-6 py-2.5 rounded-2xl inline-block border border-sky-200 shadow-sm ring-4 ring-sky-50/50">
                خدمتكم تسعدنا وطلباتكم امانة لدينا
              </p>
            </div>
          </div>

          <div className="mt-8 border-t border-sky-100 pt-5">
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <Link
                href={accountHrefNav}
                className="block w-full rounded-xl border-2 border-emerald-400 bg-emerald-50/90 px-3 py-2.5 text-center text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100"
              >
                إحصائيات طلباتك
              </Link>
              <Link
                href={historyHrefNav}
                className="block w-full rounded-xl border border-sky-300 bg-white px-3 py-2.5 text-center text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-50"
              >
                سجل الطلبات
              </Link>
            </div>
          </div>
        </header>

        <section className="kse-glass-dark mt-6 rounded-2xl border border-sky-200 p-5">
          <h2 className="text-sm font-bold text-sky-900">ادخل تفاصيل طلبيتكم</h2>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-800">نوع الطلب *</span>
            <input
              name="orderType"
              required
              autoFocus
              value={orderType}
              onChange={(e) => setOrderType(e.target.value)}
              className={inputClass}
              placeholder="مثال: بضاعة، طعام، …"
            />
          </label>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-800">سعر الطلب (بالألف) - اختياري</span>
            <input
              ref={orderPriceRef}
              name="orderSubtotal"
              inputMode="decimal"
              value={orderPrice}
              onChange={(e) => setOrderPrice(e.target.value)}
              className={`${inputClass} font-mono tabular-nums`}
              placeholder="مثال: 10 أو 10.5"
            />
            <span className="text-xs text-slate-500">
              يمكنك تركه فارغاً؛ سيظهر تنبيه تأكيد قبل الإرسال بدون سعر.
            </span>
          </label>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-red-200 bg-red-50/85 p-3 text-sm text-slate-800 shadow-sm">
              <input
                type="checkbox"
                name="prepaidAll"
                value="on"
                defaultChecked={Boolean(initialOrder?.prepaidAll)}
                className="mt-1 h-5 w-5 shrink-0 rounded border-red-400 text-red-600 accent-red-600"
              />
              <span>
                <span className="font-bold text-red-950">كل شي واصل</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-700">
                  الطلب مدفوع مسبقاً أو إلكترونياً — المندوب لا يستلم نقداً من الزبون (بما فيه التوصيل).
                </span>
              </span>
            </label>
            <button
              type="button"
              onClick={() => setReversePickup((v) => !v)}
              aria-pressed={reversePickup}
              className={`flex items-start gap-3 rounded-xl border p-3 text-sm shadow-sm transition ${
                reversePickup
                  ? "border-violet-500 bg-violet-100 text-violet-950 ring-2 ring-violet-300"
                  : "border-violet-200 bg-violet-50/70 text-slate-800 hover:bg-violet-100/70"
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded border text-xs font-black ${
                  reversePickup
                    ? "border-violet-600 bg-violet-600 text-white"
                    : "border-violet-400 bg-white text-violet-700"
                }`}
                aria-hidden
              >
                {reversePickup ? "✓" : ""}
              </span>
              <span className="text-right">
                <span className="font-bold text-violet-950">طلب عكسي</span>
                <span className="mt-1 block text-xs leading-relaxed text-slate-700">
                  تنبيه طلب عكسي استلام من الزبون وتسليم للعميل
                </span>
              </span>
            </button>
          </div>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-800">رقم الزبون *</span>
            <span className="text-xs text-slate-500">
              أي صيغة: 07… أو +964… أو مع مسافات — يُحوَّل تلقائياً.
            </span>
            <input
              name="customerPhone"
              required
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              inputMode="numeric"
              className={`${inputClass} font-mono tabular-nums`}
              placeholder="+964 777 363 0152 أو 07773630152"
              autoComplete="tel"
            />
          </label>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-800">
              رقم ثانٍ للزبون (اختياري)
            </span>
            <input
              name="alternatePhone"
              value={alternatePhone}
              onChange={(e) => setAlternatePhone(e.target.value)}
              inputMode="numeric"
              className={`${inputClass} font-mono tabular-nums`}
              placeholder="اتركه فارغاً إن لم يوجد"
              autoComplete="tel"
            />
          </label>

          <div className="mt-4">
            <span className="text-sm font-medium text-slate-800">
              منطقة الزبون * (ابحث واختر)
            </span>
            <input
              ref={regionSearchRef}
              type="text"
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setSelected(null);
              }}
              className={`${inputClass} mt-1.5`}
              placeholder="اكتب حرفين على الأقل للبحث…"
              autoComplete="off"
            />
            {hits.length > 0 && !selected ? (
              <ul
                className="mt-2 max-h-40 overflow-auto rounded-xl border border-sky-200 bg-white text-sm shadow-md"
                role="listbox"
              >
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
                      <span className="text-xs text-slate-500 tabular-nums">
                        (توصيل {formatDinarAsAlfWithUnit(h.deliveryPrice)})
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            {selected ? (
              <p className="mt-2 text-xs font-medium text-emerald-800">
                تم الاختيار: {selected.name}
              </p>
            ) : null}
            {delivery != null ? (
              <div className="mt-3 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-slate-800">
                <p>
                  سعر التوصيل (الأعلى بين محلك والزبون) بالألف:{" "}
                  <strong className="tabular-nums text-sky-800">
                    {delivery != null ? `${delivery.toFixed(2)} ألف` : "—"}
                  </strong>
                </p>
                <div className="mt-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2">
                  <p className="text-sm font-bold text-emerald-950">
                    المجموع (الطلب + التوصيل) بالألف:{" "}
                    <strong className="tabular-nums text-emerald-900">
                      {total != null && !Number.isNaN(total) ? `${total.toFixed(2)} ألف` : "—"}
                    </strong>
                  </p>
                </div>
                {!hasOrderPrice ? (
                  <p className="mt-1 text-xs font-semibold text-amber-800">
                    السعر غير مكتوب حالياً. يمكنك الإرسال بدون سعر بعد التأكيد.
                  </p>
                ) : null}
              </div>
            ) : (
              <p className="mt-2 text-xs text-amber-800">اختر منطقة الزبون لحساب التوصيل.</p>
            )}
          </div>

          <label className="mt-4 flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-800">وقت الطلب (إجباري)</span>
            <input
              name="orderTime"
              value={orderTime}
              onChange={(e) => setOrderTime(e.target.value)}
              required
              className={inputClass}
              placeholder="مثال: بعد المغرب، 6 مساءً"
            />
          </label>

          <label className="mt-4 flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-3">
              <span
                className={`text-sm font-medium ${notes.trim() ? "font-bold text-rose-800" : "text-slate-800"}`}
              >
                ملاحظات (اختياري)
              </span>
              <button
                type="button"
                disabled={!notes.trim()}
                onClick={() => {
                  const t = notes.trim();
                  if (!t) return;
                  void navigator.clipboard?.writeText(t).catch(() => {});
                }}
                className="shrink-0 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-bold text-rose-700 shadow-sm transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                title="نسخ محتوى الملاحظات"
              >
                نسخ
              </button>
            </div>
            <textarea
              name="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onPointerDown={(e) => {
                const t = notes.trim();
                if (!t) return;
                // النسخ يحتاج "لمسة" فعلية من المستخدم (PointerDown مناسب للجوال).
                void navigator.clipboard?.writeText(t).catch(() => {});
              }}
              className={`${inputClass} min-h-[5rem] resize-y ${
                notes.trim()
                  ? "border-rose-400 bg-rose-50/90 ring-2 ring-rose-200 focus:border-rose-500 focus:ring-rose-300"
                  : ""
              }`}
              placeholder="أي تفاصيل إضافية، عنوان تقريبي، …"
            />
          </label>

          <ClientVoiceNoteField />

          <div className="mt-4">
            <span className="text-sm font-medium text-slate-800">إضافة صورة (اختياري)</span>
            <p className="mt-1 text-xs text-slate-500">
              اختر <strong className="text-slate-700">كاميرا</strong> للتقاط صورة، أو{" "}
              <strong className="text-slate-700">معرض</strong> لاختيار صورة من الجهاز.
            </p>
            {/* الحقل الوحيد المُرسل مع الطلب — يُعبأ برمجياً من الكاميرا أو المعرض */}
            <input
              ref={orderImageMainRef}
              name="orderImage"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
            />
            <input
              ref={orderImageCamRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="sr-only"
              tabIndex={-1}
              onChange={() => {
                void (async () => {
                  if (orderImageCamRef.current) await syncOrderImageToMain(orderImageCamRef.current);
                })();
              }}
            />
            <input
              ref={orderImageGalRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              tabIndex={-1}
              onChange={() => {
                void (async () => {
                  if (orderImageGalRef.current) await syncOrderImageToMain(orderImageGalRef.current);
                })();
              }}
            />
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => orderImageCamRef.current?.click()}
                aria-label="التقاط صورة للطلب بالكاميرا"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-sky-400 bg-sky-50 px-4 py-2.5 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100"
              >
                <span className="text-lg" aria-hidden>
                  📷
                </span>
                التقاط صورة
              </button>
              <button
                type="button"
                onClick={() => orderImageGalRef.current?.click()}
                aria-label="اختيار صورة الطلب من معرض الصور"
                className="inline-flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-xl border-2 border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50"
              >
                <span className="text-lg" aria-hidden>
                  🖼
                </span>
                من المعرض
              </button>
            </div>
            {orderImagePreview ? (
              <div className="mt-3 flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50/50 p-3">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={orderImagePreview}
                  alt="معاينة صورة الطلب"
                  className="h-20 w-20 shrink-0 rounded-lg border border-sky-200 object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-emerald-900">تم اختيار صورة</p>
                  <button
                    type="button"
                    onClick={clearOrderImage}
                    className="mt-2 text-xs font-bold text-rose-700 underline hover:text-rose-900"
                  >
                    إزالة الصورة
                  </button>
                </div>
              </div>
            ) : null}
            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              JPG أو PNG أو Webp — حتى 10 ميجابايت.
            </p>
          </div>
        </section>

        <div className="kse-glass-dark rounded-2xl border border-slate-200/80 bg-slate-50/40 p-4">
          <button
            type="button"
            id="extra-info-toggle"
            aria-expanded={extraInfoOpen}
            aria-controls="extra-info-panel"
            onClick={() => setExtraInfoOpen((v) => !v)}
            className="flex w-full items-center justify-between gap-3 rounded-xl border border-sky-200 bg-white px-3 py-2.5 text-start text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-50"
          >
            <span>معلومات إضافية (موقع الزبون، أقرب نقطة دالة)</span>
            <span className="text-sky-600 tabular-nums" aria-hidden>
              {extraInfoOpen ? "−" : "+"}
            </span>
          </button>
          <div
            id="extra-info-panel"
            role="region"
            aria-hidden={!extraInfoOpen}
            aria-labelledby="extra-info-toggle"
            className={extraInfoOpen ? "mt-4 space-y-4" : "hidden"}
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-800">
                موقع الزبون (رابط خرائط / لوكيشن) — اختياري
              </span>
              <input
                name="customerLocationUrl"
                value={customerLocationUrl}
                onChange={(e) => setCustomerLocationUrl(e.target.value)}
                className={inputClass}
                placeholder="الصق رابط خرائط Google أو غيره"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-sm font-medium text-slate-800">أقرب نقطة دالة — اختياري</span>
              <input
                name="customerLandmark"
                value={customerLandmark}
                onChange={(e) => setCustomerLandmark(e.target.value)}
                className={inputClass}
                placeholder="مثال: قرب مدخل السوق، بجانب …"
              />
            </label>
          </div>
        </div>

        {state.error ? (
          <div
            className="space-y-2 rounded-xl border border-rose-300 bg-rose-50 px-3 py-2 text-sm text-rose-800"
            role="alert"
          >
            <p className="font-semibold">{state.error}</p>
            <p className="text-xs leading-relaxed text-rose-900/90">
              لم نمسح ما كتبته؛ صحّح الحقل المشار إليه وأعد الإرسال. إن اخترت صورة قد تحتاج لإعادة
              اختيارها (قيود المتصفح).
            </p>
          </div>
        ) : null}

        {showNoPriceConfirm ? (
          <div
            className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3 text-sm text-amber-900"
            role="alertdialog"
            aria-live="assertive"
          >
            <p className="font-bold">الطلب بدون سعر.</p>
            <p className="mt-1 text-xs">
              هل أنت متأكد من إرسال الطلب بدون سعر؟ يمكنك المتابعة أو تعديل السعر أولاً.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className="rounded-xl border border-emerald-500 bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700"
                onClick={() => {
                  setShowNoPriceConfirm(false);
                  setAllowNoPriceSubmit(true);
                  formRef.current?.requestSubmit();
                }}
              >
                موافق
              </button>
              <button
                type="button"
                className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setShowNoPriceConfirm(false);
                  orderPriceRef.current?.focus();
                }}
              >
                تعديل
              </button>
            </div>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-xl bg-gradient-to-r from-sky-600 to-cyan-600 px-4 py-3.5 text-sm font-bold text-white shadow-md shadow-sky-200 ring-1 ring-sky-400/30 transition hover:from-sky-700 hover:to-cyan-700 active:scale-[0.99] disabled:opacity-60"
        >
            {pending ? "جارٍ الإرسال…" : isEditMode ? "حفظ التعديلات" : "رفع الطلب"}
        </button>
        {pending ? (
          <p className="text-center text-xs leading-relaxed text-slate-500">
            قد يستغرق الإرسال وقتاً أطول مع صورة أو تسجيل صوتي؛ انتظر ولا تغلق الصفحة.
          </p>
        ) : null}
      </form>
    </div>
  );
}

export function ClientOrderForm(props: ClientOrderFormProps) {
  const [sessionKey, setSessionKey] = useState(0);
  return (
    <ClientOrderFormInner
      key={sessionKey}
      {...props}
      onResetForNewOrder={() => setSessionKey((k) => k + 1)}
    />
  );
}
