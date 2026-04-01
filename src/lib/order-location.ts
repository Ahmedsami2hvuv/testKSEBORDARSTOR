/** هل يوجد رابط لوكيشن للزبون (على الطلب) */
export function hasCustomerLocationUrl(
  orderLocation: string | null | undefined,
  _legacyCustomerLocation?: string | null | undefined,
): boolean {
  return !!orderLocation?.trim();
}
