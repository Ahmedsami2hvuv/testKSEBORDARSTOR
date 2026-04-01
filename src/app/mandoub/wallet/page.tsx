import Link from "next/link";
import { cookies } from "next/headers";
import type { DelegatePortalVerifyReason } from "@/lib/delegate-link";
import { verifyDelegatePortalQuery } from "@/lib/delegate-link";
import { isCourierPortalBlocked } from "@/lib/courier-delegate-access";
import { formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { Decimal } from "@prisma/client/runtime/library";
import {
  fetchMandoubMoneySumsForCourier,
  fetchOrderOnlyMoneySumsForCourier,
} from "@/lib/mandoub-courier-event-totals";
import { computeMandoubTotalsForCourier } from "@/lib/mandoub-courier-totals";
import {
  computeMandoubAdminTotalAllTimeDinar,
} from "@/lib/mandoub-wallet-carry";
import { mandoubOrderDetailInclude } from "@/lib/mandoub-order-queries";
import { prisma } from "@/lib/prisma";
import {
  LEDGER_KIND_TRANSFER_PENDING_IN,
  LEDGER_KIND_TRANSFER_PENDING_OUT,
  MISC_LEDGER_KIND_GIVE,
  MISC_LEDGER_KIND_TAKE,
  MONEY_KIND_DELIVERY,
  MONEY_KIND_PICKUP,
} from "@/lib/mandoub-money-events";
import {
  fetchWalletInOutDisplayForCourier,
  resolvePartyDisplayName,
  sumPendingOutgoingForCourier,
} from "@/lib/wallet-peer-transfer";
import { filterLedgerByRecentDays } from "@/lib/money-entry-ui";
import {
  MandoubWalletClient,
  type MandoubWalletLedgerLine,
} from "../mandoub-wallet-client";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "المحفظة النقدية — المندوب",
};

function invalidLinkMessage(reason: DelegatePortalVerifyReason): string {
  switch (reason) {
    case "bad_signature":
    case "missing":
      return "الرابط غير صالح أو تالف. تأكد من فتح الرابط الأصلي من الواتساب.";
    case "no_secret":
      return "إعداد الخادم غير مكتمل. تواصل مع الإدارة.";
  }
}

type LedgerFilter = "ward" | "sader" | "site" | "all";

type Props = {
  searchParams: Promise<{ c?: string; exp?: string; s?: string; ledger?: string }>;
};

export default async function MandoubWalletPage({ searchParams }: Props) {
  const sp = await searchParams;
  const cookieStore = await cookies();

  // جلب الهوية من الرابط أو الكوكيز
  const c = sp.c || cookieStore.get("mandoub_c")?.value;
  const s = sp.s || cookieStore.get("mandoub_s")?.value;
  const exp = sp.exp || cookieStore.get("mandoub_exp")?.value;

  const v = verifyDelegatePortalQuery(c, exp, s);

  if (!v.ok) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-700">لا يمكن فتح المحفظة</p>
            <p className="mt-2 text-sm text-slate-600">{invalidLinkMessage(v.reason)}</p>
          </div>
        </div>
      </div>
    );
  }

  if (await isCourierPortalBlocked(v.courierId)) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl border border-rose-300 p-8 text-center">
            <p className="text-lg font-bold text-rose-800">الحساب محظور</p>
          </div>
        </div>
      </div>
    );
  }

  const courier = await prisma.courier.findUnique({
    where: { id: v.courierId },
  });
  if (!courier) {
    return (
      <div dir="rtl" lang="ar" className="kse-app-bg px-4 py-16 text-slate-800">
        <div className="kse-app-inner mx-auto max-w-md">
          <div className="kse-glass-dark rounded-2xl p-8 text-center">
            <p className="text-lg font-bold text-slate-800">لم يُعثر على المندوب</p>
          </div>
        </div>
      </div>
    );
  }

  const baseAuth = { c: c!, exp: exp || "", s: s! };
  const authQuery = new URLSearchParams();
  if (baseAuth.c) authQuery.set("c", baseAuth.c);
  if (baseAuth.exp) authQuery.set("exp", baseAuth.exp);
  if (baseAuth.s) authQuery.set("s", baseAuth.s);

  const ledgerRaw = (sp.ledger ?? "").trim().toLowerCase();
  const ledgerFilter: LedgerFilter =
    ledgerRaw === "ward" || ledgerRaw === "sader" || ledgerRaw === "site"
      ? ledgerRaw
      : "all";

  const walletQuery = new URLSearchParams(authQuery);
  if (ledgerFilter !== "all") walletQuery.set("ledger", ledgerFilter);

  const walletPathWithQuery = `/mandoub/wallet?${walletQuery.toString()}`;
  const hrefMain = `/mandoub?${authQuery.toString()}`;

  function hrefWalletLedger(ledger: LedgerFilter): string {
    const p = new URLSearchParams(authQuery);
    if (ledger !== "all") p.set("ledger", ledger);
    return `/mandoub/wallet?${p.toString()}`;
  }

  const totalsBaseline = courier.mandoubTotalsResetAt;
  const [moneySums, orderOnlySums, walletInOutDisplay] = await Promise.all([
    fetchMandoubMoneySumsForCourier(courier.id, totalsBaseline),
    fetchOrderOnlyMoneySumsForCourier(courier.id, totalsBaseline),
    fetchWalletInOutDisplayForCourier(courier.id, totalsBaseline),
  ]);

  const orders = await prisma.order.findMany({
    where: {
      status: { in: ["assigned", "delivering", "delivered"] },
      OR: [
        { assignedCourierId: courier.id },
        { courierEarningForCourierId: courier.id },
      ],
    },
    include: mandoubOrderDetailInclude,
    orderBy: { createdAt: "desc" },
  });
  const ordersNorm = orders.map((o) => ({
    ...o,
    moneyEvents: o.moneyEvents.map((e) => ({
      ...e,
      courierId: e.courierId ?? undefined,
    })),
  }));
  const orderMetrics = computeMandoubTotalsForCourier(ordersNorm, courier.id, totalsBaseline);

  const siteRemainingNet = orderOnlySums.remainingNet;
  const { sumEarnings } = orderMetrics;

  const rawMisc = await prisma.courierWalletMiscEntry.findMany({
    where: {
      courierId: courier.id,
    },
    orderBy: { createdAt: "desc" },
  });

  const orderLines: MandoubWalletLedgerLine[] = [];
  for (const o of ordersNorm) {
    for (const ev of o.moneyEvents) {
      if (ev.courierId !== courier.id) continue;
      orderLines.push({
        source: "order",
        id: ev.id,
        kind: ev.kind,
        amountDinar: Number(ev.amountDinar),
        createdAt: ev.createdAt.toISOString(),
        orderId: o.id,
        orderNumber: o.orderNumber,
        shopName: o.shop.name,
        regionName: o.customerRegion?.name || undefined,
        orderNotes: o.summary,
        miscLabel: null,
        deletedAt: ev.deletedAt ? ev.deletedAt.toISOString() : null,
        deletedReason: ev.deletedReason,
        deletedByDisplayName: ev.deletedByDisplayName,
        expectedDinar: ev.expectedDinar ? Number(ev.expectedDinar) : null,
        matchesExpected: ev.matchesExpected,
      });
    }
  }

  const miscLines: MandoubWalletLedgerLine[] = rawMisc.map((e) => ({
    source: "misc",
    id: e.id,
    kind: e.direction === "take" ? MISC_LEDGER_KIND_TAKE : MISC_LEDGER_KIND_GIVE,
    amountDinar: Number(e.amountDinar),
    createdAt: e.createdAt.toISOString(),
    orderId: "",
    orderNumber: 0,
    shopName: "",
    miscLabel: e.label.trim() || "—",
    deletedAt: e.deletedAt ? e.deletedAt.toISOString() : null,
    deletedReason: e.deletedReason,
    deletedByDisplayName: e.deletedByDisplayName,
  }));

  const [
    pendingTransferRows,
    transferTargetCouriers,
    companyPreparers,
    adminTotalAllTime,
    pendingOutgoingSum,
  ] = await Promise.all([
    prisma.walletPeerTransfer.findMany({
      where: {
        status: "pending",
        OR: [{ fromCourierId: courier.id }, { toCourierId: courier.id }],
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.courier.findMany({
      where: { id: { not: courier.id }, blocked: false },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // جلب المجهزين الفعليين (CompanyPreparer) فقط
    prisma.companyPreparer.findMany({
      where: { active: true, walletEmployeeId: { not: null } },
      select: {
        name: true,
        phone: true,
        walletEmployeeId: true
      },
      orderBy: { name: "asc" },
    }),
    computeMandoubAdminTotalAllTimeDinar(courier.id),
    sumPendingOutgoingForCourier(courier.id),
  ]);

  const carryOver = courier.mandoubWalletCarryOverDinar ?? new Decimal(0);
  const walletRemain = moneySums.remainingNet.plus(carryOver);
  const handToAdmin = adminTotalAllTime;

  const pendingIncomingForUi = await Promise.all(
    pendingTransferRows
      .filter((t) => t.toCourierId === courier.id)
      .map(async (t) => ({
        id: t.id,
        amountDinar: Number(t.amountDinar),
        fromLabel: await resolvePartyDisplayName(
          t.fromKind,
          t.fromCourierId,
          t.fromEmployeeId,
        ),
        handoverLocation: t.handoverLocation.trim() || "—",
        createdAt: t.createdAt.toISOString(),
      })),
  );

  const transferOutLines: MandoubWalletLedgerLine[] = await Promise.all(
    pendingTransferRows
      .filter((t) => t.fromCourierId === courier.id)
      .map(async (t) => {
        const toLabel = await resolvePartyDisplayName(
          t.toKind,
          t.toCourierId,
          t.toEmployeeId,
        );
        const loc = t.handoverLocation.trim() || "—";
        return {
          source: "transfer_pending" as const,
          id: t.id,
          kind: LEDGER_KIND_TRANSFER_PENDING_OUT,
          amountDinar: Number(t.amountDinar),
          createdAt: t.createdAt.toISOString(),
          orderId: "",
          orderNumber: 0,
          shopName: "",
          miscLabel: `تحويل بانتظار موافقة ${toLabel} — مكان التسليم: ${loc}`,
          deletedAt: null,
          deletedReason: null,
          deletedByDisplayName: null,
        };
      }),
  );

  const transferInLines: MandoubWalletLedgerLine[] = await Promise.all(
    pendingTransferRows
      .filter((t) => t.toCourierId === courier.id)
      .map(async (t) => {
        const fromLabel = await resolvePartyDisplayName(
          t.fromKind,
          t.fromCourierId,
          t.fromEmployeeId,
        );
        const loc = t.handoverLocation.trim() || "—";
        return {
          source: "transfer_pending" as const,
          id: t.id,
          kind: LEDGER_KIND_TRANSFER_PENDING_IN,
          amountDinar: Number(t.amountDinar),
          createdAt: t.createdAt.toISOString(),
          orderId: "",
          orderNumber: 0,
          shopName: "",
          miscLabel: `تحويل بانتظار موافقتك من ${fromLabel} — مكان التسليم: ${loc}`,
          deletedAt: null,
          deletedReason: null,
          deletedByDisplayName: null,
        };
      }),
  );

  const pendingOutgoingCount = transferOutLines.length;
  const availableForTransfer = walletRemain.minus(pendingOutgoingSum);

  const mergedLedger = [
    ...orderLines,
    ...miscLines,
    ...transferOutLines,
    ...transferInLines,
  ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const ledgerFiltered: MandoubWalletLedgerLine[] =
    ledgerFilter === "ward"
      ? mergedLedger.filter(
          (l) =>
            l.kind === MISC_LEDGER_KIND_TAKE || l.kind === LEDGER_KIND_TRANSFER_PENDING_IN || l.kind === MONEY_KIND_DELIVERY,
        )
      : ledgerFilter === "sader"
        ? mergedLedger.filter(
            (l) =>
              l.kind === MISC_LEDGER_KIND_GIVE || l.kind === LEDGER_KIND_TRANSFER_PENDING_OUT || l.kind === MONEY_KIND_PICKUP,
          )
        : ledgerFilter === "site"
          ? mergedLedger.filter(
              (l) => l.kind === MONEY_KIND_DELIVERY || l.kind === MONEY_KIND_PICKUP,
            )
          : mergedLedger;

  const ledger = filterLedgerByRecentDays(ledgerFiltered);

  return (
    <div dir="rtl" lang="ar" className="kse-app-bg min-h-screen text-base leading-relaxed text-slate-800">
      <div className="kse-app-inner mx-auto max-w-3xl px-3 py-4 pb-24 sm:px-4">
        <header className="kse-glass-dark mb-4 border border-violet-200/90 px-4 py-4 shadow-sm sm:px-5 sm:py-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-xl font-black text-slate-900 sm:text-2xl">المحفظة النقدية</h1>
            </div>
            <Link
              href={hrefMain}
              className="inline-flex shrink-0 items-center justify-center rounded-xl border-2 border-sky-500 bg-sky-600 px-4 py-3 text-center text-base font-black text-white shadow-sm transition hover:bg-sky-700"
            >
              الرئيسية
            </Link>
          </div>
        </header>

        <MandoubWalletClient
          auth={baseAuth}
          walletPathWithQuery={walletPathWithQuery}
          walletLedgerHrefs={{
            site: hrefWalletLedger("site"),
            ward: hrefWalletLedger("ward"),
            sader: hrefWalletLedger("sader"),
            all: hrefWalletLedger("all"),
          }}
          ledgerFilter={ledgerFilter}
          siteRemainingNetStr={formatDinarAsAlfWithUnit(siteRemainingNet)}
          walletInFromWalletStr={formatDinarAsAlfWithUnit(walletInOutDisplay.walletIn)}
          walletOutFromWalletStr={formatDinarAsAlfWithUnit(walletInOutDisplay.walletOut)}
          sumEarningsStr={formatDinarAsAlfWithUnit(sumEarnings)}
          walletRemainStr={formatDinarAsAlfWithUnit(walletRemain)}
          handToAdminStr={formatDinarAsAlfWithUnit(handToAdmin)}
          ledger={ledger}
          pendingIncoming={pendingIncomingForUi}
          transferTargetCouriers={transferTargetCouriers.map((c) => ({
            id: c.id,
            name: c.name.trim() || "مندوب",
          }))}
          // تحويل قائمة المجهزين بشكل نظيف ومستقل عن المحلات
          transferTargetEmployees={companyPreparers.map((prep) => ({
            id: prep.walletEmployeeId!,
            name: prep.name.trim() || "مجهز",
            shopName: "", // إخفاء اسم المحل نهائياً للمجهز
            phone: prep.phone.trim() || "",
          }))}
          availableForTransferStr={formatDinarAsAlfWithUnit(availableForTransfer)}
          pendingOutgoingCount={pendingOutgoingCount}
        />
      </div>
    </div>
  );
}
