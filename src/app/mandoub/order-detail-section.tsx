import { Suspense } from "react";
import { ImageUploaderCaption } from "@/components/image-uploader-caption";
import { VoiceNoteAudio } from "@/components/voice-note-audio";
import { formatDinarAsAlf, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import {
  orderStatusBadgeClass,
  orderStatusDetailSurfaceClass,
  orderStatusStartStripeClass,
} from "@/lib/order-status-style";
import type { MandoubOrderDetailPayload } from "@/lib/mandoub-order-queries";
// أزرار التواصل تظهر عائمة عبر `MandoubFloatingBar`، لذلك لا نعرض روابط واتساب/اتصال داخل الأقسام.
import { MandoubCustomerEditForm } from "./mandoub-customer-edit-form";
import { MandoubDoorPhotoForm } from "./mandoub-door-photo-form";
import { MandoubOrderDetailActions } from "./mandoub-order-detail-actions";
import { MandoubFloatingBar } from "./mandoub-floating-bar";
import { MandoubLocFlashBanner } from "./mandoub-loc-flash-banner";
import { MandoubUploadLocationInline } from "./mandoub-upload-location-inline";
import { MandoubOrderMoneyFlow } from "./mandoub-order-money-flow";
import { MandoubOrderImageQuick } from "./mandoub-order-image-quick";
import { MandoubQuickDoorCapture } from "./mandoub-quick-door";
import { MandoubQuickDoorSecondCapture } from "./mandoub-quick-door-second";
import { NotesCopyButton } from "@/components/notes-copy-button";
import { OrderTypeDetailBlock } from "@/components/order-type-line";

const STATUS_AR: Record<string, string> = {
  assigned: "بانتظار المندوب",
  delivering: "عند المندوب (تم الاستلام)",
  delivered: "تم التسليم",
};

function imgSrc(url: string): string | null {
  return resolvePublicAssetSrc(url);
}

function contactLine(phone: string): string {
  const t = phone.trim();
  return t || "—";
}

/** أزرار فتح اللوكيشن — مدمجة لتوفير عرض للصور */
const locBtnEmerald =
  "inline-flex min-h-[34px] max-w-full items-center justify-center rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 sm:px-3 sm:text-[13px]";
const locBtnSecond =
  "inline-flex min-h-[34px] max-w-full items-center justify-center rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 sm:px-3 sm:text-[13px]";

/** عمود نصوص + صور — عمودان من الهاتف: النص يميناً والصورة يساراً (RTL) */
const gridInfoPhoto =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,12rem)] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.32fr)] sm:gap-6";

/** إطار عرض الصور بنسبة 1:1 */
const squarePhotoFrame =
  "aspect-square w-full overflow-hidden rounded-xl border border-sky-200 bg-slate-50";
const squarePhotoCover = "h-full w-full object-cover";
const squarePhotoContain = "h-full w-full object-contain";

/** مرجع (رقم + منطقة) — يُعرض إذا كان الطلب الحالي لا يزال فارغاً */
type PhoneProfileFallback = {
  locationUrl: string;
  landmark: string;
  photoUrl: string;
  alternatePhone: string | null;
} | null;

export function OrderDetailSection({
  order,
  closeHref,
  auth,
  nextUrl,
  viewerCourierId,
  phoneProfile,
  secondPhoneProfile,
}: {
  order: MandoubOrderDetailPayload;
  closeHref: string;
  auth: { c: string; exp: string; s: string };
  nextUrl: string;
  viewerCourierId?: string;
  phoneProfile?: PhoneProfileFallback;
  secondPhoneProfile?: PhoneProfileFallback;
}) {
  // صورة المحل تُدار مركزياً على `Shop.photoUrl` حتى تتحدث في جميع الطلبات (قديم/جديد).
  // نحتفظ بـ `order.shopDoorPhotoUrl` كبيانات تاريخية فقط.
  const shopImageUrl =
    order.shop.photoUrl?.trim() || order.shopDoorPhotoUrl?.trim() || "";

  // تحديد اسم ورقم الموظف المسؤول عن الطلب
  // إذا كان الطلب من مجهز شركة، نأخذ بيانات المجهز
  // وإذا كان من الإدارة ولا يوجد مجهز، نضع بيانات الإدارة (أبو الأكبر)
  const isCompanyPreparer = order.submissionSource === "company_preparer";
  const isAdminPortal = order.submissionSource === "admin_portal";

  const submitterName = order.submittedByCompanyPreparer?.name?.trim()
    || order.submittedBy?.name?.trim()
    || (isAdminPortal ? "الإدارة (أبو الأكبر)" : "—");

  const shopContactPhone = order.submittedByCompanyPreparer?.phone?.trim()
    || order.submittedBy?.phone?.trim()
    || (isAdminPortal ? "07733921568" : order.shop.phone?.trim() || "");

  const customerDoorDisplay =
    order.customerDoorPhotoUrl?.trim() ||
    phoneProfile?.photoUrl?.trim() ||
    "";

  const customerDoorCaptionName =
    customerDoorDisplay && order.customerDoorPhotoUploadedByName?.trim()
      ? order.customerDoorPhotoUploadedByName
      : null;

  const mergedCustomerLocationUrl =
    order.customerLocationUrl?.trim() ||
    phoneProfile?.locationUrl?.trim() ||
    "";

  const mergedLandmark =
    order.customerLandmark?.trim() ||
    phoneProfile?.landmark?.trim() ||
    "";

  const mergedAlternate =
    order.alternatePhone?.trim() ||
    phoneProfile?.alternatePhone?.trim() ||
    "";

  const missingCustomerLocation = !hasCustomerLocationUrl(
    mergedCustomerLocationUrl,
    undefined,
  );
  const hasCustomerLocation = !missingCustomerLocation;

  const secondLocMerged =
    order.secondCustomerLocationUrl?.trim() ||
    secondPhoneProfile?.locationUrl?.trim() ||
    "";
  const secondDoorMerged =
    order.secondCustomerDoorPhotoUrl?.trim() ||
    secondPhoneProfile?.photoUrl?.trim() ||
    "";
  const secondLandmarkMerged =
    order.secondCustomerLandmark?.trim() ||
    secondPhoneProfile?.landmark?.trim() ||
    "";

  const reversePickup = isReversePickupOrderType(order.orderType);

  return (
    <section
      className={`kse-glass-dark relative mt-4 border p-4 pb-32 text-base leading-relaxed sm:p-5 sm:pb-36 ${orderStatusStartStripeClass(order.status)} ${
        order.prepaidAll
          ? "border-emerald-300/85 bg-gradient-to-b from-emerald-50/70 via-white/90 to-teal-50/40 ring-2 ring-emerald-200/55 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]"
          : reversePickup
            ? "border-violet-300/85 bg-gradient-to-b from-violet-50/75 via-white/90 to-fuchsia-50/45 ring-2 ring-violet-200/55 shadow-[0_0_0_1px_rgba(139,92,246,0.08)]"
          : missingCustomerLocation
            ? "border-sky-200 bg-rose-50/30 ring-2 ring-rose-200"
            : `border-sky-200 ${orderStatusDetailSurfaceClass(order.status)}`
      }`}
    >
      {reversePickup ? (
        <div className="mb-4 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-950">
          تنبيه طلب عكسي استلام من الزبون وتسليم للعميل
        </div>
      ) : null}
      {order.prepaidAll ? (
        <div
          className="relative mb-4 overflow-hidden rounded-2xl border-2 border-emerald-400/55 bg-gradient-to-br from-emerald-100/90 via-teal-50/85 to-cyan-50/75 shadow-[0_12px_40px_-18px_rgba(5,150,105,0.42)]"
          role="status"
          aria-label="طلب مدفوع بالكامل — لا تحصيل نقدي عند التسليم"
        >
          <div className="pointer-events-none absolute -start-12 -top-16 h-40 w-40 rounded-full bg-emerald-300/35 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-10 -end-10 h-36 w-36 rounded-full bg-cyan-300/30 blur-3xl" />
          <div className="pointer-events-none absolute start-1/2 top-0 h-px w-[120%] -translate-x-1/2 bg-gradient-to-r from-transparent via-white/60 to-transparent" />

          <div className="relative flex flex-col items-center gap-4 p-4 sm:flex-row sm:items-start sm:gap-5 sm:p-5 sm:pe-6">
            <div className="flex size-[4.25rem] shrink-0 items-center justify-center rounded-2xl border-2 border-emerald-600/25 bg-white/95 shadow-[inset_0_2px_12px_rgba(16,185,129,0.12),0_4px_14px_-4px_rgba(5,150,105,0.25)] sm:size-[4.5rem]">
              <svg
                className="size-10 text-emerald-600 sm:size-11"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
                />
              </svg>
            </div>
            <div className="min-w-0 flex-1 space-y-2.5 text-center sm:text-right">
              <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-800/65 sm:text-[11px]">
                تسوية مالية كاملة
              </p>
              <p className="text-lg font-black leading-snug text-emerald-950 sm:text-2xl">
                لا تحصيل نقدي — ركّز على التوصيل
              </p>
              <p className="text-sm leading-relaxed text-emerald-900/90 sm:text-[15px]">
                المبلغ مغطّى <strong className="font-bold text-emerald-950">قبل وصولك</strong> (سلفاً أو
                إلكترونياً) <strong className="font-bold text-emerald-950">بما فيه أجرة التوصيل</strong>.
                لا تطلب من الزبون دفع الطلبية عند الباب.
              </p>
              <div className="flex flex-wrap justify-center gap-2 pt-1 sm:justify-end">
                <span className="inline-flex items-center gap-1 rounded-full border border-emerald-700/25 bg-white/90 px-3 py-1 text-[11px] font-bold text-emerald-950 shadow-sm backdrop-blur-[2px]">
                  <span className="text-emerald-600" aria-hidden>
                    ✓
                  </span>
                  كل المبالغ واصلة
                </span>
                <span className="inline-flex items-center rounded-full border border-teal-600/30 bg-teal-50/90 px-3 py-1 text-[11px] font-bold text-teal-950">
                  بدون كاش من الزبون
                </span>
                <span className="inline-flex items-center rounded-full border border-sky-500/35 bg-sky-100/80 px-3 py-1 text-[11px] font-bold text-sky-950">
                  التوصيل مشمول بالتسوية
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : null}
      <Suspense fallback={null}>
        <MandoubLocFlashBanner />
      </Suspense>
      <MandoubFloatingBar
        orderId={order.id}
        shopPhone={shopContactPhone}
        customerPhone={order.customerPhone}
        customerAlternatePhone={
          order.secondCustomerPhone?.trim() || mergedAlternate || ""
        }
        preparerPhone={order.submittedByCompanyPreparer?.phone ?? ""}
        orderStatus={order.status}
        orderNumber={order.orderNumber}
        shopName={order.shop.name}
        city={order.customerRegion?.name ?? ""}
        totalPrice={order.totalAmount != null ? formatDinarAsAlf(order.totalAmount) : ""}
        deliveryName={order.courier?.name ?? ""}
        customerLocationUrl={mergedCustomerLocationUrl}
        customerLandmark={mergedLandmark}
        hasCustomerLocation={hasCustomerLocation}
        hasCourierUploadedLocation={Boolean(order.customerLocationSetByCourierAt)}
      />

      {/* عمود الحالة على اليسار (نهاية السطر في RTL) — شبكة بدل flex حتى تثبت المحاذاة */}
      <div className="grid grid-cols-1 gap-3 border-b border-sky-100 pb-3 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-2">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
            تفاصيل الطلبية — رقم الطلب{" "}
            <span className="tabular-nums text-sky-800">#{order.orderNumber}</span>
          </h2>
        </div>
        <div className="flex flex-shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-self-start">
          <MandoubOrderDetailActions closeHref={closeHref} />
          <span
            className={`rounded-full px-3 py-1.5 text-xs font-bold ${orderStatusBadgeClass(order.status)}`}
          >
            {STATUS_AR[order.status] ?? order.status}
          </span>
        </div>
      </div>

      {(() => {
        const vRaw = order.voiceNoteUrl?.trim();
        const vSrc = vRaw ? resolvePublicAssetSrc(vRaw) : null;
        const aRaw = order.adminVoiceNoteUrl?.trim();
        const aSrc = aRaw ? resolvePublicAssetSrc(aRaw) : null;
        if (!vSrc && !aSrc) return null;
        return (
          <div className="mt-4 space-y-3 rounded-xl border border-sky-200 bg-sky-50/70 p-3 sm:p-4">
            {vSrc ? (
              <div>
                <p className="text-xs font-semibold text-violet-900">بصمة العميل</p>
                <VoiceNoteAudio
                  src={vSrc}
                  streamKey={`${order.id}-client-voice`}
                  className="mt-2 w-full rounded-lg border border-violet-200 bg-violet-50/60 p-2"
                />
              </div>
            ) : null}
            {aSrc ? (
              <div>
                <p className="text-xs font-semibold text-amber-950">بصمة الإدارة</p>
                <VoiceNoteAudio
                  src={aSrc}
                  streamKey={`${order.id}-admin-voice`}
                  className="mt-2 w-full rounded-lg border border-amber-200 bg-amber-50/70 p-2"
                />
              </div>
            ) : null}
          </div>
        );
      })()}

      <MandoubCustomerEditForm
        orderId={order.id}
        defaultOrderStatus={order.status}
        defaultCustomerPhone={order.customerPhone}
        defaultCustomerLocationUrl={mergedCustomerLocationUrl}
        defaultCustomerLandmark={mergedLandmark}
        defaultAlternatePhone={mergedAlternate}
        auth={auth}
        nextUrl={nextUrl}
      />

      <div className="mt-3 space-y-5 sm:mt-4 sm:space-y-6">
        {/* المحل (المعلومات + صورة بجانبها) */}
        <div className={gridInfoPhoto}>
          <div className="min-w-0 space-y-2 text-base sm:space-y-3 sm:text-lg">
            <h3 className="text-lg font-bold text-emerald-800 sm:text-xl">المحل</h3>
            <p className="font-bold leading-snug text-slate-900">{order.shop.name}</p>
            <p className="text-sm font-medium leading-snug text-slate-800 sm:text-base">
              <span className="text-slate-500">موظف المحل: </span>
              <span className="font-bold text-sky-900">{submitterName}</span>
            </p>
            <p className="text-slate-800">{order.shop.region.name}</p>
            <p className="font-mono tabular-nums text-slate-900">{contactLine(shopContactPhone)}</p>
            <div className="mt-2">
              {order.shop.locationUrl?.trim() ? (
                <a
                  href={order.shop.locationUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={locBtnEmerald}
                >
                  فتح لوكيشن المحل ↗
                </a>
              ) : (
                <p className="text-xs font-bold text-amber-800 sm:text-sm">لا يوجد لوكيشن للمحل</p>
              )}
            </div>
            {/* أزرار التواصل تمت إزالتها من داخل الصفحة لأنها تظهر عائمة عبر `MandoubFloatingBar`. */}
          </div>

          <div className="min-w-0 w-full max-w-[12rem] shrink-0 self-start justify-self-stretch sm:max-w-none">
            <p className="mb-1.5 text-sm font-bold text-slate-700 sm:mb-2 sm:text-lg">صورة المحل</p>
            {shopImageUrl && imgSrc(shopImageUrl) ? (
              <div>
                <div className={squarePhotoFrame}>
                  <img src={imgSrc(shopImageUrl)!} alt="" className={squarePhotoCover} />
                </div>
                {order.shopDoorPhotoUploadedByName?.trim() ? (
                  <ImageUploaderCaption name={order.shopDoorPhotoUploadedByName} />
                ) : null}
              </div>
            ) : (
              <p className="text-base text-slate-400">لا توجد صورة محل بعد</p>
            )}

            {/* أزرار كاميرا/معرض الخاصة بباب المحل تحت صورة المحل مباشرة */}
            <div className="mt-3">
              <MandoubDoorPhotoForm
                orderId={order.id}
                nextUrl={nextUrl}
                c={auth.c}
                exp={auth.exp}
                s={auth.s}
              />
            </div>
          </div>
        </div>

        {/* الزبون (المعلومات + صورة باب الزبون بجانبها) */}
        <div className={gridInfoPhoto}>
          <div className="min-w-0 space-y-2 text-base sm:space-y-3 sm:text-lg">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-lg font-bold text-emerald-800 sm:text-xl">الزبون</h3>
            </div>
            <p className="text-slate-800">{order.customerRegion?.name ?? "—"}</p>
            <p className="font-mono tabular-nums text-slate-900">
              {contactLine(order.customerPhone)}
            </p>
            {mergedAlternate ? (
              <p className="font-mono tabular-nums text-slate-900">{mergedAlternate}</p>
            ) : null}
            {mergedLandmark ? (
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-800">
                أقرب نقطة دالة: {mergedLandmark}
              </p>
            ) : null}
            {/* أزرار التواصل تمت إزالتها من داخل الصفحة لأنها تظهر عائمة عبر `MandoubFloatingBar`. */}

            <div className="mt-2 space-y-2">
              {mergedCustomerLocationUrl ? (
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <a
                      href={mergedCustomerLocationUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={locBtnEmerald}
                    >
                      فتح لوكيشن الزبون ↗
                    </a>
                    {order.customerLocationSetByCourierAt ? (
                      <span className="inline-flex max-w-full items-center rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-bold text-emerald-950">
                        لوكيشن مرفوع من المندوب (GPS)
                      </span>
                    ) : null}
                  </div>
                  <ImageUploaderCaption name={order.customerLocationUploadedByName} />
                </div>
              ) : null}
              {!mergedCustomerLocationUrl ? (
                <MandoubUploadLocationInline orderId={order.id} auth={auth} nextUrl={nextUrl} />
              ) : null}
            </div>
          </div>

          <div className="min-w-0 self-start">
            <p className="mb-2 text-base font-bold text-slate-700 sm:text-lg">صورة باب الزبون</p>
            {customerDoorDisplay && imgSrc(customerDoorDisplay) ? (
              <div>
                <div className={squarePhotoFrame}>
                  <img src={imgSrc(customerDoorDisplay)!} alt="" className={squarePhotoCover} />
                </div>
                <ImageUploaderCaption name={customerDoorCaptionName} />
              </div>
            ) : (
              <p className="text-base text-slate-400">لم تُرفع بعد</p>
            )}
            <div className="mt-3">
              <MandoubQuickDoorCapture orderId={order.id} nextUrl={nextUrl} auth={auth} />
            </div>
          </div>
        </div>

        {order.routeMode === "double" ? (
          <div className={gridInfoPhoto}>
            <div className="min-w-0 space-y-2 text-base sm:space-y-3 sm:text-lg">
              <h3 className="text-lg font-bold text-violet-800 sm:text-xl">الوجهة الثانية</h3>
              <p className="text-slate-800">{order.secondCustomerRegion?.name ?? "—"}</p>
              <p className="font-mono tabular-nums text-slate-900">
                {contactLine(order.secondCustomerPhone ?? "")}
              </p>
              {secondLandmarkMerged ? (
                <p className="mt-2 text-sm font-medium leading-relaxed text-slate-800">
                  أقرب نقطة دالة: {secondLandmarkMerged}
                </p>
              ) : null}
              <div className="mt-2">
                {secondLocMerged ? (
                  <a
                    href={secondLocMerged}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={locBtnSecond}
                  >
                    فتح لوكيشن الوجهة 2 ↗
                  </a>
                ) : (
                  <p className="text-xs font-bold text-amber-800 sm:text-sm">
                    لا يوجد لوكيشن للوجهة 2
                  </p>
                )}
              </div>
            </div>
            <div className="min-w-0 self-start">
              <p className="mb-2 text-base font-bold text-slate-700 sm:text-lg">صورة باب الوجهة 2</p>
              {secondDoorMerged && imgSrc(secondDoorMerged) ? (
                <div>
                  <div className={squarePhotoFrame}>
                    <img
                      src={imgSrc(secondDoorMerged)!}
                      alt=""
                      className={squarePhotoCover}
                    />
                  </div>
                  <ImageUploaderCaption name={order.secondCustomerDoorPhotoUploadedByName} />
                </div>
              ) : (
                <p className="text-base text-slate-400">لم تُرفع بعد</p>
              )}
              <div className="mt-3">
                <MandoubQuickDoorSecondCapture orderId={order.id} nextUrl={nextUrl} auth={auth} />
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* معلومات الطلب بجانب صورة الطلبية — نفس شبكة المحل وباب الزبون */}
      <div className={`${gridInfoPhoto} mt-6`}>
        <div className="min-w-0 space-y-4 rounded-xl border border-sky-100 bg-sky-50/50 p-4 sm:space-y-5 sm:p-5">
          <div>
            <p className="text-sm font-bold text-slate-700 sm:text-base">نوع</p>
            <p className="mt-1 text-xl font-black leading-snug text-slate-900 sm:text-2xl">
              <OrderTypeDetailBlock
                orderType={order.orderType}
                prefixClassName="font-black text-violet-950 bg-violet-100 px-2 py-1 rounded-lg text-xl sm:text-2xl ring-2 ring-violet-400/80 shadow-sm"
                restClassName="text-xl font-black leading-snug sm:text-2xl text-slate-900"
              />
            </p>
          </div>

          <div>
            <p className="mt-1 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
              {order.orderSubtotal != null ? `سعر${formatDinarAsAlf(order.orderSubtotal)}ألف` : "سعر—"}
            </p>
          </div>

          <div>
            <p className="mt-1 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
              {order.deliveryPrice != null ? `التوصيل${formatDinarAsAlf(order.deliveryPrice)}ألف` : "التوصيل—"}
            </p>
          </div>

          <div className="rounded-lg border border-violet-500/55 bg-violet-500/35 px-3 py-3 sm:px-5 sm:py-4 flex flex-col justify-center shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]">
            <p className="text-base font-bold text-violet-950 sm:text-lg">الكلي</p>
            <p className="mt-1 font-mono text-3xl font-black tabular-nums text-violet-950 sm:text-4xl">
              {order.totalAmount != null ? formatDinarAsAlfWithUnit(order.totalAmount) : "—"}
            </p>
          </div>
        </div>

        <div className="min-w-0 w-full max-w-[12rem] shrink-0 self-start justify-self-stretch sm:max-w-none">
          <p className="mb-1.5 text-sm font-bold text-slate-700 sm:mb-2 sm:text-lg">صورة الطلبية</p>
          {order.imageUrl?.trim() && imgSrc(order.imageUrl) ? (
            <div>
              <div className={squarePhotoFrame}>
                <img src={imgSrc(order.imageUrl)!} alt="" className={squarePhotoContain} />
              </div>
              <ImageUploaderCaption name={order.orderImageUploadedByName} />
            </div>
          ) : (
            <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50/90 px-2 text-center text-sm font-medium text-slate-500">
              لا توجد صورة طلبية بعد
            </div>
          )}
          <div className="mt-3">
            <MandoubOrderImageQuick orderId={order.id} nextUrl={nextUrl} auth={auth} />
          </div>
        </div>
      </div>

      {/* الملاحظات — نفس أسلوب عرض الإدارة (`order-view-content`)؛ عند غياب اللوكيشن نبرز الصندوق كما في لوحة الإدارة */}
      <div className="mt-6 space-y-3 border-t border-sky-100 pt-5 text-base sm:text-lg">
        <div>
          <p className="text-xs font-semibold text-slate-500">الملاحظات</p>
          <div
            className={`relative mt-1 whitespace-pre-wrap break-words rounded-lg border p-3 pe-16 text-base leading-relaxed ${
              order.summary?.trim()
                ? "border-rose-400 bg-rose-50 font-medium text-rose-950 ring-1 ring-rose-200"
                : missingCustomerLocation
                  ? "border-rose-300/90 bg-rose-50/80 text-slate-900 ring-1 ring-rose-200/70"
                  : "border-transparent text-slate-800"
            }`}
          >
            <div className="absolute end-2 top-2">
              <NotesCopyButton
                text={order.summary ?? ""}
                className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-[11px] font-black text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              />
            </div>
            {order.summary?.trim() ? order.summary : "—"}
          </div>
        </div>
        <p className="text-sm text-slate-600">
          تاريخ انشاء الطلب:{" "}
          <span className="font-semibold">
            {order.createdAt.toLocaleString("ar-IQ-u-nu-latn", {
              dateStyle: "medium",
              timeStyle: "short",
            })}
          </span>
        </p>
      </div>

      <MandoubOrderMoneyFlow
        orderId={order.id}
        orderNumber={order.orderNumber}
        courierName={order.courier?.name?.trim() || "—"}
        orderStatus={order.status}
        missingCustomerLocation={missingCustomerLocation}
        canRecordMoney={order.assignedCourierId === viewerCourierId}
        orderSubtotalDinar={
          order.orderSubtotal != null ? Number(order.orderSubtotal) : null
        }
        totalAmountDinar={order.totalAmount != null ? Number(order.totalAmount) : null}
        moneyEvents={order.moneyEvents.map((e) => ({
          id: e.id,
          kind: e.kind,
          amountDinar: Number(e.amountDinar),
          expectedDinar: e.expectedDinar != null ? Number(e.expectedDinar) : null,
          matchesExpected: e.matchesExpected,
          mismatchReason: e.mismatchReason,
          mismatchNote: e.mismatchNote,
          recordedAt: e.createdAt,
          deletedAt: e.deletedAt,
          deletedReason: (e.deletedReason ?? null) as
            | "manual_admin"
            | "manual_courier"
            | "manual_preparer"
            | "status_revert"
            | null,
          deletedByDisplayName: e.deletedByDisplayName,
          performedByDisplayName:
            e.recordedByCompanyPreparer?.name?.trim() || e.courier?.name?.trim() || "—",
          recordedByCompanyPreparerId: e.recordedByCompanyPreparerId ?? null,
        }))}
        auth={auth}
        nextUrl={nextUrl}
      />
    </section>
  );
}
