import Link from "next/link";
import { redirect } from "next/navigation";
import { formatDinarAsAlf } from "@/lib/money-alf";
import { courierAssignableWhere } from "@/lib/courier-assignable";
import { prisma } from "@/lib/prisma";
import { ad } from "@/lib/admin-ui";
import { hasCustomerLocationUrl } from "@/lib/order-location";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { normalizeIraqMobileLocal11 } from "@/lib/whatsapp";
import { CustomerOrdersBulkTable } from "../orders/customer-orders-bulk-table";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "معلومات الزبون — أبو الأكبر للتوصيل",
};

/** في الرابط: طلبات بدون حقل منطقة في الطلبية */
const NO_REGION_SLUG = "no-region";

type OrderDoorFallback = {
  customerDoorPhotoUrl: string | null;
  createdAt: Date;
};

/** أحدث صورة باب من طلبيات هذه المنطقة فقط (حقل الطلبية — لا نخلط مع صورة من سجل `Customer` العام). */
function pickLatestDoorRawUrl(orders: OrderDoorFallback[]): string | null {
  const sorted = [...orders].sort(
    (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
  );
  for (const o of sorted) {
    const fromOrder = o.customerDoorPhotoUrl?.trim();
    if (fromOrder) return fromOrder;
  }
  return null;
}

type Props = {
  searchParams: Promise<{ phone?: string; regionId?: string; q?: string }>;
};

function buildInfoHref(phone: string, regionId?: string | null) {
  const p = encodeURIComponent(phone);
  if (regionId === null || regionId === undefined) {
    return `/admin/customers/info?phone=${p}`;
  }
  const r =
    regionId === NO_REGION_SLUG
      ? NO_REGION_SLUG
      : encodeURIComponent(regionId);
  return `/admin/customers/info?phone=${p}&regionId=${r}`;
}

export default async function CustomerInfoPage({ searchParams }: Props) {
  const sp = await searchParams;
  const phone = (sp.phone ?? "").trim();
  if (!phone) {
    redirect("/admin/customers");
  }

  const regionIdParam = (sp.regionId ?? "").trim();
  const q = (sp.q ?? "").trim().toLowerCase();
  const phoneNorm = normalizeIraqMobileLocal11(phone) ?? phone;

  const [ordersBase, profiles] = await Promise.all([
    prisma.order.findMany({
      where: { customerPhone: phone },
      orderBy: [{ createdAt: "asc" }, { orderNumber: "asc" }],
      include: {
        shop: true,
        courier: true,
        customer: {
          select: {
            customerLocationUrl: true,
            name: true,
            customerDoorPhotoUrl: true,
            alternatePhone: true,
          },
        },
        customerRegion: { select: { id: true, name: true } },
      },
    }),
    phoneNorm
      ? prisma.customerPhoneProfile.findMany({
          where: { phone: phoneNorm },
          include: { region: { select: { id: true, name: true } } },
        })
      : Promise.resolve([]),
  ]);

  const couriers =
    regionIdParam !== ""
      ? await prisma.courier.findMany({
          where: courierAssignableWhere,
          orderBy: { name: "asc" },
          select: { id: true, name: true },
        })
      : [];

  const regionCounts = new Map<
    string | null,
    { name: string; count: number }
  >();

  for (const o of ordersBase) {
    const rid = o.customerRegionId;
    const rname =
      rid && o.customerRegion ? o.customerRegion.name : "بدون منطقة";
    const prev = regionCounts.get(rid);
    if (prev) prev.count += 1;
    else regionCounts.set(rid, { name: rname, count: 1 });
  }

  for (const p of profiles) {
    if (!regionCounts.has(p.regionId)) {
      regionCounts.set(p.regionId, { name: p.region.name, count: 0 });
    }
  }

  const regionEntries = Array.from(regionCounts.entries()).sort((a, b) => {
    if (a[0] === null && b[0] !== null) return 1;
    if (a[0] !== null && b[0] === null) return -1;
    return a[1].name.localeCompare(b[1].name, "ar");
  }).filter(([rid, meta]) => {
    if (!q) return true;
    const blob = `${meta.name} ${rid ?? "no-region"} ${meta.count}`.toLowerCase();
    return blob.includes(q);
  });

  const regionCount = regionCounts.size;

  const ordersFiltered =
    regionIdParam === ""
      ? null
      : regionIdParam === NO_REGION_SLUG
        ? ordersBase.filter((o) => o.customerRegionId === null)
        : ordersBase.filter((o) => o.customerRegionId === regionIdParam);

  const profileForRegion =
    regionIdParam &&
    regionIdParam !== NO_REGION_SLUG &&
    phoneNorm
      ? profiles.find((p) => p.regionId === regionIdParam) ?? null
      : null;

  const regionMeta =
    regionIdParam === ""
      ? null
      : regionIdParam === NO_REGION_SLUG
        ? { name: "بدون منطقة (في الطلبية)" }
        : await prisma.region.findUnique({
            where: { id: regionIdParam },
            select: { name: true },
          });

  const ordersForTable =
    ordersFiltered !== null ? ordersFiltered : ordersBase;

  const tableRows =
    regionIdParam !== ""
      ? ordersForTable.map((o) => {
          const missingLoc = !hasCustomerLocationUrl(o.customerLocationUrl, undefined);
          return {
            id: o.id,
            orderNumber: o.orderNumber,
            createdAtLabel: o.createdAt.toLocaleString("ar-IQ-u-nu-latn", {
              dateStyle: "medium",
              timeStyle: "short",
            }),
            shopName: o.shop.name,
            status: o.status,
            missingLoc,
            totalLabel:
              o.totalAmount != null ? formatDinarAsAlf(o.totalAmount) : "—",
            courierName: o.courier?.name?.trim() || "",
          };
        }).filter((row) => {
          if (!q) return true;
          const blob = `${row.orderNumber} ${row.shopName} ${row.status} ${row.totalLabel} ${row.courierName}`.toLowerCase();
          return blob.includes(q);
        })
      : [];

  const doorPhotoSrc =
    regionIdParam === ""
      ? null
      : (() => {
          const fromProfile = resolvePublicAssetSrc(profileForRegion?.photoUrl);
          if (fromProfile) return fromProfile;
          const raw = pickLatestDoorRawUrl(ordersFiltered ?? []);
          return resolvePublicAssetSrc(raw);
        })();

  /** آخر طلبية في المنطقة المختارة — لعرض لوكيشن/دالة/رقم ثانٍ عند عدم وجود سجل مرجعي */
  const latestOrderInRegion =
    regionIdParam !== "" && ordersFiltered && ordersFiltered.length > 0
      ? [...ordersFiltered].sort(
          (a, b) => b.createdAt.getTime() - a.createdAt.getTime(),
        )[0]
      : null;

  return (
    <div className="space-y-4" dir="rtl">
      <p className={ad.muted}>
        <Link href="/admin/customers" className={ad.link}>
          ← بيانات الزبائن
        </Link>
        <span className="text-slate-400"> | </span>
        <Link href="/admin" className={ad.link}>
          الرئيسية
        </Link>
      </p>

      <div>
        <h1 className={ad.h1}>معلومات الزبون</h1>
        <p className={`mt-1 ${ad.lead}`}>
          الهاتف:{" "}
          <strong className="font-mono tabular-nums text-sky-900">{phone}</strong>
          {phoneNorm !== phone ? (
            <>
              {" "}
              <span className="text-slate-500">
                (موحّد للمرجعية:{" "}
                <span className="font-mono tabular-nums">{phoneNorm}</span>)
              </span>
            </>
          ) : null}
        </p>
      </div>
      <section className={`${ad.section} space-y-2`}>
        <form method="get" className="flex flex-wrap items-end gap-2">
          <input type="hidden" name="phone" value={phone} />
          {regionIdParam ? <input type="hidden" name="regionId" value={regionIdParam} /> : null}
          <label className="min-w-[min(100%,340px)] flex-1">
            <span className={ad.label}>بحث داخل صفحة الزبون</span>
            <input
              type="search"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="منطقة، رقم طلب، محل، مندوب…"
              className={`${ad.input} mt-1`}
            />
          </label>
          <button type="submit" className={ad.btnDark}>
            بحث
          </button>
        </form>
      </section>

      {regionIdParam === "" ? (
        <>
          <div className={`${ad.section} space-y-3`}>
            <h2 className={ad.h2}>المناطق</h2>
            <p className="text-sm text-slate-700">
              عدد المناطق المرتبطة بهذا الرقم:{" "}
              <strong className="text-sky-900 tabular-nums">{regionCount}</strong>
              {" — "}
              يشمل مناطق ظهرت في الطلبات أو في السجل المرجعي (رقم + منطقة) حتى
              بلا طلبات بعد.
            </p>
            {regionEntries.length === 0 ? (
              <p className="text-slate-600">
                لا توجد منطقة مسجّلة لهذا الرقم — قد لا توجد طلبات بعد أو لا يوجد
                صف مرجعي.
              </p>
            ) : (
              <ul className="space-y-2">
                {regionEntries.map(([rid, { name, count }]) => {
                  const href = buildInfoHref(
                    phone,
                    rid === null ? NO_REGION_SLUG : rid,
                  );
                  return (
                    <li key={rid ?? "null"}>
                      <Link
                        href={href}
                        className="inline-flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-2.5 text-sm font-bold text-sky-950 transition hover:bg-sky-100"
                      >
                        <span>{name}</span>
                        <span className="rounded-full bg-white px-2 py-0.5 text-xs font-bold text-sky-800 tabular-nums">
                          {count} طلبية
                        </span>
                        <span className="text-xs font-semibold text-sky-700">
                          عرض التفاصيل والطلبات
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className={`${ad.section} space-y-2`}>
            <p className="text-sm text-slate-700">
              إجمالي الطلبات المسجّلة لهذا الرقم (نفس النص المخزّن في الحقل):{" "}
              <strong className="tabular-nums text-sky-900">{ordersBase.length}</strong>
            </p>
            <p className="text-sm">
              <Link
                href={`/admin/customers/orders?phone=${encodeURIComponent(phone)}`}
                className={ad.link}
              >
                عرض جميع طلبات هذا الرقم بالترتيب الزمني (بدون تصفية منطقة)
              </Link>
            </p>
            {ordersBase.length === 0 ? (
              <p className="text-center text-slate-600">
                <Link href="/admin/orders/tracking" className={ad.link}>
                  البحث في تتبع الطلبات
                </Link>
              </p>
            ) : null}
          </div>
        </>
      ) : (
        <>
          <p>
            <Link
              href={buildInfoHref(phone)}
              className={`inline-flex min-h-[44px] items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-bold text-slate-800 shadow-sm transition hover:bg-slate-50`}
            >
              ← العودة لقائمة المناطق
            </Link>
          </p>

          <div className={`${ad.section} space-y-2`}>
            <h2 className={ad.h2}>
              {regionMeta?.name ??
                (regionIdParam === NO_REGION_SLUG
                  ? "بدون منطقة"
                  : "منطقة غير معروفة")}
              {regionIdParam !== NO_REGION_SLUG ? (
                <span className="ms-2 text-sm font-normal text-slate-500">
                  (تفاصيل مرجعية + طلبيات هذه المنطقة)
                </span>
              ) : (
                <span className="ms-2 text-sm font-normal text-slate-500">
                  (طلبات بدون حقل منطقة في الطلبية)
                </span>
              )}
            </h2>
          </div>

          {regionIdParam !== NO_REGION_SLUG && profileForRegion ? (
            <div className={`${ad.section} space-y-4`}>
              <h3 className={ad.h3}>البيانات المخزّنة (مرجع رقم + منطقة)</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500">اللوكيشن</p>
                  {profileForRegion.locationUrl?.trim() ? (
                    <a
                      href={profileForRegion.locationUrl.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${ad.link} break-all text-sm font-semibold`}
                    >
                      فتح الرابط
                    </a>
                  ) : (
                    <p className="text-sm text-slate-600">—</p>
                  )}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    أقرب نقطة دالة
                  </p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">
                    {profileForRegion.landmark?.trim() || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">رقم ثانٍ</p>
                  <p className="font-mono text-sm tabular-nums">
                    {profileForRegion.alternatePhone?.trim() || "—"}
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-xs font-semibold text-slate-500">ملاحظات</p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">
                    {profileForRegion.notes?.trim() || "—"}
                  </p>
                </div>
                {doorPhotoSrc ? (
                  <div className="sm:col-span-2">
                    <p className="mb-2 text-xs font-semibold text-slate-500">
                      صورة باب
                    </p>
                    <a
                      href={doorPhotoSrc}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-block"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={doorPhotoSrc}
                        alt=""
                        className="max-h-48 max-w-xs rounded-xl border border-sky-200 object-contain"
                      />
                    </a>
                  </div>
                ) : null}
              </div>
              <p className="text-sm">
                <Link
                  href={`/admin/customers/profiles/${profileForRegion.id}/edit`}
                  className={ad.link}
                >
                  تعديل هذا المرجع في «تفاصيل زبائن مرجعية»
                </Link>
              </p>
            </div>
          ) : null}

          {!profileForRegion && latestOrderInRegion ? (
            <div className={`${ad.section} space-y-4`}>
              <h3 className={ad.h3}>من آخر طلبية في هذه المنطقة</h3>
              <p className="text-sm text-slate-600">
                لا يوجد سجل مرجعي محفوظ لهذا الرقم في هذه المنطقة؛ التالي مأخوذ من
                أحدث طلبية مسجّلة هنا.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs font-semibold text-slate-500">اللوكيشن</p>
                  {(() => {
                    const o = latestOrderInRegion;
                    const url = o.customerLocationUrl?.trim() || "";
                    return url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${ad.link} break-all text-sm font-semibold`}
                      >
                        فتح الرابط
                      </a>
                    ) : (
                      <p className="text-sm text-slate-600">—</p>
                    );
                  })()}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">
                    أقرب نقطة دالة
                  </p>
                  <p className="text-sm text-slate-800 whitespace-pre-wrap">
                    {latestOrderInRegion.customerLandmark?.trim() || "—"}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500">رقم ثانٍ</p>
                  <p className="font-mono text-sm tabular-nums">
                    {latestOrderInRegion.alternatePhone?.trim() || "—"}
                  </p>
                </div>
              </div>
            </div>
          ) : null}

          {!profileForRegion && regionIdParam !== "" && doorPhotoSrc ? (
            <div className={`${ad.section} space-y-2`}>
              <h3 className={ad.h3}>صورة باب الزبون</h3>
              <p className="text-sm text-slate-600">
                {regionIdParam === NO_REGION_SLUG
                  ? "من آخر طلبية مسجّلة لهذا الرقم ضمن «بدون منطقة»."
                  : "لا يوجد مرجع رقم+منطقة بعد؛ الصورة من آخر طلبية في هذه المنطقة."}
              </p>
              <a
                href={doorPhotoSrc}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={doorPhotoSrc}
                  alt=""
                  className="max-h-48 max-w-xs rounded-xl border border-sky-200 object-contain"
                />
              </a>
            </div>
          ) : null}

          {!profileForRegion &&
          regionIdParam !== "" &&
          regionIdParam !== NO_REGION_SLUG &&
          !doorPhotoSrc ? (
            <div className={`${ad.section} border-dashed border-amber-200 bg-amber-50/50`}>
              <p className="text-sm font-semibold text-amber-950">
                لا يوجد سجل مرجعي محفوظ لهذا الرقم في هذه المنطقة بعد — يمكن
                إضافته من{" "}
                <Link href="/admin/customers/profiles" className={ad.link}>
                  تفاصيل زبائن مرجعية
                </Link>
                .
              </p>
            </div>
          ) : null}

          <div className="space-y-3">
            <h3 className={ad.h3}>
              طلبيات هذه{" "}
              {regionIdParam === NO_REGION_SLUG ? "الفئة" : "المنطقة"} (
              {ordersFiltered?.length ?? 0})
            </h3>
            {ordersFiltered && ordersFiltered.length === 0 ? (
              <p className="text-slate-600">لا توجد طلبات ضمن هذا التصفية.</p>
            ) : (
              <CustomerOrdersBulkTable orders={tableRows} couriers={couriers} />
            )}
          </div>
        </>
      )}

      <p className={`text-sm ${ad.muted}`}>
        للبحث الأوسع استخدم{" "}
        <Link href="/admin/orders/tracking" className={ad.link}>
          تتبع الطلبات
        </Link>
        .
      </p>
    </div>
  );
}
