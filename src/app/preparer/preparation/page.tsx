import Link from "next/link";
import { verifyCompanyPreparerPortalQuery } from "@/lib/company-preparer-portal-link";
import { preparerCourierAssignWhere } from "@/lib/courier-assignable";
import { ALF_PER_DINAR } from "@/lib/money-alf";
import { preparerPath } from "@/lib/preparer-portal-nav";
import type { PreparerPrepQuickFilter } from "@/lib/preparer-portal-order-table-data";
import { loadPreparerPortalOrderTableData } from "@/lib/preparer-portal-order-table-data";
import { prisma } from "@/lib/prisma";
import { PreparerOrdersSection } from "../preparer-orders-client";
import { PreparerSiteOrderDraftClient } from "./preparer-site-order-draft-client";
import { whatsappMeUrl } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ p?: string; exp?: string; s?: string; pref?: string; q?: string }>;
};

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

export default async function PreparerPreparationPage({ searchParams }: Props) {
  const sp = await searchParams;
  const v = verifyCompanyPreparerPortalQuery(sp.p, sp.exp, sp.s);

  if (!v.ok) return <div className="p-8 text-center font-bold">الرابط غير صالح.</div>;

  const preparer = await prisma.companyPreparer.findFirst({
    where: { id: v.preparerId, active: true },
    include: { shopLinks: { where: { canSubmitOrders: true }, include: { shop: { include: { region: true } } } } },
  });

  if (!preparer) return <div className="p-8 text-center font-bold">الحساب غير متاح.</div>;

  const auth = { p: sp.p ?? "", exp: sp.exp ?? "", s: sp.s ?? "" };
  const homeHref = preparerPath("/preparer", auth);
  const shopIds = preparer.shopLinks.map((l) => l.shopId);

  const [couriers, orderTable] = await Promise.all([
    prisma.courier.findMany({ where: preparerCourierAssignWhere, select: { id: true, name: true } }),
    loadPreparerPortalOrderTableData({
      preparerId: preparer.id, shopIds, orderListResetAt: preparer.orderListResetAt,
      tab: "all", wardFilter: "lower", saderFilter: "lower", prepFilter: null, onlySubmittedByThisPreparer: true,
    }),
  ]);

  const drafts = await prisma.companyPreparerShoppingDraft.findMany({
    where: { preparerId: preparer.id, status: { in: ["draft", "priced"] } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return (
    <div className="kse-app-inner mx-auto max-w-6xl px-3 py-4 pb-24 sm:px-4">
      <div className="mb-4 flex flex-wrap gap-2">
        <Link href={homeHref} className="inline-flex items-center justify-center rounded-xl border border-sky-300 bg-sky-50 px-4 py-2 text-sm font-bold text-sky-900 shadow-sm transition hover:bg-sky-100">
          ← الطلبات
        </Link>
        <Link href={preparerPath("/preparer/order/new", auth)} className="inline-flex items-center justify-center rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-bold text-emerald-900 shadow-sm transition hover:bg-emerald-100">
          ➕ طلب يدوي
        </Link>
      </div>

      <section className="kse-glass-dark mb-4 rounded-2xl border border-violet-200/80 p-4 shadow-sm">
        <h2 className="text-base font-black text-violet-950">خانة طلبات التجهيز</h2>
        {drafts.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">لا توجد مسودات حالياً.</p>
        ) : (
          <div className="mt-3 space-y-2">
            {drafts.map((d) => (
              <div key={d.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white p-3">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-black text-slate-900">{d.titleLine || "—"}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <p className="text-xs text-slate-500 font-mono" dir="ltr">
                      {(d.customerPhone || "—").trim()}
                    </p>
                    {d.customerPhone && (
                      <a
                        href={whatsappMeUrl(d.customerPhone)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-white shadow-sm hover:bg-emerald-600"
                        title="تواصل مع الزبون"
                      >
                        <WhatsAppIcon className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </div>
                </div>
                <Link href={preparerPath(`/preparer/preparation/draft/${d.id}`, auth)} className="rounded-xl bg-violet-600 px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-violet-700">
                  فتح / تسعير
                </Link>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="mx-auto max-w-lg">
        <PreparerSiteOrderDraftClient auth={auth} preparerName={preparer.name} homeHref={homeHref} />
      </div>

      <section className="kse-glass-dark mt-8 overflow-hidden border border-sky-200 shadow-sm">
        <div className="p-3 border-b border-sky-100">
           <h3 className="text-sm font-bold text-sky-900">الطلبات المرفوعة</h3>
        </div>
        <PreparerOrdersSection allRows={orderTable.rows} searchFields={orderTable.searchFields} auth={auth} tab="all" initialQuery={sp.q || ""} couriersForBulkAssign={couriers} />
      </section>
    </div>
  );
}
