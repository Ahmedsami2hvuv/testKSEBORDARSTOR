import { prisma } from "@/lib/prisma";
import {
  applyMandoubWaTemplate,
  parseStatusesCsv,
  splitMandoubWaTemplateVariants,
} from "@/lib/mandoub-wa-button-template";
import { OrderFabDock } from "@/components/order-fab-dock";

/** مواضع موحّدة لكل طلبات الإدارة */
const STORAGE_KEY = "adminFabLayout_v4";

type Props = {
  orderId: string;
  shopPhone: string;
  customerPhone: string;
  customerAlternatePhone?: string;
  preparerPhone?: string;
  orderStatus: string;
  orderNumber: number;
  shopName: string;
  city: string;
  totalPrice: string;
  deliveryName: string;
  customerLocationUrl: string;
  customerLandmark: string;
  hasCustomerLocation: boolean;
  hasCourierUploadedLocation: boolean;
};

/** واتساب + اتصال (قائمة عميل/زبون) — لصفحة عرض الطلب */
export async function AdminOrderFloatingBar(props: Props) {
  const rows = await prisma.mandoubWaButtonSetting.findMany({
    where: { isActive: true },
    orderBy: { updatedAt: "desc" },
  });

  const vars = {
    clientshop: props.shopName,
    city: props.city,
    total_price: props.totalPrice,
    delivery: props.deliveryName,
    location_url: props.customerLocationUrl,
    landmark: props.customerLandmark,
    order_number: String(props.orderNumber),
    customer_phone: props.customerPhone,
    customer_phone2: props.customerAlternatePhone ?? "",
    shop_phone: props.shopPhone,
  };

  function parseLocationRules(raw: string): Array<"any" | "exists" | "missing" | "courier_gps"> {
    const parts = (raw ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const allowed = parts.filter(
      (p): p is "any" | "exists" | "missing" | "courier_gps" =>
        p === "any" || p === "exists" || p === "missing" || p === "courier_gps",
    );
    return allowed.length ? allowed : ["any"];
  }

  const customWaButtons =
    rows.flatMap((r) => {
      const scopes = (r.visibilityScope ?? "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const canSeeAdmin = scopes.includes("all") || scopes.includes("admin");
      if (!canSeeAdmin) return [];

      const statuses = parseStatusesCsv(r.statusesCsv);
      if (statuses.length > 0 && !statuses.includes(props.orderStatus)) return [];

      const locRules = parseLocationRules(r.customerLocationRule ?? "any");
      if (!locRules.includes("any")) {
        const matchesLocationRule = locRules.some((rule) => {
          if (rule === "exists") return props.hasCustomerLocation;
          if (rule === "missing") return !props.hasCustomerLocation;
          if (rule === "courier_gps") return props.hasCourierUploadedLocation;
          return false;
        });
        if (!matchesLocationRule) return [];
      }

      const messages = splitMandoubWaTemplateVariants(r.templateText).map((t) =>
        applyMandoubWaTemplate(t, vars),
      );
      if (messages.length === 0) return [];

      return [{ id: r.id, label: r.label, iconKey: r.iconKey, messages }];
    }) ?? [];

  return (
    <OrderFabDock
      storageKey={STORAGE_KEY}
      legacyLayoutStorageKey="adminFabLayout_v3"
      orderId={props.orderId}
      shopPhone={props.shopPhone}
      customerPhone={props.customerPhone}
      customerAlternatePhone={props.customerAlternatePhone}
      preparerPhone={props.preparerPhone}
      customWaButtons={customWaButtons}
    />
  );
}
