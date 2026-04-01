import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin-session";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { StoreOrderStatusActions } from "./ui";

export const metadata = {
  title: "طلبات المتجر — لوحة الإدارة",
};

export default async function AdminStoreOrdersPage() {
  if (!(await isAdminSession())) redirect("/admin/login");

  const orders = await prisma.storeOrder.findMany({
    orderBy: { createdAt: "desc" },
    include: { items: true },
    take: 150,
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={ad.h1}>طلبات المتجر</h1>
          <p className={`mt-1 ${ad.muted}`}>طلبات ضيوف بدون حساب.</p>
        </div>
        <Link href="/admin/store" className={ad.link}>
          ← المتجر
        </Link>
      </div>

      <section className={ad.section}>
        {orders.length === 0 ? (
          <p className={ad.muted}>لا يوجد طلبات بعد.</p>
        ) : (
          <div className={ad.listDivide}>
            {orders.map((o) => (
              <div key={o.id} className="py-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-bold text-slate-800">
                      طلب #{o.orderNumber} ·{" "}
                      <span className="text-sky-800">{o.status}</span>
                    </div>
                    <div className={`mt-1 ${ad.listMuted}`}>
                      {o.customerName ? `${o.customerName} · ` : ""}
                      {o.customerPhone}
                      {o.addressText ? ` · ${o.addressText}` : ""}
                    </div>
                    <div className={`mt-1 ${ad.listMuted}`}>
                      إجمالي: {formatDinarAsAlfWithUnit(o.totalSaleDinar)} · ربح:{" "}
                      {formatDinarAsAlfWithUnit(o.profitDinar)} · عناصر: {o.items.length}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className="text-xs text-slate-500 font-mono">{o.id}</div>
                    <StoreOrderStatusActions id={o.id} current={o.status} />
                  </div>
                </div>

                {o.items.length > 0 ? (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    {o.items.map((it) => (
                      <div key={it.id} className="rounded-xl border border-sky-100 bg-white p-3">
                        <div className="text-sm font-semibold text-slate-800">
                          {it.productName}
                        </div>
                        <div className="mt-1 text-xs text-slate-500">
                          {it.variantLabel ? `(${it.variantLabel}) ` : ""}
                          × {it.quantity}
                        </div>
                        <div className="mt-1 text-sm text-slate-700">
                          {formatDinarAsAlfWithUnit(it.lineSaleDinar)} · ربح:{" "}
                          {formatDinarAsAlfWithUnit(it.lineProfitDinar)}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

