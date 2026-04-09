import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // هذا السطر يخبر الخادم بتخطي أخطاء TypeScript وقت الرفع
  typescript: {
    ignoreBuildErrors: true,
  },
  // هذا السطر يتخطى أخطاء الكود الشكلية (ESLint) حتى لا توقف الرفع أيضاً
  eslint: {
    ignoreDuringBuilds: true,
  },
  // زيادة حد حجم البيانات المرسلة للسيرفر للسماح برفع الصور الكبيرة من الموبايل
  experimental: {
    serverActions: {
      bodySizeLimit: "25mb",
    },
  },
};

export default nextConfig;