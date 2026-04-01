import Link from "next/link";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { formatBaghdadDateLabel } from "@/lib/baghdad-archived-day";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "الطلبات المؤرشفة — أبو الأكبر للتوصيل",
};

export default async function ArchivedOrdersIndexPage() {
  const rows = await prisma.$queryRaw<Array<{ day: string; cnt: bigint }>>(
    Prisma.sql`
      SELECT
        to_char(
          (o."archivedAt" AT TIME ZONE 'UTC' AT TIME ZONE 'Asia/Baghdad')::date,
          'YYYY-MM-DD'
        ) AS day,
        COUNT(*)::bigint AS cnt
      FROM "Order" o
      WHERE o.status = 'archived'
        AND o."archivedAt" IS NOT NULL
      GROUP BY 1
      ORDER BY 1 DESC
    `,
  );

  return (
    <div className="space-y-4" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>
          ← الرئيسية
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href="/admin/orders/tracking" className={ad.link}>
          تتبع الطلبات
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>الطلبات المؤرشفة</h1>
        <p className={`mt-1 ${ad.lead}`}>
          الطلبات المؤرشفة تُجمَّع هنا حسب <strong className="text-sky-900">يوم الأرشفة</strong> (توقيت بغداد)،
          وتظهر ضمن نتائج «البحث الخارق» حتى بدون اختيار حالة «مؤرشف».
        </p>
      </div>

      {rows.length === 0 ? (
        <div className={`${ad.section} border-dashed border-violet-200 bg-violet-50/40`}>
          <p className="text-center text-slate-600">لا توجد طلبات مؤرشفة بعد.</p>
        </div>
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((r) => {
            const day = r.day;
            const cnt = Number(r.cnt);
            return (
              <li key={day}>
                <Link
                  href={`/admin/orders/archived/${encodeURIComponent(day)}`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-violet-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-800 shadow-sm transition hover:border-violet-400 hover:bg-violet-50/80"
                >
                  <span className="min-w-0 text-right leading-snug">{formatBaghdadDateLabel(day)}</span>
                  <span className="shrink-0 rounded-full bg-violet-100 px-2.5 py-1 text-xs font-extrabold text-violet-900 tabular-nums">
                    {cnt}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
