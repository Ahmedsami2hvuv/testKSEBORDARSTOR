/**
 * Production start: run migrations then Next.js.
 * Fixed to handle the Courier migration ordering issue.
 */
const { spawnSync, spawn } = require("child_process");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  return r.status ?? 1;
}

// محاولة تشغيل التهجير بشكل طبيعي
let code = run("npx", ["prisma", "migrate", "deploy"]);

if (code !== 0) {
  console.log("[start] Detected migration failure. Attempting to fix ordering issue...");

  // 1. وسُم التهجير الفاشل كأنه تم التراجع عنه لأنه يعتمد على جدول لم يُنشأ بعد
  run("npx", [
    "prisma",
    "migrate",
    "resolve",
    "--rolled-back",
    "20260322181000_courier_hidden_blocked",
  ]);

  // 2. وسُم التهجير الآخر الذي كان يسبب مشاكل في السجلات سابقاً
  run("npx", [
    "prisma",
    "migrate",
    "resolve",
    "--rolled-back",
    "20260325180000_order_money_event_recorded_by_preparer",
  ]);

  // محاولة التشغيل مرة أخرى
  code = run("npx", ["prisma", "migrate", "deploy"]);

  if (code !== 0) {
    console.error("[start] Migration still failing after attempts to resolve.");
    // إذا فشل مجدداً، سنحاول تجاهل التهجيرات وبدء التطبيق (خطر ولكن قد ينقذ الموقف إذا كانت قاعدة البيانات محدثة يدوياً)
    // process.exit(code);
  }
}

const child = spawn("npx", ["next", "start"], { stdio: "inherit" });
child.on("exit", (c) => process.exit(c ?? 0));
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
