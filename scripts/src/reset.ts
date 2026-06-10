import { pool } from "@workspace/db";

const args = process.argv.slice(2);

if (!args.includes("-rs")) {
  console.log("Cách dùng: pnpm --filter @workspace/scripts run reset -- -rs");
  console.log("Flag -rs: Xoá toàn bộ dữ liệu bot (players, items, cultivation_log)");
  process.exit(0);
}

async function resetAllData() {
  const client = await pool.connect();
  try {
    console.log("⚠️  Bắt đầu reset toàn bộ dữ liệu bot Tu Tiên...");

    await client.query("BEGIN");

    await client.query("TRUNCATE TABLE cultivation_log RESTART IDENTITY CASCADE");
    console.log("✅ Đã xoá bảng cultivation_log");

    await client.query("TRUNCATE TABLE items RESTART IDENTITY CASCADE");
    console.log("✅ Đã xoá bảng items");

    await client.query("TRUNCATE TABLE players RESTART IDENTITY CASCADE");
    console.log("✅ Đã xoá bảng players");

    await client.query("COMMIT");
    console.log("🎉 Reset thành công! Toàn bộ dữ liệu bot đã được xoá.");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Lỗi khi reset:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

resetAllData();
