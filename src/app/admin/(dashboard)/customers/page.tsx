import Link from "next/link";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import type { CustomerPhoneRowUi } from "./customer-phone-rows";
import { CustomersPageClient } from "./customers-page-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "بيانات الزبائن — أبو الأكبر للتوصيل",
};

export default async function AdminCustomersPage() {
  const [groups, ordersRaw, regions, profiles] = await Promise.all([
    prisma.order.groupBy({
      by: ["customerPhone"],
      where: { customerPhone: { not: "" } },
      _count: { id: true },
    }),
    prisma.order.findMany({
      where: { customerPhone: { not: "" } },
      orderBy: [{ createdAt: "desc" }],
      select: {
        customerPhone: true,
        customerRegionId: true,
        customerLandmark: true,
        customerLocationUrl: true,
        totalAmount: true,
        customerRegion: { select: { name: true } },
      },
    }),
    prisma.region.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.customerPhoneProfile.findMany({
      orderBy: { updatedAt: "desc" },
      include: { region: { select: { id: true, name: true } } },
    }),
  ]);

  const rows = [...groups].sort((a, b) => b._count.id - a._count.id);
  const regionOptions = regions.map((r) => ({ id: r.id, name: r.name }));
  const regionNameById = new Map(regions.map((r) => [r.id, r.name]));

  const phoneRows = new Map<string, CustomerPhoneRowUi>();
  for (const g of rows) {
    phoneRows.set(g.customerPhone, {
      phone: g.customerPhone,
      totalOrders: g._count.id,
      totalAmountLabel: "0",
      ordersHref: `/admin/customers/orders?phone=${encodeURIComponent(g.customerPhone)}`,
      regions: [],
    });
  }

  const regionMeta = new Map<
    string,
    {
      name: string;
      locationUrl: string;
      landmark: string;
      orderCount: number;
      totalDinar: number;
      infoHref: string;
    }
  >();
  const totalByPhone = new Map<string, number>();

  function key(phone: string, regionId: string | null): string {
    return `${phone}__${regionId ?? "no-region"}`;
  }
  function regionLabel(regionId: string | null, fallback?: string | null): string {
    if (regionId == null) return "بدون منطقة";
    return (fallback || regionNameById.get(regionId) || "منطقة غير معروفة").trim();
  }
  function infoHref(phone: string, regionId: string | null): string {
    if (regionId == null) {
      return `/admin/customers/info?phone=${encodeURIComponent(phone)}&regionId=no-region`;
    }
    return `/admin/customers/info?phone=${encodeURIComponent(phone)}&regionId=${encodeURIComponent(regionId)}`;
  }

  for (const o of ordersRaw) {
    const k = key(o.customerPhone, o.customerRegionId);
    const prev = regionMeta.get(k);
    const sum = (prev?.totalDinar ?? 0) + Number(o.totalAmount ?? 0);
    regionMeta.set(k, {
      name: regionLabel(o.customerRegionId, o.customerRegion?.name),
      locationUrl: prev?.locationUrl || o.customerLocationUrl?.trim() || "",
      landmark: prev?.landmark || o.customerLandmark?.trim() || "",
      orderCount: (prev?.orderCount ?? 0) + 1,
      totalDinar: sum,
      infoHref: infoHref(o.customerPhone, o.customerRegionId),
    });
    totalByPhone.set(
      o.customerPhone,
      (totalByPhone.get(o.customerPhone) ?? 0) + Number(o.totalAmount ?? 0),
    );
  }

  for (const p of profiles) {
    const normalized = normalizeIraqMobileLocal11(p.phone) ?? p.phone;
    const attachPhone = phoneRows.has(p.phone)
      ? p.phone
      : [...phoneRows.keys()].find(
          (x) => (normalizeIraqMobileLocal11(x) ?? x) === normalized,
        ) || null;
    if (!attachPhone) continue;
    const k = key(attachPhone, p.regionId);
    const prev = regionMeta.get(k);
    regionMeta.set(k, {
      name: p.region.name,
      locationUrl: p.locationUrl?.trim() || prev?.locationUrl || "",
      landmark: p.landmark?.trim() || prev?.landmark || "",
      orderCount: prev?.orderCount ?? 0,
      totalDinar: prev?.totalDinar ?? 0,
      infoHref: infoHref(attachPhone, p.regionId),
    });
  }

  for (const [phone, r] of phoneRows.entries()) {
    r.totalAmountLabel = formatDinarAsAlf(totalByPhone.get(phone) ?? 0);
    r.regions = [...regionMeta.entries()]
      .filter(([k]) => k.startsWith(`${phone}__`))
      .map(([k, v]) => ({
        key: k,
        name: v.name,
        locationUrl: v.locationUrl,
        landmark: v.landmark,
        orderCount: v.orderCount,
        totalLabel: formatDinarAsAlf(v.totalDinar),
        infoHref: v.infoHref,
      }))
      .sort((a, b) => a.name.localeCompare(b.name, "ar"));
  }
  const customerRows = [...phoneRows.values()];
  const profileRows = profiles.map((p) => ({
    id: p.id,
    phone: p.phone,
    regionName: p.region.name,
    locationUrl: p.locationUrl,
    landmark: p.landmark,
    alternatePhone: p.alternatePhone,
    notes: p.notes,
    photoUrl: p.photoUrl,
  }));

  return (
    <div className="space-y-4">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>
          ← الرئيسية
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>بيانات الزبائن</h1>
        <p className={`mt-1 ${ad.lead}`}>
          أرقام هواتف <strong className="text-sky-900">زبائن الطلبات</strong> المسجّلة في
          النظام (من صفحة إدخال الطلب).{" "}
          <strong className="text-sky-800">انقر على الرقم</strong> لعرض{" "}
          <strong className="text-sky-800">معلومات الزبون</strong> (المناطق، المرجعية، ثم
          طلبيات كل منطقة). المندوبون وموظفو المحل
          يُدارون من{" "}
          <Link href="/admin/couriers" className={ad.link}>
            المندوبين
          </Link>{" "}
          ومن صفحة كل محل.
        </p>
        <p className={`mt-3 ${ad.lead}`}>
          صفحة مبسّطة: قائمة الزبائن أولاً، ثم زر إضافة وتفاصيل الزبائن المرجعية
          بنفس الصفحة.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className={`${ad.section} border-dashed border-sky-300`}>
          <p className="text-center text-slate-600">
            لا توجد أرقام زبائن بعد — تظهر هنا بعد إدخال طلبات تحتوي رقم الزبون.
          </p>
        </div>
      ) : (
        <CustomersPageClient
          rows={customerRows}
          regionOptions={regionOptions}
          profiles={profileRows}
        />
      )}
    </div>
  );
}
