import { prisma } from "@/lib/prisma";
import { StoreShell } from "./store-shell";

export const dynamic = "force-dynamic";

export default async function StoreLayout({ children }: { children: React.ReactNode }) {
  const categories = await prisma.storeCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true, parentId: true },
  });

  return (
    <StoreShell
      categories={categories.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        parentId: c.parentId ?? null,
      }))}
    >
      {children}
    </StoreShell>
  );
}

