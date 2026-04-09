import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { AdminPreparationClient } from "./admin-preparation-client";

export const dynamic = "force-dynamic";

export default async function AdminNewPreparationDraftPage() {
  const companyPreparers = await prisma.companyPreparer.findMany({
    orderBy: { name: "asc" },
    select: { id: true, name: true, active: true, availableForAssignment: true },
  });

  const preparersList = companyPreparers.map((p) => ({
    id: p.id,
    name: p.name,
    available: p.active && p.availableForAssignment,
  }));

  return (
    <div className="space-y-4" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/preparation-orders" className={ad.link}>
          ← تجهيز الطلبات
        </Link>
      </p>

      <div>
        <h1 className={ad.h1}>إنشاء مسودة تجهيز طلبات متعددة</h1>
        <p className={`mt-1 ${ad.lead}`}>
          قم بلصق الطلب ليتم تحليله وإرساله كمسودة إلى خانة تجهيز الطلبات الخاصة بالمجهزين.
        </p>
      </div>

      <div className="mx-auto max-w-4xl pt-4">
        <AdminPreparationClient preparers={preparersList} />
      </div>
    </div>
  );
}
