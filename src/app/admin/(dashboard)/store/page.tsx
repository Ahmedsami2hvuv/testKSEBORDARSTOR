import Link from "next/link";
import { redirect } from "next/navigation";
import { isAdminSession } from "@/lib/admin-session";
import { ad } from "@/lib/admin-ui";

export const metadata = {
  title: "المتجر — لوحة الإدارة",
};

type Tab = "categories" | "branches" | "products" | "orders" | "employees";

const allowedTabs: Tab[] = ["categories", "branches", "products", "orders", "employees"];

function getActiveTab(raw: unknown): Tab {
  const t = String(raw ?? "");
  return (allowedTabs as string[]).includes(t) ? (t as Tab) : "categories";
}

export default async function AdminStoreHomePage({
  searchParams,
}: {
  searchParams?: { tab?: string };
}) {
  if (!(await isAdminSession())) redirect("/admin/login");

  const ksebstorPublicBase = "https://ksebstor-production.up.railway.app";
  const ksebstorAdminBase = "https://ksebstor-production.up.railway.app/admin";
  const activeTab = getActiveTab(searchParams?.tab);
  const activeHref = `${ksebstorAdminBase}?tab=${encodeURIComponent(activeTab)}`;

  return (
    <div className="space-y-6">
      <div className={ad.section}>
        <h1 className={ad.h1}>المتجر</h1>
        <p className={`mt-2 ${ad.lead}`}>
          المتجر للزبائن له رابط مستقل، وإدارة المتجر لها رابط مستقل أيضاً.
        </p>
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-extrabold text-slate-900">رابط المتجر (للزبائن)</p>
            <p className="mt-1 text-xs text-slate-500">يفتح المتجر العام خارج لوحة الإدارة</p>
          </div>
          <a
            href={ksebstorPublicBase}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-bold text-white"
          >
            فتح المتجر بصفحة كاملة
          </a>
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-700">{ksebstorPublicBase}</div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {allowedTabs.map((t) => {
          const label =
            t === "categories"
              ? "الأقسام"
              : t === "branches"
                ? "الأفرع"
                : t === "products"
                  ? "المنتجات"
                  : t === "orders"
                    ? "الطلبات"
                    : "الموظفين";
          const isActive = t === activeTab;
          return (
            <Link
              key={t}
              href={`/admin/store?tab=${encodeURIComponent(t)}`}
              className={
                isActive
                  ? "rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white"
                  : "rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800"
              }
            >
              {label}
            </Link>
          );
        })}
      </div>

      <div className="rounded-2xl border bg-white p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-extrabold text-slate-900">إدارة المتجر (صفحة كاملة)</p>
          <a
            href={activeHref}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white"
          >
            فتح القسم الحالي بصفحة كاملة
          </a>
        </div>
        <div className="mt-3 rounded-xl bg-slate-50 p-3 font-mono text-xs text-slate-700">{ksebstorAdminBase}</div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {allowedTabs.map((t) => {
            const label =
              t === "categories"
                ? "الأقسام"
                : t === "branches"
                  ? "الأفرع"
                  : t === "products"
                    ? "المنتجات"
                    : t === "orders"
                      ? "الطلبات"
                      : "الموظفين";
            const href = `${ksebstorAdminBase}?tab=${encodeURIComponent(t)}`;
            return (
              <a
                key={t}
                href={href}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border bg-slate-50 p-4 hover:bg-white"
              >
                <p className="text-sm font-extrabold text-slate-900">{label}</p>
                <p className="mt-1 text-xs text-slate-500">يفتح بصفحة كاملة</p>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}

