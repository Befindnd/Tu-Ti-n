'use strict';
const { CE } = require('../systems/emoji');

const CO_THU = [
    {
      id: "thien_dao_kinh",
      ten: "Thiên Đạo Kinh",
      phi: 0,
      yeu_cau_cap: 0,
      yeu_cau_ngo: 0,
      kha_nang: ["thap_huyen", "ngu_hanh"],
      mo_ta: "Bổn kinh tu tiên cơ bản, phổ thông nhất.",
    },
    {
      id: "hoa_long_bi_luc",
      ten: "Hỏa Long Bí Lục",
      phi: 2e3,
      yeu_cau_cap: 5,
      yeu_cau_ngo: 20,
      kha_nang: ["thien_long", "van_thuy"],
      mo_ta: "Bí lục của pháp sư thượng cổ về hỏa long kiếm pháp.",
    },
    {
      id: "am_do_bi_tich",
      ten: "Âm Độ Bí Tịch",
      phi: 8e3,
      yeu_cau_cap: 10,
      yeu_cau_ngo: 35,
      kha_nang: ["am_duong", "thanh_lien"],
      mo_ta: "Bí tịch của Âm Dương Song Thánh — chỉ người ngộ tính cao mới lĩnh hội được.",
    },
    {
      id: "ma_kinh_co_qua",
      ten: "Ma Kinh Cổ Quái",
      phi: 15e3,
      yeu_cau_cap: 14,
      yeu_cau_ngo: 30,
      kha_nang: ["ma_dao"],
      mo_ta: `${CE('warn_icon','⚠️')} Tà thư của Ma Vương Cổ Đại, lĩnh ngộ sẽ mất đạo tâm.`,
    },
    {
      id: "vo_shang_kiem_jue",
      ten: "Vô Thượng Kiếm Quyết",
      phi: 5e4,
      yeu_cau_cap: 20,
      yeu_cau_ngo: 60,
      kha_nang: ["diet_tien"],
      mo_ta: "Kiếm quyết tuyệt thế của Kiếm Thánh, chỉ thiên phẩm ngộ tính mới lĩnh hội.",
    },
    {
      id: "hon_don_nguyen_qi",
      ten: "Hỗn Độn Nguyên Khí Phổ",
      phi: 2e5,
      yeu_cau_cap: 30,
      yeu_cau_ngo: 80,
      kha_nang: ["hon_don_kinh"],
      mo_ta: "🌀 Cổ kinh khai thiên lập địa. Tiên phẩm ngộ tính mới có cơ hội lĩnh hội.",
    },
  ],
  LINH_NGO_CD_H = 2,
  LINH_CAN = {
    kim: {
      ten: "Kim Linh Căn",
      bonus_atk: 0.15,
      bonus_def: 0.1,
      bonus_exp: 0,
      get emoji() {
        return CE("lc_kim", "⚔️");
      },
    },
    moc: {
      ten: "Mộc Linh Căn",
      bonus_atk: 0.05,
      bonus_def: 0.05,
      bonus_exp: 0.2,
      get emoji() {
        return CE("lc_moc", "🌿");
      },
    },
    thuy: {
      ten: "Thủy Linh Căn",
      bonus_atk: 0.05,
      bonus_def: 0.15,
      bonus_exp: 0.1,
      get emoji() {
        return CE("lc_thuy", "💧");
      },
    },
    hoa: {
      ten: "Hỏa Linh Căn",
      bonus_atk: 0.18,
      bonus_def: -0.05,
      bonus_exp: 0.05,
      get emoji() {
        return CE("lc_hoa", "🔥");
      },
    },
    tho: {
      ten: "Thổ Linh Căn",
      bonus_atk: 0,
      bonus_def: 0.25,
      bonus_exp: 0.05,
      get emoji() {
        return CE("lc_tho", "🪨");
      },
    },
    hon_don: {
      ten: "Hỗn Độn Linh Căn",
      bonus_atk: 0.15,
      bonus_def: 0.15,
      bonus_exp: 0.15,
      get emoji() {
        return CE("lc_hon_don", "🌀");
      },
    },
    am: {
      ten: "Âm Linh Căn",
      bonus_atk: 0.1,
      bonus_def: 0.05,
      bonus_exp: 0.12,
      get emoji() {
        return CE("lc_am", "🌑");
      },
    },
    duong: {
      ten: "Dương Linh Căn",
      bonus_atk: 0.12,
      bonus_def: 0.08,
      bonus_exp: 0.1,
      get emoji() {
        return CE("lc_duong", "☀️");
      },
    },
    thunder: {
      ten: "Lôi Linh Căn",
      bonus_atk: 0.22,
      bonus_def: -0.1,
      bonus_exp: 0,
      get emoji() {
        return CE("lc_thunder", `${CE("tia_set","⚡")}`);
      },
    },
    phong: {
      ten: "Phong Linh Căn",
      bonus_atk: 0.08,
      bonus_def: 0,
      bonus_exp: 0.25,
      get emoji() {
        return CE("lc_phong", "🌪️");
      },
    },
    thien: {
      ten: "Thiên Linh Căn",
      bonus_atk: 0.18,
      bonus_def: 0.18,
      bonus_exp: 0.18,
      get emoji() {
        return CE("lc_thien", "🌟");
      },
    },
    vo_cuc: {
      ten: "Vô Cực Linh Căn",
      bonus_atk: 0.25,
      bonus_def: 0.12,
      bonus_exp: 0.2,
      get emoji() {
        return CE("lc_vo_cuc", "♾️");
      },
    },
  },
  LINH_CAN_MO_TA = {
    kim: "Thiên về chinh phạt, Công Lực và Thủ Lực vượt trội.",
    moc: "Tu luyện nhanh hơn người, tiến triển bền vững.",
    thuy: "Dẻo dai bất khuất, Thủ Lực và Tu Vi ổn định.",
    hoa: "Bùng nổ sát thương cực cao, khó đỡ!",
    tho: "Phòng thủ kiên cố như núi, khó bị tiêu diệt.",
    hon_don: "🌀 Thiên tư cực hiếm, toàn diện vô song!",
    am: "Huyền bí khó lường, thích hợp ma đạo.",
    duong: "Rực rỡ như mặt trời, soi sáng con đường tu tiên.",
    thunder: `${CE("tia_set","⚡")} Sấm sét bùng nổ, Công Lực tột đỉnh thiên hạ!`,
    phong: "Linh hoạt tựa gió, tốc độ tu luyện nhanh nhất.",
    thien: "🌟 Thiên Tư Di Mạch — Công/Thủ/EXP đều vượt trội, cân bằng hoàn hảo hiếm gặp.",
    vo_cuc: "♾️ Vô Cực Căn Nguyên — Công Lực đỉnh cao nhất trong mọi linh căn, tu luyện tốc độ không thua.",
  },
  HUYET_MACH = {
    pham: {
      ten: "Phàm Huyết",
      multiplier: 1,
      get emoji() { return CE("hm_pham", "🩶"); },
      ce_name: "hm_pham",
      rate: 41,
      he: null,
      dac_tinh: null,
      mo_ta: "Huyết mạch thường dân, không đặc tính.",
    },
    linh: {
      ten: "Bạch Hổ Huyết",
      multiplier: 1.3,
      get emoji() { return CE("hm_linh", "🐯"); },
      ce_name: "hm_linh",
      rate: 30,
      he: "kim",
      dac_tinh: "sat_phat",
      mo_ta: "Hổ tướng sát phạt — crit +20%, kim hệ thiên bẩm.",
    },
    than: {
      ten: "Chu Tước Huyết",
      multiplier: 1.6,
      get emoji() { return CE("hm_than", "🦩"); },
      ce_name: "hm_than",
      rate: 15,
      he: "hoa",
      dac_tinh: "hoa_thuoc",
      mo_ta: "Hỏa điểu thiêu đốt — vượt Thiên Kiếp +15%, hỏa hệ thiên bẩm.",
    },
    thanh: {
      ten: "Huyền Vũ Huyết",
      multiplier: 2,
      get emoji() { return CE("hm_thanh", "🐢"); },
      ce_name: "hm_thanh",
      rate: 8,
      he: "thuy",
      dac_tinh: "phong_thu",
      mo_ta: "Thần Rùa bất phá — Thủ Lực +30%, giảm 20% sát thương nhận vào.",
    },
    tien: {
      ten: "Thanh Long Huyết",
      multiplier: 2.8,
      get emoji() { return CE("hm_tien", "🐉"); },
      ce_name: "hm_tien",
      rate: 4,
      he: null,
      dac_tinh: "vuot_kiep",
      mo_ta: "Thanh Long cổ đại — Ngộ Đạo +25% khi Thiên Kiếp, miễn khắc chế ngũ hành.",
    },
    tu_la: {
      ten: "Tu La Sát Thần",
      multiplier: 3.8,
      get emoji() { return CE("hm_tu_la", "🔥"); },
      ce_name: "hm_tu_la",
      rate: 1,
      he: null,
      dac_tinh: "tu_la_sat",
      mo_ta: "☠️ Tu La Chi Huyết — ATK +55%, Crit +25%, DEF -15% · Đòn đầu tiên mỗi trận luôn bạo kích · Bạo kích nhân ×3.5.",
    },
    co_than: {
      ten: "Cổ Thần Hóa Thân",
      multiplier: 3.4,
      get emoji() { return CE("hm_co_than", "✨"); },
      ce_name: "hm_co_than",
      rate: 1,
      he: null,
      dac_tinh: "co_than_phuc",
      mo_ta: "🏛️ Cổ Thần Chi Huyết — ATK +35%, DEF +30%, EXP +15% · Mỗi lượt chiến đấu hồi phục 8% HP tối đa.",
    },
    thien_long: {
      ten: "Thiên Long Chí Tôn",
      multiplier: 4.5,
      get emoji() { return CE("hm_thien_long", "🐲"); },
      ce_name: "hm_thien_long",
      rate: 0,
      he: null,
      dac_tinh: "thien_long_uy",
      mo_ta: "👑 Thiên Long Thần Mạch — ATK +45%, DEF +40%, EXP +25% · Miễn mọi khắc chế ngũ hành · Bạo kích +20% · Hồi 10% HP/lượt.",
    },
    hon_don_the: {
      ten: "Hỗn Độn Chi Thể",
      multiplier: 5,
      get emoji() { return CE("hm_hon_don", "🌀"); },
      ce_name: "hm_hon_don",
      rate: 0,
      he: null,
      dac_tinh: "hon_don_the",
      mo_ta: "🌌 Hỗn Độn Khai Thiên — ATK +60%, DEF +50%, EXP +30% · Miễn mọi khắc chế · Không thể bị crit · Bạo kích +30% · Hồi 15% HP/lượt.",
    },
  };

module.exports = { CO_THU, LINH_NGO_CD_H, LINH_CAN, LINH_CAN_MO_TA, HUYET_MACH };