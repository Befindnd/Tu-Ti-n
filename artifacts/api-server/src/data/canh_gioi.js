'use strict';
const { CE } = require('../systems/emoji');

const DAI_CANH_GIOI = [
  { tu: 0, den: 0, ten: "Phàm Nhân" },
  { tu: 1, den: 9, ten: "Luyện Khí" },
  { tu: 10, den: 13, ten: "Trúc Cơ" },
  { tu: 14, den: 17, ten: "Kết Đan" },
  { tu: 18, den: 21, ten: "Nguyên Anh" },
  { tu: 22, den: 25, ten: "Hóa Thần" },
  { tu: 26, den: 29, ten: "Luyện Hư" },
  { tu: 30, den: 33, ten: "Hợp Thể" },
  { tu: 34, den: 37, ten: "Đại Thừa" },
  { tu: 38, den: 38, ten: "Độ Kiếp" },
  { tu: 39, den: 39, ten: "Tiên Nhân" },
];
function getDaiCanhGioiIndex(n) {
  for (let t = 0; t < DAI_CANH_GIOI.length; t++) {
    const e = DAI_CANH_GIOI[t];
    if (n >= e.tu && n <= e.den) return t;
  }
  return 0;
}
function getDCGDiff(n, t) {
  return Math.abs(getDaiCanhGioiIndex(n) - getDaiCanhGioiIndex(t));
}
const CANH_GIOI = [
    { ten: "Phàm Nhân", cap: 0, exp_can: 0, linh_luc: 100, cong_luc: 10, thu_luc: 5 },
    { ten: "Luyện Khí Tầng 1", cap: 1, exp_can: 100, linh_luc: 150, cong_luc: 15, thu_luc: 8 },
    { ten: "Luyện Khí Tầng 2", cap: 2, exp_can: 250, linh_luc: 200, cong_luc: 20, thu_luc: 12 },
    { ten: "Luyện Khí Tầng 3", cap: 3, exp_can: 500, linh_luc: 280, cong_luc: 28, thu_luc: 16 },
    { ten: "Luyện Khí Tầng 4", cap: 4, exp_can: 900, linh_luc: 380, cong_luc: 38, thu_luc: 22 },
    { ten: "Luyện Khí Tầng 5", cap: 5, exp_can: 1500, linh_luc: 500, cong_luc: 50, thu_luc: 30 },
    { ten: "Luyện Khí Tầng 6", cap: 6, exp_can: 2400, linh_luc: 650, cong_luc: 65, thu_luc: 40 },
    { ten: "Luyện Khí Tầng 7", cap: 7, exp_can: 3800, linh_luc: 830, cong_luc: 83, thu_luc: 52 },
    { ten: "Luyện Khí Tầng 8", cap: 8, exp_can: 5800, linh_luc: 1050, cong_luc: 105, thu_luc: 66 },
    { ten: "Luyện Khí Tầng 9", cap: 9, exp_can: 8500, linh_luc: 1300, cong_luc: 130, thu_luc: 82 },
    { ten: "Trúc Cơ Sơ Kỳ", cap: 10, exp_can: 13e3, linh_luc: 2e3, cong_luc: 200, thu_luc: 120 },
    { ten: "Trúc Cơ Trung Kỳ", cap: 11, exp_can: 2e4, linh_luc: 3e3, cong_luc: 300, thu_luc: 180 },
    { ten: "Trúc Cơ Hậu Kỳ", cap: 12, exp_can: 3e4, linh_luc: 4500, cong_luc: 450, thu_luc: 270 },
    {
      ten: "Trúc Cơ Viên Mãn",
      cap: 13,
      exp_can: 45e3,
      linh_luc: 6500,
      cong_luc: 650,
      thu_luc: 390,
    },
    { ten: "Kết Đan Sơ Kỳ", cap: 14, exp_can: 7e4, linh_luc: 1e4, cong_luc: 1e3, thu_luc: 600 },
    {
      ten: "Kết Đan Trung Kỳ",
      cap: 15,
      exp_can: 11e4,
      linh_luc: 15e3,
      cong_luc: 1500,
      thu_luc: 900,
    },
    {
      ten: "Kết Đan Hậu Kỳ",
      cap: 16,
      exp_can: 17e4,
      linh_luc: 22e3,
      cong_luc: 2200,
      thu_luc: 1320,
    },
    {
      ten: "Kết Đan Viên Mãn",
      cap: 17,
      exp_can: 26e4,
      linh_luc: 32e3,
      cong_luc: 3200,
      thu_luc: 1920,
    },
    { ten: "Nguyên Anh Sơ Kỳ", cap: 18, exp_can: 4e5, linh_luc: 5e4, cong_luc: 5e3, thu_luc: 3e3 },
    {
      ten: "Nguyên Anh Trung Kỳ",
      cap: 19,
      exp_can: 62e4,
      linh_luc: 75e3,
      cong_luc: 7500,
      thu_luc: 4500,
    },
    {
      ten: "Nguyên Anh Hậu Kỳ",
      cap: 20,
      exp_can: 95e4,
      linh_luc: 11e4,
      cong_luc: 11e3,
      thu_luc: 6600,
    },
    {
      ten: "Nguyên Anh Viên Mãn",
      cap: 21,
      exp_can: 145e4,
      linh_luc: 16e4,
      cong_luc: 16e3,
      thu_luc: 9600,
    },
    {
      ten: "Hóa Thần Sơ Kỳ",
      cap: 22,
      exp_can: 22e5,
      linh_luc: 25e4,
      cong_luc: 25e3,
      thu_luc: 15e3,
    },
    {
      ten: "Hóa Thần Trung Kỳ",
      cap: 23,
      exp_can: 33e5,
      linh_luc: 38e4,
      cong_luc: 38e3,
      thu_luc: 22800,
    },
    {
      ten: "Hóa Thần Hậu Kỳ",
      cap: 24,
      exp_can: 5e6,
      linh_luc: 56e4,
      cong_luc: 56e3,
      thu_luc: 33600,
    },
    {
      ten: "Hóa Thần Viên Mãn",
      cap: 25,
      exp_can: 75e5,
      linh_luc: 82e4,
      cong_luc: 82e3,
      thu_luc: 49200,
    },
    {
      ten: "Luyện Hư Sơ Kỳ",
      cap: 26,
      exp_can: 11e6,
      linh_luc: 12e5,
      cong_luc: 12e4,
      thu_luc: 72e3,
    },
    {
      ten: "Luyện Hư Trung Kỳ",
      cap: 27,
      exp_can: 165e5,
      linh_luc: 18e5,
      cong_luc: 18e4,
      thu_luc: 108e3,
    },
    {
      ten: "Luyện Hư Hậu Kỳ",
      cap: 28,
      exp_can: 25e6,
      linh_luc: 27e5,
      cong_luc: 27e4,
      thu_luc: 162e3,
    },
    {
      ten: "Luyện Hư Viên Mãn",
      cap: 29,
      exp_can: 37e6,
      linh_luc: 4e6,
      cong_luc: 4e5,
      thu_luc: 24e4,
    },
    { ten: "Hợp Thể Sơ Kỳ", cap: 30, exp_can: 55e6, linh_luc: 6e6, cong_luc: 6e5, thu_luc: 36e4 },
    {
      ten: "Hợp Thể Trung Kỳ",
      cap: 31,
      exp_can: 82e6,
      linh_luc: 9e6,
      cong_luc: 9e5,
      thu_luc: 54e4,
    },
    {
      ten: "Hợp Thể Hậu Kỳ",
      cap: 32,
      exp_can: 12e7,
      linh_luc: 135e5,
      cong_luc: 135e4,
      thu_luc: 81e4,
    },
    {
      ten: "Hợp Thể Viên Mãn",
      cap: 33,
      exp_can: 18e7,
      linh_luc: 2e7,
      cong_luc: 2e6,
      thu_luc: 12e5,
    },
    { ten: "Đại Thừa Sơ Kỳ", cap: 34, exp_can: 27e7, linh_luc: 3e7, cong_luc: 3e6, thu_luc: 18e5 },
    {
      ten: "Đại Thừa Trung Kỳ",
      cap: 35,
      exp_can: 4e8,
      linh_luc: 45e6,
      cong_luc: 45e5,
      thu_luc: 27e5,
    },
    {
      ten: "Đại Thừa Hậu Kỳ",
      cap: 36,
      exp_can: 6e8,
      linh_luc: 67e6,
      cong_luc: 67e5,
      thu_luc: 402e4,
    },
    { ten: "Đại Thừa Viên Mãn", cap: 37, exp_can: 9e8, linh_luc: 1e8, cong_luc: 1e7, thu_luc: 6e6 },
    {
      ten: "Độ Kiếp — Vượt Thiên Kiếp",
      cap: 38,
      exp_can: 14e8,
      linh_luc: 2e8,
      cong_luc: 2e7,
      thu_luc: 12e6,
    },
    {
      ten: "Tiên Nhân — Siêu Phàm Thoát Tục",
      cap: 39,
      exp_can: 25e8,
      linh_luc: 5e8,
      cong_luc: 5e7,
      thu_luc: 3e7,
    },
  ],
  GET_RANK_KEY = (n) =>
    n >= 39 ? "rank_tien_nhan"
    : n >= 38 ? "rank_do_kiep"
    : n >= 34 ? "rank_dai_thua"
    : n >= 30 ? "rank_hop_the"
    : n >= 26 ? "rank_luyen_hu"
    : n >= 22 ? "rank_hoa_than"
    : n >= 18 ? "rank_nguyen_anh"
    : n >= 14 ? "rank_ket_dan"
    : n >= 10 ? "rank_truc_co"
    : n >= 1  ? "rank_luyen_khi"
    : "rank_pham_nhan",
  CG_EMOJI = (n) =>
    n >= 39
      ? CE("rank_tien_nhan","👑")
      : n >= 38
        ? CE("rank_do_kiep","⚡")
        : n >= 34
          ? CE("rank_dai_thua","☄️")
          : n >= 30
            ? CE("rank_hop_the","🌌")
            : n >= 26
              ? CE("rank_luyen_hu","🌀")
              : n >= 22
                ? CE("rank_hoa_than","💫")
                : n >= 18
                  ? CE("rank_nguyen_anh","🌊")
                  : n >= 14
                    ? CE("rank_ket_dan","👁️")
                    : n >= 10
                      ? CE("rank_truc_co","⚗️")
                      : n >= 1
                        ? CE("rank_luyen_khi","🌿")
                        : CE("rank_pham_nhan","🌱"),
  NGO_TINH_PHAM = [
    {
      id: "pham",
      ten: "Phàm Phẩm",
      get emoji() { return CE("nt_pham","🪨"); },
      tu: 0,
      den: 20,
      linh_ngo_bonus: 0,
      than_thong_rate: 0.05,
      ngo_dao_rate: 0.05,
      mo_ta: "Thiên tư thường, tu luyện chậm chạp.",
    },
    {
      id: "linh",
      ten: "Linh Phẩm",
      get emoji() { return CE("nt_linh","🌿"); },
      tu: 21,
      den: 40,
      linh_ngo_bonus: 0.15,
      than_thong_rate: 0.1,
      ngo_dao_rate: 0.1,
      mo_ta: "Ngộ tính khá tốt, lĩnh ngộ nhanh hơn người thường.",
    },
    {
      id: "dia",
      ten: "Địa Phẩm",
      get emoji() { return CE("nt_dia","💠"); },
      tu: 41,
      den: 60,
      linh_ngo_bonus: 0.35,
      than_thong_rate: 0.2,
      ngo_dao_rate: 0.2,
      mo_ta: "Thiên tư xuất sắc, các môn phái đều muốn thu làm đệ tử.",
    },
    {
      id: "thien",
      ten: "Thiên Phẩm",
      get emoji() { return CE("nt_thien","🔮"); },
      tu: 61,
      den: 80,
      linh_ngo_bonus: 0.6,
      than_thong_rate: 0.35,
      ngo_dao_rate: 0.35,
      mo_ta: "Thiên tư nghìn năm một lần, lĩnh ngộ như thần.",
    },
    {
      id: "tien",
      ten: "Tiên Phẩm",
      get emoji() { return CE("nt_tien","✨"); },
      tu: 81,
      den: 100,
      linh_ngo_bonus: 1,
      than_thong_rate: 0.55,
      ngo_dao_rate: 0.55,
      mo_ta: "Ngộ tính siêu phàm! Chỉ đọc một lần là thông hiểu đạo lý ngàn năm.",
    },
  ];
function getNgoTinh(n) {
  const t = Math.max(0, Math.min(100, n || 50));
  return NGO_TINH_PHAM.find((n) => t >= n.tu && t <= n.den) || NGO_TINH_PHAM[2];
}
function getKhiVanBonus(n) {
  const t = Math.max(0, Math.min(100, n || 30));
  return {
    truyen_thua_rate: 0.05 + (t / 100) * 0.25,
    bao_vat_rate: 0.03 + (t / 100) * 0.2,
    bi_canh_bonus: t / 200,
    co_duyen_bonus: t / 200,
    desc:
      t >= 80
        ? "🌟 Khí Vận Phi Phàm"
        : t >= 60
          ? "✨ Khí Vận Tốt"
          : t >= 40
            ? "⚖️ Khí Vận Bình Thường"
            : t >= 20
              ? "☁️ Khí Vận Thấp"
              : "💀 Khí Vận Kém",
  };
}
function getNhanQua(n) {
  return n >= 100
    ? {
        get emoji() { return CE("nq_vien_man","☀️"); },
        ten: "Công Đức Viên Mãn",
        mo_ta: "Thiên đạo chứng kiến thiện hạnh — kiếp vận may mắn vô biên.",
        khi_van_bonus: 25,
        kiep_giam: 20,
      }
    : n >= 50
      ? {
          get emoji() { return CE("nq_cong_duc","😇"); },
          ten: "Công Đức Dày",
          mo_ta: "Thiện hạnh tích lũy — thiên kiếp nhẹ hơn, cơ duyên nhiều hơn.",
          khi_van_bonus: 15,
          kiep_giam: 10,
        }
      : n >= 10
        ? {
            get emoji() { return CE("nq_tieu","🌿"); },
            ten: "Tiểu Công Đức",
            mo_ta: "Chút thiện hạnh tích lũy, thiên đạo ghi nhận.",
            khi_van_bonus: 5,
            kiep_giam: 0,
          }
        : n > -10
          ? {
              get emoji() { return CE("nq_trung","⚖️"); },
              ten: "Nhân Quả Trung Bình",
              mo_ta: "Thiện ác cân bằng, không có hiệu ứng đặc biệt.",
              khi_van_bonus: 0,
              kiep_giam: 0,
            }
          : n > -50
            ? {
                get emoji() { return CE("nq_nghiep","🩸"); },
                ten: "Nghiệp Lực Tích Tụ",
                mo_ta: "Sát nghiệp tăng nặng — thiên kiếp ác liệt hơn, cơ duyên giảm.",
                khi_van_bonus: -10,
                kiep_giam: -15,
              }
            : n > -100
              ? {
                  get emoji() { return CE("nq_sau","👿"); },
                  ten: "Nghiệp Lực Sâu Nặng",
                  mo_ta: "Ma khí bủa vây, nghiệp lực ăn sâu — thiên kiếp cực kỳ nguy hiểm!",
                  khi_van_bonus: -20,
                  kiep_giam: -30,
                }
              : {
                  get emoji() { return CE("nq_chuong","☠️"); },
                  ten: "Nghiệp Chướng Tột Đỉnh",
                  mo_ta:
                    "Sát nghiệp chất đầy! Kiếp vận đen tối — thiên kiếp gần như không qua được!",
                  khi_van_bonus: -30,
                  kiep_giam: -50,
                };
}

module.exports = {
  DAI_CANH_GIOI, CANH_GIOI, CG_EMOJI, GET_RANK_KEY,
  NGO_TINH_PHAM, getNgoTinh, getKhiVanBonus, getNhanQua,
  getDaiCanhGioiIndex, getDCGDiff,
};