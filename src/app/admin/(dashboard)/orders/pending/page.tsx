import Link from "next/link";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { courierAssignableWhere } from "@/lib/courier-assignable";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { formatBaghdadDateTime } from "@/lib/baghdad-time";
import { isReversePickupOrderType } from "@/lib/order-type-flags";
import { PendingOrdersClient, type PendingOrderRow } from "./pending-orders-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الطلبات الجديدة — أبو الأكبر للتوصيل",
};

function customerOrderTimeLabel(orderNoteTime: string | null): string {
  if (!orderNoteTime?.trim()) return "—";
  const t = orderNoteTime.trim();
  return t.replace(/^وقت الطلب:\s*/i, "").trim() || t;
}

type PageProps = { searchParams: Promise<{ assignOrder?: string }> };

export default async function PendingOrdersPage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const assignOrder = (sp.assignOrder ?? "").trim();
  const orders = await prisma.order.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "desc" },
    include: {
      shop: { include: { region: true } },
      submittedBy: true,
      customerRegion: true,
      customer: true,
    },
  });

  const couriers = await prisma.courier.findMany({
    where: courierAssignableWhere,
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const phoneProfileKeys = new Set<string>();
  for (const o of orders) {
    const phoneNorm = normalizeIraqMobileLocal11(o.customerPhone);
    const regionId = o.customerRegionId;
    if (phoneNorm && regionId) {
      phoneProfileKeys.add(`${phoneNorm}::${regionId}`);
    }
  }

  const phoneProfiles = phoneProfileKeys.size
    ? await prisma.customerPhoneProfile.findMany({
        where: {
          OR: Array.from(phoneProfileKeys).map((k) => {
            const [phone, regionId] = k.split("::");
            return { phone, regionId };
          }),
        },
        select: {
          phone: true,
          regionId: true,
          photoUrl: true,
          locationUrl: true,
          landmark: true,
          alternatePhone: true,
        },
      })
    : [];

  const phoneProfileMap = new Map<
    string,
    { photoUrl: string; locationUrl: string; landmark: string; alternatePhone: string }
  >();
  for (const p of phoneProfiles) {
    phoneProfileMap.set(`${p.phone}::${p.regionId}`, {
      photoUrl: p.photoUrl?.trim() ?? "",
      locationUrl: p.locationUrl?.trim() ?? "",
      landmark: p.landmark?.trim() ?? "",
      alternatePhone: p.alternatePhone?.trim() ?? "",
    });
  }

  const rows: PendingOrderRow[] = orders.map((o) => {
    const phoneNorm = normalizeIraqMobileLocal11(o.customerPhone);
    const prof =
      phoneNorm && o.customerRegionId
        ? phoneProfileMap.get(`${phoneNorm}::${o.customerRegionId}`)
        : undefined;
    const locMerged = o.customerLocationUrl?.trim() || prof?.locationUrl || "";
    const lmMerged = o.customerLandmark?.trim() || prof?.landmark || "";
    const rawDoor = o.customerDoorPhotoUrl?.trim() || prof?.photoUrl || "";
    return {
      id: o.id,
      orderNumber: o.orderNumber,
      routeMode: o.routeMode === "double" ? "double" : "single",
      shopName: o.shop.name,
      regionName: o.customerRegion?.name ?? "—",
      orderType: o.orderType?.trim() ? o.orderType : "—",
      customerOrderTime: customerOrderTimeLabel(o.orderNoteTime),
      createdAtLabel: formatBaghdadDateTime(o.createdAt, { dateStyle: "short", timeStyle: "short" }),
      summary: o.summary,
      customerPhone: o.customerPhone,
      customerAlternatePhone: o.alternatePhone?.trim() || prof?.alternatePhone || "",
      customerDoorPhotoUrl: resolvePublicAssetSrc(rawDoor) ?? "",
      totalAmount: o.totalAmount != null ? formatDinarAsAlfWithUnit(o.totalAmount) : null,
      deliveryPrice: o.deliveryPrice != null ? formatDinarAsAlfWithUnit(o.deliveryPrice) : null,
      submittedByName: o.submittedBy?.name ?? null,
      submissionLabel:
        o.submissionSource === "customer_via_employee_link"
          ? "من رابط العميل (موظف)"
          : o.submissionSource === "client_portal"
            ? "من رابط قديم (محل)"
            : o.submissionSource === "admin_portal"
              ? "مدخل من الإدارة"
            : null,
      customerLocationUrl: locMerged,
      customerLandmark: lmMerged,
      hasCustomerLocation: hasCustomerLocationUrl(locMerged, undefined),
      hasCourierUploadedLocation: Boolean(o.customerLocationSetByCourierAt),
      reversePickup: isReversePickupOrderType(o.orderType),
    };
  });
  function hrefTracking(opts: {
    status:
      | "all"
      | "pending"
      | "assigned"
      | "delivering"
      | "delivered"
      | "checkSader"
      | "checkWard"
      | "cancelled";
    wardFilter?: "lower" | "higher";
  }): string {
    const p = new URLSearchParams();
    if (opts.status !== "all") p.set("status", opts.status);
    if (opts.status === "checkWard" && opts.wardFilter === "higher") {
      p.set("wardFilter", "higher");
    }
    return p.toString()
      ? `/admin/orders/tracking?${p.toString()}`
      : "/admin/orders/tracking";
  }

  return (
    <div className="space-y-4">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>
          ← الرئيسية
        </Link>
      </p>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className={ad.h1}>الطلبات الجديدة</h1>
        <Link href="/admin/orders/new" className={ad.btnPrimary}>
          + إضافة طلب من الإدارة
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Link
          href={hrefTracking({ status: "all" })}
          className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-sm font-bold text-sky-800 transition hover:bg-sky-50"
        >
          الكل
        </Link>
        <Link
          href={hrefTracking({ status: "pending" })}
          className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-sm font-bold text-sky-800 transition hover:bg-sky-50"
        >
          جديد
        </Link>
        <Link
          href={hrefTracking({ status: "assigned" })}
          className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-sm font-bold text-sky-800 transition hover:bg-sky-50"
        >
          مسند
        </Link>
        <Link
          href={hrefTracking({ status: "delivering" })}
          className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-sm font-bold text-sky-800 transition hover:bg-sky-50"
        >
          بالتوصيل
        </Link>
        <Link
          href={hrefTracking({ status: "delivered" })}
          className="rounded-full border border-sky-200 bg-white px-3 py-1.5 text-sm font-bold text-sky-800 transition hover:bg-sky-50"
        >
          مسلّم
        </Link>
        <Link
          href="/admin/orders/archived"
          className="rounded-full border border-violet-300 bg-violet-50 px-3 py-1.5 text-sm font-bold text-violet-900 transition hover:bg-violet-100"
        >
          المؤرشفة
        </Link>
        <Link
          href={hrefTracking({ status: "checkSader" })}
          className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-sm font-bold text-emerald-900 transition hover:bg-emerald-100"
        >
          فحص الصادر
        </Link>
        <Link
          href={hrefTracking({ status: "checkWard" })}
          className="rounded-full border border-red-200 bg-red-50 px-3 py-1.5 text-sm font-bold text-red-900 transition hover:bg-red-100"
        >
          فحص الوارد
        </Link>
        <Link
          href={hrefTracking({ status: "cancelled" })}
          className="rounded-full border-2 border-red-600 bg-red-50 px-3 py-1.5 text-sm font-bold text-red-800 transition hover:bg-red-100"
        >
          الطلبات المرفوضة
        </Link>
      </div>

      {rows.length === 0 ? (
        <div className={`${ad.section} border-dashed border-sky-300`}>
          <p className="text-center text-slate-600">
            لا توجد طلبات في الانتظار. يُرسل{" "}
            <strong className="text-sky-900">رابط إدخال الطلب للعميل</strong> من{" "}
            <Link href="/admin/shops" className={ad.link}>
              المحلات → موظفو المحل
            </Link>
            .
          </p>
        </div>
      ) : (
        <PendingOrdersClient
          orders={rows}
          couriers={couriers}
          initialAssignOrderId={
            assignOrder && rows.some((r) => r.id === assignOrder)
              ? assignOrder
              : null
          }
        />
      )}
      <p className={ad.orderListCountFooter}>
        عدد الطلبات في هذه الصفحة:{" "}
        <span className="font-bold text-sky-900">{rows.length}</span>
      </p>
    </div>
  );
}
