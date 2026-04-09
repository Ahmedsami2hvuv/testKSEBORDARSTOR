/** بيانات تجهيز التسوق المرسلة من العميل (مطابقة منطق بوت Telegram) */

export type PreparerShoppingProductPayload = {
  line: string;
  buyAlf: number;
  sellAlf: number;
  /** هل قامت الإدارة بتجهيز هذا المنتج بنفسها؟ (يُستثنى من حسابات المجهز) */
  isAdminPrepared?: boolean;
};

export type PreparerShoppingPayloadV1 = {
  version: 1;
  titleLine: string;
  products: PreparerShoppingProductPayload[];
  placesCount: number;
  /** نص القائمة الأصلي (واتساب) للمراجعة */
  rawListText?: string;
};
