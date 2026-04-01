import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { prisma } from "@/lib/prisma";
import { AdminCreateOrderForm } from "./admin-create-order-form";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "إضافة طلب من الإدارة — أبو الأكبر للتوصيل",
};

export default async function AdminCreateOrderPage() {
  // جلب المحلات، المناطق، الزبائن (للملء التلقائي)، والموظفين (كأزرار سريعة)
  const [shops, regions, customers, employees] = await Promise.all([
    prisma.shop.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, regionId: true, locationUrl: true },
    }),
    prisma.region.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.customer.findMany({
      select: {
        id: true,
        shopId: true,
        name: true,
        phone: true,
        customerRegionId: true,
        customerLocationUrl: true,
        customerLandmark: true,
        customerDoorPhotoUrl: true,
      },
      take: 50000,
    }),
    prisma.employee.findMany({
      select: {
        id: true,
        shopId: true,
        name: true,
        phone: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  return (
    <div className="space-y-4">
      <p className={ad.muted}>
        <Link href="/admin/orders/pending" className={ad.link}>
          ← الرجوع إلى الطلبات الجديدة
        </Link>
      </p>
      <header className="space-y-1">
        <h1 className={ad.h1}>إضافة طلب من الإدارة</h1>
        <p className={ad.lead}>
          ثلاثة مسارات: <strong>رفع من محل</strong> (بحث عن المحل ثم عميل من المحل أو الإدارة)،{" "}
          <strong>وجهة واحدة إدارية</strong> (وجهة الإدارة برقم ثابت)، أو{" "}
          <strong>وجهتان</strong> (مرسل ومستلم). البحث عن بيانات محفوظة يعتمد على{" "}
          <strong>الرقم + المنطقة</strong>.
        </p>
      </header>
      <AdminCreateOrderForm shops={shops} regions={regions} customers={customers} employees={employees} />
    </div>
  );
}
