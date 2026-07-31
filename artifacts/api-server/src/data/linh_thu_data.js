'use strict';
/**
 * data/linh_thu_data.js
 * Dữ liệu tĩnh cho tính năng Săn Linh Thú (đội tối đa 3 người).
 * v2: CD giảm 1/2 · Độ khó tăng · Passive nội tại · Loot drops
 */

const { CE } = require('../systems/emoji');

// ── Bậc linh thú ─────────────────────────────────────────────────────────────
const LINH_THU_TIERS = {
  pho_thong: {
    ten: 'Phổ Thông', emoji: '🟢',
    min_canh_gioi: 0,
    atkM: [0.77, 1.13], defM: [0.59, 0.86], hpM_base: [1.80, 2.70],
    hpM_per_member: 0.50,
    cd_h: 0.25, max_turns: 20,  // 15 phút
  },
  hiem: {
    ten: 'Hiếm', emoji: '🔵',
    min_canh_gioi: 5,
    atkM: [1.44, 1.98], defM: [1.13, 1.58], hpM_base: [3.60, 5.40],
    hpM_per_member: 0.90,
    cd_h: 0.5, max_turns: 20,  // 30 phút
  },
  su_thi: {
    ten: 'Sử Thi', emoji: '🟣',
    min_canh_gioi: 10,
    atkM: [2.16, 3.06], defM: [1.71, 2.39], hpM_base: [6.12, 9.18],
    hpM_per_member: 1.17,
    cd_h: 0.75, max_turns: 25, // 45 phút
  },
  huyen_thoai: {
    ten: 'Huyền Thoại', emoji: '🔴',
    min_canh_gioi: 15,
    atkM: [2.60, 3.70], defM: [1.95, 2.75], hpM_base: [9.00, 13.50],
    hpM_per_member: 1.35,
    cd_h: 1, max_turns: 30,    // 1 tiếng
  },
  than_thu: {
    ten: 'Thần Thú', emoji: '⚫',
    min_canh_gioi: 20,
    atkM: [2.80, 3.90], defM: [2.10, 3.00], hpM_base: [10.00, 15.00],
    hpM_per_member: 1.40,
    cd_h: 1.5, max_turns: 45,  // 1.5 tiếng
  },
};

// ── Danh sách linh thú theo bậc ──────────────────────────────────────────────
// passive: id nội tại — được áp dụng tự động mỗi lượt hoặc khi tấn công
// passive_desc: mô tả ngắn hiển thị cho người chơi
const LINH_THU_LIST = {
    pho_thong: [
      {
        id: 'doc_lang', ten: 'Độc Lang', get mu() { return CE('lt_doc_lang', '🐺'); }, element: 'moc',
        skill: 'doc_nha', skill_cd: 3,
        skill_desc: 'Hàm Độc — cắn xé gây **10% HP** độc cho 1 thành viên trong **3 lượt**',
        skill2: 'bao_thu', skill2_cd: 4,
        skill2_desc: 'Bạo Thụ — tăng ATK thú **60% trong 2 lượt** + giáng 2 đòn liên tiếp vào 1 mục tiêu',
        passive: 'doc_tich_luy',
        passive_desc: '☠️ **Nọc Tích Lũy** — mỗi đòn thường có 30% gây độc thêm 1 lượt',
      },
      {
        id: 'hoa_ho', ten: 'Hỏa Hồ', get mu() { return CE('lt_hoa_ho', '🦊'); }, element: 'hoa',
        skill: 'hoa_thiet', skill_cd: 3,
        skill_desc: 'Hỏa Thiệt — phun lửa, giảm **DEF 25%** toàn đội trong **3 lượt**',
        skill2: 'hoa_cuong', skill2_cd: 5,
        skill2_desc: 'Hỏa Cuồng — ATK thú **+50% trong 3 lượt** + đốt toàn đội thêm 2 lượt',
        passive: 'than_hoa',
        passive_desc: '🔥 **Thân Hỏa** — hấp thụ 25% sát thương từ bí pháp, đầu lượt đốt cháy toàn đội 3% HP',
      },
      {
        id: 'bang_hung', ten: 'Băng Hùng', get mu() { return CE('lt_bang_hung', '🐻'); }, element: 'thuy',
        skill: 'bang_chua', skill_cd: 4,
        skill_desc: 'Băng Trấn — đóng băng **toàn đội** 1 lượt',
        skill2: 'bang_than', skill2_cd: 5,
        skill2_desc: 'Băng Thân Kiên Cố — **DEF tăng 80% trong 2 lượt** + hồi 12% HP',
        passive: 'bang_giap',
        passive_desc: '❄️ **Băng Giáp** — hồi 2% HP đầu lượt + nhận 15% ít sát thương',
      },
      {
        id: 'dia_nga', ten: 'Địa Nha', get mu() { return CE('lt_dia_nga', '🦎'); }, element: 'tho',
        skill: 'dia_chan', skill_cd: 3,
        skill_desc: 'Địa Chấn — rung chuyển tấn công **toàn đội** xuyên phá 40% DEF',
        skill2: 'dia_sut', skill2_cd: 4,
        skill2_desc: 'Đất Sụt — giảm **ATK 1 mục tiêu 20% trong 3 lượt** + gây 120% sát thương',
        passive: 'dai_dia',
        passive_desc: '🌍 **Đại Địa** — miễn nhiễm đóng băng và giảm 50% thời gian choáng',
      },
    ],
    hiem: [
      {
        id: 'loi_bao', ten: 'Lôi Báo', get mu() { return CE('lt_loi_bao', '🐆'); }, element: 'thunder',
        skill: 'loi_dien', skill_cd: 4,
        skill_desc: 'Lôi Điện Choáng — phóng điện choáng **toàn đội** 1 lượt',
        skill2: 'bao_song_loi', skill2_cd: 5,
        skill2_desc: 'Bão Song Lôi — AOE **130% ATK** toàn đội + 40% choáng mỗi thành viên',
        passive: 'phong_dien',
        passive_desc: `${CE("tia_set","⚡")} **Phóng Điện** — mỗi đòn thường có 25% choáng mục tiêu 1 lượt`,
      },
      {
        id: 'dia_long', ten: 'Địa Long', get mu() { return CE('lt_dia_long', '🐉'); }, element: 'tho',
        skill: 'dia_truong', skill_cd: 4,
        skill_desc: 'Địa Long Trấn — tấn công toàn đội **xuyên phá 50% DEF**',
        skill2: 'dia_mach_hoi', skill2_cd: 5,
        skill2_desc: 'Địa Mạch Linh Hồi — hồi **25% HP** + DEF thú tăng 40% trong 2 lượt',
        passive: 'tai_sinh_dia',
        passive_desc: '🌱 **Tái Sinh Địa** — hồi 4% HP max đầu mỗi lượt',
      },
      {
        id: 'phong_ung', ten: 'Phong Ưng', get mu() { return CE('lt_phong_ung', '🦅'); }, element: 'phong',
        skill: 'vu_phong', skill_cd: 3,
        skill_desc: 'Vũ Phong Liên Kích — **đánh 3 lần** liên tiếp, mỗi đòn 70% ATK',
        skill2: 'xuyen_nguc', skill2_cd: 4,
        skill2_desc: 'Xuyên Ngực — đòn đơn **220% ATK** xuyên phá **80% giáp** của mục tiêu',
        passive: 'lien_kich',
        passive_desc: '🦅 **Liên Kích** — tấn công thường đánh **2 lần** (mỗi đòn 80% sát thương)',
      },
      {
        id: 'am_tac', ten: 'Ám Thước', get mu() { return CE('lt_am_tac', '🦜'); }, element: 'am',
        skill: 'am_nguyen', skill_cd: 4,
        skill_desc: 'Ám Nguyền — giảm **ATK toàn đội 20%** trong **4 lượt**',
        skill2: 'am_pha', skill2_cd: 5,
        skill2_desc: 'Ám Phá — sát thương **120% ATK** + khoá **Hộ Thể & Hồi Khí** mục tiêu 2 lượt',
        passive: 'am_hinh',
        passive_desc: '🌑 **Ám Hình** — 20% cơ hội né đòn bất kỳ',
      },
    ],
    su_thi: [
      {
        id: 'huyet_su', ten: 'Huyết Sư', get mu() { return CE('lt_huyet_su', '🦁'); }, element: 'hoa',
        skill: 'huyet_ho', skill_cd: 4,
        skill_desc: 'Huyết Hống — tấn công toàn đội + **tự hồi 25% HP**',
        skill2: 'hung_phan', skill2_cd: 5,
        skill2_desc: 'Hùng Phẫn Bạo Kích — ATK thú **+80% trong 2 lượt** + giáng 150% ATK + choáng mục tiêu',
        passive: 'khat_mau',
        passive_desc: '🩸 **Khát Máu** — hồi lại 8% sát thương đã gây ra',
      },
      {
        id: 'bang_phuong', ten: 'Băng Phượng', get mu() { return CE('lt_bang_phuong', '🦚'); }, element: 'thuy',
        skill: 'bang_pha', skill_cd: 5,
        skill_desc: 'Băng Phá Toàn Kích — đóng băng + gây sát thương **toàn đội**',
        skill2: 'tuyet_bao', skill2_cd: 6,
        skill2_desc: 'Tuyết Bão — đóng băng toàn đội **2 lượt** + sát thương 80% ATK mỗi người',
        passive: 'vinh_han',
        passive_desc: '🧊 **Vĩnh Hàn** — miễn nhiễm burn + đầu lượt 50% đóng băng 1 thành viên ngẫu nhiên',
      },
      {
        id: 'dia_nguc_quy', ten: 'Địa Ngục Quỷ', get mu() { return CE('lt_dia_nguc_quy', '👿'); }, element: 'am',
        skill: 'hon_don_kham', skill_cd: 4,
        skill_desc: 'Hỗn Độn Kham — gây sát thương + giảm **DEF 30%** toàn đội trong **3 lượt**',
        skill2: 'am_quy_hut', skill2_cd: 5,
        skill2_desc: 'Địa Ngục Quỷ Kịch — **180% ATK** + hút máu **40% sát thương** gây ra về HP thú',
        passive: 'dia_nguc_khi',
        passive_desc: '💀 **Địa Ngục Khí** — đầu lượt giảm ATK toàn đội 8% (tối đa 2 stack = 16%)',
      },
      {
        id: 'kim_tuoc', ten: 'Kim Tước', get mu() { return CE('lt_kim_tuoc', '🐦'); }, element: 'kim',
        skill: 'kim_cuong_the', skill_cd: 5,
        skill_desc: 'Kim Cương Thể — tăng **DEF 80%** trong **3 lượt** + phản 15% sát thương',
        skill2: 'kim_nen_kiep', skill2_cd: 5,
        skill2_desc: 'Kim Nghiêm Liên Kiếm — **5 nhát liên tiếp** mỗi đòn 70% ATK vào 1 mục tiêu',
        passive: 'kim_than',
        passive_desc: '🛡️ **Kim Thân** — hấp thụ 12% sát thương nhận vào (chuyển thành HP)',
      },
    ],
    huyen_thoai: [
      {
        id: 'cuu_vi_ho', ten: 'Cửu Vĩ Hồ', get mu() { return CE('lt_cuu_vi_ho', '🦊'); }, element: 'hoa',
        skill: 'cuu_vi_lua', skill_cd: 5,
        skill_desc: 'Cửu Vĩ Nghiệt Hỏa — đốt toàn đội, **mất 10% HP** mỗi lượt trong **4 lượt**',
        skill2: 'cuu_vi_tan', skill2_cd: 5,
        skill2_desc: 'Cửu Vĩ Tán Công — **nhân đôi burn stacks** toàn đội + AOE 100% ATK',
        passive: 'cuu_linh',
        passive_desc: '🌀 **Cửu Linh** — khi HP < 40% hồi 6% HP mỗi lượt + miễn choáng',
      },
      {
        id: 'thanh_long', ten: 'Thanh Long', get mu() { return CE('lt_thanh_long', '🐉'); }, element: 'moc',
        skill: 'thanh_long_ao', skill_cd: 5,
        skill_desc: 'Thanh Long Ngao — tấn công toàn đội, **xuyên phá 60% DEF**, crit x3',
        skill2: 'long_ao_thien', skill2_cd: 6,
        skill2_desc: 'Long Ngạo Thiên Hạ — đòn đơn **400% ATK** xuyên phá **100% DEF** mục tiêu',
        passive: 'long_van',
        passive_desc: '🐉 **Long Vận** — crit rate +15%, crit nhân x2.5 thay vì x2',
      },
      {
        id: 'bach_ho', ten: 'Bạch Hổ', get mu() { return CE('lt_bach_ho', '🐯'); }, element: 'kim',
        skill: 'bach_ho_ao', skill_cd: 4,
        skill_desc: 'Bạch Hổ Bạo Hống — tăng **ATK 100%** trong **3 lượt** + gây 200% sát thương',
        skill2: 'ba_vuong_linh', skill2_cd: 5,
        skill2_desc: 'Bá Vương Lĩnh Địa — choáng **toàn đội** + 1 thành viên bị choáng **2 lượt**',
        passive: 'thien_sat',
        passive_desc: '🐯 **Thiên Sát** — khi tấn công thành viên HP < 25%, có 20% one-shot',
      },
      {
        id: 'huyen_vu', ten: 'Huyền Vũ', get mu() { return CE('lt_huyen_vu', '🐢'); }, element: 'thuy',
        skill: 'huyen_vu_tram', skill_cd: 6,
        skill_desc: 'Huyền Vũ Trấn — **bất tử 2 lượt** + phản **40% sát thương** nhận vào',
        skill2: 'hoan_vu_phuc_giap', skill2_cd: 7,
        skill2_desc: 'Hoàn Vũ Phục Giáp — hồi **30% HP** + bất tử 1 lượt + phản **50% sát thương**',
        passive: 'huyen_giap',
        passive_desc: '🐢 **Huyền Giáp** — hấp thụ 20% sát thương, phản 5% lại người tấn công',
      },
      {
        id: 'chu_tuoc', ten: 'Chu Tước', get mu() { return CE('lt_chu_tuoc', '🦚'); }, element: 'hoa',
        skill: 'chu_tuoc_liem', skill_cd: 5,
        skill_desc: 'Chu Tước Liệt Hỏa — thiêu đốt 1 mục tiêu với **250% sát thương** + đốt 3 lượt',
        skill2: 'phuong_hoa_thien', skill2_cd: 6,
        skill2_desc: 'Phượng Hỏa Thiên Giáng — đốt toàn đội **5 lượt** + AOE **80% ATK**',
        passive: 'lua_hoi_sinh',
        passive_desc: '♻️ **Lửa Hồi Sinh** — khi HP về 0 lần đầu, hồi lại 20% HP (1 lần/trận)',
      },
    ],
    than_thu: [
      {
        id: 'hon_don_thu', ten: 'Hỗn Độn Thú', get mu() { return CE('lt_hon_don_thu', '👾'); }, element: 'hon_don',
        skill: 'hon_don_manh', skill_cd: 4,
        skill_desc: 'Hỗn Độn Mãnh Kích — tấn công ngẫu nhiên **3-5 lần**, mỗi đòn **90% ATK**',
        skill2: 'hon_don_hu_vo', skill2_cd: 8,
        skill2_desc: 'Hỗn Độn Hư Vô — hút **18% HP hiện tại** của mỗi thành viên + thú bất tử 1 lượt',
        passive: 'hon_loan',
        passive_desc: '🌀 **Hỗn Loạn** — đầu lượt tự buff ngẫu nhiên: ATK+25%, DEF+30%, hoặc hồi 6% HP',
      },
      {
        id: 'thai_co_long', ten: 'Thái Cổ Long', get mu() { return CE('lt_thai_co_long', '🐲'); }, element: 'tho',
        skill: 'thai_co_ao', skill_cd: 5,
        skill_desc: 'Thái Cổ Ngao — đòn hủy diệt **250% ATK** + hồi **35% HP**',
        skill2: 'thai_co_tru_thien', skill2_cd: 7,
        skill2_desc: 'Thái Cổ Trụ Thiên — gây **20% HP max cố định** toàn đội (bỏ qua mọi giáp)',
        passive: 'thai_co_bat_diet',
        passive_desc: '♾️ **Thái Cổ Bất Diệt** — khi HP < 40% DEF nhân đôi + miễn mọi hiệu ứng trạng thái',
      },
      {
        id: 'tien_linh', ten: 'Tiên Linh', get mu() { return CE('lt_tien_linh', '✨'); }, element: 'phong',
        skill: 'thien_vu_tinh', skill_cd: 6,
        skill_desc: 'Thiên Vũ Tịnh Hóa — giảm **30% HP hiện tại** của toàn đội ngay lập tức',
        skill2: 'tien_phap_trao_doi', skill2_cd: 8,
        skill2_desc: 'Tiên Pháp Trao Đổi — hoán đổi HP của **thành viên HP cao nhất** với HP thú',
        passive: 'tien_phep',
        passive_desc: '✨ **Tiên Phép** — đầu lượt 12% vô hiệu hóa hành động của 1 thành viên ngẫu nhiên',
      },
    ],
  };

// ── Phần thưởng theo bậc ─────────────────────────────────────────────────────
const LINH_THU_REWARDS = {
  pho_thong: {
    exp_pct:    [0.04, 0.08],
  },
  hiem: {
    exp_pct:    [0.06, 0.12],
  },
  su_thi: {
    exp_pct:    [0.10, 0.18],
  },
  huyen_thoai: {
    exp_pct:    [0.15, 0.26],
  },
  than_thu: {
    exp_pct:    [0.22, 0.40],
  },
};

// ── Bảng loot (đồ rơi) theo bậc ──────────────────────────────────────────────
// Mỗi entry: [item_id, drop_rate (0-1)]  — có thể rơi nhiều món
const LINH_THU_LOOT = {
  pho_thong: [
    ['da_linh_thu',    0.50],
    ['long_linh_thu',  0.35],
    ['rang_vuot',      0.25],
  ],
  hiem: [
    ['xuong_linh_thu', 0.30],
    ['tinh_thach_nho', 0.14],
  ],
  su_thi: [
    ['nanh_linh_thu',    0.28],
    ['tinh_thach_trung', 0.14],
  ],
  huyen_thoai: [
    ['xuong_huyen_linh', 0.22],
    ['vay_linh_long',    0.14],
  ],
  than_thu: [
    ['tinh_thach_than',   0.12],
    ['tim_than_thu',      0.08],
    ['linh_hon_than_thu', 0.05],
  ],
};

// Định nghĩa chi tiết vật phẩm loot + tác dụng khi dùng
// kg: trọng lượng trong túi trữ vật
// emoji field dùng CE() để hiển thị custom Discord emoji nếu đã upload, fallback về Unicode
const LINH_THU_LOOT_ITEMS = {
  // ── Hộp & Vé phần thưởng ──────────────────────────────────────────────────
  hop_linh_thach: { ten: 'Hộp Linh Thạch', emoji: '📦', kg: 0.3, get mo_ta() { return `${CE('lock_icon','🔒')} Giftcode/Donate độc quyền — mở ra nhận ngẫu nhiên 500–2,500 ${CE('tult','💠')} Linh Thạch. Dùng \`-vat_pham mo hop_linh_thach\``; }, openable: true, exclusive: true },
  ve_gacha: { ten: 'Vé Gacha', get emoji() { return CE('ve_gacha','🎰'); }, kg: 0.05, get mo_ta() { return `${CE('lock_icon','🔒')} Giftcode độc quyền — dùng \`-gacha\` để quay nhận phần thưởng ngẫu nhiên siêu hiếm!`; }, openable: false, exclusive: true },
  // ── Phổ thông ─────────────────────────────────────────────────────────────
  da_linh_thu:       { ten: 'Da Linh Thú',        get emoji() { return CE('vp_da_linh_thu','🟫'); },      kg: 0.5, mo_ta: 'Da thú thô có linh khí sơ cấp — nguyên liệu chế tạo Bảo Bối' },
  long_linh_thu:     { ten: 'Lông Linh Thú',      get emoji() { return CE('vp_long_linh_thu','🪶'); },    kg: 0.2, mo_ta: 'Lông nhẹ mang linh khí — nguyên liệu chế tạo Bảo Bối' },
  rang_vuot:         { ten: 'Răng Vuốt Linh Thú', get emoji() { return CE('vp_rang_vuot','🦷'); },        kg: 0.3, mo_ta: 'Nanh vuốt sắc bén ngấm linh khí — nguyên liệu chế tạo Bảo Bối' },
  // ── Hiếm ──────────────────────────────────────────────────────────────────
  xuong_linh_thu:    { ten: 'Xương Linh Thú',     get emoji() { return CE('vp_xuong_linh_thu','🦴'); },   kg: 1.0, mo_ta: 'Xương rắn chắc như thép linh — nguyên liệu chế tạo' },
  tinh_thach_nho:    { ten: 'Tinh Thạch Nhỏ',     get emoji() { return CE('vp_tinh_thach_nho','💎'); },   kg: 0.6, mo_ta: 'Tinh thạch nhỏ cô đặc linh lực — nguyên liệu Bảo Bối & Rèn Luyện' },
  // ── Sử thi ────────────────────────────────────────────────────────────────
  nanh_linh_thu:     { ten: 'Nanh Linh Thú',      get emoji() { return CE('vp_nanh_linh_thu','🗡️'); },   kg: 0.8, mo_ta: 'Nanh toả hào quang linh khí — nguyên liệu Bảo Bối sát thương' },
  tinh_thach_trung:  { ten: 'Tinh Thạch Trung',   get emoji() { return CE('vp_tinh_thach_trung','💠'); }, kg: 1.0, mo_ta: 'Tinh thạch trung bình linh năng dồi dào — nguyên liệu Bảo Bối' },
  // ── Huyền thoại ───────────────────────────────────────────────────────────
  xuong_huyen_linh:  { ten: 'Xương Huyền Linh',   get emoji() { return CE('vp_xuong_huyen_linh','🌀'); }, kg: 2.0, mo_ta: 'Xương phát sáng huyền bí — nguyên liệu Bảo Bối huyền thoại' },
  vay_linh_long:     { ten: 'Vảy Linh Long',      get emoji() { return CE('vp_vay_linh_long','🐉'); },    kg: 1.8, mo_ta: 'Vảy rồng linh cực quý — nguyên liệu cốt lõi Bảo Bối huyền thoại' },
  // ── Thần thú ──────────────────────────────────────────────────────────────
  tinh_thach_than:   { ten: 'Tinh Thạch Thần',    get emoji() { return CE('vp_tinh_thach_than','⭐'); },  kg: 2.5, mo_ta: 'Tinh thạch cấp thần linh năng vô hạn — nguyên liệu Rèn Luyện +9/+10' },
  tim_than_thu:      { ten: 'Tim Thần Thú',        get emoji() { return CE('vp_tim_than_thu','❤️‍🔥'); },   kg: 2.0, mo_ta: 'Tim bất diệt đập nguyên lực — nguyên liệu Bảo Bối đỉnh cao' },
  linh_hon_than_thu: { ten: 'Linh Hồn Thần Thú',  get emoji() { return CE('vp_linh_hon_than_thu','👻'); }, kg: 1.0, mo_ta: 'Linh hồn thần thú — nguyên liệu tối thượng Rèn Luyện +10' },
};

// ── Công thức chế tạo Bảo Bối từ loot ────────────────────────────────────────
const LINH_THU_CRAFT = [
  {
    bao_boi_id: 'linh_thu_ho_tam',
    yeu_cau_cap: 6,
    phi: 8_000,
    vat_lieu: { da_linh_thu: 5, xuong_linh_thu: 3 },
  },
  {
    bao_boi_id: 'da_thu_sat_khi',
    yeu_cau_cap: 6,
    phi: 10_000,
    vat_lieu: { rang_vuot: 6, nanh_linh_thu: 3 },
  },
  {
    bao_boi_id: 'tinh_thach_hoi_linh',
    yeu_cau_cap: 10,
    phi: 30_000,
    vat_lieu: { tinh_thach_nho: 5, tinh_thach_trung: 2 },
  },
  {
    bao_boi_id: 'huyen_long_tam_chau',
    yeu_cau_cap: 13,
    phi: 80_000,
    vat_lieu: { vay_linh_long: 2, xuong_huyen_linh: 2 },
  },
  {
    bao_boi_id: 'than_thu_tam_ngoc',
    yeu_cau_cap: 18,
    phi: 500_000,
    vat_lieu: { tim_than_thu: 1, tinh_thach_than: 2 },
  },
  {
    bao_boi_id: 'linh_hon_am_khi',
    yeu_cau_cap: 25,
    phi: 2_000_000,
    vat_lieu: { linh_hon_than_thu: 1, tim_than_thu: 2 },
  },
  {
    bao_boi_id: 'tui_da_thu',
    yeu_cau_cap: 5,
    phi: 6_000,
    vat_lieu: { da_linh_thu: 5, long_linh_thu: 4, rang_vuot: 3 },
  },
];

module.exports = {
  LINH_THU_TIERS,
  LINH_THU_LIST,
  LINH_THU_REWARDS,
  LINH_THU_LOOT,
  LINH_THU_LOOT_ITEMS,
  LINH_THU_CRAFT,
};
