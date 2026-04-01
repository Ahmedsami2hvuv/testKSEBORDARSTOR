import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { BranchCreateForm, StockMovementForm } from "./ui";

export const metadata = {
  title: "فروع/مخازن المتجر — لوحة الإدارة",
};

export default async function AdminStoreBranchesPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  const [branches, shops, variants] = await Promise.all([
    prisma.storeBranch.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.shop.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.storeProductVariant.findMany({
      orderBy: [{ createdAt: "desc" }],
      include: { product: { select: { name: true } } },
      take: 300,
    }),
  ]);

  const shopNameById = new Map(shops.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={ad.h1}>فروع/مخازن المتجر</h1>
          <p className={`mt-1 ${ad.muted}`}>تسجيل حركات المخزون لكل متغير.</p>
        </div>
        <Link href="/admin/store" className={ad.link}>
          ← المتجر
        </Link>
      </div>

      <section className={ad.section}>
        <h2 className={ad.h2}>إضافة فرع/مخزن</h2>
        <div className="mt-4">
          <BranchCreateForm shops={shops} />
        </div>
      </section>

      <section className={ad.section}>
        <h2 className={ad.h2}>إضافة حركة مخزون</h2>
        <div className="mt-4">
          <StockMovementForm branches={branches} variants={variants} />
        </div>
      </section>

      <section className={ad.section}>
        <h2 className={ad.h2}>الفروع</h2>
        {branches.length === 0 ? (
          <p className={`mt-3 ${ad.muted}`}>لا يوجد فروع بعد.</p>
        ) : (
          <div className={`mt-3 ${ad.listDivide}`}>
            {branches.map((b) => (
              <div key={b.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <div className={ad.listTitle}>{b.name}</div>
                  <div className={ad.listMuted}>
                    {b.shopId ? (
                      <>
                        مرتبط بـ Shop:{" "}
                        <span className="font-medium">{shopNameById.get(b.shopId) ?? "غير معروف"}</span>
                      </>
                    ) : (
                      "غير مرتبط بـ Shop"
                    )}
                    {" · "}
                    {b.imageUrl ? "لديه صورة" : "بدون صورة"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Link href={`/admin/store/branches/${b.id}/edit`} className={ad.link}>
                    تعديل
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

