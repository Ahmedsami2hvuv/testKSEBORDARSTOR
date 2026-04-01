import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { AdminOrderFloatingBar } from "./edit/admin-order-floating-bar";
import { AdminOrderMoneyEvents } from "./admin-order-money-events";
import { OrderViewContent } from "./order-view-content";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { isReversePickupOrderType } from "@/lib/order-type-flags";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ orderId: string }> };

export async function generateMetadata({ params }: Props) {
  const { orderId } = await params;
  const o = await prisma.order.findUnique({
    where: { id: orderId },
    select: { orderNumber: true },
  });
  return {
    title: o ? `طلب #${o.orderNumber} — أبو الأكبر للتوصيل` : "طلب — أبو الأكبر للتوصيل",
  };
}

export default async function AdminOrderViewPage({ params }: Props) {
  const { orderId } = await params;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      shop: true,
      customerRegion: true,
      courier: true,
      customer: true,
      submittedBy: true,
      submittedByCompanyPreparer: true,
      moneyEvents: {
        orderBy: { createdAt: "asc" },
        include: {
          courier: { select: { name: true } },
          recordedByCompanyPreparer: { select: { name: true } },
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  const customerPhoneNorm = normalizeIraqMobileLocal11(order.customerPhone);
  const customerPhoneProfile =
    customerPhoneNorm && order.customerRegionId
      ? await prisma.customerPhoneProfile.findUnique({
          where: {
            phone_regionId: {
              phone: customerPhoneNorm,
              regionId: order.customerRegionId,
            },
          },
          select: {
            photoUrl: true,
            locationUrl: true,
            landmark: true,
            alternatePhone: true,
          },
        })
      : null;

  const secondPhoneNorm = order.secondCustomerPhone?.trim()
    ? normalizeIraqMobileLocal11(order.secondCustomerPhone)
    : null;
  const secondCustomerPhoneProfile =
    secondPhoneNorm && order.secondCustomerRegionId
      ? await prisma.customerPhoneProfile.findUnique({
          where: {
            phone_regionId: {
              phone: secondPhoneNorm,
              regionId: order.secondCustomerRegionId,
            },
          },
          select: {
            photoUrl: true,
            locationUrl: true,
            landmark: true,
            alternatePhone: true,
          },
        })
      : null;

  // fallback: صورة باب الزبون من CustomerPhoneProfile إذا كان الطلب فارغاً
  const customerDoorPhotoUrlEffective: string | null =
    order.customerDoorPhotoUrl?.trim() ||
    customerPhoneProfile?.photoUrl?.trim() ||
    null;

  const secondCustomerDoorPhotoUrlEffective: string | null =
    order.secondCustomerDoorPhotoUrl?.trim() ||
    secondCustomerPhoneProfile?.photoUrl?.trim() ||
    null;

  // fallback: لوكيشن الزبون من CustomerPhoneProfile
  const customerLocationUrlEffective =
    order.customerLocationUrl?.trim() ||
    customerPhoneProfile?.locationUrl?.trim() ||
    "";

  // fallback: أقرب نقطة دالة من CustomerPhoneProfile
  const customerLandmarkEffective =
    order.customerLandmark?.trim() ||
    customerPhoneProfile?.landmark?.trim() ||
    "";

  // fallback: الرقم الثاني من CustomerPhoneProfile
  const alternatePhoneEffective =
    order.alternatePhone?.trim() ||
    customerPhoneProfile?.alternatePhone?.trim() ||
    null;

  // fallback: لوكيشن الوجهة الثانية من CustomerPhoneProfile
  const secondCustomerLocationUrlEffective =
    order.secondCustomerLocationUrl?.trim() ||
    secondCustomerPhoneProfile?.locationUrl?.trim() ||
    "";

  // fallback: أقرب نقطة دالة للوجهة الثانية
  const secondCustomerLandmarkEffective =
    order.secondCustomerLandmark?.trim() ||
    secondCustomerPhoneProfile?.landmark?.trim() ||
    "";

  const shopPhoneForBar =
    order.shop.phone?.trim() || order.submittedBy?.phone?.trim() || "";

  const adminMoneyEvents = order.moneyEvents.map((e) => ({
    id: e.id,
    kind: e.kind,
    amountDinar: Number(e.amountDinar),
    expectedDinar: e.expectedDinar != null ? Number(e.expectedDinar) : null,
    matchesExpected: e.matchesExpected,
    mismatchReason: e.mismatchReason,
    mismatchNote: e.mismatchNote,
    recordedAt: e.createdAt.toISOString(),
    deletedAt: e.deletedAt?.toISOString() ?? null,
    deletedReason: e.deletedReason,
    deletedByDisplayName: e.deletedByDisplayName,
    performedByDisplayName:
      e.recordedByCompanyPreparer?.name?.trim() || e.courier?.name?.trim() || "—",
    recordedByCompanyPreparerId: e.recordedByCompanyPreparerId ?? null,
  }));

  const view = {
    id: order.id,
    orderNumber: order.orderNumber,
    status: order.status,
    routeMode: (order.routeMode === "double" ? "double" : "single") as
      | "single"
      | "double",
    adminOrderCode: order.adminOrderCode,
    orderType: order.orderType,
    summary: order.summary,
    customerPhone: order.customerPhone,
    alternatePhone: alternatePhoneEffective,
    secondCustomerPhone: order.secondCustomerPhone,
    secondCustomerLocationUrl: secondCustomerLocationUrlEffective,
    secondCustomerLandmark: secondCustomerLandmarkEffective,
    secondCustomerDoorPhotoUrl: secondCustomerDoorPhotoUrlEffective,
    orderNoteTime: order.orderNoteTime,
    imageUrl: order.imageUrl,
    orderImageUploadedByName: order.orderImageUploadedByName,
    shopDoorPhotoUploadedByName: order.shopDoorPhotoUploadedByName,
    customerDoorPhotoUploadedByName: order.customerDoorPhotoUploadedByName,
    secondCustomerDoorPhotoUploadedByName: order.secondCustomerDoorPhotoUploadedByName,
    voiceNoteUrl: order.voiceNoteUrl,
    adminVoiceNoteUrl: order.adminVoiceNoteUrl,
    shopDoorPhotoUrl: order.shopDoorPhotoUrl,
    customerDoorPhotoUrl: customerDoorPhotoUrlEffective,
    customerLandmark: customerLandmarkEffective,
    orderSubtotal:
      order.orderSubtotal != null ? formatDinarAsAlfWithUnit(order.orderSubtotal) : null,
    deliveryPrice:
      order.deliveryPrice != null ? formatDinarAsAlfWithUnit(order.deliveryPrice) : null,
    totalAmount:
      order.totalAmount != null ? formatDinarAsAlfWithUnit(order.totalAmount) : null,
    submissionSource: order.submissionSource,
    createdAt: order.createdAt,
    prepaidAll: order.prepaidAll,
    reversePickup: isReversePickupOrderType(order.orderType),
    shop: {
      name: order.shop.name,
      phone: order.shop.phone,
      ownerName: order.shop.ownerName,
    },
    shopPhotoUrl: order.shop.photoUrl,
    shopLocationUrl: order.shop.locationUrl,
    customerLocationUrl: customerLocationUrlEffective,
    customerLocationUploadedByName: order.customerLocationUploadedByName,
    customerRegion: order.customerRegion
      ? { name: order.customerRegion.name }
      : null,
    courier: order.courier
      ? { name: order.courier.name, phone: order.courier.phone }
      : null,
    customer: order.customer ? { name: order.customer.name } : null,
    submittedBy: order.submittedBy ? { name: order.submittedBy.name } : null,
    submittedByCompanyPreparer: order.submittedByCompanyPreparer
      ? { name: order.submittedByCompanyPreparer.name, phone: order.submittedByCompanyPreparer.phone }
      : null,
  };

  return (
    <div className="space-y-4">
      <p className={ad.muted}>
        <Link href="/admin/orders/tracking" className={ad.link}>
          ← تتبع الطلبات
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>عرض الطلب #{order.orderNumber}</h1>
        <p className={`mt-1 ${ad.lead}`}>
          تفاصيل للقراءة فقط — للتعديل استخدم زر «تعديل الطلب».
        </p>
      </div>
      <OrderViewContent order={view} />
      <AdminOrderMoneyEvents
        orderNumber={order.orderNumber}
        nextPath={`/admin/orders/${order.id}`}
        events={adminMoneyEvents}
      />
      <AdminOrderFloatingBar
        orderId={order.id}
        shopPhone={shopPhoneForBar}
        customerPhone={order.customerPhone ?? ""}
        customerAlternatePhone={order.secondCustomerPhone ?? order.alternatePhone ?? ""}
        preparerPhone={order.submittedByCompanyPreparer?.phone ?? ""}
        orderStatus={order.status}
        orderNumber={order.orderNumber}
        shopName={order.shop.name}
        city={order.customerRegion?.name ?? ""}
        totalPrice={order.totalAmount != null ? formatDinarAsAlfWithUnit(order.totalAmount) : ""}
        deliveryName={order.courier?.name ?? ""}
        customerLocationUrl={customerLocationUrlEffective}
        customerLandmark={customerLandmarkEffective}
        hasCustomerLocation={Boolean(customerLocationUrlEffective)}
        hasCourierUploadedLocation={Boolean(order.customerLocationSetByCourierAt)}
      />
    </div>
  );
}
