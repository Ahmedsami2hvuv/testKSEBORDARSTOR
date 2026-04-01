/**
 * تصغير صور الرفع على الخادم (محلات، إلخ) — JPEG بجودة معقولة.
 */
import sharp from "sharp";

const MAX_EDGE = 1920;
const JPEG_QUALITY = 82;

/** يعيد JPEG — يقلّل الأبعاد ولا يكبّر الصور الصغيرة. */
export async function resizeImageBufferForShop(input: Buffer): Promise<Buffer> {
  return sharp(input)
    .rotate()
    .resize({
      width: MAX_EDGE,
      height: MAX_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: JPEG_QUALITY, mozjpeg: true })
    .toBuffer();
}
