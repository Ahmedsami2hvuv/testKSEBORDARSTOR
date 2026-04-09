import { Suspense } from "react";
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
import { MandoubCustomerEditForm } from "./mandoub-customer-edit-form";
import { MandoubDoorPhotoForm } from "./mandoub-door-photo-form";
import { MandoubOrderDetailActions } from "./mandoub-order-detail-actions";
import { MandoubFloatingBar } from "./mandoub-floating-bar";
import { MandoubLocFlashBanner } from "./mandoub-loc-flash-banner";
import { MandoubUploadLocationInline } from "./mandoub-upload-location-inline";
import { MandoubOrderMoneyFlow } from "./mandoub-order-money-flow";
import { MandoubOrderImageQuick } from "./mandoub-order-image-quick";
import { MandoubQuickDoorCapture } from "./mandoub-quick-door";
import { NotesCopyButton } from "@/components/notes-copy-button";
import { OrderTypeDetailBlock } from "@/components/order-type-line";
import { telHref, whatsappMeUrl } from "@/lib/whatsapp";
import { IconPhone, IconWa } from "@/components/order-fab-dock";
import { UISectionConfig } from "@/lib/ui-settings";

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

const locBtnEmerald =
  "inline-flex min-h-[34px] max-w-full items-center justify-center rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 sm:px-3 sm:text-[13px]";
const contactBtnBase = "inline-flex items-center justify-center gap-1 rounded-md px-2 py-1 text-[11px] font-bold shadow-sm transition-colors sm:px-2.5 sm:py-1.5 sm:text-xs";
const callBtnClass = `${contactBtnBase} bg-sky-600 text-white hover:bg-sky-700`;
const waBtnClass = `${contactBtnBase} bg-emerald-600 text-white hover:bg-emerald-700`;

const gridInfoPhoto =
  "grid grid-cols-[minmax(0,1fr)_minmax(0,12rem)] items-start gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.32fr)] sm:gap-6";

const squarePhotoFrame =
  "aspect-square w-full overflow-hidden rounded-xl border border-sky-200 bg-slate-50";
const squarePhotoCover = "h-full w-full object-cover";
const squarePhotoContain = "h-full w-full object-contain";

export function OrderDetailSection({
  order,
  closeHref,
  auth,
  nextUrl,
  viewerCourierId,
  phoneProfile,
  uiSettings,
}: {
  order: MandoubOrderDetailPayload;
  closeHref: string;
  auth: { c: string; exp: string; s: string };
  nextUrl: string;
  viewerCourierId?: string;
  phoneProfile?: any;
  uiSettings?: UISectionConfig | null;
}) {
  const shopImageUrl = order.shop.photoUrl?.trim() || order.shopDoorPhotoUrl?.trim() || "";
  const isAdminPortal = order.submissionSource === "admin_portal";
  const submitterName = order.submittedByCompanyPreparer?.name?.trim() || order.submittedBy?.name?.trim() || (isAdminPortal ? "الإدارة" : "—");
  const shopContactPhone = order.submittedByCompanyPreparer?.phone?.trim() || order.submittedBy?.phone?.trim() || (isAdminPortal ? "الإدارة" : order.shop.phone?.trim() || "");
  const customerDoorDisplay = order.customerDoorPhotoUrl?.trim() || phoneProfile?.photoUrl?.trim() || "";
  const mergedCustomerLocationUrl = order.customerLocationUrl?.trim() || phoneProfile?.locationUrl?.trim() || "";
  const mergedLandmark = order.customerLandmark?.trim() || phoneProfile?.landmark?.trim() || "";
  const mergedAlternate = order.alternatePhone?.trim() || phoneProfile?.alternatePhone?.trim() || "";
  const missingCustomerLocation = !hasCustomerLocationUrl(mergedCustomerLocationUrl, undefined);
  const prepJson = order.preparerShoppingJson as any;
  const hideSubtotalInfo = prepJson?.hidePricesFromCourier === true;
  const reversePickup = isReversePickupOrderType(order.orderType);

  const customStyle = uiSettings ? {
    backgroundColor: uiSettings.statusStyles?.[order.status]?.backgroundColor || uiSettings.backgroundColor,
    backgroundImage: uiSettings.statusStyles?.[order.status]?.backgroundImage ? `url(${uiSettings.statusStyles[order.status].backgroundImage})` : (uiSettings.backgroundImage ? `url(${uiSettings.backgroundImage})` : undefined),
    color: uiSettings.statusStyles?.[order.status]?.textColor || uiSettings.textColor,
    opacity: uiSettings.backgroundOpacity,
    borderRadius: uiSettings.borderRadius,
    fontSize: uiSettings.fontSize,
    backgroundSize: 'cover', backgroundPosition: 'center',
  } : {};

  const renderBlock = (blockId: string) => {
    const bConf = uiSettings?.blockConfigs?.[blockId] || {};
    if (bConf.hidden) return null;

    const blockStyle = {
      backgroundColor: bConf.backgroundColor,
      fontSize: bConf.fontSize,
      gridColumn: bConf.fullWidth ? "span 2 / span 2" : "auto"
    };

    switch (blockId) {
      case "shop_info":
        return (
          <div key="shop" className={gridInfoPhoto} style={blockStyle}>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-emerald-800">المحل</h3>
              <p className="font-bold text-slate-900">{order.shop.name}</p>
              <p className="text-sm font-medium"><span className="text-slate-500">المسؤول: </span><span className="font-bold text-sky-900">{submitterName}</span></p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono text-sm font-bold text-slate-700">{contactLine(shopContactPhone)}</p>
              </div>
              <p className="text-slate-800">{order.shop.region.name}</p>
              <div className="mt-2">{order.shop.locationUrl?.trim() ? <a href={order.shop.locationUrl} target="_blank" rel="noopener noreferrer" className={locBtnEmerald}>فتح لوكيشن المحل ↗</a> : <p className="text-xs font-bold text-amber-800">لا يوجد لوكيشن</p>}</div>
            </div>
            <div className="max-w-[12rem] self-start">
              {shopImageUrl ? <div className={squarePhotoFrame}><img src={imgSrc(shopImageUrl)!} alt="" className={squarePhotoCover} /></div> : <p className="text-xs text-slate-400">لا توجد صورة</p>}
              <div className="mt-2"><MandoubDoorPhotoForm orderId={order.id} nextUrl={nextUrl} {...auth} /></div>
            </div>
          </div>
        );
      case "customer_info":
        return (
          <div key="customer" className={gridInfoPhoto} style={blockStyle}>
            <div className="space-y-2">
              <h3 className="text-lg font-bold text-emerald-800">الزبون</h3>
              <p className="text-slate-800">{order.customerRegion?.name ?? "—"}</p>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-mono font-bold text-slate-900">{contactLine(order.customerPhone)}</p>
              </div>
              {mergedAlternate && (<div className="flex flex-wrap items-center gap-2 mt-1"><p className="font-mono text-sm text-slate-600">رقم إضافي: {mergedAlternate}</p></div>)}
              {mergedLandmark && <p className="mt-1 text-sm font-medium text-slate-800">أقرب نقطة: {mergedLandmark}</p>}
              <div className="mt-2">{mergedCustomerLocationUrl ? <a href={mergedCustomerLocationUrl} target="_blank" rel="noopener noreferrer" className={locBtnEmerald}>فتح لوكيشن الزبون ↗</a> : <MandoubUploadLocationInline orderId={order.id} auth={auth} nextUrl={nextUrl} />}</div>
            </div>
            <div className="max-w-[12rem] self-start">{customerDoorDisplay ? <div className={squarePhotoFrame}><img src={imgSrc(customerDoorDisplay)!} alt="" className={squarePhotoCover} /></div> : <p className="text-xs text-slate-400">لا توجد صورة باب</p>}<div className="mt-2"><MandoubQuickDoorCapture orderId={order.id} nextUrl={nextUrl} auth={auth} /></div></div>
          </div>
        );
      case "price_details":
        return (
          <div key="pricing" className={`${gridInfoPhoto} mt-8`} style={blockStyle}>
            <div className="space-y-4 rounded-2xl border-2 border-sky-100 bg-sky-50/50 p-4 shadow-inner">
              <div className="grid grid-cols-2 gap-4">
                <div><p className="text-xs font-bold text-slate-500 uppercase">نوع الطلب</p><div className="mt-1"><OrderTypeDetailBlock orderType={order.orderType} prefixClassName="font-black text-violet-950 bg-violet-100 px-2 py-0.5 rounded text-lg ring-1 ring-violet-300" restClassName="text-lg font-black text-slate-900" /></div></div>
                {order.orderNoteTime && <div><p className="text-xs font-bold text-slate-500 uppercase">وقت الطلب</p><p className="mt-1 text-sm font-black text-indigo-700">{order.orderNoteTime}</p></div>}
              </div>
              {!hideSubtotalInfo && (<div className="space-y-3 pt-2"><div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">السعر:</span><span className="font-black text-slate-900 tabular-nums">{order.orderSubtotal != null ? `${formatDinarAsAlf(order.orderSubtotal)} ألف` : "—"}</span></div><div className="flex justify-between items-center"><span className="text-sm font-bold text-slate-600">توصيل:</span><span className="font-black text-slate-900 tabular-nums">{order.deliveryPrice != null ? `${formatDinarAsAlf(order.deliveryPrice)} ألف` : "—"}</span></div></div>)}
              <div className="rounded-xl border-2 border-violet-500/30 bg-violet-50/10 p-4 shadow-sm"><p className="text-xs font-black text-violet-900 uppercase tracking-widest mb-1">الكلي</p><p className="font-mono text-3xl font-black text-violet-950 tabular-nums">{order.totalAmount != null ? formatDinarAsAlfWithUnit(order.totalAmount) : "—"}</p></div>
            </div>
            <div className="max-w-[12rem] self-start"><p className="mb-2 text-sm font-bold text-slate-700">صورة الطلبية</p>{order.imageUrl ? <div className={squarePhotoFrame}><img src={imgSrc(order.imageUrl)!} alt="" className={squarePhotoContain} /></div> : <div className="aspect-square flex items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white text-xs font-bold text-slate-400">لا يوجد صورة</div>}<div className="mt-2"><MandoubOrderImageQuick orderId={order.id} nextUrl={nextUrl} auth={auth} /></div></div>
          </div>
        );
      case "notes_summary":
        return (
          <div key="notes" className="mt-6 border-t border-sky-100 pt-5" style={blockStyle}>
            <p className="text-xs font-black text-slate-400 mb-2 uppercase tracking-widest">ملاحظات وقائمة المواد</p>
            <div className="relative rounded-xl border-2 border-amber-200 bg-amber-50/30 p-4"><div className="absolute end-3 top-3"><NotesCopyButton text={order.summary ?? ""} /></div><div className="whitespace-pre-wrap text-sm font-bold text-slate-800 leading-relaxed">{order.summary || "لا توجد ملاحظات"}</div></div>
          </div>
        );
      case "money_flow":
        return (<MandoubOrderMoneyFlow key="money" orderId={order.id} orderNumber={order.orderNumber} courierName={order.courier?.name ?? "—"} orderStatus={order.status} missingCustomerLocation={missingCustomerLocation} canRecordMoney={order.assignedCourierId === viewerCourierId} orderSubtotalDinar={Number(order.orderSubtotal || 0)} totalAmountDinar={Number(order.totalAmount || 0)} moneyEvents={order.moneyEvents.map(e => ({...e, amountDinar: Number(e.amountDinar), expectedDinar: e.expectedDinar != null ? Number(e.expectedDinar) : null, performedByDisplayName: e.recordedByCompanyPreparer?.name || e.courier?.name || "—", recordedAt: e.createdAt}))} auth={auth} nextUrl={nextUrl} />);
      default: return null;
    }
  };

  const layout = uiSettings?.layoutOrder && uiSettings.layoutOrder.length > 0
    ? uiSettings.layoutOrder
    : ["shop_info", "customer_info", "price_details", "notes_summary", "money_flow"];

  return (
    <section
      style={customStyle}
      className={`kse-glass-dark relative mt-4 border p-4 pb-32 text-base leading-relaxed sm:p-5 sm:pb-36 ${!uiSettings ? orderStatusStartStripeClass(order.status) : ''} ${
        !uiSettings && order.prepaidAll ? "border-emerald-300/85 bg-gradient-to-b from-emerald-50/70 via-white/90 to-teal-50/40 ring-2 ring-emerald-200/55 shadow-[0_0_0_1px_rgba(16,185,129,0.08)]" :
        !uiSettings && reversePickup ? "border-violet-300/85 bg-gradient-to-b from-violet-50/75 via-white/90 to-fuchsia-50/45 ring-2 ring-violet-200/55 shadow-[0_0_0_1px_rgba(139,92,246,0.08)]" :
        !uiSettings && missingCustomerLocation ? "border-sky-200 bg-rose-50/30 ring-2 ring-rose-200" : (!uiSettings ? `border-sky-200 ${orderStatusDetailSurfaceClass(order.status)}` : "")
      }`}
    >
      {reversePickup && <div className="mb-4 rounded-xl border border-violet-300 bg-violet-50 px-3 py-2 text-sm font-bold text-violet-950">تنبيه طلب عكسي استلام من الزبون وتسليم للعميل</div>}
      {order.prepaidAll && (<div className="relative mb-4 overflow-hidden rounded-2xl border-2 border-emerald-400/55 bg-gradient-to-br from-emerald-100/90 via-teal-50/85 to-cyan-50/75 p-4 sm:p-5 shadow-xl"><div className="relative flex flex-col items-center gap-4 sm:flex-row sm:items-start"><div className="flex size-[4rem] shrink-0 items-center justify-center rounded-2xl bg-white/95 shadow-md"><svg className="size-10 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" /></svg></div><p className="text-xl font-black text-emerald-950 sm:text-2xl text-center sm:text-right">الطلب واصل اخذ التوصيل من العميل</p></div></div>)}

      <Suspense fallback={null}><MandoubLocFlashBanner /></Suspense>

      <MandoubFloatingBar
        orderId={order.id} shopPhone={shopContactPhone} customerPhone={order.customerPhone} customerAlternatePhone={order.secondCustomerPhone?.trim() || mergedAlternate || ""} preparerPhone={order.submittedByCompanyPreparer?.phone ?? ""} orderStatus={order.status} orderNumber={order.orderNumber} shopName={order.shop.name} city={order.customerRegion?.name ?? ""} totalPrice={order.totalAmount != null ? formatDinarAsAlf(order.totalAmount) : ""} deliveryName={order.courier?.name ?? ""} customerLocationUrl={mergedCustomerLocationUrl} customerLandmark={mergedLandmark} hasCustomerLocation={!missingCustomerLocation} hasCourierUploadedLocation={Boolean(order.customerLocationSetByCourierAt)}
      />

      <div className="grid grid-cols-1 gap-3 border-b border-sky-100 pb-3 sm:grid-cols-[1fr_auto] sm:items-start">
        <div><h2 className="text-xl font-black text-slate-900 sm:text-2xl">رقم الطلب <span className="tabular-nums text-sky-800">#{order.orderNumber}</span></h2>{order.courier && <p className="mt-0.5 text-[11px] font-bold text-slate-500">المندوب: {order.courier.name} ({order.courier.phone})</p>}</div>
        <div className="flex flex-wrap items-center gap-2"><MandoubOrderDetailActions closeHref={closeHref} /><span className={`rounded-full px-3 py-1.5 text-xs font-bold ${orderStatusBadgeClass(order.status)}`}>{STATUS_AR[order.status] ?? order.status}</span></div>
      </div>

      <MandoubCustomerEditForm orderId={order.id} defaultOrderStatus={order.status} defaultCustomerPhone={order.customerPhone} defaultCustomerLocationUrl={mergedCustomerLocationUrl} defaultCustomerLandmark={mergedLandmark} defaultAlternatePhone={mergedAlternate} auth={auth} nextUrl={nextUrl} />

      <div className="mt-5 space-y-6">
        {layout.map((blockId) => renderBlock(blockId))}
      </div>
    </section>
  );
}
