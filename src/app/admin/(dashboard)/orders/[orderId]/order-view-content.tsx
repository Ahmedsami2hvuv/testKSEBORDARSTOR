import type { ReactNode } from "react";
import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { OrderTypeLine } from "@/components/order-type-line";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import {
  orderStatusBadgeClass,
  orderStatusBadgeClassPrepaid,
} from "@/lib/order-status-style";
import { CustomerDoorPhotoQuick } from "./customer-door-photo-quick";
import { AdminOrderPhotoQuick } from "./admin-order-photo-quick";
import { AdminCustomerLocationQuick } from "./admin-customer-location-quick";
import { ImageUploaderCaption } from "@/components/image-uploader-caption";
import { VoiceNoteAudio } from "@/components/voice-note-audio";
import { AdminVoiceNoteSection } from "./edit/admin-voice-note-section";
import { OrderFabDock } from "@/components/order-fab-dock";

/** عرض صور الطلب بنسبة 1:1 */
const squarePhotoFrame =
  "aspect-square w-full overflow-hidden rounded-xl border border-sky-200 bg-slate-50";
const squarePhotoImg = "h-full w-full object-contain";

const STATUS_AR: Record<string, string> = {
  pending: "قيد الانتظار",
  assigned: "مسند للمندوب",
  delivering: "قيد التوصيل",
  delivered: "تم التسليم",
  cancelled: "ملغى",
  archived: "مؤرشف",
};

// أسماء المحلات التي نعتبرها "إدارة" لإخفاء تفاصيلها
const ADMIN_SHOP_NAMES = ["طلبات الإدارة العامة", "الإدارة"];
const SYSTEM_ADMIN_PHONE = "07733921568";

function submissionLabel(source: string): string {
  if (source === "customer_via_employee_link") return "من رابط موظف المحل";
  if (source === "client_portal") return "من رابط قديم (محل)";
  if (source === "admin_portal") return "مدخل من الإدارة";
  if (source === "employee") return "موظف محل";
  return source || "—";
}

type OrderViewModel = {
  id: string;
  orderNumber: number;
  status: string;
  orderType: string;
  summary: string;
  customerPhone: string;
  routeMode: "single" | "double";
  adminOrderCode: string;
  alternatePhone: string | null;
  secondCustomerPhone: string | null;
  secondCustomerLocationUrl: string;
  secondCustomerLandmark: string;
  secondCustomerDoorPhotoUrl: string | null;
  secondCustomerDoorPhotoUploadedByName: string | null;
  orderNoteTime: string | null;
  imageUrl: string | null;
  orderImageUploadedByName: string | null;
  voiceNoteUrl: string | null;
  adminVoiceNoteUrl: string | null;
  shopDoorPhotoUrl: string | null;
  shopDoorPhotoUploadedByName: string | null;
  customerDoorPhotoUrl: string | null;
  customerDoorPhotoUploadedByName: string | null;
  /** أقرب نقطة دالة — مدمج من الطلب أو CustomerPhoneProfile */
  customerLandmark: string;
  orderSubtotal: string | null;
  deliveryPrice: string | null;
  totalAmount: string | null;
  submissionSource: string;
  createdAt: Date;
  prepaidAll: boolean;
  /** طلب عكسي (من رابط العميل) — يُاستنتج أيضاً من بادئة نوع الطلب */
  reversePickup: boolean;
  shop: { name: string; phone: string; ownerName: string };
  shopPhotoUrl: string;
  shopLocationUrl: string;
  customerLocationUrl: string;
  customerLocationUploadedByName: string | null;
  customerRegion: { name: string } | null;
  courier: { name: string; phone: string } | null;
  customer: { name: string } | null;
  /** موظف المحل الذي رفع الطلب — منفصل عن زبون التوصيل */
  submittedBy: { name: string } | null;
  /** إن وُجد: الطلب أُدخل من لوحة مجهز الشركة */
  submittedByCompanyPreparer: { name: string; phone: string } | null;
};

function Field({
  label,
  children,
  emphasize,
}: {
  label: string;
  children: ReactNode;
  emphasize?: boolean;
}) {
  return (
    <div className="min-w-0">
      <p
        className={
          emphasize
            ? "text-sm font-bold text-slate-600 sm:text-base"
            : "text-xs font-semibold text-slate-500"
        }
      >
        {label}
      </p>
      <div
        className={
          emphasize
            ? "mt-1 text-base font-semibold text-slate-900 sm:text-lg"
            : "mt-0.5 text-sm text-slate-900"
        }
      >
        {children}
      </div>
    </div>
  );
}

export function OrderViewContent({ order }: { order: OrderViewModel }) {
  const imgOrder = resolvePublicAssetSrc(order.imageUrl);
  const voiceSrc = resolvePublicAssetSrc(order.voiceNoteUrl);
  const imgShopDoor = resolvePublicAssetSrc(order.shopPhotoUrl || order.shopDoorPhotoUrl || null);
  const imgCustDoor = resolvePublicAssetSrc(order.customerDoorPhotoUrl);
  const imgCustDoor2 = resolvePublicAssetSrc(order.secondCustomerDoorPhotoUrl);

  const hasCustomerLocation = !!order.customerLocationUrl?.trim();

  const statusBadgeClass = order.prepaidAll
    ? orderStatusBadgeClassPrepaid(order.status, true)
    : orderStatusBadgeClass(order.status);
  const isPreparerShoppingOrder =
    order.submissionSource === "company_preparer" && order.orderType?.trim() === "تجهيز تسوق";
  const isReversePickup = order.reversePickup || isReversePickupOrderType(order.orderType);

  // هل الطلب هو طلب إداري مباشر؟ (نفحص الاسم أو مصدر الرفع)
  const isSystemAdminOrder = ADMIN_SHOP_NAMES.includes(order.shop.name) || order.submissionSource === "admin_portal";

  // رقم الهاتف المستخدم في الأزرار العائمة (واتساب/اتصال)
  const effectiveShopPhone = isSystemAdminOrder ? SYSTEM_ADMIN_PHONE : order.shop.phone;

  return (
    <div
      className={`space-y-6 ${
        order.prepaidAll
          ? "rounded-2xl border-2 border-red-300/85 bg-gradient-to-b from-red-50/95 to-red-50/40 p-4 shadow-inner shadow-red-100/40 sm:p-5"
          : isReversePickup
            ? "rounded-2xl border-2 border-violet-300/85 bg-gradient-to-b from-violet-50/95 to-fuchsia-50/35 p-4 shadow-inner shadow-violet-100/40 sm:p-5"
            : ""
      }`}
      dir="rtl"
    >
      <div className="flex flex-wrap items-center justify-start gap-2">
        <Link
          href={`/admin/orders/${order.id}/edit`}
          className={ad.btnPrimary}
        >
          تعديل الطلب
        </Link>
        <span
          className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${statusBadgeClass}`}
        >
          {STATUS_AR[order.status] ?? order.status}
        </span>
        <Link href="/admin/orders/tracking" className={ad.btnDark}>
          تتبع الطلبات
        </Link>
        {order.customerPhone?.trim() ? (
          <Link
            href={`/admin/customers/info?phone=${encodeURIComponent(order.customerPhone.trim())}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-violet-500 bg-violet-50 px-4 text-sm font-bold text-violet-950 shadow-sm transition hover:bg-violet-100"
          >
            عرض معلومات الزبون
          </Link>
        ) : null}
        {order.status === "pending" ? (
          <Link
            href={`/admin/orders/pending?assignOrder=${encodeURIComponent(order.id)}`}
            className="inline-flex min-h-[44px] items-center justify-center rounded-xl border border-emerald-500 bg-emerald-600 px-4 text-sm font-bold text-white shadow-sm transition hover:bg-emerald-700"
          >
            إسناد للمندوب
          </Link>
        ) : null}
      </div>

      <div className={`${ad.section} space-y-4`}>
        <h3 className={ad.h3}>البصمات الصوتية</h3>
        <div className="space-y-4">
          {voiceSrc ? (
            <div>
              <p className="text-xs font-semibold text-violet-900">بصمة مُدخل الطلب</p>
              <VoiceNoteAudio
                src={voiceSrc}
                streamKey={`${order.id}-submitter-voice`}
                className="mt-2 w-full max-w-md rounded-lg border border-violet-200 bg-violet-50/50 p-2"
              />
            </div>
          ) : (
            <p className="text-sm text-slate-500">لا توجد بصمة صوتية من مُدخل الطلب.</p>
          )}
          <AdminVoiceNoteSection
            variant="standalone"
            orderId={order.id}
            defaultAdminVoiceNoteUrl={order.adminVoiceNoteUrl}
          />
        </div>
      </div>

      {/* المربع المطلوب: طلب وجه واحدة */}
      <div className={`${ad.section} space-y-4`}>
        <h2 className={ad.h2}>
          {isSystemAdminOrder ? "طلب وجه واحدة" : (isPreparerShoppingOrder ? "معلومات المجهز" : "معلومات المحل")}
        </h2>
        <div className={isSystemAdminOrder ? "flex items-center" : "grid gap-4 grid-cols-[1.6fr_1fr]"}>
          <div className="space-y-3 w-full">
            {!isSystemAdminOrder ? (
              <>
                <Field label="رقم الطلب">#{order.orderNumber}</Field>
                <Field label="مرجع الإدارة">{order.adminOrderCode?.trim() || "—"}</Field>
                {isPreparerShoppingOrder ? (
                  <>
                    <Field label="اسم المجهز">
                      {order.submittedByCompanyPreparer?.name?.trim() || "—"}
                    </Field>
                    <Field label="رقم المجهز">
                      <span className="font-mono tabular-nums">
                        {order.submittedByCompanyPreparer?.phone?.trim() || "—"}
                      </span>
                    </Field>
                    <Field label="نوع الطلب">
                      <OrderTypeLine orderType={order.orderType} />
                    </Field>
                  </>
                ) : (
                  <>
                    <Field label="اسم المحل">{order.shop.name}</Field>
                    {order.shop.ownerName?.trim() ? (
                      <Field label="صاحب المحل">{order.shop.ownerName.trim()}</Field>
                    ) : null}
                    <Field label="هاتف المحل">
                      <span className="font-mono tabular-nums">{order.shop.phone?.trim() || "—"}</span>
                    </Field>
                    <Field label="عميل المحل (موظف رفع الطلب)">
                      {order.submittedBy?.name?.trim() || "—"}
                    </Field>
                    {order.submittedByCompanyPreparer?.name?.trim() ? (
                      <Field label="مجهز الشركة (رافع الطلب من لوحة المجهز)">
                        {order.submittedByCompanyPreparer.name.trim()}
                      </Field>
                    ) : null}
                  </>
                )}
                <Field label="مصدر الرفع">{submissionLabel(order.submissionSource)}</Field>
                {!isPreparerShoppingOrder ? (
                  <Field label="لوكيشن المحل">
                    {order.shopLocationUrl?.trim() ? (
                      <a
                        href={order.shopLocationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 via-sky-600 to-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-sky-200/60 ring-1 ring-sky-400/30 transition hover:from-indigo-700 hover:via-sky-700 hover:to-cyan-700"
                      >
                        فتح لوكيشن المحل <span aria-hidden>↗</span>
                      </a>
                    ) : (
                      "—"
                    )}
                  </Field>
                ) : null}
              </>
            ) : (
              <div className="grid grid-cols-2 gap-10 items-center py-4 bg-sky-50/50 rounded-2xl border-2 border-sky-200 px-6">
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-500">رقم الطلب</p>
                  <p className="text-4xl font-black text-slate-900">#{order.orderNumber}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-slate-500">رقم الاداره</p>
                  <a href={`tel:${SYSTEM_ADMIN_PHONE}`} className="text-3xl font-black text-indigo-700 tabular-nums hover:underline decoration-4">
                    {SYSTEM_ADMIN_PHONE}
                  </a>
                </div>
              </div>
            )}
          </div>

          {!isSystemAdminOrder && (
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">صورة باب المحل</p>
              {imgShopDoor ? (
                <a href={imgShopDoor} target="_blank" rel="noopener noreferrer" className="block">
                  <div className={squarePhotoFrame}>
                    <img src={imgShopDoor} alt="" className={squarePhotoImg} />
                  </div>
                  <ImageUploaderCaption name={order.shopDoorPhotoUploadedByName} />
                </a>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                  لا توجد صورة باب المحل
                </div>
              )}
              <AdminOrderPhotoQuick orderId={order.id} kind="shop" hasImage={!!(order.shopPhotoUrl || order.shopDoorPhotoUrl)} />
            </div>
          )}
        </div>
      </div>

      <div className={`${ad.section} space-y-3`}>
        <h3 className={ad.h2}>الزبون</h3>
        <div className="grid gap-4 grid-cols-[1.6fr_1fr]">
          <div className="space-y-3">
            <Field label="منطقة الزبون">{order.customerRegion?.name ?? "—"}</Field>
            {order.customer?.name?.trim() ? (
              <Field label="اسم الزبون (من السجل)">{order.customer.name.trim()}</Field>
            ) : null}
            <Field label="رقم الزبون الأول">
              <span className="font-mono tabular-nums">{order.customerPhone || "—"}</span>
            </Field>
            {order.alternatePhone?.trim() ? (
              <Field label="رقم الزبون الثاني">
                <span className="font-mono tabular-nums">{order.alternatePhone}</span>
              </Field>
            ) : null}
            {order.customerLandmark?.trim() ? (
              <Field label="أقرب نقطة دالة">{order.customerLandmark}</Field>
            ) : null}
            <Field label="لوكيشن الزبون">
              {hasCustomerLocation ? (
                <div>
                  <a
                    href={order.customerLocationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 via-teal-600 to-cyan-600 px-4 py-2 text-sm font-bold text-white shadow-md shadow-sky-200/60 ring-1 ring-emerald-400/30 transition hover:from-emerald-700 hover:via-teal-700 hover:to-cyan-700"
                  >
                    فتح لوكيشن الزبون <span aria-hidden>↗</span>
                  </a>
                  <ImageUploaderCaption name={order.customerLocationUploadedByName} />
                  <AdminCustomerLocationQuick orderId={order.id} />
                </div>
              ) : (
                <div>
                  <p>—</p>
                  <AdminCustomerLocationQuick orderId={order.id} />
                </div>
              )}
            </Field>
          </div>
          <div className="space-y-2">
            <p className="mb-1 text-xs font-semibold text-slate-600">صورة باب الزبون</p>
            {imgCustDoor ? (
              <a href={imgCustDoor} target="_blank" rel="noopener noreferrer" className="block">
                <div className={squarePhotoFrame}>
                  <img src={imgCustDoor} alt="" className={squarePhotoImg} />
                </div>
                <ImageUploaderCaption name={order.customerDoorPhotoUploadedByName} />
              </a>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                لا توجد صورة باب الزبون
              </div>
            )}
            <CustomerDoorPhotoQuick orderId={order.id} hasImage={!!order.customerDoorPhotoUrl} />
          </div>
        </div>
      </div>

      {order.routeMode === "double" ? (
        <div className={`${ad.section} space-y-3`}>
          <h3 className={ad.h3}>الوجهة الثانية</h3>
          <div className="grid gap-4 grid-cols-[1.6fr_1fr]">
            <div className="space-y-3">
              <Field label="رقم الوجهة 2">
                <span className="font-mono tabular-nums">{order.secondCustomerPhone || "—"}</span>
              </Field>
              <Field label="لوكيشن الوجهة 2">
                {order.secondCustomerLocationUrl?.trim() ? (
                  <a
                    href={order.secondCustomerLocationUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 via-indigo-600 to-sky-600 px-4 py-2 text-sm font-bold text-white shadow-md ring-1 ring-indigo-400/30 transition hover:from-violet-700 hover:via-indigo-700 hover:to-sky-700"
                  >
                    فتح لوكيشن الوجهة 2 <span aria-hidden>↗</span>
                  </a>
                ) : (
                  "—"
                )}
              </Field>
              <Field label="أقرب نقطة دالة">{order.secondCustomerLandmark?.trim() || "—"}</Field>
            </div>
            <div>
              <p className="mb-1 text-xs font-semibold text-slate-600">صورة باب الوجهة 2</p>
              {imgCustDoor2 ? (
                <a href={imgCustDoor2} target="_blank" rel="noopener noreferrer" className="block">
                  <div className={squarePhotoFrame}>
                    <img src={imgCustDoor2} alt="" className={squarePhotoImg} />
                  </div>
                  <ImageUploaderCaption name={order.secondCustomerDoorPhotoUploadedByName} />
                </a>
              ) : (
                <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                  لا توجد صورة باب الوجهة 2
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <div className={`${ad.section} space-y-3`}>
        <h3 className={ad.h3}>الطلب</h3>
        <div className="grid gap-4 grid-cols-[1.6fr_1fr]">
          <div className="space-y-3">
            <Field label="نوع الطلب" emphasize>
              <OrderTypeLine
                orderType={order.orderType}
                prefixClassName="font-black text-violet-950 bg-violet-100 px-2 py-1 rounded-lg text-xl sm:text-2xl ring-2 ring-violet-400/80 shadow-sm"
                restClassName="text-xl font-black leading-snug sm:text-2xl text-slate-900"
              />
            </Field>
            <Field label="المسار">
              {order.routeMode === "double" ? (
                <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-900">
                  وجهتين
                </span>
              ) : isSystemAdminOrder ? (
                <span className="rounded-full bg-sky-700 px-3 py-1 text-xs font-black text-white shadow-sm ring-2 ring-sky-400">
                  طلب وجهة واحدة
                </span>
              ) : (
                "—"
              )}
            </Field>
            <Field label="سعر الطلب (بالألف)" emphasize>
              <span className="font-mono text-lg font-bold tabular-nums sm:text-xl">
                {order.orderSubtotal ?? "—"}
              </span>
            </Field>
            <Field label="سعر التوصيل (بالألف)" emphasize>
              <span className="font-mono text-lg font-bold tabular-nums sm:text-xl">
                {order.deliveryPrice ?? "—"}
              </span>
            </Field>
            <Field label="المبلغ الكلي (بالألف)" emphasize>
              <span className="font-mono text-2xl font-black tabular-nums text-sky-950 sm:text-3xl">
                {order.totalAmount ?? "—"}
              </span>
            </Field>
            <Field label="الملاحظات">
              <p
                className={`whitespace-pre-wrap break-words rounded-lg border p-3 ${
                  order.summary?.trim()
                    ? "border-rose-400 bg-rose-50 font-medium text-rose-950 ring-1 ring-rose-200"
                    : "border-transparent text-slate-800"
                }`}
              >
                {order.summary?.trim() || "—"}
              </p>
            </Field>
          </div>
          <div>
            <p className="mb-1 text-xs font-semibold text-slate-600">صورة طلب</p>
            {imgOrder ? (
              <a href={imgOrder} target="_blank" rel="noopener noreferrer" className="block">
                <div className={squarePhotoFrame}>
                  <img src={imgOrder} alt="" className={squarePhotoImg} />
                </div>
                <ImageUploaderCaption name={order.orderImageUploadedByName} />
              </a>
            ) : (
              <div className="flex aspect-square items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                لا توجد صورة طلب
              </div>
            )}
            <AdminOrderPhotoQuick orderId={order.id} kind="order" hasImage={!!order.imageUrl} />
          </div>
        </div>
      </div>

      {/* زر الاتصال العائم: نقوم بتمرير رقم الإدارة إذا كان الطلب إدارياً */}
      <OrderFabDock
        storageKey="adminFabLayout_v4"
        orderId={order.id}
        shopPhone={effectiveShopPhone}
        customerPhone={order.customerPhone}
        customerAlternatePhone={order.alternatePhone ?? undefined}
      />
    </div>
  );
}
