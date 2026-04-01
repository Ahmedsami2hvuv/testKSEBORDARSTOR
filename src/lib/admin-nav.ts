/** روابط لوحة الإدارة — المربعات والشريط الجانبي */

export type AdminTile = {
  slug: string;
  label: string;
  emoji: string;
  /** إن وُجد يُستخدم مباشرة بدل /admin/module/[slug] */
  href?: string;
};

export const ADMIN_TILES: AdminTile[] = [
  { slug: "new-orders", label: "الطلبات الجديدة", emoji: "📥", href: "/admin/orders/pending" },
  { slug: "order-tracking", label: "تتبع الطلبات", emoji: "📍", href: "/admin/orders/tracking" },
  { slug: "admin-create-order", label: "إضافة طلب من الإدارة", emoji: "➕", href: "/admin/orders/new" },
  { slug: "preparation-orders", label: "تجهيز الطلبات", emoji: "🧾", href: "/admin/preparation-orders" },
  { slug: "archived-orders", label: "الطلبات المؤرشفة", emoji: "📦", href: "/admin/orders/archived" },
  { slug: "rejected-orders", label: "المرفوضة", emoji: "❌", href: "/admin/orders/tracking?status=cancelled" },

  { slug: "reports", label: "التقارير", emoji: "📊", href: "/admin/reports" },
  { slug: "wallet-ledger", label: "سجل المحافظ بين الأطراف", emoji: "📒", href: "/admin/reports/wallet-ledger" },
  { slug: "prep-notices", label: "إشعارات تجهيز المجهزين", emoji: "📣", href: "/admin/prep-notices" },

  { slug: "customers", label: "بيانات الزبائن", emoji: "👥", href: "/admin/customers" },
  { slug: "couriers", label: "المندوبين", emoji: "🏍️", href: "/admin/couriers" },
  { slug: "courier-map", label: "خريطة المندوبين", emoji: "🗺️", href: "/admin/couriers/map" },
  { slug: "preparers", label: "المجهزين", emoji: "👨‍🍳", href: "/admin/preparers" },
  { slug: "employees", label: "الموظفين", emoji: "🧑‍💼", href: "/admin/employees" },

  { slug: "shops", label: "المحلات", emoji: "🏪", href: "/admin/shops" },
  { slug: "regions", label: "المناطق", emoji: "🗺️", href: "/admin/regions" },
  { slug: "store", label: "المتجر", emoji: "🛒", href: "/admin/store" },

  { slug: "wa-buttons", label: "أزرار واتساب للمندوب", emoji: "💬", href: "/admin/wa-buttons" },
  { slug: "super-search", label: "البحث الخارق", emoji: "🔎", href: "/admin/search" },
  { slug: "settings", label: "الإعدادات", emoji: "⚙️", href: "/admin/settings" },
  { slug: "notification-settings", label: "إشعارات المتصفح", emoji: "🔔", href: "/admin/settings#notifications" },
];

/** إخفاء قسم «الطلبات الجديدة» من الواجهة فقط (بدون حذف الصفحة). */
const HIDE_NEW_ORDERS_SECTION = false;

export function tileHref(tile: AdminTile): string {
  return tile.href ?? `/admin/module/${tile.slug}`;
}

function isVisibleTile(tile: AdminTile): boolean {
  if (HIDE_NEW_ORDERS_SECTION && tile.slug === "new-orders") return false;
  return true;
}

/** ترتيب ثابت في الشريط الجانبي */
const SIDEBAR_ORDER_FIRST: readonly string[] = [
  "new-orders",
  "order-tracking",
  "admin-create-order",
  "wallet-ledger",
];

export function adminSidebarTiles(): AdminTile[] {
  const first = SIDEBAR_ORDER_FIRST.map((slug) => {
    const t = ADMIN_TILES.find((x) => x.slug === slug);
    if (!t) throw new Error(`Missing admin tile: ${slug}`);
    return t;
  }).filter(isVisibleTile);
  const rest = ADMIN_TILES.filter(
    (t) => !SIDEBAR_ORDER_FIRST.includes(t.slug) && isVisibleTile(t),
  );
  return [...first, ...rest];
}

export function isTileEnabled(slug: string): boolean {
  const t = ADMIN_TILES.find((x) => x.slug === slug);
  if (!t) return false;
  return isVisibleTile(t);
}
