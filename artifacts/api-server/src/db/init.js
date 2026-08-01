'use strict';
/**
 * db/init.js
 * Database schema initialisation.
 *
 * Creates core tables and applies additive ALTER TABLE migrations.
 * Safe to run on every startup — all operations are idempotent.
 */
const { db } = require('./pool');

async function initDB() {
  // ── Core tables ───────────────────────────────────────────────────────
  await db(
    `CREATE TABLE IF NOT EXISTS players (
      user_id       TEXT PRIMARY KEY,
      username      TEXT NOT NULL,
      canh_gioi     INT DEFAULT 0,
      exp           BIGINT DEFAULT 0,
      hp            BIGINT DEFAULT 100,
      hp_max        BIGINT DEFAULT 100,
      linh_thach    BIGINT DEFAULT 0,
      linh_can      TEXT DEFAULT 'moc',
      huyet_mach    TEXT DEFAULT 'pham',
      cong_phap     TEXT DEFAULT 'thap_huyen',
      nghe          TEXT DEFAULT NULL,
      tam_ma        INT DEFAULT 100,
      tu_luyen_cd   BIGINT DEFAULT 0,
      pvp_cd        BIGINT DEFAULT 0,
      dong_phu      TEXT DEFAULT NULL,
      vu_khi        TEXT DEFAULT 'kiem_go',
      bao_boi       TEXT[] DEFAULT '{}',
      bi_phap       TEXT[] DEFAULT '{}',
      boss_cooldown JSONB DEFAULT '{}',
      pvp_wins      INT DEFAULT 0,
      pvp_losses    INT DEFAULT 0,
      linh_thao     JSONB DEFAULT '{}',
      dan_duoc      JSONB DEFAULT '{}',
      phu_luc       JSONB DEFAULT '{}',
      buff_active   JSONB DEFAULT '{}',
      vu_khi_cap    INT DEFAULT 0,
      kiem_thao_cd  BIGINT DEFAULT 0,
      am_sat_cd     BIGINT DEFAULT 0,
      phong_thuy_cd BIGINT DEFAULT 0,
      created_at    TIMESTAMP DEFAULT NOW(),
      last_active   TIMESTAMP DEFAULT NOW()
    )`,
  );

  // ── Additive migrations (idempotent) ─────────────────────────────────
  const migrations = [
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS linh_thao JSONB DEFAULT '{}'",
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS dan_duoc JSONB DEFAULT '{}'",
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS phu_luc JSONB DEFAULT '{}'",
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS buff_active JSONB DEFAULT '{}'",
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS vu_khi_cap INT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS kiem_thao_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS am_sat_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS phong_thuy_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS tu_luyen_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS pvp_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS last_active TIMESTAMP DEFAULT NOW()',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS tong_mon TEXT DEFAULT NULL',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS la_ma_tu BOOLEAN DEFAULT FALSE',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS co_duyen_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS bi_canh_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS binh_canh BOOLEAN DEFAULT FALSE',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS ngo_tinh INT DEFAULT 50',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS khi_van INT DEFAULT 30',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS nhan_qua INT DEFAULT 0',
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS tong_mon_cap TEXT DEFAULT 'ngoai_mon'",
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS co_phap_ngo TEXT[] DEFAULT '{}'",
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS linh_ngo_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS ma_khi INT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS cong_duc INT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS cam_ngo INT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS hap_thu_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS nghe_locked BOOLEAN DEFAULT FALSE',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS diem_danh_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS ban_until BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS boss_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ALTER COLUMN nghe DROP DEFAULT',
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS daily_missions JSONB DEFAULT '{}'",
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS mission_reset_date TEXT DEFAULT NULL',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS ve_doi_nghe INTEGER DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS ve_doi_linh_can INTEGER DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS ve_doi_linh_can_cao_cap INTEGER DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS ve_doi_linh_can_nguyen INTEGER DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS ve_doi_huyet INTEGER DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS ve_doi_huyet_vip INTEGER DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS ve_nang_cap_huyet INTEGER DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS trinh_sat_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS tu_linh_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS dao_thuong INT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS chua_thuong_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS an_ngu_until BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS an_ngu_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS khai_van_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS bao_linh_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS phu_baoho_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS luyen_thuoc_cd BIGINT DEFAULT 0',
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS lan_dau_mua TEXT[] DEFAULT '{}'",
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS bag_bonus_kg FLOAT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS ngan_hang BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS ngan_hang_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS tui_nang_cap INT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS dao_thuong_at BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS thien_phu_nghe TEXT DEFAULT NULL',
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS ngoc_gian_tui JSONB DEFAULT '{}'",
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS than_thong TEXT[] DEFAULT '{}'",
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS thap_thi_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS thap_tang INT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS vuot_kiep_cd BIGINT DEFAULT 0',
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS khoang_vat JSONB DEFAULT '{}'",
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS khai_quang_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS noi_tai_an_unlocked BOOLEAN DEFAULT FALSE',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS linh_thach_trung BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS linh_thach_cao BIGINT DEFAULT 0',
    // ── Săn Linh Thú ──────────────────────────────────────────────────────
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS san_linh_thu_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS cuop_tui_cd BIGINT DEFAULT 0',
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS vat_pham JSONB DEFAULT '{}'",
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS dao_tu TEXT DEFAULT NULL',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS ve_doi_dao_tu INTEGER DEFAULT 0',
    // ── Vote top.gg ───────────────────────────────────────────────────────
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS vote_bot_at    TIMESTAMP DEFAULT NULL',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS vote_server_at TIMESTAMP DEFAULT NULL',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS vote_count     INT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS vote_notify    BOOLEAN DEFAULT TRUE',
    // ── Đan dược donate permanent bonuses ────────────────────────────────
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS linh_tu_hp_bonus  FLOAT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS linh_tu_def_bonus FLOAT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS nguyen_than_crit  FLOAT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS bao_che_cd BIGINT DEFAULT 0',
    // ── Gia Tộc ───────────────────────────────────────────────────────────
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS gia_toc TEXT DEFAULT NULL',
    // ── Lịch Sử Nạp ──────────────────────────────────────────────────────
    "ALTER TABLE players ADD COLUMN IF NOT EXISTS nap_log JSONB DEFAULT '[]'",
    // ── Đố Vui ───────────────────────────────────────────────────────────
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS do_vui_cd BIGINT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS do_vui_diem INT DEFAULT 0',
    'ALTER TABLE players ADD COLUMN IF NOT EXISTS do_vui_streak_max INT DEFAULT 0',
  ];

  for (const sql of migrations) {
    await db(sql).catch(() => {});
  }

  // ── Nhà Đấu Giá ──────────────────────────────────────────────────────
  await db(`
    CREATE TABLE IF NOT EXISTS auctions (
      id           SERIAL PRIMARY KEY,
      seller_id    TEXT NOT NULL,
      seller_name  TEXT NOT NULL,
      item_type    TEXT NOT NULL,
      item_id      TEXT NOT NULL,
      item_qty     INT DEFAULT 1,
      gia_khoi     BIGINT NOT NULL,
      gia_hien     BIGINT NOT NULL,
      gia_mua_ngay BIGINT DEFAULT NULL,
      bidder_id    TEXT DEFAULT NULL,
      bidder_name  TEXT DEFAULT NULL,
      expires_at   TIMESTAMP NOT NULL,
      status       TEXT DEFAULT 'active',
      created_at   TIMESTAMP DEFAULT NOW()
    )
  `).catch(() => {});
  await db(`CREATE INDEX IF NOT EXISTS idx_auctions_status ON auctions(status, expires_at)`).catch(() => {});
  await db(`CREATE INDEX IF NOT EXISTS idx_auctions_seller ON auctions(seller_id, status)`).catch(() => {});

  // ── Pending payments (auto-pay webhook) ──────────────────────────────
  await db(
    `CREATE TABLE IF NOT EXISTS pending_payments (
      id          SERIAL PRIMARY KEY,
      pay_code    TEXT UNIQUE NOT NULL,
      user_id     TEXT NOT NULL,
      username    TEXT NOT NULL,
      guild_id    TEXT DEFAULT NULL,
      channel_id  TEXT DEFAULT NULL,
      goi_id      TEXT NOT NULL,
      amount      BIGINT NOT NULL,
      status      TEXT DEFAULT 'pending',
      created_at  TIMESTAMP DEFAULT NOW(),
      paid_at     TIMESTAMP DEFAULT NULL,
      expires_at  TIMESTAMP DEFAULT NOW() + INTERVAL '24 hours'
    )`,
  ).catch(() => {});
  await db(`CREATE INDEX IF NOT EXISTS idx_pp_pay_code ON pending_payments(pay_code)`).catch(() => {});
  await db(`CREATE INDEX IF NOT EXISTS idx_pp_user ON pending_payments(user_id, status)`).catch(() => {});

  // expire old pending payments on startup
  await db(`UPDATE pending_payments SET status='expired' WHERE status='pending' AND expires_at < NOW()`).catch(() => {});

  // ── Gift-code table ───────────────────────────────────────────────────
  await db(
    `CREATE TABLE IF NOT EXISTS giftcodes (
      code       TEXT PRIMARY KEY,
      rewards    JSONB NOT NULL DEFAULT '{}',
      max_uses   INT DEFAULT 1,
      used_by    TEXT[] DEFAULT '{}',
      created_at TIMESTAMP DEFAULT NOW(),
      expires_at TIMESTAMP DEFAULT NULL
    )`,
  ).catch(() => {});

  // ── Data integrity fix: reset cong_phap for under-level players ───────
  await db(
    `UPDATE players SET cong_phap = 'thap_huyen' WHERE
      (cong_phap = 'ngu_hanh'     AND canh_gioi < 3)  OR
      (cong_phap = 'thien_long'   AND canh_gioi < 10) OR
      (cong_phap = 'van_thuy'     AND canh_gioi < 10) OR
      (cong_phap = 'ma_dao'       AND canh_gioi < 10) OR
      (cong_phap = 'am_duong'     AND canh_gioi < 14) OR
      (cong_phap = 'thanh_lien'   AND canh_gioi < 14) OR
      (cong_phap = 'diet_tien'    AND canh_gioi < 18) OR
      (cong_phap = 'hon_don_kinh' AND canh_gioi < 30)`,
  ).catch((e) => console.warn('⚠️ Reset cong_phap:', e.message));

  await db("ALTER TABLE giftcodes ADD COLUMN IF NOT EXISTS min_canh_gioi INT DEFAULT 0").catch(() => {});
  await db("ALTER TABLE giftcodes ADD COLUMN IF NOT EXISTS target_user_id TEXT DEFAULT NULL").catch(() => {});

  // ── CD bí pháp gia tộc ngoài PvP ─────────────────────────────────────
  await db("ALTER TABLE players ADD COLUMN IF NOT EXISTS bi_phap_cd JSONB DEFAULT '{}'").catch(() => {});

  // ── Bot settings (persistent key-value store) ─────────────────────────
  await db(
    `CREATE TABLE IF NOT EXISTS bot_settings (
      key   TEXT PRIMARY KEY,
      value JSONB NOT NULL DEFAULT '{}'
    )`,
  ).catch(() => {});

  console.log('✅ Database khởi tạo xong.');
}

module.exports = { initDB };
