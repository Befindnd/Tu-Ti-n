'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder,
} = require('discord.js');
const { CE } = require('../systems/emoji');
const fmt = (n) => (n = Number(n)) >= 1e9 ? (n/1e9).toFixed(2)+'tỷ' : n >= 1e6 ? (n/1e6).toFixed(2)+'triệu' : n >= 1e3 ? (n/1e3).toFixed(1)+'k' : n.toString();

const DONATE_DATA = {
  linh_thach: {
    ten: "Linh Thạch",
    get emoji() { return CE('tult','💠'); },
    get mo_ta() {
      return "Nạp **3 loại Linh Thạch** — tiền tệ lưu thông của tu tiên giới.\n"
        + `${CE('tult','💠')} **Thường** · ${CE('tult_trung','🔮')} **Trung** *(1 Trung = 5.000 Thường)* · ${CE('tult_cao','💚')} **Cao** *(1 Cao = 50.000 Thường)*\n`
        + "Linh Thạch nạp **không tính tải trọng** túi trữ vật.";
    },
    // ── 3 loại thực sự, mỗi loại 3 gói (tổng 9 gói) ─────────────────────
    tiers: [
      { id: 1, get emoji() { return CE('tult','💠'); },       ten: 'Linh Thạch Thường', mo_ta: 'Dùng mua vũ khí, đan dược, shop thường' },
      { id: 2, get emoji() { return CE('tult_trung','🔮'); }, ten: 'Linh Thạch Trung',  mo_ta: '1 Trung = 5.000 Thường — dùng cho bí pháp, cảnh giới cao' },
      { id: 3, get emoji() { return CE('tult_cao','💚'); },   ten: 'Linh Thạch Cao',   mo_ta: '1 Cao = 50.000 Thường — dùng cho vật phẩm đỉnh cấp' },
    ],
    goi: [
      // ── Loại 1 — 💠 Linh Thạch Thường ─────────────────────────────────
      {
        id: "lt_t_15k", tier: 1,
        ten: "15.000 Linh Thạch Thường",
        get emoji() { return CE('tult','💠'); },
        gia: "15k VND",
        get phan_thuong() { return `${CE('tult','💠')} 15.000 Linh Thạch Thường`; },
        rewards: { linh_thach: 15e3 },
      },
      {
        id: "lt_t_25k", tier: 1,
        ten: "25.000 Linh Thạch Thường",
        get emoji() { return CE('tult','💠'); },
        gia: "25k VND",
        get phan_thuong() { return `${CE('tult','💠')} 25.000 Linh Thạch Thường`; },
        rewards: { linh_thach: 25e3 },
      },
      {
        id: "lt_t_49k", tier: 1,
        ten: "50.000 Linh Thạch Thường",
        get emoji() { return CE('tult','💠'); },
        gia: "49k VND",
        get phan_thuong() { return `${CE('tult','💠')} 50.000 Linh Thạch Thường`; },
        rewards: { linh_thach: 5e4 },
      },
      // ── Loại 2 — 🔮 Linh Thạch Trung ──────────────────────────────────
      {
        id: "lt_tr_25k", tier: 2,
        ten: "5 Linh Thạch Trung",
        get emoji() { return CE('tult_trung','🔮'); },
        gia: "25k VND",
        get phan_thuong() { return `${CE('tult_trung','🔮')} 5 Linh Thạch Trung *(= 25.000 Thường)*`; },
        rewards: { linh_thach_trung: 5 },
      },
      {
        id: "lt_tr_49k", tier: 2,
        ten: "10 Linh Thạch Trung",
        get emoji() { return CE('tult_trung','🔮'); },
        gia: "49k VND",
        get phan_thuong() { return `${CE('tult_trung','🔮')} 10 Linh Thạch Trung *(= 50.000 Thường)*`; },
        rewards: { linh_thach_trung: 10 },
      },
      {
        id: "lt_tr_99k", tier: 2,
        ten: "22 Linh Thạch Trung",
        get emoji() { return CE('tult_trung','🔮'); },
        gia: "99k VND",
        get phan_thuong() { return `${CE('tult_trung','🔮')} 22 Linh Thạch Trung *(= 110.000 Thường)*`; },
        rewards: { linh_thach_trung: 22 },
      },
      // ── Loại 3 — 💚 Linh Thạch Cao ────────────────────────────────────
      {
        id: "lt_c_49k", tier: 3,
        ten: "1 Linh Thạch Cao",
        get emoji() { return CE('tult_cao','💚'); },
        gia: "49k VND",
        get phan_thuong() { return `${CE('tult_cao','💚')} 1 Linh Thạch Cao *(= 50.000 Thường)*`; },
        rewards: { linh_thach_cao: 1 },
      },
      {
        id: "lt_c_99k", tier: 3,
        ten: "2 Linh Thạch Cao",
        get emoji() { return CE('tult_cao','💚'); },
        gia: "99k VND",
        get phan_thuong() { return `${CE('tult_cao','💚')} 2 Linh Thạch Cao *(= 100.000 Thường)*`; },
        rewards: { linh_thach_cao: 2 },
      },
      {
        id: "lt_c_199k", tier: 3,
        ten: "5 Linh Thạch Cao",
        get emoji() { return CE('tult_cao','💚'); },
        gia: "199k VND",
        get phan_thuong() { return `${CE('tult_cao','💚')} 5 Linh Thạch Cao *(= 250.000 Thường)*`; },
        rewards: { linh_thach_cao: 5 },
      },
    ],
  },
  lan_dau: {
    ten: "Lần Đầu",
    get emoji() { return CE('donate_gift','🎁'); },
    get mo_ta() {
      return "Gói **chỉ mua được 1 lần mỗi gói** — dành riêng cho tu tiên giả mới nhập đạo hoặc muốn một khởi đầu mạnh mẽ.\n" +
        `${CE('tip_icon','💡')} Giá trị vật phẩm cao hơn nhiều so với mua lẻ từng món!`;
    },
    lan_dau: true,
    goi: [
      {
        id: "ld_nhap_dao",
        ten: "Gói Nhập Đạo",
        get emoji() { return CE('gift_nhap_dao','🎁'); },
        gia: "15k VND",
        get phan_thuong() { return `${CE('tult','💠')} 8.000 LT · ${CE('vk_kiem_sat','🗡️')} Tinh Thiết Phi Kiếm (Linh Phẩm) · ${CE('hoi_xuan_dan','🌸')} Hồi Xuân Đan ×1 · ${CE('pha_canh_dan','🌌')} Phá Cảnh Đan ×1`; },
        rewards: { linh_thach: 8e3, vu_khi: "kiem_sat", dan_duoc: "hoi_xuan_dan", dan_duoc_qty: 1, dan_duoc_extra: { id: "pha_canh_dan", qty: 1 } },
      },
      {
        id: "ld_linh_can_mo",
        ten: "Gói Thức Tỉnh Linh Căn",
        get emoji() { return CE('gift_linh_can','🎁'); },
        gia: "29k VND",
        get phan_thuong() { return `${CE('tult','💠')} 10.000 LT · ${CE('ve_linh_can','🎟️')} Vé Thức Tỉnh LC Cơ Bản ×1 · ${CE('bb_van_bao_tui','🎒')} +30kg · ${CE('pha_canh_dan','🌌')} Phá Cảnh Đan ×1`; },
        rewards: { linh_thach: 1e4, ve_linh_can: 1, ve_linh_can_tier: "co_ban", bag_bonus_kg: 30, dan_duoc: "pha_canh_dan", dan_duoc_qty: 1 },
      },
      {
        id: "ld_tui_tru",
        ten: "Gói Túi Không Gian",
        get emoji() { return CE('gift_tui_tru','🎁'); },
        gia: "39k VND",
        get phan_thuong() { return `${CE('tult','💠')} 8.000 LT · ${CE('bb_van_bao_tui','🎒')} Tải trọng +60kg (vĩnh viễn) · ${CE('pha_canh_dan','🌌')} Phá Cảnh Đan ×1`; },
        rewards: { linh_thach: 8e3, bag_bonus_kg: 60, dan_duoc: "pha_canh_dan", dan_duoc_qty: 1 },
      },
      {
        id: "ld_phi_thang",
        ten: "Gói Phi Thăng",
        get emoji() { return CE('gift_phi_thang','🎁'); },
        gia: "49k VND",
        get phan_thuong() { return `${CE('tult','💠')} 18.000 LT · ${CE('vk_linh_kiem','💎')} Thiên Nguyên Linh Phong Kiếm (Thiên Phẩm) · ${CE('pha_canh_dan','🌌')} Phá Cảnh Đan ×2 · ${CE('ve_huyet_mach','🩸')} Vé Đổi HM ×1`; },
        rewards: { linh_thach: 18e3, vu_khi: "linh_kiem", dan_duoc: "pha_canh_dan", dan_duoc_qty: 2, ve_doi_huyet: 1 },
      },
      {
        id: "ld_khai_dao",
        ten: "Gói Khai Đạo",
        get emoji() { return CE('gift_khai_dao','🎁'); },
        gia: "99k VND",
        get phan_thuong() { return `${CE('tult','💠')} 35.000 LT · ${CE('vk_nhat_luan_kiem','☀️')} Nhật Luân Thánh Kiếm (Thần Phẩm) · ${CE('bb_van_bao_tui','🎒')} +60kg · ${CE('pha_canh_dan','🌌')} Phá Cảnh Đan ×2 · ${CE('ve_linh_can','🎟️')} Vé LC Cơ Bản ×1`; },
        rewards: { linh_thach: 35e3, vu_khi: "nhat_luan_kiem", bag_bonus_kg: 60, dan_duoc: "pha_canh_dan", dan_duoc_qty: 2, ve_linh_can: 1, ve_linh_can_tier: "co_ban" },
      },
      {
        id: "ld_vo_song",
        ten: "Gói Vô Song",
        get emoji() { return CE('gift_vo_song','🎁'); },
        gia: "149k VND",
        get phan_thuong() { return `${CE('tult','💠')} 60.000 LT · ${CE('vk_cuu_long_kich','🐉')} Cửu Long Thần Binh Kích (Thần Phẩm) · ${CE('bb_am_duong_bai','☯️')} Âm Dương Thái Cực Bài · ${CE('bb_van_bao_tui','🎒')} +100kg · ${CE('pha_canh_dan','🌌')} Phá Cảnh Đan ×2 · ${CE('ve_huyet_mach','🩸')} Vé HM ×1`; },
        rewards: {
          linh_thach: 6e4,
          vu_khi: "cuu_long_kich",
          bao_boi: "am_duong_bai",
          dan_duoc: "pha_canh_dan",
          dan_duoc_qty: 2,
          bag_bonus_kg: 100,
          ve_doi_huyet: 1,
        },
      },
      {
        id: "ld_thien_dia",
        ten: "Gói Thiên Địa Vô Song",
        get emoji() { return CE('gift_thien_dia','🎁'); },
        gia: "299k VND",
        get phan_thuong() { return `${CE('tult','💠')} 100.000 LT · ${CE('vk_am_ma_kiem','🌑')} Thiên Tử Bá Vương Đao (Hỗn Độn) · ${CE('bb_vo_bien_nhan','💍')} Vô Biên Kiền Khôn Nhẫn · ${CE('bb_van_bao_tui','🎒')} +150kg · ${CE('pha_canh_dan','🌌')} Phá Cảnh Đan ×3 · ${CE('ve_linh_can','🎟️')} Vé LC Cao Cấp ×1 · ${CE('tukv','💎')} Vé HM VIP ×1`; },
        rewards: {
          linh_thach: 1e5,
          vu_khi: "am_ma_kiem",
          bao_boi: "vo_bien_nhan",
          dan_duoc: "pha_canh_dan",
          dan_duoc_qty: 3,
          bag_bonus_kg: 150,
          ve_linh_can: 1,
          ve_linh_can_tier: "cao_cap",
          ve_doi_huyet_vip: 1,
        },
      },
    ],
  },
  tui_tru_vat: {
    ten: "Túi Trữ Vật",
    emoji: "🎒",
    get mo_ta() {
      return `Mở rộng tải trọng túi **vĩnh viễn** — cộng dồn không giới hạn.\nLinh Thạch và đạo cụ nạp donate **không chiếm** tải trọng.\n${CE('tip_icon','💡')} Tải trọng lớn = cày được nhiều vật phẩm hơn khi ra ngoài!`;
    },
    goi: [
      {
        id: "tui_linh",
        ten: "Linh Phẩm +50kg",
        emoji: "🌿",
        gia: "29k VND",
        phan_thuong: "🎒 Tải trọng +50kg vĩnh viễn",
        rewards: { bag_bonus_kg: 50 },
      },
      {
        id: "tui_bao",
        ten: "Bảo Phẩm +80kg",
        get emoji() { return CE('tukv','💎'); },
        gia: "45k VND",
        phan_thuong: "🎒 Tải trọng +80kg vĩnh viễn",
        rewards: { bag_bonus_kg: 80 },
      },
      {
        id: "tui_tien",
        ten: "Tiên Phẩm +130kg",
        emoji: "✨",
        gia: "69k VND",
        phan_thuong: "🎒 Tải trọng +130kg vĩnh viễn",
        rewards: { bag_bonus_kg: 130 },
      },
      {
        id: "tui_than",
        ten: "Thần Phẩm +200kg",
        emoji: "🌟",
        gia: "119k VND",
        phan_thuong: "🎒 Tải trọng +200kg vĩnh viễn",
        rewards: { bag_bonus_kg: 200 },
      },
      {
        id: "tui_hu_khong",
        ten: "Hư Không +300kg",
        emoji: "🏔️",
        gia: "179k VND",
        phan_thuong: "🎒 Tải trọng +300kg vĩnh viễn",
        rewards: { bag_bonus_kg: 300 },
      },
      {
        id: "tui_tuyet_dinh",
        ten: "Tuyệt Đỉnh +500kg",
        emoji: "🌌",
        gia: "279k VND",
        phan_thuong: `🎒 Tải trọng +500kg vĩnh viễn · ${CE('tult','💠')} 10.000 LT bonus`,
        rewards: { bag_bonus_kg: 500, linh_thach: 1e4 },
      },
      {
        id: "tui_399k",
        ten: "Càn Khôn +800kg",
        emoji: "🌌",
        gia: "399k VND",
        phan_thuong: `🎒 Tải trọng +800kg vĩnh viễn · ${CE('tult','💠')} 30.000 LT bonus · 🌌 Phá Cảnh Đan ×1`,
        rewards: { bag_bonus_kg: 800, linh_thach: 3e4, dan_duoc: "pha_canh_dan", dan_duoc_qty: 1 },
      },
      {
        id: "tui_can_khon",
        ten: "Tiểu Thế Giới +1200kg",
        emoji: "🌌",
        gia: "Liên hệ ADMIN",
        phan_thuong: `🎒 Tải trọng +1200kg vĩnh viễn · ${CE('tult','💠')} 50.000 LT bonus`,
        rewards: { bag_bonus_kg: 1200, linh_thach: 5e4 },
        admin_only: true,
      },
      {
        id: "tui_tieu_tg",
        ten: "Hỗn Độn +2000kg",
        emoji: "🌌",
        gia: "Liên hệ ADMIN",
        phan_thuong: `🎒 Tải trọng +2000kg vĩnh viễn · ${CE('tult','💠')} 100.000 LT bonus`,
        rewards: { bag_bonus_kg: 2000, linh_thach: 1e5 },
        admin_only: true,
      },
    ],
  },
  dan_duoc: {
    ten: "Đan Dược",
    emoji: "⚗️",
    mo_ta:
      "Tiên đan **Độc Quyền** — **không thể luyện qua Luyện Đan Sư**, không thể cày được.\n💎 Những tiên đan cực phẩm mà bậc thầy luyện đan hàng trăm năm cũng không đúc nổi.",
    goi: [
      {
        id: "dd_hoi_xuan_1",
        ten: "Hồi Xuân Đan ×1",
        emoji: "🌸",
        gia: "99k VND",
        phan_thuong: "🌸 Hồi Xuân Đan ×1 — Đạo Thương lập tức giảm 1 cấp, thần thể phục hồi như mới!",
        rewards: { dan_duoc: "hoi_xuan_dan", dan_duoc_qty: 1 },
      },
      {
        id: "dd_hoi_xuan_3",
        ten: "Hồi Xuân Đan ×3",
        emoji: "🌸",
        gia: "249k VND",
        phan_thuong: "🌸 Hồi Xuân Đan ×3 — tiết kiệm 48k so với mua lẻ!",
        rewards: { dan_duoc: "hoi_xuan_dan", dan_duoc_qty: 3 },
      },
      {
        id: "dd_tuyet_tinh",
        ten: "Tuyệt Tinh Hoá Đan ×1",
        get emoji() { return CE('cuu_pham_dan_sp','🔷'); },
        gia: "199k VND",
        phan_thuong: "🔷 Tuyệt Tinh Hoá Đan — Tẩy sạch Tâm Ma, Ngộ Tính +30 & Khi Vận +20 vĩnh viễn!",
        rewards: { dan_duoc: "cuu_pham_dan", dan_duoc_qty: 1 },
      },
      {
        id: "dd_tam_tay_sui",
        ten: "Tẩy Tủy Đan ×1",
        emoji: "💎",
        gia: "299k VND",
        phan_thuong: "💎 Tẩy Tủy Đan — Tẩy luyện thể xác, HP Max +20% & DEF +10% vĩnh viễn!",
        rewards: { dan_duoc: "linh_tu_dan", dan_duoc_qty: 1 },
      },
      {
        id: "dd_pha_canh_1",
        ten: "Phá Cảnh Đan ×1",
        emoji: "🌌",
        gia: "199k VND",
        phan_thuong: "🌌 Phá Cảnh Đan ×1 — đột phá ngay 1 tiểu cảnh giới, **BỎ QUA Thiên Kiếp**!",
        rewards: { dan_duoc: "pha_canh_dan", dan_duoc_qty: 1 },
      },
      {
        id: "dd_pha_canh_3",
        ten: "Phá Cảnh Đan ×3",
        emoji: "🌌",
        gia: "399k VND",
        phan_thuong: "🌌 Phá Cảnh Đan ×3 — đột phá 3 cảnh giới liên tiếp, giá tốt nhất!",
        rewards: { dan_duoc: "pha_canh_dan", dan_duoc_qty: 3 },
      },
      {
        id: "dd_nguyen_dan",
        ten: "Nguyên Thần Ngưng Tụ Đan ×1",
        emoji: "🌀",
        gia: "349k VND",
        phan_thuong: "🌀 Nguyên Thần Ngưng Tụ Đan — Crit +10% & Ngộ Tính +20% vĩnh viễn!",
        rewards: { dan_duoc: "nguyen_than_dan", dan_duoc_qty: 1 },
      },
    ],
  },
  phi_khi: {
    ten: "Phi Khí",
    emoji: "⚔️",
    get mo_ta() {
      return `Phi khí **Độc Quyền** — **không thể mua bằng Linh Thạch** tại Linh Bảo Các.\nThay thế vũ khí hiện tại, tăng Công Lực chiến đấu.\n${CE('warn_icon','⚠️')} Mua gói cao hơn **không hoàn tiền** — cân nhắc kỹ trước khi chọn.`;
    },
    goi: [
      {
        id: "pk_49k",
        ten: "Tinh Thiết Phi Kiếm",
        get emoji() { return CE('vk_kiem_sat','🗡️'); },
        gia: "49k VND",
        phan_thuong: "🗡️ Tinh Thiết Phi Kiếm (Linh Phẩm) — ATK +1.500 · Bạo Kích 10%",
        rewards: { vu_khi: "kiem_sat" },
      },
      {
        id: "pk_99k",
        ten: "Vạn Kiếp Thần Lôi Kiếm",
        get emoji() { return CE('vk_than_kiem','🌟'); },
        gia: "99k VND",
        phan_thuong: "🌟 Vạn Kiếp Thần Lôi Kiếm (Thần Phẩm) — ATK +6.000 · Bạo Kích 22% ×3 · Lôi Hệ thiên bẩm",
        rewards: { vu_khi: "than_kiem" },
      },
      {
        id: "pk_149k",
        ten: "Hư Không Thần Uy Cung",
        get emoji() { return CE('vk_than_cung','🏹'); },
        gia: "149k VND",
        phan_thuong: "🏹 Hư Không Thần Uy Cung (Thần Phẩm) — ATK +9.000 · Xuyên Giáp 35% · Tấn công từ xa không bị phản kích",
        rewards: { vu_khi: "than_cung" },
      },
      {
        id: "pk_199k",
        ten: "Nhật Luân Thánh Kiếm",
        get emoji() { return CE('vk_nhat_luan_kiem','☀️'); },
        gia: "199k VND",
        phan_thuong: "☀️ Nhật Luân Thánh Kiếm (Thần Phẩm) — ATK +13.000 · Tích lũy +12% Công Lực/lần hạ địch (tối đa 4 lần)",
        rewards: { vu_khi: "nhat_luan_kiem" },
      },
      {
        id: "pk_249k",
        ten: "Tuyết Tinh Hàn Nguyên Thương",
        get emoji() { return CE('vk_tuyet_tinh_thuong','❄️'); },
        gia: "249k VND",
        phan_thuong: "❄️ Tuyết Tinh Hàn Nguyên Thương (Thần Phẩm) — ATK +17.000 · 30% đóng băng địch 1 lượt · Băng Hệ thiên bẩm",
        rewards: { vu_khi: "tuyet_tinh_thuong" },
      },
      {
        id: "pk_299k",
        ten: "Cửu Long Thần Binh Kích",
        get emoji() { return CE('vk_cuu_long_kich','🐉'); },
        gia: "299k VND",
        phan_thuong: "🐉 Cửu Long Thần Binh Kích (Thần Phẩm) — ATK +22.000 · Xuyên Giáp 45% · Triệu hồi Long Khí khi kết thúc trận",
        rewards: { vu_khi: "cuu_long_kich" },
      },
      {
        id: "pk_399k",
        ten: "Thiên Tử Bá Vương Đao",
        get emoji() { return CE('vk_am_ma_kiem','🔱'); },
        gia: "399k VND",
        phan_thuong: "🔱 Thiên Tử Bá Vương Đao (Hỗn Độn) — ATK +28.000 · Bạo Kích 28% ×3.5 · Kẻ thù thua mất thêm 30% LT",
        rewards: { vu_khi: "am_ma_kiem" },
      },
      {
        id: "pk_am_ma",
        ten: "Ám Ma Cửu Huyền Kiếm",
        get emoji() { return CE('vk_am_ma_kiem','🌑'); },
        gia: "Liên hệ ADMIN",
        phan_thuong: "🌑 Ám Ma Cửu Huyền Kiếm (Hỗn Độn) — ATK +38.000 · Bạo Kích 32% ×3.8 · Hút 12% sát thương → HP",
        rewards: { vu_khi: "am_ma_kiem" },
        admin_only: true,
      },
      {
        id: "pk_hong_mong",
        ten: "Hồng Mông Khai Thiên Kiếm",
        get emoji() { return CE('vk_hong_mong_kiem','🌌'); },
        gia: "Liên hệ ADMIN",
        phan_thuong: "🌌 Hồng Mông Khai Thiên Kiếm (Hỗn Độn) — ATK +55.000 · Bạo Kích 28% ×4.5 · Hủy diệt hiệu ứng giảm sát thương",
        rewards: { vu_khi: "hong_mong_kiem" },
        admin_only: true,
      },
    ],
  },
  linh_bao: {
    ten: "Linh Bảo",
    get emoji() { return CE('ft_linh_bao','🔮'); },
    get mo_ta() {
      return `Linh bảo **Độc Quyền** — **không thể mua bằng Linh Thạch** tại Linh Bảo Các.\n✨ Cộng vào bộ sưu tập bảo bối, **không thay thế nhau**!\n${CE('warn_icon','⚠️')} Nếu đã có, đổi thành 2.000 Linh Thạch.`;
    },
    goi: [
      {
        id: "lb_49k",
        ten: "Thiên Nhãn Kính",
        get emoji() { return CE('bb_bat_qua_kinh','👁️'); },
        gia: "49k VND",
        phan_thuong: "👁️ Thiên Nhãn Kính (Thần Phẩm) — ATK +1.500 · Crit +15% · Xem thông số địch trước khi chiến",
        rewards: { bao_boi: "bat_qua_kinh" },
      },
      {
        id: "lb_99k",
        ten: "Bát Quái Kiền Khôn Kính",
        get emoji() { return CE('bb_bat_qua_kinh','🔯'); },
        gia: "99k VND",
        phan_thuong: "🔯 Bát Quái Kiền Khôn Kính (Thần Phẩm) — ATK +2.500 · DEF +4.500 · Né tránh 28%",
        rewards: { bao_boi: "bat_qua_kinh" },
      },
      {
        id: "lb_149k",
        ten: "Âm Dương Thái Cực Bài",
        get emoji() { return CE('bb_am_duong_bai','☯️'); },
        gia: "149k VND",
        phan_thuong: "☯️ Âm Dương Thái Cực Bài (Thần Phẩm) — ATK +2.000 · DEF +4.000 · Phản kích 20% · Kháng khắc chế âm dương",
        rewards: { bao_boi: "am_duong_bai" },
      },
      {
        id: "lb_199k",
        ten: "Thiên Long Hộ Thể Giáp",
        get emoji() { return CE('bb_thien_long_giap','🐲'); },
        gia: "199k VND",
        phan_thuong: "🐲 Thiên Long Hộ Thể Giáp (Thần Phẩm) — DEF +7.000 · Phản kích 25% ST nhận · Hồi 5% HP mỗi lượt",
        rewards: { bao_boi: "thien_long_giap" },
      },
      {
        id: "lb_249k",
        ten: "Hỗn Độn Linh Châu",
        get emoji() { return CE('bb_hong_mong_chu','🌀'); },
        gia: "249k VND",
        phan_thuong: "🌀 Hỗn Độn Linh Châu (Hỗn Độn) — ATK +5.000 · DEF +5.000 · EXP +10% vĩnh viễn · Miễn 1 loại khắc chế",
        rewards: { bao_boi: "hong_mong_chu" },
      },
      {
        id: "lb_299k",
        ten: "Vô Biên Kiền Khôn Nhẫn",
        get emoji() { return CE('bb_vo_bien_nhan','💍'); },
        gia: "299k VND",
        phan_thuong: "💍 Vô Biên Kiền Khôn Nhẫn (Hỗn Độn) — ATK +9.000 · DEF +9.000 · +22% tổng Công Lực & Thủ Lực",
        rewards: { bao_boi: "vo_bien_nhan" },
      },
      {
        id: "lb_399k",
        ten: "Hồng Mông Huyền Thiên Châu",
        get emoji() { return CE('bb_hong_mong_chu','🌌'); },
        gia: "399k VND",
        phan_thuong: "🌌 Hồng Mông Huyền Thiên Châu (Hỗn Độn) — ATK +7.000 · DEF +7.000 · Hấp thu 35% Công Lực địch · Lá chắn 10% HP/đầu lượt",
        rewards: { bao_boi: "hong_mong_chu" },
      },
    ],
  },
  bi_phap: {
    ten: "Bí Pháp",
    emoji: "📜",
    mo_ta:
      `Bí pháp **Độc Quyền** — **không thể mua bằng Linh Thạch** tại Bí Pháp Các.\n${CE("tia_set","⚡")} Học 1 lần, dùng mãi trong mọi trận đánh.\n${CE('warn_icon','⚠️')} Nếu đã biết, đổi thành 3.000 Linh Thạch.`,
    goi: [
      {
        id: "bp_49k",
        ten: "Tam Hoa Tụ Đỉnh",
        get emoji() { return CE('bp_tam_hoa','🌸'); },
        gia: "49k VND",
        phan_thuong: "🌸 Tam Hoa Tụ Đỉnh — Sát thương 380% Công Lực · Hồi Nguyên Khí · CD 5 lượt",
        rewards: { bi_phap: "tam_hoa" },
      },
      {
        id: "bp_99k",
        ten: "Thiên Địa Hồng Lô",
        get emoji() { return CE('bp_thien_dia_lo','🔥'); },
        gia: "99k VND",
        phan_thuong: "🔥 Thiên Địa Hồng Lô — Sát thương 480% + thiêu đốt 3 lượt (15%/lượt) · CD 6 lượt",
        rewards: { bi_phap: "thien_dia_lo" },
      },
      {
        id: "bp_149k",
        ten: "Băng Vũ Thiên Địa",
        get emoji() { return CE('bp_bang_vu','❄️'); },
        gia: "149k VND",
        phan_thuong: "❄️ Băng Vũ Thiên Địa — Sát thương 420% + đóng băng địch 2 lượt · CD 6 lượt",
        rewards: { bi_phap: "bang_vu" },
      },
      {
        id: "bp_199k",
        ten: "Thiên Hạ Đệ Nhất Kiếm",
        get emoji() { return CE('bp_thien_ha_de_nhat_kiem','🗡️'); },
        gia: "199k VND",
        phan_thuong: "🗡️ Thiên Hạ Đệ Nhất Kiếm — Sát thương 550% + xuyên qua toàn bộ DEF · CD 7 lượt",
        rewards: { bi_phap: "thien_ha_de_nhat_kiem" },
      },
      {
        id: "bp_249k",
        ten: "Hồng Mông Chi Thể",
        get emoji() { return CE('bp_hong_mong_chi_the','🌌'); },
        gia: "249k VND",
        phan_thuong: "🌌 Hồng Mông Chi Thể — Giảm 75% sát thương nhận + phản đòn 20% trong 2 lượt · CD 4 lượt",
        rewards: { bi_phap: "hong_mong_chi_the" },
      },
      {
        id: "bp_299k",
        ten: "Lôi Kiếp Hư Không",
        get emoji() { return CE("tia_set","⚡"); },
        gia: "299k VND",
        phan_thuong: `${CE("tia_set","⚡")} Lôi Kiếp Hư Không — Sát thương 650% + tê liệt địch 1 lượt + Xuyên Giáp 100% · CD 8 lượt`,
        rewards: { bi_phap: "bang_vu" },
      },
      {
        id: "bp_399k",
        ten: "Vạn Kiếm Quy Tông",
        get emoji() { return CE('tuatk','⚔️'); },
        gia: "399k VND",
        phan_thuong: "⚔️ Vạn Kiếm Quy Tông — Sát thương 700% + Ignore DEF hoàn toàn · CD 9 lượt · **Tuyệt kỹ đỉnh cao thiên hạ!**",
        rewards: { bi_phap: "van_kiem_quy_tong" },
      },
      {
        id: "bp_khai_thien",
        ten: "Hỗn Độn Khai Thiên Chưởng",
        emoji: "🌀",
        gia: "Liên hệ ADMIN",
        phan_thuong: "🌀 Hỗn Độn Khai Thiên Chưởng — Sát thương 900% + xóa sạch buff địch · CD 10 lượt",
        rewards: { bi_phap: "van_kiem_quy_tong" },
        admin_only: true,
      },
    ],
  },
  linh_can: {
    ten: "Linh Căn",
    get emoji() { return CE('ve_linh_can','🔮'); },
    mo_ta:
      "Mua **Vé Thức Tỉnh Linh Căn** — dùng lệnh `-linh_can dung` để thức tỉnh **ngẫu nhiên**.\n${CE('warn_icon','⚠️')} Mỗi người chỉ có **1 Linh Căn** tại 1 thời điểm, dùng vé sẽ ghi đè cũ.\n${CE('tip_icon','💡')} **Vé Cơ Bản** random trong 8 linh căn thường · **Vé Cao Cấp** random trong 4 linh căn mạnh nhất.",
    goi: [
      {
        id: "lc_ve_co_ban",
        ten: "Vé Linh Căn Cơ Bản ×1",
        emoji: "🎟️",
        gia: "99k VND",
        phan_thuong: "🎟️ Vé LC Cơ Bản ×1 — Ngẫu nhiên: ⚔️Kim · 🪨Thổ · 💧Thủy · 🌿Mộc · 🔥Hỏa · 🌪️Phong · 🌑Âm · ☀️Dương",
        rewards: { ve_linh_can: 1, ve_linh_can_tier: "co_ban" },
      },
      {
        id: "lc_ve_co_ban_3",
        ten: "Vé Linh Căn Cơ Bản ×3",
        emoji: "🎟️",
        gia: "249k VND",
        phan_thuong: "🎟️ Vé LC Cơ Bản ×3 — Ngẫu nhiên 8 linh căn cơ bản, tiết kiệm 48k!",
        rewards: { ve_linh_can: 3, ve_linh_can_tier: "co_ban" },
      },
      {
        id: "lc_ve_cao_cap",
        ten: "Vé Linh Căn Cao Cấp ×1",
        get emoji() { return CE('tukv','💎'); },
        gia: "249k VND",
        get phan_thuong() { return `${CE('tukv','💎')} Vé LC Cao Cấp ×1 — Ngẫu nhiên: ${CE("tia_set","⚡")}Lôi · 🌀Hỗn Độn · 🌟Thiên · ♾️Vô Cực`; },
        rewards: { ve_linh_can: 1, ve_linh_can_tier: "cao_cap" },
      },
      {
        id: "lc_ve_cao_cap_3",
        ten: "Vé Linh Căn Cao Cấp ×3",
        get emoji() { return CE('tukv','💎'); },
        gia: "399k VND",
        get phan_thuong() { return `${CE('tukv','💎')} Vé LC Cao Cấp ×3 — Ngẫu nhiên 4 linh căn mạnh nhất, tiết kiệm 348k!`; },
        rewards: { ve_linh_can: 3, ve_linh_can_tier: "cao_cap" },
      },
      {
        id: "lc_nguyen_linh",
        ten: "Vé Linh Căn Nguyên Thủy",
        emoji: "🔱",
        gia: "Liên hệ ADMIN",
        phan_thuong: "🔱 Vé Thức Tỉnh Nguyên Linh Căn — ATK+40% · DEF+35% · EXP+30% · Huyền thoại độc nhất",
        rewards: { ve_linh_can: 1, ve_linh_can_tier: "nguyen_linh" },
        admin_only: true,
      },
    ],
  },
  huyet_mach: {
    ten: "Huyết Mạch",
    emoji: "🩸",
    get mo_ta() {
      return `Thức tỉnh Huyết Mạch — thay đổi huyết thống thiên bẩm **vĩnh viễn**, tăng nhân EXP & chiến lực.\n${CE('warn_icon','⚠️')} Mỗi người chỉ có **1 Huyết Mạch** tại 1 thời điểm, mua mới sẽ ghi đè cũ.\n${CE('tip_icon','💡')} **Gợi ý:** Hỗn Độn > Tu La > Cổ Thần cho PvP.`;
    },
    goi: [
      {
        id: "hm_49k",
        ten: "Linh Hồ Huyết Mạch",
        emoji: "🦊",
        gia: "49k VND",
        phan_thuong: "🦊 Linh Hồ — ATK+10% · EXP+8% · Né tránh +15% · EXP nhân ×1.2",
        rewards: { huyet_mach: "linh" },
      },
      {
        id: "hm_99k",
        ten: "Bạch Hổ / Chu Tước",
        emoji: "🐯",
        gia: "99k VND",
        phan_thuong: "🐯 Bạch Hổ — ATK+15% · Crit+22% · ×1.3\n🦩 Chu Tước — ATK+18% · Vượt Kiếp+18% · ×1.6 *(Admin chọn theo yêu cầu)*",
        rewards: { huyet_mach: "linh" },
      },
      {
        id: "hm_149k",
        ten: "Huyền Vũ Huyết Mạch",
        emoji: "🐢",
        gia: "149k VND",
        phan_thuong: "🐢 Huyền Vũ — DEF+35% · Giảm 22% ST nhận · Hồi 5% HP/lượt · EXP nhân ×2.0",
        rewards: { huyet_mach: "thanh" },
      },
      {
        id: "hm_199k",
        ten: "Thanh Long Huyết Mạch",
        emoji: "🐉",
        gia: "199k VND",
        phan_thuong: "🐉 Thanh Long — ATK+22% · Ngộ Đạo+28% khi Thiên Kiếp · Miễn khắc chế ngũ hành · EXP ×2.8",
        rewards: { huyet_mach: "tien" },
      },
      {
        id: "hm_249k",
        ten: "Kim Long Huyết Mạch",
        emoji: "🌟",
        gia: "249k VND",
        phan_thuong: "🌟 Kim Long — ATK+28% · DEF+22% · Crit+18% · Miễn khắc chế kim hệ · EXP ×3.0",
        rewards: { huyet_mach: "co_than" },
      },
      {
        id: "hm_299k",
        ten: "Cổ Thần Hóa Thân",
        emoji: "✨",
        gia: "299k VND",
        phan_thuong: "✨ Cổ Thần — ATK+38% · DEF+32% · EXP+18% · Hồi 10% HP/lượt · EXP ×3.4",
        rewards: { huyet_mach: "co_than" },
      },
      {
        id: "hm_349k",
        ten: "Tu La Sát Thần",
        emoji: "🔥",
        gia: "349k VND",
        phan_thuong: "🔥 Tu La — ATK+58% · Crit+28% · DEF-12% · Đòn đầu luôn bạo kích · Kẻ thua mất thêm 20% LT · EXP ×3.8",
        rewards: { huyet_mach: "tu_la" },
      },
      {
        id: "hm_399k",
        ten: "Hỗn Độn Chi Thể",
        emoji: "🌀",
        gia: "399k VND",
        phan_thuong: "🌀 Hỗn Độn — ATK+65% · DEF+55% · EXP+35% · Miễn khắc chế · Không thể bị crit · EXP ×5",
        rewards: { huyet_mach: "hon_don_the" },
      },
      {
        id: "hm_thien_long",
        ten: "Thiên Long Chí Tôn",
        emoji: "🐲",
        gia: "Liên hệ ADMIN",
        phan_thuong: "🐲 Thiên Long — ATK+50% · DEF+45% · EXP+28% · Bạo kích+22% · Hồi 12% HP/lượt · Miễn khắc chế · EXP ×4.8",
        rewards: { huyet_mach: "thien_long" },
        admin_only: true,
      },
    ],
  },
  huyet_mach_thach: {
    ten: "Huyết Mạch Thạch",
    emoji: "🔴",
    mo_ta:
      "**Huyết Mạch Thạch** — vật liệu để **nâng cấp** và **cường hóa** Huyết Mạch.\nDùng lệnh `-huyet_mach nang_cap` để nâng cấp huyết mạch lên cấp cao hơn.\n${CE('tip_icon','💡')} Càng nhiều HMS, huyết mạch càng mạnh — không giới hạn!",
    goi: [
      {
        id: "hms_99k",
        ten: "Huyết Mạch Thạch ×20",
        emoji: "🔴",
        gia: "99k VND",
        phan_thuong: "🔴 Huyết Mạch Thạch ×20",
        rewards: { huyet_mach_thach: 20 },
      },
      {
        id: "hms_199k",
        ten: "Huyết Mạch Thạch ×45",
        emoji: "🔴",
        gia: "199k VND",
        phan_thuong: "🔴 Huyết Mạch Thạch ×45 (+5 bonus)",
        rewards: { huyet_mach_thach: 50 },
      },
      {
        id: "hms_299k",
        ten: "Huyết Mạch Thạch ×80",
        emoji: "🔴",
        gia: "299k VND",
        phan_thuong: "🔴 Huyết Mạch Thạch ×80 (+10 bonus) · 🩸 Vé Đổi HM ×1",
        rewards: { huyet_mach_thach: 90, ve_doi_huyet: 1 },
      },
      {
        id: "hms_399k",
        ten: "Huyết Mạch Thạch ×130",
        emoji: "🔴",
        gia: "399k VND",
        phan_thuong: "🔴 Huyết Mạch Thạch ×130 (+20 bonus) · 💎 Vé HM VIP ×1",
        rewards: { huyet_mach_thach: 150, ve_doi_huyet_vip: 1 },
      },
    ],
  },
  dac_biet: {
    ten: "Đặc Biệt",
    emoji: "🎫",
    get mo_ta() {
      return `Vật phẩm hỗ trợ đặc biệt — vé đổi nghề, huyết mạch, linh căn và combo tiện ích.\n${CE('tip_icon','💡')} Mua combo tiết kiệm hơn mua lẻ!`;
    },
    goi: [
      {
        id: "db_ve1",
        ten: "Vé Đổi Nghề ×1",
        emoji: "🎫",
        gia: "25k VND",
        phan_thuong: `🎫 Vé Đổi Nghề ×1 — dùng \`-nghe doi <id>\` đổi đường tu miễn 50k ${CE('tult','💠')}`,
        rewards: { ve_doi_nghe: 1 },
      },
      {
        id: "db_ve3",
        ten: "Vé Đổi Nghề ×3",
        emoji: "🎫",
        gia: "65k VND",
        phan_thuong: "🎫 Vé Đổi Nghề ×3 — tiết kiệm 10k so với mua lẻ",
        rewards: { ve_doi_nghe: 3 },
      },
      {
        id: "db_ve5",
        ten: "Vé Đổi Nghề ×5",
        emoji: "🎫",
        gia: "99k VND",
        phan_thuong: "🎫 Vé Đổi Nghề ×5 — tiết kiệm 26k so với mua lẻ",
        rewards: { ve_doi_nghe: 5 },
      },
      {
        id: "db_ve_huyet1",
        ten: "Vé Đổi Huyết Mạch ×1",
        emoji: "🩸",
        gia: "39k VND",
        phan_thuong: "🩸 Vé Đổi HM ×1 — dùng `-huyet_mach doi` random huyết mạch mới",
        rewards: { ve_doi_huyet: 1 },
      },
      {
        id: "db_ve_huyet3",
        ten: "Vé Đổi Huyết Mạch ×3",
        emoji: "🩸",
        gia: "99k VND",
        phan_thuong: "🩸 Vé Đổi HM ×3 — tiết kiệm 18k so với mua lẻ",
        rewards: { ve_doi_huyet: 3 },
      },
      {
        id: "db_ve_huyet_vip1",
        ten: "Vé Huyết Mạch VIP ×1",
        get emoji() { return CE('tukv','💎'); },
        gia: "99k VND",
        get phan_thuong() { return `${CE('tukv','💎')} Vé HM VIP ×1 — \`-huyet_mach doi_vip\` thăng HM **+1 bậc đảm bảo** (Max: Cổ Thần)`; },
        rewards: { ve_doi_huyet_vip: 1 },
      },
      {
        id: "db_ve_huyet_vip3",
        ten: "Vé Huyết Mạch VIP ×3",
        get emoji() { return CE('tukv','💎'); },
        gia: "269k VND",
        get phan_thuong() { return `${CE('tukv','💎')} Vé HM VIP ×3 — tiết kiệm 28k, thăng 3 bậc liên tiếp`; },
        rewards: { ve_doi_huyet_vip: 3 },
      },
      {
        id: "db_ve_linh_can1",
        ten: "Vé Linh Căn Cơ Bản ×1",
        emoji: "🎟️",
        gia: "99k VND",
        phan_thuong: "🎟️ Vé Thức Tỉnh LC Cơ Bản ×1 — ngẫu nhiên trong 8 linh căn cơ bản",
        rewards: { ve_linh_can: 1, ve_linh_can_tier: "co_ban" },
      },
      {
        id: "db_pha_canh",
        ten: "Phá Cảnh Đan ×1",
        emoji: "🌌",
        gia: "199k VND",
        phan_thuong: "🌌 Phá Cảnh Đan ×1 — đột phá 1 tiểu cảnh giới ngay, bỏ qua Thiên Kiếp!",
        rewards: { dan_duoc: "pha_canh_dan", dan_duoc_qty: 1 },
      },
      {
        id: "db_combo_doi",
        ten: "Combo Đổi Toàn Diện",
        emoji: "🔄",
        gia: "299k VND",
        phan_thuong: "🔄 🎫 Vé Nghề ×5 · 🩸 Vé HM ×3 · 💎 Vé HM VIP ×2 · 🎟️ Vé LC Cơ Bản ×1 — Tiết kiệm ~170k!",
        rewards: { ve_doi_nghe: 5, ve_doi_huyet: 3, ve_doi_huyet_vip: 2, ve_linh_can: 1, ve_linh_can_tier: "co_ban" },
      },
      {
        id: "db_combo_vip",
        ten: "Combo VIP",
        emoji: "👑",
        gia: "399k VND",
        phan_thuong: "👑 🎫 Vé Nghề ×5 · 🩸 Vé HM ×3 · 💎 Vé HM VIP ×3 · 🎟️ Vé LC Cao Cấp ×1 · 🌌 Phá Cảnh Đan ×1 — Tiết kiệm ~350k!",
        rewards: { ve_doi_nghe: 5, ve_doi_huyet: 3, ve_doi_huyet_vip: 3, ve_linh_can: 1, ve_linh_can_tier: "cao_cap", dan_duoc: "pha_canh_dan", dan_duoc_qty: 1 },
      },
    ],
  },
  than_thong: {
    ten: "Thần Thông",
    emoji: "✨",
    mo_ta:
      "**Ngọc Giản Thần Thông** — mua từ donate, vào túi trữ vật.\nDùng `-than_thong hoc <id>` để học, hiệu ứng **vĩnh viễn**.\n${CE('warn_icon','⚠️')} Phải đủ **cảnh giới** mới học được. Mỗi thần thông chỉ học **1 lần**.",
    goi: [
      {
        id: "ng_ngung_khi",
        ten: "Ngọc Giản Ngưng Khí Thuật",
        emoji: "🌀",
        gia: "99k VND",
        phan_thuong: "🌀 Ngưng Khí Thuật — ATK +8% vĩnh viễn · Tải trọng +0,44kg",
        rewards: { ngoc_gian: "ngung_khi_thuat", bag_bonus_kg: 0.44 },
      },
      {
        id: "ng_the_phach",
        ten: "Ngọc Giản Thể Phách Cường Hóa",
        emoji: "🐉",
        gia: "99k VND",
        phan_thuong: "🐉 Thể Phách Cường Hóa — HP Max +25% vĩnh viễn · Hồi HP +3%/lượt · Tải trọng +0,44kg",
        rewards: { ngoc_gian: "the_phach_cuong_hoa", bag_bonus_kg: 0.44 },
      },
      {
        id: "ng_linh_giac",
        ten: "Ngọc Giản Linh Giác",
        emoji: "🦅",
        gia: "149k VND",
        phan_thuong: "🦅 Linh Giác — Crit +12% vĩnh viễn · Phát hiện địch ẩn · Tải trọng +0,44kg",
        rewards: { ngoc_gian: "linh_giac", bag_bonus_kg: 0.44 },
      },
      {
        id: "ng_khinh_cong",
        ten: "Ngọc Giản Khinh Công",
        emoji: "🌊",
        gia: "199k VND",
        phan_thuong: "🌊 Khinh Công — Né tránh PvP +18% vĩnh viễn · EXP di chuyển +10% · Tải trọng +0,44kg",
        rewards: { ngoc_gian: "khinh_cong", bag_bonus_kg: 0.44 },
      },
      {
        id: "ng_thien_mu",
        ten: "Ngọc Giản Thiên Mục Thông",
        emoji: "👁️",
        gia: "249k VND",
        phan_thuong: "👁️ Thiên Mục Thông — Xem thông số địch trước PvP · Drop vật phẩm +15% vĩnh viễn · Tải trọng +0,45kg",
        rewards: { ngoc_gian: "linh_giac", bag_bonus_kg: 0.45 },
      },
      {
        id: "ng_linh_khi",
        ten: "Ngọc Giản Linh Khí Hộ Thể",
        get emoji() { return CE('ng_linh_khi_ho_the','🔷'); },
        gia: "249k VND",
        get phan_thuong() { return `${CE('ng_linh_khi_ho_the','🔷')} Linh Khí Hộ Thể — DEF +10% vĩnh viễn · Phản kích 8% ST nhận · Tải trọng +0,46kg`; },
        rewards: { ngoc_gian: "linh_khi_ho_the", bag_bonus_kg: 0.46 },
      },
      {
        id: "ng_kim_chung",
        ten: "Ngọc Giản Kim Chung Tráo",
        emoji: "🌙",
        gia: "299k VND",
        phan_thuong: "🌙 Kim Chung Tráo — Giảm 18% ST nhận PvP vĩnh viễn · Miễn 1 đòn tử thương/trận · Tải trọng +0,56kg",
        rewards: { ngoc_gian: "kim_chung_trao", bag_bonus_kg: 0.56 },
      },
      {
        id: "ng_thiet_bo",
        ten: "Ngọc Giản Thiết Bố Sam",
        emoji: "🦁",
        gia: "349k VND",
        phan_thuong: "🦁 Thiết Bố Sam — DEF +18% · ATK +7% vĩnh viễn · Không thể bị đánh ngã khi HP>30% · Tải trọng +0,56kg",
        rewards: { ngoc_gian: "thiet_bo_sam", bag_bonus_kg: 0.56 },
      },
      {
        id: "ng_thien_phuc",
        ten: "Ngọc Giản Thiên Phúc Chi Thuật",
        emoji: "🔥",
        gia: "399k VND",
        phan_thuong: "🔥 Thiên Phúc Chi Thuật — EXP +12% · Drop Linh Thảo +25% vĩnh viễn · Cơ Duyên thường xuyên hơn · Tải trọng +0,58kg",
        rewards: { ngoc_gian: "thien_phuc_chi_thuat", bag_bonus_kg: 0.58 },
      },
      {
        id: "ng_hon_don_am",
        ten: "Ngọc Giản Hỗn Độn Ấn",
        emoji: "🌀",
        gia: "Liên hệ ADMIN",
        phan_thuong: "🌀 Hỗn Độn Ấn — ATK +15% · DEF +15% vĩnh viễn · Miễn 1 loại khắc chế · Tải trọng +0,80kg",
        rewards: { ngoc_gian: "thien_phuc_chi_thuat", bag_bonus_kg: 0.80 },
        admin_only: true,
      },
    ],
  },
  thien_phu: {
    ten: "Thiên Phú Nghề",
    get emoji() { return CE('tustar','⭐'); },
    get mo_ta() {
      return `Khai phóng **Thiên Phú** ẩn của đường tu — **vĩnh viễn**, **1 lần duy nhất** cho mỗi nghề.\n${CE('warn_icon','⚠️')} Thiên Phú gắn với **nghề tại thời điểm kích hoạt** — đổi nghề không mất.\n${CE('tip_icon','💡')} Chỉ có **1 Thiên Phú** tại 1 thời điểm.`;
    },
    goi: [
      {
        id: "tp_luyen_dan",
        ten: "Đan Vương Thiên Phú",
        emoji: "⚗️",
        gia: "99k VND",
        phan_thuong: "⚗️ Đan Vương — 55% Cực Phẩm khi luyện đan · Thất bại không mất nguyên liệu (yêu cầu: Luyện Đan Sư)",
        rewards: { thien_phu_nghe: "luyen_dan" },
      },
      {
        id: "tp_luyen_khi",
        ten: "Thần Binh Giác Tỉnh",
        emoji: "🔱",
        gia: "99k VND",
        phan_thuong: "🔱 Thần Binh — +12% Công Lực rèn luyện · 10% thức tỉnh kỹ năng ẩn phi khí (yêu cầu: Phi Khí Sư)",
        rewards: { thien_phu_nghe: "luyen_khi" },
      },
      {
        id: "tp_phu_luc",
        ten: "Thiên Phù Hoàn Hảo",
        emoji: "📜",
        gia: "99k VND",
        phan_thuong: "📜 Thiên Phù — ×3.5 LT khi dùng phù · CD phù lục giảm 2h (yêu cầu: Phù Lục Sư)",
        rewards: { thien_phu_nghe: "phu_luc" },
      },
      {
        id: "tp_an_sat",
        ten: "Tuyệt Sát Thiên Tâm",
        emoji: "🗡️",
        gia: "99k VND",
        phan_thuong: "🗡️ Tuyệt Sát — Crit+18% PvP · Cướp+25% LT ám sát · Ẩn thân lần đầu 100% (yêu cầu: Ám Vệ)",
        rewards: { thien_phu_nghe: "an_sat" },
      },
      {
        id: "tp_phong_thuy",
        ten: "Thiên Cơ Minh Đạt",
        emoji: "🧭",
        gia: "99k VND",
        phan_thuong: "🧭 Thiên Cơ — +35% thưởng Cơ Duyên & Bí Cảnh · Dự đoán kết quả Cơ Duyên trước khi chọn (yêu cầu: Phong Thủy Sư)",
        rewards: { thien_phu_nghe: "phong_thuy" },
      },
      {
        id: "tp_duoc_su",
        ten: "Diệu Thủ Thần Y",
        emoji: "💉",
        gia: "99k VND",
        phan_thuong: "💉 Thần Y — Chữa đạo thương MIỄN PHÍ · CD giảm 60% · Hồi HP đồng đội +50% (yêu cầu: Dược Sư)",
        rewards: { thien_phu_nghe: "duoc_su" },
      },
    ],
  },
};

function findDonateGoi(n) {
  for (const [t, e] of Object.entries(DONATE_DATA)) {
    const h = e.goi.find((t) => t.id === n);
    if (h) return { cat_id: t, cat: e, goi: h };
  }
  return null;
}

// ── Parse emoji string thành dạng Discord.js ButtonBuilder chấp nhận ────────
function resolveButtonEmoji(emojiVal) {
  if (!emojiVal) return '💳';
  const s = String(emojiVal);
  // Custom emoji: <:name:id> hoặc <a:name:id>
  const m = s.match(/^<(a?):(\w+):(\d+)>$/);
  if (m) return { animated: m[1] === 'a', name: m[2], id: m[3] };
  // Unicode emoji OK
  return s || '💳';
}

function buildDonateEmbed(n) {
  const t = DONATE_DATA[n];
  if (!t) return null;
  const goiList = t.goi.filter(g => !g.admin_only);
  const adminList = t.goi.filter(g => g.admin_only);

  // ── Nếu category có tiers → nhóm gói theo từng loại ──────────────────
  let goiDesc;
  if (t.tiers) {
    let idx = 0;
    goiDesc = t.tiers.map(tier => {
      const tierGois = goiList.filter(g => g.tier === tier.id);
      const lines = tierGois.map((g) => `${++idx}. ${g.emoji} **${g.ten}** — **${g.gia}**`).join("\n");
      return `**${tier.emoji} Loại ${tier.id} — ${tier.ten}** *(${tier.mo_ta})*\n${lines}`;
    }).join("\n\n");
  } else {
    goiDesc = goiList.map((g, i) => `${i + 1}. ${g.emoji} **${g.ten}** — **${g.gia}**`).join("\n");
  }

  let desc =
    `${t.mo_ta}\n\n` +
    (t.lan_dau ? `${CE('warn_icon','⚠️')} **Gói Lần Đầu chỉ mua được 1 lần mỗi gói!**\n\n` : "") +
    "**Các gói hiện có:**\n" +
    goiDesc;
  if (adminList.length > 0) {
    desc += `\n\n${CE('lock_icon','🔒')} **Gói Đặc Biệt (Liên hệ ADMIN):**\n` +
      adminList.map(g => `▸ ${g.emoji} **${g.ten}**`).join("\n");
  }
  return new EmbedBuilder()
    .setTitle(`${t.emoji} ${t.ten} — Donate Shop`)
    .setColor(0xf5a623)
    .setDescription(desc)
    .setFooter({ text: "Nhấn nút Mua để nhận QR thanh toán | Tự động cộng sau ~30s" });
}

function buildDonateButtons(n, t = 0) {
  const e = DONATE_DATA[n];
  if (!e) return [];
  const h = 5 * t,
    i = e.goi.slice(h, h + 5),
    a = [],
    o = new ActionRowBuilder();
  for (const n of i)
    n.admin_only
      ? o.addComponents(
          new ButtonBuilder()
            .setCustomId(`donate_admin_${n.id}`)
            .setLabel("Liên hệ ADMIN")
            .setStyle(ButtonStyle.Secondary)
            .setEmoji(resolveButtonEmoji(n.emoji)),
        )
      : e.lan_dau
        ? o.addComponents(
            new ButtonBuilder()
              .setCustomId(`donate_buy_${n.id}`)
              .setLabel(`Nhận Quà — ${n.gia}`)
              .setStyle(ButtonStyle.Primary)
              .setEmoji(resolveButtonEmoji(n.emoji)),
          )
        : o.addComponents(
            new ButtonBuilder()
              .setCustomId(`donate_buy_${n.id}`)
              .setLabel(`Mua — ${n.gia}`)
              .setStyle(ButtonStyle.Success)
              .setEmoji(resolveButtonEmoji(n.emoji)),
          );
  o.components.length > 0 && a.push(o);
  const c = new ActionRowBuilder();
  t > 0 &&
    c.addComponents(
      new ButtonBuilder()
        .setCustomId(`donate_page_${n}_${t - 1}`)
        .setLabel("◀ Trang trước")
        .setStyle(ButtonStyle.Secondary),
    );
  h + 5 < e.goi.length &&
    c.addComponents(
      new ButtonBuilder()
        .setCustomId(`donate_page_${n}_${t + 1}`)
        .setLabel("Trang sau ▶")
        .setStyle(ButtonStyle.Secondary),
    );
  c.addComponents(
    new ButtonBuilder()
      .setCustomId("donate_payment_info")
      .setLabel("Hướng dẫn thanh toán")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("💳"),
  );
  c.components.length > 0 && a.push(c);
  return a;
}

function buildDonateCatSelect(n = null) {
  const t = new StringSelectMenuBuilder()
    .setCustomId("donate_cat_select")
    .setPlaceholder("✨ Chọn danh mục donate...")
    .addOptions(
      Object.entries(DONATE_DATA).map(([t, e]) =>
        new StringSelectMenuOptionBuilder()
          .setLabel(e.ten)
          .setDescription(e.ten + (e.lan_dau ? " — Chỉ mua 1 lần!" : ` — ${e.goi.filter(g=>!g.admin_only).length} gói`))
          .setValue(t)
          .setEmoji(e.emoji)
          .setDefault(t === n),
      ),
    );
  return new ActionRowBuilder().addComponents(t);
}

module.exports = { DONATE_DATA, findDonateGoi, buildDonateEmbed, buildDonateButtons, buildDonateCatSelect };
