import Link from "next/link";
import type { MandoubOrderDetailPayload } from "@/lib/mandoub-order-queries";
import { preparerPath } from "@/lib/preparer-portal-nav";
import { dinarDecimalToAlfInputString, formatDinarAsAlf } from "@/lib/money-alf";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import {
  orderStatusBadgeClass,
  orderStatusDetailSurfaceClass,
  orderStatusStartStripeClass,
} from "@/lib/order-status-style";
import { MandoubFloatingBar } from "@/app/mandoub/mandoub-floating-bar";
import { MandoubOrderDetailActions } from "@/app/mandoub/mandoub-order-detail-actions";
import { PreparerOrderEditPanel } from "./preparer-order-edit-panel";
import { ImageUploaderCaption } from "@/components/image-uploader-caption";
import { VoiceNoteAudio } from "@/components/voice-note-audio";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { PreparerOrderMoneyFlow } from "./preparer-order-money-flow";
import { NotesCopyButton } from "@/components/notes-copy-button";
import { OrderTypeDetailBlock } from "@/components/order-type-line";

const STATUS_AR: Record<string, string> = {
  pending: "جديد",
  assigned: "بانتظار المندوب",
  delivering: "عند المندوب (تم الاستلام)",
  delivered: "تم التسليم",
  cancelled: "ملغي",
  archived: "مؤرشف",
};

function imgSrc(url: string): string | null {
  return resolvePublicAssetSrc(url);
}

function contactLine(phone: string): string {
  const t = phone.trim();
  return t || "—";
}

const locBtnEmerald =
  "inline-flex min-h-[34px] max-w-full items-center justify-center rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 sm:px-3 sm:text-[13px]";
const locBtnSecond =
  "inline-flex min-h-[34px] max-w-full items-center justify-center rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-violet-700 sm:px-3 sm:text-[13px]";

const gridInfoPhoto =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,12rem)] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.32fr)] sm:gap-6";

const squarePhotoFrame =
  "aspect-square w-full overflow-hidden rounded-xl border border-sky-200 bg-slate-50";
const squarePhotoCover = "h-full w-full object-cover";
const squarePhotoContain = "h-full w-full object-contain";

type PhoneProfileFallback = {
  locationUrl: string;
  landmark: string;
  photoUrl: string;
  alternatePhone: string | null;
} | null;

export function PreparerOrderDetailSection({
  order,
  closeHref,
  auth,
  nextUrl,
  preparerId,
  phoneProfile,
  secondPhoneProfile,
}: {
  order: MandoubOrderDetailPayload;
  closeHref: string;
  auth: { p: string; exp: string; s: string };
  nextUrl: string;
  preparerId: string;
  phoneProfile?: PhoneProfileFallback;
  secondPhoneProfile?: PhoneProfileFallback;
}) {
  
  // صورة المحل تُدار مركزياً على `Shop.photoUrl` حتى تتحدث في جميع الطلبات (قديم/جديد).
  // نحتفظ بـ `order.shopDoorPhotoUrl` كبيانات تاريخية فقط.
  const shopImageUrl =
    order.shop.photoUrl?.trim() || order.shopDoorPhotoUrl?.trim() || "";

  const shopContactPhone = order.shop.phone?.trim() || order.submittedBy?.phone?.trim() || "";

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

  const missingCustomerLocation = !hasCustomerLocationUrl(mergedCustomerLocationUrl, undefined);
  const hasCustomerLocation = !missingCustomerLocation;
  const hasCourierUploadedLocation = Boolean(order.customerLocationSetByCourierAt);

  const routeMode = order.routeMode ?? "single";
  const secondLocMerged = order.secondCustomerLocationUrl?.trim() || secondPhoneProfile?.locationUrl?.trim() || "";
  const secondDoorMerged = order.secondCustomerDoorPhotoUrl?.trim() || secondPhoneProfile?.photoUrl?.trim() || "";
  const secondLandmarkMerged = order.secondCustomerLandmark?.trim() || secondPhoneProfile?.landmark?.trim() || "";

  const reversePickup = isReversePickupOrderType(order.orderType);

  return (
    <section
      className={`kse-glass-dark relative mt-4 border p-4 pb-32 text-base leading-relaxed sm:p-5 sm:pb-36 ${orderStatusStartStripeClass(
        order.status,
      )} ${
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
      <MandoubFloatingBar
        orderId={order.id}
        shopPhone={shopContactPhone}
        customerPhone={order.customerPhone}
        customerAlternatePhone={order.secondCustomerPhone?.trim() || mergedAlternate || ""}
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
        hasCourierUploadedLocation={hasCourierUploadedLocation}
        hideWhenPreparerEditOpen
      />

      <div className="grid grid-cols-1 gap-3 border-b border-sky-100 pb-3 sm:grid-cols-[1fr_auto] sm:items-start sm:gap-2">
        <div className="min-w-0">
          <h2 className="text-xl font-black text-slate-900 sm:text-2xl">
            تفاصيل الطلبية — رقم الطلب{" "}
            <span className="tabular-nums text-sky-800">#{order.orderNumber}</span>
          </h2>
          <Link
            href={preparerPath(`/preparer/order/${order.id}/edit`, auth)}
            className="mt-2 inline-flex items-center rounded-lg border border-sky-300 bg-sky-50 px-2.5 py-1.5 text-xs font-bold text-sky-900 hover:bg-sky-100"
          >
            تعديل بيانات الطلب
          </Link>

        </div>

        <div className="flex flex-shrink-0 flex-wrap items-center justify-start gap-2 sm:justify-self-start">
          <MandoubOrderDetailActions closeHref={closeHref} />
          <span className={`rounded-full px-3 py-1.5 text-xs font-bold ${orderStatusBadgeClass(order.status)}`}>
            {STATUS_AR[order.status] ?? order.status}
          </span>
        </div>
      </div>

      {order.orderType.includes("تجهيز") && order.preparerShoppingJson != null && order.status !== "delivered" ? (
        <div className="mt-3 rounded-xl border border-violet-300 bg-violet-50/70 p-3 text-sm">
          <Link
            href={preparerPath(`/preparer/preparation/edit/${order.id}`, auth)}
            className="font-bold text-violet-900 underline decoration-violet-400"
          >
            صفحة تعديل تسعير طلبية التجهيز
          </Link>
          <p className="mt-1 text-xs text-slate-600">غير متاح بعد «تم التسليم».</p>
        </div>
      ) : null}

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

      <PreparerOrderEditPanel
        auth={auth}
        orderId={order.id}
        defaults={{
          orderType: order.orderType,
          customerPhone: order.customerPhone,
          orderSubtotalAlf: order.orderSubtotal != null ? dinarDecimalToAlfInputString(order.orderSubtotal) : "",
        }}
      />

      <div className="mt-3 space-y-5 sm:mt-4 sm:space-y-6">
        {/* المحل + صورة المحل */}
        <div className={gridInfoPhoto}>
          <div className="min-w-0 space-y-2 text-base sm:space-y-3 sm:text-lg">
            <h3 className="text-lg font-bold text-emerald-800 sm:text-xl">المحل</h3>
            <p className="font-bold leading-snug text-slate-900">{order.shop.name}</p>
            <p className="text-sm font-medium leading-snug text-slate-800">
              <span className="text-slate-500">موظف المحل: </span>
              {order.submittedBy?.name?.trim() || "—"}
            </p>
            <p className="text-slate-800">{order.shop.region.name}</p>
            <p className="font-mono tabular-nums text-slate-900">{shopContactPhone || "—"}</p>
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
          </div>
        </div>

        {/* الزبون */}
        <div className={gridInfoPhoto}>
          <div className="min-w-0 space-y-2 text-base sm:space-y-3 sm:text-lg">
            <h3 className="text-lg font-bold text-emerald-800 sm:text-xl">الزبون</h3>
            <p className="text-slate-800">{order.customerRegion?.name ?? "—"}</p>
            <p className="font-mono tabular-nums text-slate-900">{contactLine(order.customerPhone)}</p>
            {mergedAlternate ? <p className="mt-1 font-mono tabular-nums text-slate-900">{mergedAlternate}</p> : null}
            {mergedLandmark ? (
              <p className="mt-1 text-sm font-medium leading-relaxed text-slate-800">أقرب نقطة دالة: {mergedLandmark}</p>
            ) : null}

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
                <p className="text-xs font-bold text-amber-800">لا يوجد لوكيشن للزبون بعد</p>
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
          </div>
        </div>

        {/* الوجهة 2 (اختياري) */}
        {routeMode === "double" ? (
          <div className={gridInfoPhoto}>
            <div className="min-w-0 space-y-2 text-base sm:space-y-3 sm:text-lg">
              <h3 className="text-lg font-bold text-violet-800 sm:text-xl">الوجهة 2</h3>
              <p className="text-slate-800">{order.secondCustomerRegion?.name ?? "—"}</p>
              {order.secondCustomerPhone?.trim() ? (
                <p className="font-mono tabular-nums text-slate-900">{contactLine(order.secondCustomerPhone)}</p>
              ) : null}
              {secondLandmarkMerged ? (
                <p className="mt-1 text-sm font-medium leading-relaxed text-slate-800">أقرب نقطة دالة: {secondLandmarkMerged}</p>
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
                  <p className="text-xs font-bold text-amber-800 sm:text-sm">لا يوجد لوكيشن للوجهة 2</p>
                )}
              </div>
            </div>

            <div className="min-w-0 self-start">
              <p className="mb-2 text-base font-bold text-slate-700 sm:text-lg">صورة باب الوجهة 2</p>
              {secondDoorMerged && imgSrc(secondDoorMerged) ? (
                <div>
                  <div className={squarePhotoFrame}>
                    <img src={imgSrc(secondDoorMerged)!} alt="" className={squarePhotoCover} />
                  </div>
                  <ImageUploaderCaption name={order.secondCustomerDoorPhotoUploadedByName} />
                </div>
              ) : (
                <p className="text-base text-slate-400">لم تُرفع بعد</p>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {/* معلومات الطلب + صورة الطلبية */}
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
              {order.orderSubtotal != null
                ? `سعر${formatDinarAsAlf(order.orderSubtotal)}ألف`
                : "سعر—"}
            </p>
          </div>
          <div>
            <p className="mt-1 font-mono text-lg font-black tabular-nums text-slate-900 sm:text-xl">
              {order.deliveryPrice != null
                ? `التوصيل${formatDinarAsAlf(order.deliveryPrice)}ألف`
                : "التوصيل—"}
            </p>
          </div>
          <div className="rounded-lg border border-violet-500/55 bg-violet-500/35 px-3 py-3 sm:px-5 sm:py-4 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.25)]">
            <p className="text-sm font-bold text-violet-950 sm:text-base">الكلي</p>
            <p className="mt-1 font-mono text-2xl font-black tabular-nums text-violet-950 sm:text-3xl">
              {order.totalAmount != null ? formatDinarAsAlf(order.totalAmount) : "—"}
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
        </div>
      </div>

      {/* الملاحظات + تاريخ الإنشاء */}
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

      <PreparerOrderMoneyFlow
        orderId={order.id}
        orderNumber={order.orderNumber}
        courierName={order.courier?.name?.trim() || "—"}
        assignedCourierId={order.assignedCourierId}
        orderStatus={order.status}
        orderSubtotalDinar={order.orderSubtotal != null ? Number(order.orderSubtotal) : null}
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
          deletedReason: e.deletedReason,
          deletedByDisplayName: e.deletedByDisplayName,
          performedByDisplayName:
            e.recordedByCompanyPreparer?.name?.trim() || e.courier?.name?.trim() || "—",
          recordedByCompanyPreparerId: e.recordedByCompanyPreparerId ?? null,
        }))}
        auth={auth}
        nextUrl={nextUrl}
        preparerId={preparerId}
      />
    </section>
  );
}

