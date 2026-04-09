import { resizeImageBufferForShop } from "@/lib/image-resize";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

// رفع الحد الأقصى للرفع إلى 20 ميجابايت لضمان قبول كافة صور الهواتف الحديثة
export const MAX_ORDER_IMAGE_BYTES = 20 * 1024 * 1024;

// رفع حد التخزين في قاعدة البيانات لضمان بقاء الصور الكبيرة مستقرة حتى لو فشل التصغير
const MAX_BASE64_STORAGE_BYTES = 10 * 1024 * 1024;

export function inferImageMime(file: File): string | null {
  const t = file.type?.trim().toLowerCase();
  if (t && IMAGE_TYPES.has(t)) return t;
  const n = file.name.toLowerCase();
  if (n.endsWith(".png")) return "image/png";
  if (n.endsWith(".webp")) return "image/webp";
  if (n.endsWith(".jpg") || n.endsWith(".jpeg")) return "image/jpeg";
  return null;
}

/**
 * تحويل الصورة إلى Base64 وتخزينها في قاعدة البيانات مباشرة لضمان عدم ضياعها عند إعادة البناء (Railway).
 */
async function processImageToBase64(file: File): Promise<string> {
  // التحقق الأولي من الحجم المرفوع
  if (file.size > MAX_ORDER_IMAGE_BYTES) {
    throw new Error("IMAGE_TOO_LARGE");
  }
  const mime = inferImageMime(file);
  if (!mime) {
    throw new Error("IMAGE_BAD_TYPE");
  }

  const arrayBuffer = await file.arrayBuffer();
  let buf: Buffer = Buffer.from(arrayBuffer);

  // نظام التصغير التلقائي (Resize) لتقليل استهلاك الذاكرة
  try {
    const resized = await resizeImageBufferForShop(buf);
    if (resized) {
      buf = resized as Buffer;
    }
  } catch (e) {
    console.error("Image resize failed, using original", e);
  }

  // التحقق النهائي بعد الضغط
  if (buf.length > MAX_BASE64_STORAGE_BYTES) {
    throw new Error("IMAGE_TOO_LARGE_AFTER_RESIZE");
  }

  const b64 = buf.toString("base64");
  // تحويل البيانات إلى Data URL لتعمل مباشرة في المتصفح دون الحاجة لملفات خارجية
  // نستخدم دائماً jpeg كنوع للمخرجات لأن Sharp يحولها لـ jpeg في resizeImageBufferForShop
  return `data:image/jpeg;base64,${b64}`;
}

export async function saveOrderImageUploaded(file: File, _maxBytes: number) {
  return processImageToBase64(file);
}

export async function saveCustomerDoorPhotoUploaded(file: File, _maxBytes: number) {
  return processImageToBase64(file);
}

export async function saveShopDoorPhotoUploaded(file: File, _maxBytes: number) {
  return processImageToBase64(file);
}

export async function saveCustomerProfilePhotoUploaded(file: File, _maxBytes: number) {
  return processImageToBase64(file);
}

export async function saveStoreCategoryImageUploaded(file: File, _maxBytes: number) {
  return processImageToBase64(file);
}

export async function saveStoreProductImageUploaded(file: File, _maxBytes: number) {
  return processImageToBase64(file);
}

export async function saveStoreBranchImageUploaded(file: File, _maxBytes: number) {
  return processImageToBase64(file);
}

export async function saveOrderImageFromResizedBuffer(jpegBuffer: Buffer, _maxBytes: number) {
  return `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
}
export async function saveCustomerDoorPhotoFromResizedBuffer(jpegBuffer: Buffer, _maxBytes: number) {
  return `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
}
export async function saveShopDoorPhotoFromResizedBuffer(jpegBuffer: Buffer, _maxBytes: number) {
  return `data:image/jpeg;base64,${jpegBuffer.toString("base64")}`;
}
export async function saveShopPhotoUploaded(file: File, maxBytes: number) {
  return saveShopDoorPhotoUploaded(file, maxBytes);
}
export async function saveShopPhotoFromResizedBuffer(jpegBuffer: Buffer, maxBytes: number) {
  return saveShopDoorPhotoFromResizedBuffer(jpegBuffer, maxBytes);
}
