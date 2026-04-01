import { NextResponse } from "next/server";
import { Decimal } from "@prisma/client/runtime/library";
import { prisma } from "@/lib/prisma";

type ReqBody = {
  customerName?: string;
  customerPhone?: string;
  addressText?: string;
  notes?: string;
  items?: { variantId: string; quantity: number }[];
};

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

export async function POST(req: Request) {
  let body: ReqBody;
  try {
    body = (await req.json()) as ReqBody;
  } catch {
    return bad("بيانات غير صالحة.");
  }

  const customerName = String(body.customerName ?? "").trim();
  const customerPhone = String(body.customerPhone ?? "").trim();
  const addressText = String(body.addressText ?? "").trim();
  const notes = String(body.notes ?? "").trim();
  const itemsRaw = Array.isArray(body.items) ? body.items : [];

  if (!customerName) return bad("اسم الزبون مطلوب.");
  if (!customerPhone) return bad("رقم الهاتف مطلوب.");
  if (!addressText) return bad("اختيار المنطقة مطلوب.");
  if (itemsRaw.length === 0) return bad("السلة فارغة.");

  const items = itemsRaw
    .map((x) => ({
      variantId: String(x.variantId ?? "").trim(),
      quantity: Math.floor(Number(x.quantity ?? 0)),
    }))
    .filter((x) => x.variantId && Number.isFinite(x.quantity) && x.quantity > 0);

  if (items.length === 0) return bad("العناصر غير صالحة.");

  const variantIds = Array.from(new Set(items.map((x) => x.variantId)));
  const variants = await prisma.storeProductVariant.findMany({
    where: { id: { in: variantIds }, active: true, product: { active: true } },
    include: { product: { select: { name: true } } },
  });
  const byId = new Map(variants.map((v) => [v.id, v]));

  for (const it of items) {
    if (!byId.has(it.variantId)) {
      return bad("بعض العناصر غير متاحة حالياً.");
    }
  }

  const computedItems = items.map((it) => {
    const v = byId.get(it.variantId)!;
    const unitSale = new Decimal(v.salePriceDinar);
    const unitCost = new Decimal(v.costPriceDinar);
    const q = new Decimal(it.quantity);
    const lineSale = unitSale.mul(q);
    const lineCost = unitCost.mul(q);
    const lineProfit = lineSale.sub(lineCost);
    const variantLabel = (() => {
      try {
        const json = v.optionValues as unknown;
        return JSON.stringify(json);
      } catch {
        return "";
      }
    })();
    return {
      variantId: v.id,
      productName: v.product.name,
      variantLabel,
      quantity: it.quantity,
      unitSaleDinar: unitSale,
      unitCostDinar: unitCost,
      lineSaleDinar: lineSale,
      lineCostDinar: lineCost,
      lineProfitDinar: lineProfit,
    };
  });

  const subtotalSale = computedItems.reduce(
    (acc, it) => acc.add(it.lineSaleDinar),
    new Decimal(0),
  );
  const totalSale = subtotalSale; // لا يوجد توصيل/ضرائب حالياً
  const totalCost = computedItems.reduce(
    (acc, it) => acc.add(it.lineCostDinar),
    new Decimal(0),
  );
  const profit = totalSale.sub(totalCost);

  const created = await prisma.storeOrder.create({
    data: {
      status: "pending",
      customerName,
      customerPhone,
      addressText,
      notes,
      subtotalSaleDinar: subtotalSale,
      totalSaleDinar: totalSale,
      totalCostDinar: totalCost,
      profitDinar: profit,
      items: {
        create: computedItems.map((it) => ({
          variantId: it.variantId,
          productName: it.productName,
          variantLabel: it.variantLabel,
          quantity: it.quantity,
          unitSaleDinar: it.unitSaleDinar,
          unitCostDinar: it.unitCostDinar,
          lineSaleDinar: it.lineSaleDinar,
          lineCostDinar: it.lineCostDinar,
          lineProfitDinar: it.lineProfitDinar,
        })),
      },
    },
    select: { orderNumber: true },
  });

  return NextResponse.json({ ok: true, orderNumber: created.orderNumber });
}

