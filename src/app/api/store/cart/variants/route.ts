import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type ReqBody = {
  variantIds?: unknown[];
};

function formatOptionValues(optionValues: unknown): string {
  // نعرض الخيارات بصيغة فخمة بدون مفاتيح تقنية/JSON خام.
  // مثال: لون: أحمر · قياس: كبير · شكل: دائري
  const mapKey: Record<string, string> = {
    color: "لون",
    size: "قياس",
    shape: "شكل",
  };

  try {
    if (optionValues && typeof optionValues === "object" && !Array.isArray(optionValues)) {
      const obj = optionValues as Record<string, unknown>;
      const entries = Object.entries(obj).filter(([, v]) => v != null && String(v).trim() !== "");
      if (entries.length === 0) return "";
      return entries.map(([k, v]) => `${mapKey[k] ?? k}: ${String(v)}`).join(" · ");
    }
    return optionValues == null ? "" : String(optionValues);
  } catch {
    return "";
  }
}

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

  const rawIds = Array.isArray(body.variantIds) ? body.variantIds : [];
  const variantIds = Array.from(
    new Set(
      rawIds
        .map((x) => (typeof x === "string" ? x.trim() : String(x ?? "").trim()))
        .filter(Boolean),
    ),
  );

  if (variantIds.length === 0) return bad("لا يوجد معرّفات متغيرات.");

  const variants = await prisma.storeProductVariant.findMany({
    where: { id: { in: variantIds }, active: true, product: { active: true } },
    include: { product: { select: { name: true } } },
  });

  const variantsOut = variants.map((v) => ({
    variantId: v.id,
    productName: v.product.name,
    variantLabel: formatOptionValues(v.optionValues),
    salePriceDinar: String(v.salePriceDinar),
  }));

  return NextResponse.json({ ok: true, variants: variantsOut });
}

