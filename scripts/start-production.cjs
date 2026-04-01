/**
 * Production start: run migrations then Next.js.
 * If deploy hits P3009 (failed migration record from a broken historical migration),
 * mark that migration rolled back once and retry deploy — unblocks Railway without manual DB access.
 */
const { spawnSync, spawn } = require("child_process");

function run(cmd, args) {
  const r = spawnSync(cmd, args, { stdio: "inherit" });
  return r.status ?? 1;
}

let code = run("npx", ["prisma", "migrate", "deploy"]);
if (code !== 0) {
  console.error(
    "[start] prisma migrate deploy failed — attempting resolve for 20260325180000_order_money_event_recorded_by_preparer (P3009 recovery)",
  );
  run("npx", [
    "prisma",
    "migrate",
    "resolve",
    "--rolled-back",
    "20260325180000_order_money_event_recorded_by_preparer",
  ]);
  code = run("npx", ["prisma", "migrate", "deploy"]);
  if (code !== 0) {
    process.exit(code);
  }
}

const child = spawn("npx", ["next", "start"], { stdio: "inherit" });
child.on("exit", (c) => process.exit(c ?? 0));
child.on("error", (err) => {
  console.error(err);
  process.exit(1);
});
