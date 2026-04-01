import Link from "next/link";
import { ad } from "@/lib/admin-ui";

export const metadata = {
  title: "التقارير — أبو الأكبر للتوصيل",
};

const REPORT_LINKS = [
  {
    href: "/admin/reports/accounting",
    title: "ربط المحاسبة",
    desc: "ملخص الطلبات المسلّمة وعلامات التحصيل (المحل، الزبون، المندوب) لمراجعة المحاسبة.",
    emoji: "📒",
  },
  {
    href: "/admin/reports/general",
    title: "تقرير عام",
    desc: "معاملات المحافظ: نقد الطلبات، أخذت/أعطيت، تحويلات — مع اختيار التاريخ وصاحب المعاملة (مندوب، موظف، مجهز).",
    emoji: "📋",
  },
  {
    href: "/admin/reports/orders",
    title: "تقرير الطلبات",
    desc: "كل الطلبات في نطاق زمني (جدول الطلبات السابق) — رقم الطلب، المحل، المندوب، نوع المعاملة.",
    emoji: "🧾",
  },
  {
    href: "/admin/reports/wallet-ledger",
    title: "مستودع معاملات المحافظ",
    desc: "عرض كل المعاملات بين تاريخين (من يوم إلى يوم) مع اختيار صاحب المعاملة، ومسح السجل عند الحاجة.",
    emoji: "🗄️",
  },
  {
    href: "/admin/reports/preparation",
    title: "تقرير التجهيز",
    desc: "تفاصيل فواتير التجهيز المكتملة: المنطقة، البيع/الشراء، ربح كل منتج، ربح الطلب، وتجميع الأرباح اليومية والشهرية.",
    emoji: "🛒",
  },
  {
    href: "/admin/reports/preparers",
    title: "طلبات موظفي المحل",
    desc: "طلبات مرفوعة من موظفي المحلات عبر رابط المحل — تصفية بموظف أو فترة.",
    emoji: "🏪",
  },
  {
    href: "/admin/reports/couriers",
    title: "تقرير المندوبين",
    desc: "ملخص لكل مندوب نشط: وارد وصادر وعدد الطلبات والتوصيل وربح التوصيل — باختيار من يوم إلى يوم.",
    emoji: "🏍️",
  },
  {
    href: "/admin/reports/courier-mandoub",
    title: "لوحة المندوب (منذ التصفير)",
    desc: "نفس أرقام لوحة المندوب لكل مندوب منذ آخر تصفير من الإعدادات — بدون اختيار تاريخ؛ مع ملخص إضافي وربط بتصفير الفترة.",
    emoji: "📱",
  },
  {
    href: "/admin/reports/shops",
    title: "تقرير المحلات",
    desc: "طلبات حسب المحل مع تصفية بمحل معيّن.",
    emoji: "🏪",
  },
];

export default function ReportsHubPage() {
  return (
    <div className="space-y-6" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin" className={ad.link}>
          ← الرئيسية
        </Link>
      </p>
      <div>
        <h1 className={ad.h1}>التقارير</h1>
        <p className={`mt-1 ${ad.lead}`}>
          اختر نوع التقرير. تقارير الطلبات تعرض تفاصيل الطلبية؛ التقرير العام هنا يعني{" "}
          <strong className="text-sky-900">معاملات المحافظ</strong> مع تصفية بالتاريخ والشخص.
        </p>
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {REPORT_LINKS.map((r) => (
          <li key={r.href}>
            <Link
              href={r.href}
              className={`flex h-full flex-col gap-2 rounded-2xl border border-sky-200 bg-white p-5 shadow-sm transition hover:border-sky-400 hover:shadow-md`}
            >
              <span className="text-3xl" aria-hidden>
                {r.emoji}
              </span>
              <span className="text-lg font-bold text-sky-900">{r.title}</span>
              <span className="text-sm leading-relaxed text-slate-600">{r.desc}</span>
              <span className="mt-auto pt-2 text-sm font-semibold text-emerald-700">فتح التقرير ←</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
