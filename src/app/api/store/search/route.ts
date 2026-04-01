import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

type Hit =
  | { kind: "product"; slug: string; title: string; subtitle?: string }
  | { kind: "category"; slug: string; title: string };

function bad(msg: string, code = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status: code });
}

function normalizeQ(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q0 = normalizeQ(String(searchParams.get("q") ?? ""));
  if (q0.length < 2) return bad("اكتب حرفين على الأقل.");
  const q = q0.slice(0, 60);

  const like = `%${q}%`;

  const [cats, prods] = await Promise.all([
    prisma.storeCategory.findMany({
      where: { name: { contains: q, mode: "insensitive" } },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      take: 10,
      select: { slug: true, name: true },
    }),
    prisma.$queryRaw<Array<{ slug: string; name: string; categoryName: string | null }>>`
      SELECT p.slug as "slug",
             p.name as "name",
             c.name as "categoryName"
      FROM "StoreProduct" p
      LEFT JOIN "StoreCategory" c ON c.id = p."categoryId"
      WHERE p.active = true
        AND (
          p.name ILIKE ${like}
          OR COALESCE(p.description, '') ILIKE ${like}
          OR COALESCE(c.name, '') ILIKE ${like}
          OR EXISTS (
            SELECT 1
            FROM "StoreProductVariant" v
            WHERE v."productId" = p.id
              AND v.active = true
              AND (v."optionValues")::text ILIKE ${like}
          )
        )
      ORDER BY p."createdAt" DESC
      LIMIT 18
    `,
  ]);

  const hits: Hit[] = [];
  for (const c of cats) hits.push({ kind: "category", slug: c.slug, title: c.name });
  for (const p of prods) {
    hits.push({
      kind: "product",
      slug: p.slug,
      title: p.name,
      subtitle: p.categoryName ? `القسم: ${p.categoryName}` : undefined,
    });
  }

  return NextResponse.json({ ok: true, hits });
}

