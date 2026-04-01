"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "./actions";
import { AdminLiveSearchInput } from "./live-search-input";
import { adminSidebarTiles, tileHref } from "@/lib/admin-nav";

function navItemActive(pathname: string, href: string): boolean {
  const base = href.split("#")[0] ?? href;
  if (base === "/admin") return pathname === "/admin";
  return pathname === base || pathname.startsWith(`${base}/`);
}

export function AdminShell({
  children,
  pendingInitialCount = 0,
}: {
  children: React.ReactNode;
  pendingInitialCount?: number;
}) {
  const [navOpen, setNavOpen] = useState(false);
  const [pendingCount, setPendingCount] = useState(pendingInitialCount);
  const pathname = usePathname() ?? "";

  useEffect(() => {
    document.body.style.overflow = navOpen ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [navOpen]);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const close = () => {
      if (mq.matches) setNavOpen(false);
    };
    mq.addEventListener("change", close);
    return () => mq.removeEventListener("change", close);
  }, []);

  useEffect(() => {
    const open = () => setNavOpen(true);
    window.addEventListener("kse:open-admin-nav", open);
    return () => window.removeEventListener("kse:open-admin-nav", open);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const POLL_MS = 8000;
    async function poll() {
      try {
        const res = await fetch("/api/notifications/admin-pending", {
          cache: "no-store",
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = (await res.json()) as { pendingCount?: number };
        if (cancelled) return;
        if (typeof data.pendingCount === "number" && Number.isFinite(data.pendingCount)) {
          setPendingCount(Math.max(0, data.pendingCount));
        }
      } catch {
        // ignore transient network errors
      }
    }
    void poll();
    const id = window.setInterval(() => {
      void poll();
    }, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const NavLinks = ({ onNavigate }: { onNavigate?: () => void }) => (
    <>
      <Link
        href="/admin"
        onClick={onNavigate}
        className={
          navItemActive(pathname, "/admin")
            ? "flex items-center gap-3 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-sm text-sky-950 shadow-sm"
            : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-emerald-50/80 hover:text-emerald-900"
        }
      >
        <span
          className={
            navItemActive(pathname, "/admin")
              ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-400 bg-white text-lg shadow-sm"
              : "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-white text-lg"
          }
          aria-hidden
        >
          🏠
        </span>
        <span className="leading-snug font-medium">لوحة الرئيسية</span>
      </Link>
      <p className="mt-5 px-3 text-[11px] font-bold tracking-wider text-emerald-700/90">
        الأقسام
      </p>
      <div className="mt-2 flex flex-col gap-1">
        {adminSidebarTiles().map((tile) => {
          const href = tileHref(tile);
          const active = navItemActive(pathname, href);
          const isNewOrdersTab = tile.slug === "new-orders";
          const showPendingBadge = isNewOrdersTab && pendingCount > 0;
          return (
            <Link
              key={tile.slug}
              href={href}
              onClick={onNavigate}
              className={
                active
                  ? "flex items-center gap-3 rounded-xl border border-sky-300 bg-sky-50 px-3 py-2.5 text-sm text-sky-950 shadow-sm"
                  : "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-slate-700 transition hover:bg-emerald-50/80 hover:text-emerald-900"
              }
            >
              <span
                className={
                  active
                    ? "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-400 bg-white text-lg shadow-sm"
                    : "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-sky-200 bg-white text-lg"
                }
              >
                {tile.emoji}
                {showPendingBadge ? (
                  <span className="absolute -top-2 -right-2 inline-flex min-w-[1.2rem] items-center justify-center rounded-full bg-rose-600 px-1.5 py-0.5 text-[10px] font-black leading-none text-white shadow">
                    {pendingCount > 99 ? "99+" : pendingCount}
                  </span>
                ) : null}
              </span>
              <span className="leading-snug font-medium">{tile.label}</span>
            </Link>
          );
        })}
      </div>
    </>
  );

  return (
    <div className="kse-app-bg min-h-screen lg:flex">
      <button
        type="button"
        aria-expanded={navOpen}
        aria-controls="admin-drawer"
        onClick={() => setNavOpen((o) => !o)}
        className="fixed end-4 top-4 z-[110] flex h-12 w-12 items-center justify-center rounded-2xl border border-sky-300 bg-white text-sky-800 shadow-md lg:hidden"
      >
        <span className="sr-only">القائمة</span>
        {navOpen ? (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        )}
      </button>

      <button
        type="button"
        aria-hidden
        tabIndex={-1}
        className={`fixed inset-0 z-[90] bg-slate-900/30 backdrop-blur-[2px] transition-opacity duration-200 lg:hidden ${
          navOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={() => setNavOpen(false)}
      />

      <aside
        id="admin-drawer"
        className={`fixed inset-y-0 start-0 z-[100] flex w-[min(19rem,90vw)] flex-col border-e border-sky-200 bg-gradient-to-b from-white via-sky-50/90 to-emerald-50/50 shadow-lg shadow-sky-200/40 backdrop-blur-sm transition-transform duration-200 ease-out lg:static lg:z-0 lg:w-[17.5rem] lg:shrink-0 lg:translate-x-0 ${
          navOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        <div className="border-b border-sky-200 bg-white/80 px-4 py-6">
          <p className="bg-gradient-to-r from-sky-700 via-cyan-600 to-emerald-600 bg-clip-text text-lg font-extrabold tracking-tight text-transparent">
            أبو الأكبر للتوصيل
          </p>
          <p className="mt-1 text-xs font-semibold text-emerald-800/90">لوحة الإدارة</p>
        </div>
        <nav className="flex flex-1 flex-col overflow-y-auto px-2 py-4">
          <NavLinks onNavigate={() => setNavOpen(false)} />
        </nav>
        <div className="border-t border-sky-200 bg-white/70 p-3">
          <form action={logout}>
            <button
              type="submit"
              className="w-full rounded-xl px-3 py-3 text-start text-sm font-medium text-rose-600 transition hover:bg-rose-50"
            >
              خروج
            </button>
          </form>
        </div>
      </aside>

      <div className="kse-app-inner relative min-h-screen min-w-0 flex-1">
        <main className="min-h-screen w-full px-1 pb-10 pt-[4.25rem] sm:px-3 lg:px-6 lg:pb-12 lg:pt-10">
          <div className="mx-auto w-full max-w-6xl">
            <div className="rounded-none border-0 bg-white/95 p-2 shadow-none ring-0 sm:rounded-xl sm:border sm:border-sky-100/80 sm:p-4 sm:shadow-sm lg:p-6">
              <div className="mb-4">
                <div className="flex flex-wrap gap-2">
                  <AdminLiveSearchInput
                    id="admin-super-search-header"
                    ariaLabel="البحث"
                    placeholder="ابحث بأي شيء: كسر، كيك، رقم طلب، تقرير، وارد، صادر، وجهتين..."
                    className="min-w-[220px] flex-1 rounded-xl border border-sky-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                  />
                </div>
              </div>
              {children}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
