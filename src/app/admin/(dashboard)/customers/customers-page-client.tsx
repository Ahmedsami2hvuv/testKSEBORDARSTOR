"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ad } from "@/lib/admin-ui";
import { resolvePublicAssetSrc } from "@/lib/image-url";
import { CustomerPhoneRows, type CustomerPhoneRowUi } from "./customer-phone-rows";
import { CustomerProfileUpsertForm } from "./profiles/customer-profile-upsert-form";

type RegionOption = { id: string; name: string };
type ProfileRow = {
  id: string;
  phone: string;
  regionName: string;
  locationUrl: string;
  landmark: string;
  alternatePhone: string | null;
  notes: string;
  photoUrl: string;
};

export function CustomersPageClient({
  rows,
  regionOptions,
  profiles,
}: {
  rows: CustomerPhoneRowUi[];
  regionOptions: RegionOption[];
  profiles: ProfileRow[];
}) {
  const [query, setQuery] = useState("");
  const [showProfiles, setShowProfiles] = useState(false);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => {
      const blob = [
        r.phone,
        r.totalOrders.toString(),
        r.totalAmountLabel,
        ...r.regions.flatMap((x) => [
          x.name,
          x.landmark,
          x.totalLabel,
          x.orderCount.toString(),
        ]),
      ]
        .join(" ")
        .toLowerCase();
      return blob.includes(q);
    });
  }, [rows, query]);

  return (
    <>
      <section className={`${ad.section} space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className={ad.h2}>قائمة الزبائن</h2>
          <button
            type="button"
            onClick={() => setShowProfiles((v) => !v)}
            className={ad.btnPrimary}
          >
            {showProfiles ? "إخفاء إضافة زبون" : "إضافة زبون"}
          </button>
        </div>
        <label className="block">
          <span className={ad.label}>بحث فوري</span>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="رقم، منطقة، أقرب نقطة، عدد طلبات، مبلغ…"
            className={`${ad.input} mt-1`}
          />
        </label>
      </section>

      <div className={ad.section}>
        <CustomerPhoneRows rows={filteredRows} />
      </div>

      {showProfiles ? (
        <>
          <section id="profiles" className={`${ad.section} space-y-4`}>
            <div>
              <h2 className={ad.h2}>تفاصيل زبائن مرجعية</h2>
              <p className={`mt-1 ${ad.lead}`}>
                احفظ لكل <strong className="text-sky-900">رقم + منطقة</strong>{" "}
                <strong className="text-sky-900">اللوكيشن</strong>،{" "}
                <strong className="text-sky-900">أقرب نقطة دالة</strong>،{" "}
                <strong className="text-sky-900">صورة باب</strong>،{" "}
                <strong className="text-sky-900">رقم ثانٍ</strong>، وملاحظات.
              </p>
            </div>
            <CustomerProfileUpsertForm regions={regionOptions} />
          </section>

          <section className={ad.section}>
            <h2 className={ad.h2}>السجلات المرجعية المحفوظة</h2>
            {profiles.length === 0 ? (
              <p className="mt-3 text-center text-slate-600">
                لا توجد تفاصيل محفوظة بعد — استخدم النموذج أعلاه.
              </p>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[32rem] text-sm">
                  <thead>
                    <tr className="border-b border-sky-200 text-right text-xs text-slate-500">
                      <th className="pb-2 pe-2 font-medium">الهاتف</th>
                      <th className="pb-2 font-medium">المنطقة</th>
                      <th className="pb-2 font-medium">لوكيشن</th>
                      <th className="pb-2 font-medium">دالة</th>
                      <th className="pb-2 font-medium">ثانٍ</th>
                      <th className="pb-2 font-medium">ملاحظة</th>
                      <th className="pb-2 font-medium">صورة</th>
                      <th className="pb-2 font-medium w-28">إجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    {profiles.map((p) => {
                      const photoSrc = resolvePublicAssetSrc(p.photoUrl);
                      return (
                        <tr
                          key={p.id}
                          className="border-b border-slate-100 text-slate-800 align-top"
                        >
                          <td className="py-2 pe-2 font-mono tabular-nums">{p.phone}</td>
                          <td className="py-2">{p.regionName}</td>
                          <td className="py-2 max-w-[14rem]">
                            {p.locationUrl ? (
                              <a
                                href={p.locationUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className={`${ad.link} break-all`}
                              >
                                عرض
                              </a>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2 max-w-[10rem] text-slate-600">
                            {p.landmark.trim() ? (
                              <span className="line-clamp-2 text-xs" title={p.landmark}>
                                {p.landmark.trim()}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2 font-mono text-xs tabular-nums text-slate-700">
                            {p.alternatePhone?.trim() ? p.alternatePhone.trim() : "—"}
                          </td>
                          <td className="py-2 max-w-[10rem] text-slate-600">
                            {p.notes.trim() ? (
                              <span className="line-clamp-2 text-xs" title={p.notes}>
                                {p.notes.trim()}
                              </span>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2">
                            {photoSrc ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={photoSrc}
                                alt=""
                                className="h-12 w-12 rounded-lg border border-sky-100 object-cover"
                              />
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="py-2">
                            <Link
                              href={`/admin/customers/profiles/${p.id}/edit`}
                              className={ad.link}
                            >
                              تعديل
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      ) : null}
    </>
  );
}

