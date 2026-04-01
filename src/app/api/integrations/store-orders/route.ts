import { NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";
import { notifyTelegramNewOrder } from "@/lib/telegram-notify";
import { pushNotifyAdminsNewPendingOrder } from "@/lib/web-push-server";

type IncomingBody = {
  source?: string;
  storeOrderId?: string;
  customer?: {
    name?: string;
    phone?: string;
    city?: string;
    address?: string;
    notes?: string;
  };
  totals?: { totalAmount?: number };
  items?: Array<{
    productName?: string;
    quantity?: number;
    unitPrice?: number;
    color?: string;
    size?: string;
    shape?: string;
  }>;
};

function unauthorized() {
  return NextResponse.json({ ok: false, error: "غير مصرح" }, { status: 401 });
}

function bad(msg: string) {
  return NextResponse.json({ ok: false, error: msg }, { status: 400 });
}

function normalizePhoneFallback(raw: string) {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "";
  if (digits.startsWith("964") && digits.length >= 12) return `0${digits.slice(3, 13)}`;
  if (digits.startsWith("0") && digits.length >= 11) return digits.slice(0, 11);
  return digits.slice(-11);
}

export async function POST(req: Request) {
  const expectedToken = process.env.KSEB_MAIN_ORDER_API_TOKEN?.trim();
  if (!expectedToken) {
    return NextResponse.json({ ok: false, error: "Integration token not configured" }, { status: 500 });
  }

  const auth = req.headers.get("authorization");
  const bearer = auth?.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  if (bearer !== expectedToken) return unauthorized();

  let body: IncomingBody;
  try {
    body = (await req.json()) as IncomingBody;
  } catch {
    return bad("بيانات غير صالحة");
  }

  const storeOrderId = String(body.storeOrderId ?? "").trim();
  const customerName = String(body.customer?.name ?? "").trim();
  const customerPhone = normalizePhoneFallback(String(body.customer?.phone ?? "").trim());
  const city = String(body.customer?.city ?? "").trim();
  const address = String(body.customer?.address ?? "").trim();
  const notes = String(body.customer?.notes ?? "").trim();
  const totalAmount = Number(body.totals?.totalAmount ?? 0);
  const items = Array.isArray(body.items) ? body.items : [];

  if (!storeOrderId) return bad("storeOrderId مطلوب");
  if (!customerName) return bad("اسم الزبون مطلوب");
  if (!customerPhone) return bad("رقم الزبون مطلوب");
  if (!Number.isFinite(totalAmount) || totalAmount < 0) return bad("إجمالي غير صالح");

  const summaryParts = items.map((item) => {
    const qty = Math.max(1, Math.floor(Number(item.quantity ?? 1)));
    const title = String(item.productName ?? "منتج").trim();
    const details = [item.color, item.size, item.shape].filter(Boolean).join("/");
    return `${title}${details ? ` (${details})` : ""} x${qty}`;
  });
  const summary = summaryParts.join(" | ").slice(0, 1800);

  const shop =
    (await prisma.shop.findUnique({
      where: { id: process.env.KSEB_MAIN_ORDER_SHOP_ID ?? "" },
      include: { region: true },
    })) ??
    (await prisma.shop.findFirst({
      include: { region: true },
      orderBy: { createdAt: "asc" },
    }));

  if (!shop) {
    return NextResponse.json({ ok: false, error: "لا يوجد محل مهيأ في النظام الأساسي" }, { status: 500 });
  }

  const delivery = new Decimal(0);
  const subtotal = new Decimal(totalAmount);
  const total = subtotal.plus(delivery);

  const createdCustomer = await prisma.customer.create({
    data: {
      shopId: shop.id,
      name: customerName,
      phone: customerPhone,
      customerRegionId: shop.regionId,
      customerLandmark: [city, address].filter(Boolean).join(" - "),
      customerLocationUrl: "",
    },
  });

  const mainOrder = await prisma.order.create({
    data: {
      shopId: shop.id,
      customerId: createdCustomer.id,
      status: "pending",
      summary: summary || `طلب محول من KSEB STOR #${storeOrderId}`,
      orderType: "store_transfer",
      customerPhone,
      customerRegionId: shop.regionId,
      customerLandmark: [city, address].filter(Boolean).join(" - "),
      customerLocationUrl: "",
      orderNoteTime: "منقول من المتجر",
      orderSubtotal: subtotal,
      deliveryPrice: delivery,
      totalAmount: total,
      adminOrderCode: `STORE-${storeOrderId.slice(-8).toUpperCase()}`,
      submissionSource: "store_bridge",
      alternatePhone: null,
      imageUrl: null,
      voiceNoteUrl: null,
      prepaidAll: true,
      ...(notes ? { summary: `${summary || ""}\nملاحظات: ${notes}`.trim() } : {}),
    },
    select: { id: true, orderNumber: true },
  });

  void notifyTelegramNewOrder(mainOrder.id);
  void pushNotifyAdminsNewPendingOrder(mainOrder.orderNumber);

  return NextResponse.json({
    ok: true,
    mainOrderId: String(mainOrder.orderNumber),
    orderNumber: mainOrder.orderNumber,
  });
}
