"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import { ad } from "@/lib/admin-ui";
import {
  ADMIN_OFFICE_LABEL,
  ADMIN_PHONE_FROM_SHOP_LOCAL,
  ADMIN_PHONE_ONE_FACE_LOCAL,
  ADMIN_PHONE_SUPPORT_FOOTER_LOCAL,
} from "@/lib/admin-order-from-admin-constants";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { RegionSearchPicker } from "@/components/region-search-picker";
import { ShopSearchPicker } from "@/components/shop-search-picker";
import {
  ShopEmployeeQuickPick,
  type ShopEmployeeRow,
} from "@/components/shop-customer-search-picker";
import { ClientVoiceNoteField } from "@/app/client/order/client-voice-note-field";
import { createAdminOrder, type AdminCreateOrderState } from "./actions";

type ShopOpt = { id: string; name: string; regionId: string; locationUrl: string };
type RegionOpt = { id: string; name: string };
type EmployeeOpt = ShopEmployeeRow;
type CustomerPrefill = {
  id: string;
  shopId: string;
  name: string;
  phone: string;
  customerRegionId: string | null;
  customerLocationUrl: string;
  customerLandmark: string;
  customerDoorPhotoUrl: string | null;
};

const initialState: AdminCreateOrderState = {};

type SubmissionMode = "from_shop" | "admin_one_face" | "two_faces";

function doorPhotoUrlForDisplay(url: string | null | undefined): string | null {
  const u = url?.trim();
  if (!u) return null;
  if (u.startsWith("http://") || u.startsWith("https://")) return u;
  return u.startsWith("/") ? u : `/${u}`;
}

export function AdminCreateOrderForm({
  shops,
  regions,
  customers,
  employees,
}: {
  shops: ShopOpt[];
  regions: RegionOpt[];
  customers: CustomerPrefill[];
  employees: EmployeeOpt[];
}) {
  const [state, formAction, pending] = useActionState(createAdminOrder, initialState);

  const [submissionMode, setSubmissionMode] = useState<SubmissionMode>("from_shop");
  const [shopId, setShopId] = useState("");

  const [recipientKind, setRecipientKind] = useState<"none" | "employee" | "admin">("none");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("");

  const [orderType, setOrderType] = useState("");
  const [orderSubtotal, setOrderSubtotal] = useState("");
  const [orderNoteTime, setOrderNoteTime] = useState("");
  const [summary, setSummary] = useState("");

  const [firstPhone, setFirstPhone] = useState("");
  const [firstRegionId, setFirstRegionId] = useState("");
  const [firstLocationUrl, setFirstLocationUrl] = useState("");
  const [firstLandmark, setFirstLandmark] = useState("");

  const [secondPhone, setSecondPhone] = useState("");
  const [secondRegionId, setSecondRegionId] = useState("");
  const [secondLocationUrl, setSecondLocationUrl] = useState("");
  const [secondLandmark, setSecondLandmark] = useState("");

  const [firstSavedDoorPhotoUrl, setFirstSavedDoorPhotoUrl] = useState<string | null>(null);
  const [secondSavedDoorPhotoUrl, setSecondSavedDoorPhotoUrl] = useState<string | null>(null);

  const routeMode = submissionMode === "two_faces" ? "double" : "single";

  useEffect(() => {
    if (submissionMode === "admin_one_face") {
      setShopId("");
      setRecipientKind("none");
      setSelectedEmployeeId("");
      setFirstSavedDoorPhotoUrl(null);
      setFirstPhone(ADMIN_PHONE_ONE_FACE_LOCAL);
      setFirstRegionId("");
      setFirstLocationUrl("");
      setFirstLandmark("");
      setSecondPhone("");
      setSecondRegionId("");
      setSecondLocationUrl("");
      setSecondLandmark("");
    } else if (submissionMode === "two_faces") {
      setShopId("");
      setRecipientKind("none");
      setSelectedEmployeeId("");
      setFirstSavedDoorPhotoUrl(null);
      setSecondSavedDoorPhotoUrl(null);
      setFirstPhone("");
      setFirstRegionId("");
      setFirstLocationUrl("");
      setFirstLandmark("");
      setSecondPhone("");
      setSecondRegionId("");
      setSecondLocationUrl("");
      setSecondLandmark("");
    } else {
      setFirstSavedDoorPhotoUrl(null);
      setSecondSavedDoorPhotoUrl(null);
      setFirstPhone("");
      setFirstRegionId("");
      setFirstLocationUrl("");
      setFirstLandmark("");
      setSecondPhone("");
      setSecondRegionId("");
      setSecondLocationUrl("");
      setSecondLandmark("");
      setRecipientKind("none");
      setSelectedEmployeeId("");
    }
  }, [submissionMode]);

  useEffect(() => {
    if (submissionMode !== "from_shop") return;
    setRecipientKind("none");
    setSelectedEmployeeId("");
    setFirstSavedDoorPhotoUrl(null);
  }, [shopId, submissionMode]);

  function pickEmployee(emp: EmployeeOpt) {
    setRecipientKind("employee");
    setSelectedEmployeeId(emp.id);
    setFirstSavedDoorPhotoUrl(null);
  }

  function pickAdminOffice() {
    setRecipientKind("admin");
    setSelectedEmployeeId("");
    setFirstSavedDoorPhotoUrl(null);
    setFirstPhone(ADMIN_PHONE_FROM_SHOP_LOCAL);
    setFirstRegionId("");
    setFirstLocationUrl("");
    setFirstLandmark(ADMIN_OFFICE_LABEL);
  }

  const firstPhoneNormalized = useMemo(
    () => normalizeIraqMobileLocal11(firstPhone),
    [firstPhone],
  );
  const secondPhoneNormalized = useMemo(
    () => normalizeIraqMobileLocal11(secondPhone),
    [secondPhone],
  );

  const defaultDoubleShopId = shops[0]?.id ?? "";

  function findCustomerPrefill(phoneRaw: string, regionId: string): CustomerPrefill | null {
    const local = normalizeIraqMobileLocal11(phoneRaw);
    const rid = regionId.trim();
    if (!local || !rid) return null;
    return (
      customers.find((c) => {
        const samePhoneRegion = c.phone === local && (c.customerRegionId ?? "") === rid;
        if (submissionMode === "from_shop" && shopId) {
          return c.shopId === shopId && samePhoneRegion;
        }
        return samePhoneRegion;
      }) ?? null
    );
  }

  const firstPrefill = useMemo(
    () => findCustomerPrefill(firstPhone, firstRegionId),
    [firstPhone, firstRegionId, customers, submissionMode, shopId],
  );
  const secondPrefill = useMemo(
    () => findCustomerPrefill(secondPhone, secondRegionId),
    [secondPhone, secondRegionId, customers, submissionMode, shopId],
  );

  useEffect(() => {
    if (!firstPrefill) setFirstSavedDoorPhotoUrl(null);
  }, [firstPrefill]);

  useEffect(() => {
    if (!secondPrefill) setSecondSavedDoorPhotoUrl(null);
  }, [secondPrefill]);

  const canSubmit =
    !pending &&
    (submissionMode !== "two_faces" || Boolean(defaultDoubleShopId)) &&
    (submissionMode !== "from_shop" || Boolean(shopId.trim()));

  return (
    <form action={formAction} className="space-y-4" encType="multipart/form-data">
      <input type="hidden" name="adminSubmissionMode" value={submissionMode} />
      <input type="hidden" name="routeMode" value={routeMode} />
      <input type="hidden" name="linkedCustomerId" value={selectedEmployeeId} />

      <div className="rounded-xl border border-sky-200 bg-white/70 p-3">
        <p className="text-sm font-bold text-slate-800">نوع المسار</p>
        <div className="mt-2 flex flex-col gap-3">
          <label className="inline-flex max-w-full items-start gap-2 text-sm leading-snug">
            <input
              type="radio"
              name="submissionModeUi"
              checked={submissionMode === "from_shop"}
              onChange={() => setSubmissionMode("from_shop")}
              className="mt-0.5 shrink-0"
            />
            <span>
              <strong>رفع من محل</strong> — ابحث عن المحل، ثم اختر العميل كزر جاهز أو «الإدارة»، ثم أكمل الطلب.
            </span>
          </label>
          <label className="inline-flex max-w-full items-start gap-2 text-sm leading-snug">
            <input
              type="radio"
              name="submissionModeUi"
              checked={submissionMode === "admin_one_face"}
              onChange={() => setSubmissionMode("admin_one_face")}
              className="mt-0.5 shrink-0"
            />
            <span>
              <strong>وجهة واحدة (إداري)</strong> — طلبية مباشرة بدون محل. يتم إدخال تفاصيل الزبون والطلبية فقط.
            </span>
          </label>
          <label className="inline-flex max-w-full items-start gap-2 text-sm leading-snug">
            <input
              type="radio"
              name="submissionModeUi"
              checked={submissionMode === "two_faces"}
              onChange={() => setSubmissionMode("two_faces")}
              className="mt-0.5 shrink-0"
            />
            <span>
              <strong>وجهتان</strong> — مرسل ومستلم (رقم ومنطقة لكل وجهة)، مع نوع الطلب والسعر والتفاصيل.
            </span>
          </label>
        </div>
      </div>

      {submissionMode === "from_shop" ? (
        <div className="space-y-4">
          <div>
            <ShopSearchPicker
              shops={shops}
              fieldName="shopId"
              label="المحل"
              required
              value={shopId}
              onValueChange={setShopId}
            />
            <span className="text-[11px] leading-snug text-slate-500 block mt-1">
              ابحث عن اسم المحل واختر من النتائج.
            </span>
          </div>
          <ShopEmployeeQuickPick
            shopId={shopId}
            employees={employees}
            selectedEmployeeId={selectedEmployeeId}
            recipientKind={recipientKind}
            onPickEmployee={pickEmployee}
            onPickAdminOffice={pickAdminOffice}
          />
        </div>
      ) : null}

      {submissionMode === "admin_one_face" ? (
        <div className="rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 text-sm text-violet-950">
          وضع <strong>وجهة واحدة</strong>: لا يتطلب اختيار محل. أدخل تفاصيل الزبون ونوع الطلبية والسعر.
        </div>
      ) : null}

      {submissionMode === "two_faces" && !defaultDoubleShopId ? (
        <p className="rounded-lg border border-rose-300 bg-rose-50 px-3 py-2 text-sm font-bold text-rose-900">
          لا يوجد محل مسجّل — أضف محلاً واحداً على الأقل لاستخدام طلبات الوجهتين.
        </p>
      ) : submissionMode === "two_faces" ? (
        <div className="rounded-lg border border-violet-200 bg-violet-50/70 px-3 py-2 text-sm text-violet-950">
          مسار <strong>مرسل → مستلم</strong>: لا يظهر اختيار المحل؛ يُربَط الطلب داخلياً بأول محل للتسعير
          فقط.
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1.5 text-base sm:text-lg">
          <span className={`${ad.label} text-base sm:text-lg`}>نوع الطلب</span>
          <input
            name="orderType"
            required
            autoFocus
            className={`${ad.input} min-h-[52px] text-lg sm:text-xl`}
            placeholder="مثال: مستلزمات / مستندات / طلب خاص"
            value={orderType}
            onChange={(e) => setOrderType(e.target.value)}
          />
        </label>
        <label className="flex flex-col gap-1.5 text-base sm:text-lg">
          <span className={`${ad.label} text-base sm:text-lg`}>سعر الطلب</span>
          <input
            name="orderSubtotal"
            required
            className={`${ad.input} min-h-[52px] text-lg font-semibold tabular-nums sm:text-xl`}
            placeholder="مثال: 10 أو 10.5"
            inputMode="decimal"
            value={orderSubtotal}
            onChange={(e) => setOrderSubtotal(e.target.value)}
          />
        </label>
      </div>

      <label className="flex flex-col gap-1 text-sm">
        <span className={ad.label}>وقت الطلب (إجباري)</span>
        <input
          name="orderNoteTime"
          required
          className={ad.input}
          placeholder="مثال: الساعة 8 مساءً"
          value={orderNoteTime}
          onChange={(e) => setOrderNoteTime(e.target.value)}
        />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        <span className={ad.label}>ملاحظات / تفاصيل</span>
        <textarea
          name="summary"
          rows={3}
          className={ad.input}
          value={summary}
          onChange={(e) => setSummary(e.target.value)}
        />
      </label>

      <section className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/40 p-4">
        <div>
          <h2 className={ad.h2}>
            {submissionMode === "two_faces"
              ? "المرسل (الوجهة الأولى)"
              : "الزبون (الوجهة)"}
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            أدخل الرقم والمنطقة — يُبحث عن بيانات محفوظة لنفس الرقم والمنطقة (لجلب لوكيشن الزبون).
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>
              {submissionMode === "two_faces" ? "رقم المرسل" : "رقم الزبون"}
            </span>
            <input
              name="firstCustomerPhone"
              className={ad.input}
              value={firstPhone}
              onChange={(e) => setFirstPhone(e.target.value)}
              inputMode="numeric"
              autoComplete="tel"
              placeholder="اكتب أو الصق الرقم"
              required
            />
          </label>
          <RegionSearchPicker
            fieldName="firstCustomerRegionId"
            label={submissionMode === "two_faces" ? "منطقة المرسل" : "منطقة الزبون"}
            required
            value={firstRegionId}
            onValueChange={setFirstRegionId}
            regionsLookup={regions}
          />
        </div>

        {firstPhoneNormalized && !firstRegionId.trim() ? (
          <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-semibold text-amber-950">
            اختر المنطقة لعرض ما إذا وُجدت بيانات محفوظة لهذا الرقم.
          </p>
        ) : null}

        {firstPrefill ? (
          <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
            <p className="font-bold">هذا الرقم لديه بيانات محفوظة لهذا الرقم والمنطقة.</p>
            <button
              type="button"
              className="mt-2 rounded-lg border border-emerald-400 bg-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-100"
              onClick={() => {
                setFirstRegionId(firstPrefill.customerRegionId ?? "");
                setFirstLocationUrl(firstPrefill.customerLocationUrl ?? "");
                setFirstLandmark(firstPrefill.customerLandmark ?? "");
                setFirstSavedDoorPhotoUrl(doorPhotoUrlForDisplay(firstPrefill.customerDoorPhotoUrl));
              }}
            >
              نعم، استخدم التفاصيل المحفوظة
            </button>
          </div>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>
              {submissionMode === "two_faces" ? "لوكيشن المرسل" : "لوكيشن الزبون"}
            </span>
            <input
              name="firstCustomerLocationUrl"
              className={ad.input}
              value={firstLocationUrl}
              onChange={(e) => setFirstLocationUrl(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>
              {submissionMode === "two_faces" ? "أقرب نقطة دالة (مرسل)" : "أقرب نقطة دالة"}
            </span>
            <input
              name="firstCustomerLandmark"
              className={ad.input}
              value={firstLandmark}
              onChange={(e) => setFirstLandmark(e.target.value)}
            />
          </label>
        </div>
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>
            {submissionMode === "two_faces" ? "صورة باب المرسل" : "صورة باب الزبون"}
          </span>
          <input
            name="firstCustomerDoorPhoto"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className={ad.input}
            onChange={(e) => {
              if (e.target.files?.[0]) setFirstSavedDoorPhotoUrl(null);
            }}
          />
        </label>
        {firstSavedDoorPhotoUrl ? (
          <div className="rounded-lg border border-emerald-200 bg-white p-2 text-sm shadow-sm">
            <p className="text-xs font-medium text-slate-700">
              صورة الباب المحفوظة — تُرفق مع الطلب إن لم تختر صورة جديدة أعلاه.
            </p>
            <img
              src={firstSavedDoorPhotoUrl}
              alt=""
              className="mt-2 max-h-44 w-full max-w-xs rounded-md border border-slate-200 object-contain"
            />
          </div>
        ) : null}
      </section>

      {submissionMode === "two_faces" ? (
        <section className="space-y-3 rounded-2xl border border-violet-200 bg-violet-50/40 p-4">
          <div>
            <h2 className={ad.h2}>المستلم (الوجهة الثانية)</h2>
            <p className="mt-1 text-xs text-slate-600">
              أدخل رقم المستلم ثم المنطقة — يُبحث عن بيانات محفوظة لنفس الرقم والمنطقة.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className={ad.label}>رقم المستلم</span>
              <input
                name="secondCustomerPhone"
                className={ad.input}
                value={secondPhone}
                onChange={(e) => setSecondPhone(e.target.value)}
                inputMode="numeric"
                autoComplete="tel"
                placeholder="اكتب أو الصق الرقم"
                required
              />
            </label>
            <RegionSearchPicker
              fieldName="secondCustomerRegionId"
              label="منطقة المستلم"
              required
              value={secondRegionId}
              onValueChange={setSecondRegionId}
              regionsLookup={regions}
            />
          </div>

          {secondPhoneNormalized && !secondRegionId.trim() ? (
            <p className="rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs font-semibold text-amber-950">
              اختر المنطقة لعرض التفاصيل المحفوظة (إن وُجدت) لهذا الرقم والمنطقة.
            </p>
          ) : null}

          {secondPrefill ? (
            <div className="rounded-xl border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-900">
              <p className="font-bold">هذا الرقم لديه بيانات محفوظة لهذا الرقم والمنطقة.</p>
              <button
                type="button"
                className="mt-2 rounded-lg border border-emerald-400 bg-white px-3 py-1.5 text-xs font-bold hover:bg-emerald-100"
                onClick={() => {
                  setSecondRegionId(secondPrefill.customerRegionId ?? "");
                  setSecondLocationUrl(secondPrefill.customerLocationUrl ?? "");
                  setSecondLandmark(secondPrefill.customerLandmark ?? "");
                  setSecondSavedDoorPhotoUrl(doorPhotoUrlForDisplay(secondPrefill.customerDoorPhotoUrl));
                }}
              >
                نعم، استخدم التفاصيل المحفوظة
              </button>
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className={ad.label}>لوكيشن المستلم</span>
              <input
                name="secondCustomerLocationUrl"
                className={ad.input}
                value={secondLocationUrl}
                onChange={(e) => setSecondLocationUrl(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className={ad.label}>أقرب نقطة دالة (مستلم)</span>
              <input
                name="secondCustomerLandmark"
                className={ad.input}
                value={secondLandmark}
                onChange={(e) => setSecondLandmark(e.target.value)}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1 text-sm">
            <span className={ad.label}>صورة باب المستلم</span>
            <input
              name="secondCustomerDoorPhoto"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className={ad.input}
              onChange={(e) => {
                if (e.target.files?.[0]) setSecondSavedDoorPhotoUrl(null);
              }}
            />
          </label>
          {secondSavedDoorPhotoUrl ? (
            <div className="rounded-lg border border-emerald-200 bg-white p-2 text-sm shadow-sm">
              <p className="text-xs font-medium text-slate-700">
                صورة الباب المحفوظة — تُرفق مع الطلب إن لم تختر صورة جديدة أعلاه.
              </p>
              <img
                src={secondSavedDoorPhotoUrl}
                alt=""
                className="mt-2 max-h-44 w-full max-w-xs rounded-md border border-slate-200 object-contain"
              />
            </div>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm">
          <span className={ad.label}>صورة الطلب</span>
          <input
            name="orderImage"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            capture="environment"
            className={ad.input}
          />
        </label>
        <ClientVoiceNoteField title="ملاحظة صوتية (تسجيل مباشر)" wrapperClassName="" />
      </div>

      {state.error ? <p className={ad.error}>{state.error}</p> : null}
      {state.ok ? <p className={ad.success}>تم إنشاء الطلب من الإدارة بنجاح.</p> : null}

      <button type="submit" className={ad.btnPrimary} disabled={!canSubmit}>
        {pending ? "جارٍ الإنشاء..." : "إنشاء الطلب"}
      </button>
    </form>
  );
}
