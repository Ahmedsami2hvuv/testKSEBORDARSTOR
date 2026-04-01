"use client";

import Link from "next/link";
import {
  adminSidebarTiles,
  tileHref,
  type AdminTile,
} from "@/lib/admin-nav";

function HubMenuButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("kse:open-admin-nav"))}
      className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-sky-300 bg-white text-sky-800 shadow-sm transition hover:border-sky-400 hover:bg-sky-50"
      aria-label="فتح القائمة"
    >
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
      </svg>
    </button>
  );
}

function HubCard({ t }: { t: AdminTile }) {
  return (
    <Link
      href={tileHref(t)}
      className="kse-glass-card group flex items-center justify-between gap-3 px-4 py-3.5 transition hover:border-sky-400 hover:shadow-md hover:shadow-sky-200/60"
    >
      <span className="text-2xl" aria-hidden>
        {t.emoji}
      </span>
      <span className="min-w-0 flex-1 text-sm font-bold leading-snug text-slate-800 sm:text-[15px]">
        {t.label}
      </span>
      <span
        className="shrink-0 text-sky-600 transition group-hover:text-emerald-600"
        aria-hidden
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
      </span>
    </Link>
  );
}

export function AdminHubDashboard() {
  const allNavTiles: AdminTile[] = adminSidebarTiles();

  return (
    <div className="relative overflow-hidden">
      <div
        className="pointer-events-none absolute -end-16 -top-10 h-48 w-48 rounded-full bg-sky-200/40 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -bottom-12 -start-10 h-44 w-44 rounded-full bg-emerald-200/35 blur-3xl"
        aria-hidden
      />

      <header className="relative z-[1] mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div className="flex w-full items-start gap-3">
          <HubMenuButton />
          <div className="min-w-0 flex-1 text-right">
            <p className="text-xs font-bold text-emerald-800">أبو الأكبر للتوصيل</p>
            <h1 className="mt-1 bg-gradient-to-l from-sky-700 via-cyan-600 to-emerald-600 bg-clip-text text-2xl font-extrabold text-transparent sm:text-3xl">
              لوحة الرئيسية
            </h1>
          </div>
        </div>
      </header>

      <nav
        className="relative z-[1] mx-auto grid w-full max-w-6xl grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3 xl:gap-5"
        aria-label="أقسام لوحة الإدارة"
      >
        <div className="flex flex-col gap-3 md:col-span-2 xl:col-span-3">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {allNavTiles.map((t) => (
              <HubCard key={t.slug} t={t} />
            ))}
          </div>
        </div>
      </nav>
    </div>
  );
}
