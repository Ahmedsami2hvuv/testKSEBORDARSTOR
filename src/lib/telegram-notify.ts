import { Decimal } from "@prisma/client/runtime/library";
import { formatDinarAsAlf, formatDinarAsAlfWithUnit } from "@/lib/money-alf";
import { prisma } from "@/lib/prisma";
import { getPublicAppUrl } from "@/lib/app-url";
import {
  escapeTelegramHtml,
  sendTelegramMessage,
  sendTelegramMessageWithKeyboard,
  sendTelegramHtmlToChat,
  sendTelegramMessageWithKeyboardToChat,
  type TelegramInlineKeyboard,
} from "@/lib/telegram";
import { getPreparerMoneyTotals } from "./preparer-combined-wallet-totals";

function alfLine(label: string, value: string): string {
  return `${label} ${escapeTelegramHtml(value)} الف`;
}

function formatOrderBodyLines(input: {
  shopName: string; customerName: string; regionName: string; orderType: string;
  orderSubtotal: Decimal | null; deliveryPrice: Decimal | null; totalAmount: Decimal | null;
  orderNumber: number; customerPhone: string;
}): string[] {
  const cust = input.customerName?.trim() || "—";
  return [
    `🏪 (${escapeTelegramHtml(input.shopName)} — ${escapeTelegramHtml(cust)})`,
    `📍 ${escapeTelegramHtml(input.regionName || "—")}`,
    `📦 ${escapeTelegramHtml(input.orderType || "—")}`,
    alfLine("💵", formatDinarAsAlf(input.orderSubtotal)),
    alfLine("🚚", formatDinarAsAlf(input.deliveryPrice)),
    alfLine("💰", formatDinarAsAlf(input.totalAmount)),
    `🔢 ${input.orderNumber}`,
    `📞 ${escapeTelegramHtml(input.customerPhone || "—")}`,
  ];
}

export async function notifyTelegramPreparerWalletEvent(input: {
  preparerId: string;
  kind: "take" | "give" | "order_in" | "order_out" | "transfer_in" | "transfer_out" | "transfer_rejected" | "transfer_accepted";
  amountDinar: Decimal;
  label: string;
}) {
  const totals = await getPreparerMoneyTotals(input.preparerId);
  const preparer = await prisma.companyPreparer.findUnique({ where: { id: input.preparerId } });
  
  const isIn = input.kind === "take" || input.kind === "order_in" || input.kind === "transfer_in" || input.kind === "transfer_accepted";
  const isRejected = input.kind === "transfer_rejected";

  const emoji = isRejected ? "❌ تحويل مرفوض" : isIn ? "🔴 وارد للمحفظة" : "🟢 صادر من المحفظة";
  const amount = formatDinarAsAlfWithUnit(input.amountDinar);
  const remain = totals ? formatDinarAsAlfWithUnit(totals.remain) : "—";

  const text = [
    `<b>💰 حركة محفظة مجهز</b>`,
    `<b>المجهز:</b> ${escapeTelegramHtml(preparer?.name || "—")}`,
    `<b>النوع:</b> ${emoji}`,
    `<b>المبلغ:</b> ${amount}`,
    `<b>التفاصيل:</b> ${escapeTelegramHtml(input.label)}`,
    `-------------------------`,
    `<b>💰 المتبقي بذمة المجهز:</b> ${remain}`
  ].join("\n");

  await sendTelegramMessage(text);
  if (preparer?.telegramUserId) {
    await sendTelegramHtmlToChat(preparer.telegramUserId, text);
  }
}

/** إشعار للمندوب عند استلام أو قبول/رفض تحويله */
export async function notifyTelegramCourierTransferEvent(input: {
  courierId: string;
  kind: "incoming" | "accepted" | "rejected";
  amountDinar: Decimal;
  partyName: string;
  location: string;
  transferId?: string;
}) {
  const courier = await prisma.courier.findUnique({ where: { id: input.courierId } });
  if (!courier?.telegramUserId) return;

  let text = "";
  let kb: TelegramInlineKeyboard | undefined = undefined;

  const amountStr = formatDinarAsAlfWithUnit(input.amountDinar);

  if (input.kind === "incoming") {
    text = `💰 <b>تحويل مالي واصل إليك</b>\n\n` +
           `<b>المرسل:</b> ${escapeTelegramHtml(input.partyName)}\n` +
           `<b>المبلغ:</b> ${amountStr}\n` +
           `<b>المكان:</b> ${escapeTelegramHtml(input.location)}\n\n` +
           `هل تقبل استلام المبلغ؟`;
    kb = {
      inline_keyboard: [
        [
          { text: "✅ قبول", callback_data: `acc_t_${input.transferId}` },
          { text: "❌ رفض", callback_data: `rej_t_${input.transferId}` }
        ]
      ]
    };
  } else if (input.kind === "accepted") {
    text = `✅ <b>تم قبول تحويلك</b>\n\n` +
           `<b>المستلم:</b> ${escapeTelegramHtml(input.partyName)}\n` +
           `<b>المبلغ:</b> ${amountStr}\n` +
           `لقد تم خصم المبلغ من ذمتك للإدارة بنجاح.`;
  } else if (input.kind === "rejected") {
    text = `❌ <b>تم رفض تحويلك</b>\n\n` +
           `<b>الطرف الآخر:</b> ${escapeTelegramHtml(input.partyName)}\n` +
           `<b>المبلغ:</b> ${amountStr}\n` +
           `المبلغ لا يزال في ذمتك، تواصل معه للتأكد.`;
  }

  if (kb) {
    await sendTelegramMessageWithKeyboardToChat(courier.telegramUserId, text, kb);
  } else {
    await sendTelegramHtmlToChat(courier.telegramUserId, text);
  }
}

export async function notifyTelegramNewOrder(orderId: string): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { shop: true, customer: true, customerRegion: true }
  });
  if (!order) return;

  const text = formatNewOrderTelegramHtml({
    shopName: order.shop.name, customerName: order.customer?.name?.trim() || "—",
    regionName: order.customerRegion?.name ?? "—", orderType: order.orderType,
    orderSubtotal: order.orderSubtotal, deliveryPrice: order.deliveryPrice, totalAmount: order.totalAmount,
    orderNumber: order.orderNumber, customerPhone: order.customerPhone, orderId: order.id,
  });

  const on = String(order.orderNumber);
  const kb: TelegramInlineKeyboard = buildTelegramOrderKeyboard(order.orderNumber, order.id);

  await sendTelegramMessageWithKeyboard(text, kb);

  const preparers = await prisma.companyPreparer.findMany({
    where: { active: true, telegramUserId: { not: "" }, shopLinks: { some: { shopId: order.shopId } } }
  });

  for (const prep of preparers) {
    if (prep.telegramUserId) {
      await sendTelegramMessageWithKeyboardToChat(prep.telegramUserId, `🔔 <b>طلب جديد لمحل تابع لك:</b>\n\n${text}`, kb);
    }
  }
}

export function formatNewOrderTelegramHtml(input: any, options?: any): string {
  const lines = formatOrderBodyLines(input);
  if (!options?.omitAdminLink) {
    lines.push(`🔗 <a href="${escapeTelegramHtml(getPublicAppUrl() + '/admin/orders/' + input.orderId)}">رابط الطلبية</a>`);
  }
  return lines.join("\n");
}

export async function notifyTelegramMoneyEvent(input: any): Promise<void> {
  const order = await prisma.order.findUnique({
    where: { id: input.orderId },
    include: { shop: true, customer: true, customerRegion: true }
  });
  if (!order) return;

  const header = input.kind === "pickup_out" ? "💸 للعميل 💸" : "💸 من الزبون 💸";
  const body = formatOrderBodyLines({ 
    ...order, 
    shopName: order.shop.name, 
    customerName: order.customer?.name ?? "",
    regionName: order.customerRegion?.name ?? "" 
  });

  const text = [
    escapeTelegramHtml(header),
    `👤 ${escapeTelegramHtml(input.courierName)}`,
    alfLine("💰", formatDinarAsAlf(input.amountDinar)),
    ...body
  ].join("\n");

  const on = String(order.orderNumber);
  const kb: TelegramInlineKeyboard = buildTelegramOrderKeyboard(order.orderNumber, order.id);

  await sendTelegramMessageWithKeyboard(text, kb);

  const preparers = await prisma.companyPreparer.findMany({
    where: { active: true, telegramUserId: { not: "" }, shopLinks: { some: { shopId: order.shopId } } }
  });

  for (const prep of preparers) {
    if (prep.telegramUserId) {
      await sendTelegramMessageWithKeyboardToChat(prep.telegramUserId, `💸 <b>تحديث مالي لمحل تابع لك:</b>\n\n${text}`, kb);
    }
  }
}

export async function notifyTelegramPresenceChange(input: any): Promise<void> {
  const label = input.kind === "courier" ? "مندوب" : "مجهز";
  const text = `<b>${label}:</b> ${escapeTelegramHtml(input.name)} \n${input.available ? "✅ متاح" : "⏸ غير متاح"}`;
  await sendTelegramMessage(text);
}

export function buildTelegramOrderKeyboard(
  orderNumber: number,
  orderId?: string,
  options?: { showBrowserLinks?: boolean; omitAdminLink?: boolean }
): TelegramInlineKeyboard {
  const on = String(orderNumber);
  return {
    inline_keyboard: [
      [{ text: "تحويل لمندوب", callback_data: `l${on}` }],
      [{ text: "تعديل الطلب", callback_data: `e${on}` }],
    ],
  };
}
