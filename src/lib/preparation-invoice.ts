import { ALF_PER_DINAR, formatDinarAsAlf } from "@/lib/money-alf";
import { calculateExtraAlfFromPlacesCount } from "@/lib/preparation-extra";

export type InvoiceProductLine = {
  line: string;
  buyAlf: number;
  sellAlf: number;
};

function fmtAlf(n: number): string {
  return formatDinarAsAlf(n * ALF_PER_DINAR);
}

/** فاتورة الزبون (بيع + تراكمي) + تجهيز + توصيل — بصيغة قريبة من بوت Telegram */
export function buildCustomerInvoiceText(params: {
  brandLabel: string;
  orderNumberLabel: string;
  regionTitle: string;
  phone: string;
  lines: InvoiceProductLine[];
  placesCount: number;
  deliveryAlf: number;
}): string {
  const { brandLabel, orderNumberLabel, regionTitle, phone, lines, placesCount, deliveryAlf } = params;
  const extraAlf = calculateExtraAlfFromPlacesCount(placesCount);

  const parts: string[] = [];
  parts.push(`📋 ${brandLabel} 🚀`);
  parts.push("-----------------------------------");
  parts.push(`🔢: ${orderNumberLabel}`);
  parts.push(`🏠: ${regionTitle}`);
  parts.push(`📞: ${phone}`);
  parts.push("");
  parts.push("🛍 ال🛍:");
  parts.push("");

  let run = 0;
  for (const row of lines) {
    const s = row.sellAlf;
    parts.push(`– ${row.line} بـ${fmtAlf(s)}`);
    run += s;
    parts.push(`• ${fmtAlf(run)} 💵`);
  }

  parts.push(`– 📦 التجهيز: من ${placesCount} محلات بـ ${fmtAlf(extraAlf)}`);
  run += extraAlf;
  parts.push(`• ${fmtAlf(run)} 💵`);

  const withoutDelivery = run;

  parts.push(`– 🚚: بـ ${fmtAlf(deliveryAlf)}`);
  run += deliveryAlf;
  parts.push(`• ${fmtAlf(run)} 💵`);

  parts.push("-----------------------------------");
  parts.push("✨ المجموع الكلي: ✨");
  parts.push(`بدون التوصيل = ${fmtAlf(withoutDelivery)} 💵`);
  parts.push(`مــــع التوصيل = ${fmtAlf(run)} 💵`);
  parts.push("شكراً لاختياركم أبو الأكبر للتوصيل! ❤️");

  return parts.join("\n");
}

/** سطر لكل منتج في خانة ملاحظات الطلب: الاسم — السعر بالألف فقط (بدون كلمة بيع). */
export function buildShoppingOrderProductNotesLines(lines: InvoiceProductLine[]): string {
  return lines.map((r) => `${r.line.trim()} — ${fmtAlf(r.sellAlf)}`).join("\n");
}

/** ملخص شراء للمجهز (للحقول الداخلية) */
export function buildPreparerPurchaseSummaryText(lines: InvoiceProductLine[]): string {
  const rows = lines.map((r) => `• ${r.line}: شراء ${fmtAlf(r.buyAlf)} | بيع ${fmtAlf(r.sellAlf)}`);
  const totalBuy = lines.reduce((s, r) => s + r.buyAlf, 0);
  rows.push(`مجموع الشراء (تقديري): ${fmtAlf(totalBuy)}`);
  return ["══ تفاصيل المجهز (شراء / بيع) ══", ...rows].join("\n");
}
