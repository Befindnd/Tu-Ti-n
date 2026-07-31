'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer, awardBiPhap, awardLinhThao } = require('../db/players');
const { CE, CEu } = require('../systems/emoji');
const {
  DAI_CANH_GIOI, CANH_GIOI, NGO_TINH_PHAM, getDaiCanhGioiIndex, getDCGDiff,
  LINH_CAN, LINH_CAN_MO_TA, HUYET_MACH, CO_THU,
  CONG_PHAP, BI_PHAP, NGHE, VU_KHI, BAO_BOI, LINH_THAO, KHOANG_VAT,
  NGOC_GIAN_DATA, DAN_DUOC, DAN_PHAM, DAN_PHAM_ORDER, REN_LUYEN_CAP, calcDanTyLe, PHU_LUC_DATA,
  THIEN_KIEP_KQ, THIEN_KIEP_NGUONG, getThienKiepLoai,
  PHONG_THUY_VAN, DONG_PHU, TRUYEN_THUA_LIST,
  TONG_MON_CAP_BAC, TONG_MON, CO_DUYEN_EVENTS,
  BI_CANH_SESSIONS, BI_CANH_CD_H, BI_CANH_LUA_CHON,
  DAO_TU,
  NHIEM_VU_LIST,
  CP_GIA, BP_GIA,
  CG_EMOJI, getNgoTinh, getKhiVanBonus, getNhanQua, getTT,
} = require('../data');
const {
  getDailyMissionState,
  BAG_WEIGHTS, getDanKg, getBagCapacity, calcBagWeight, canAddToBag, calcMaxLinhThach, calcMaxLinhThachTrung, calcMaxLinhThachCao,
  DONATE_DATA, findDonateGoi, buildDonateEmbed, buildDonateButtons, buildDonateCatSelect,
  fmt, getCG, pBar, fTime, cdRem, cdRemMin, embedClr,
  randomLC, randomHM, getTamMa,
  SEP, SEP2, SEP3, errE, warnE, okE,
  CHIEU_THUC, getChieu,
  tinhCS, calcEXP_active,
  COMMANDS, reg, RATE_LIMIT, checkRateLimit,
  DT_TEN, DT_HIEU, PHI_TU_CHUA, PHI_DUOC_SU, CD_TU_H, CD_DS_TU_H, CD_DS_NGUOI,
} = require('../utils');
const {
  COMBAT_SESSIONS, RECENTLY_ENDED, markRecentlyEnded, wasRecentlyEnded,
  BP_COMBAT, hpBar, hpHeart, makeCombatEmbed,
  makePVPInviteRow, makePVPInviteRowDisabled, makePVPCombatRow,
  resolveCombatTurn, endCombat, scheduleTurnTimeout, applyCombatStats,
} = require('../game/combat');
const ADMIN_ID = process.env.ADMIN_ID || '';


const DIA_DANH_HAI_THAO = [
  "khe núi Vạn Linh sâu thẳm",
  "vách đá Thái Âm chơi vơi",
  "đầm lầy Linh Mộc huyền ảo",
  "đỉnh Thiên Phong mây phủ",
  "hang động Bích Lâm rêu phong cổ kính",
  "bờ suối Linh Tuyền nước trong vắt",
  "rừng Huyền Mộc ngàn năm tuổi",
];
// ── Tỉ lệ kết quả Bí Cảnh thay đổi theo Đạo Tu ─────────────────────────
// Giá trị > 1 = outcome đó xảy ra nhiều hơn (có thể tốt HOẶC xấu)
// Giá trị < 1 = outcome đó xảy ra ít hơn
// ── Bí Cảnh: mỗi Đạo Tu có đúng 2 LỢI và 2 HẠI ──────────────────────────
// LỢI = tăng outcome tốt (>1) HOẶC giảm outcome xấu (<1 trên mat_linh_thach)
// HẠI = tăng outcome xấu (>1 trên mat_linh_thach) HOẶC giảm outcome tốt (<1)

// ── Sự kiện đặc thù của từng Đạo Tu (xác suất 28%) ─────────────────────────
const DAO_TU_EXCLUSIVE_EVENTS = {
  kiem_tu: [
    { id: 'kt_kiem_khi', ten: 'Kiếm Khí Cường Hóa', get emoji() { return CE('dt_kiem_tu','⚔️'); },
      mo_ta: 'Trận gió mang theo kiếm khí cổ đại ập đến — kiếm tâm thăng hoa, bí kỹ kiếm đạo tự nhiên hiển lộ!',
      hieu_ung: { loai: 'bi_phap_random', gia_tri: 1 } },
    { id: 'kt_sat_phong', ten: 'Sát Phong Dâng Trào', get emoji() { return CE('dt_kiem_tu','🗡️'); },
      mo_ta: 'Sát khí từ chiến trường xưa phun ra — Kiếm Tu như cá gặp nước, linh lực bùng phát dữ dội!',
      hieu_ung: { loai: 'linh_thach', gia_tri: 1600 } },
  ],
  the_tu: [
    { id: 'tt_co_the_khai', ten: 'Cơ Thể Khai Thông', get emoji() { return CE('dt_the_tu','💪'); },
      mo_ta: 'Linh địa mạnh mẽ thấm sâu vào huyệt đạo — Thể Tu khai thông kinh mạch, tu vi bùng nổ!',
      hieu_ung: { loai: 'exp', gia_tri: 0.7 } },
    { id: 'tt_thien_dia', ten: 'Thiên Địa Hành Thể', get emoji() { return CE('dt_the_tu','🌍'); },
      mo_ta: 'Đất đai linh lực phun trào, Thể Tu hấp thu trực tiếp qua da thịt — nội lực cường hóa kinh người!',
      hieu_ung: { loai: 'heal', gia_tri: 3 } },
  ],
  phap_tu: [
    { id: 'pt_thien_van', ten: 'Thiên Văn Cổ Thư', get emoji() { return CE('dt_phap_tu','📚'); },
      mo_ta: 'Cổ thư linh văn tự nhiên hiện ra trước mắt Pháp Tu — kỳ thư truyền đạo, trí tuệ khai mở hoàn toàn!',
      hieu_ung: { loai: 'bi_phap_random', gia_tri: 1 } },
    { id: 'pt_phap_luc', ten: 'Pháp Lực Cường Hóa Đột Biến', get emoji() { return CE('dt_phap_tu','✨'); },
      mo_ta: 'Thiên địa linh khí tự hội tụ vào Pháp Tu — ngộ thông thiên đạo pháp tắc, tu vi vọt lên cấp số nhân!',
      hieu_ung: { loai: 'exp', gia_tri: 0.8 } },
  ],
  ma_tu: [
    { id: 'mt_ma_khi', ten: 'Ma Khí Cộng Lực', get emoji() { return CE('dt_ma_tu',`${CE("tam_ma","😈")}`); },
      mo_ta: 'Vùng đất ô uế tràn đầy ma khí — Ma Tu như về tổ, hấp thu ma khí tăng thực lực vùn vụt!',
      hieu_ung: { loai: 'exp', gia_tri: 0.7 } },
    { id: 'mt_ta_ngoc', ten: 'Phát Hiện Tà Ngọc Bảo Vật', get emoji() { return CE('dt_ma_tu','🩸'); },
      mo_ta: 'Bảo vật tà ma từ thời thượng cổ ẩn giấu nơi đây — chỉ Ma Tu mới cảm nhận được hào quang tăm tối này!',
      hieu_ung: { loai: 'linh_thach', gia_tri: 1800 } },
  ],
  yeu_tu: [
    { id: 'yt_linh_thu', ten: 'Linh Thú Khai Ngộ', get emoji() { return CE('dt_yeu_tu','🦋'); },
      mo_ta: 'Linh thú hoang dã cảm nhận được hào khí đồng loại — chúng thân thiện dẫn đường đến linh thảo bảo địa!',
      hieu_ung: { loai: 'linh_thao_random', gia_tri: 5 } },
    { id: 'yt_hoa_hop', ten: 'Hòa Hợp Thiên Nhiên', get emoji() { return CE('dt_yeu_tu','🌿'); },
      mo_ta: 'Yêu Tu đồng điệu với mạch linh đất trời — thiên nhiên ban phước, thân thể phục hồi hoàn toàn viên mãn!',
      hieu_ung: { loai: 'heal', gia_tri: 4 } },
  ],
  dan_tu: [
    { id: 'dt_linh_thao', ten: 'Linh Thảo Thần Thu', get emoji() { return CE('dt_dan_tu','🌺'); },
      mo_ta: 'Mũi Đan Tu nhạy bén phát hiện cụm linh thảo cực phẩm ẩn sâu trong núi — thu hoạch bất ngờ!',
      hieu_ung: { loai: 'linh_thao_random', gia_tri: 6 } },
    { id: 'dt_dan_huong', ten: 'Đan Hương Giao Hòa', get emoji() { return CE('dt_dan_tu','💊'); },
      mo_ta: 'Mùi đan dược tỏa ra, thiên nhiên hưởng ứng — linh khí tứ phương hội tụ chữa lành thương thế hoàn toàn!',
      hieu_ung: { loai: 'heal', gia_tri: 3.5 } },
  ],
  khi_tu: [
    { id: 'kht_co_khi', ten: 'Cổ Khí Khai Phong', get emoji() { return CE('dt_khi_tu','⚙️'); },
      mo_ta: 'Khí Tu cảm nhận rung động khí cụ cổ đại ẩn dưới đất — khai phong bảo vật, đại phát tài lộc!',
      hieu_ung: { loai: 'linh_thach', gia_tri: 1400 } },
    { id: 'kht_ren_ngo', ten: 'Rèn Đúc Ngộ Lý', get emoji() { return CE('dt_khi_tu','🔨'); },
      mo_ta: 'Nhìn vào cổ trận, Khí Tu bất giác ngộ thông nguyên lý vận hành — bí kỹ tự nhiên hiển lộ trong tâm!',
      hieu_ung: { loai: 'bi_phap_random', gia_tri: 1 } },
  ],
  tran_tu: [
    { id: 'trt_co_tran', ten: 'Cổ Trận Giải Mã', get emoji() { return CE('dt_tran_tu','🔮'); },
      mo_ta: 'Trận Tu một mắt nhìn qua cổ trận ngàn năm — giải mã toàn bộ bí ẩn, thu thập trận pháp tinh hoa!',
      hieu_ung: { loai: 'bi_phap_random', gia_tri: 1 } },
    { id: 'trt_linh_tran', ten: 'Linh Trận Bảo Hộ', get emoji() { return CE('dt_tran_tu','🛡️'); },
      mo_ta: 'Trận Tu bày trận che chắn tứ phía — linh địa cộng hưởng trận pháp, linh thạch kết tinh từ không khí!',
      hieu_ung: { loai: 'linh_thach', gia_tri: 1200 } },
  ],
};


// ── Lựa chọn Bí Cảnh đặc thù từng Đạo Tu ────────────────────────────────────
const DAO_TU_BI_CANH_CHOICES = {
  kiem_tu: { id: 'bc_kt', ten: 'Kiếm Tâm Chiếu Cảnh', get emoji() { return CE('dt_kiem_tu','⚔️'); },
    mo_ta: 'Dùng kiếm ý quét qua bí cảnh — sát khí vạch đường, Kiếm Tu dễ tìm thấy kho báu ẩn giấu.',
    ket_qua: [
      { rate: 30, loai: 'linh_thach', gia_tri: 1250, get mo_ta() { return `${CE("tuatk","⚔️")} Kiếm khí phá ấn — tìm được **1.800 Linh Thạch**!`; } },
      { rate: 25, loai: 'bi_phap_random', gia_tri: 1, get mo_ta() { return `${CE("ft_am_sat","🗡️")} Kiếm tâm cảm ứng — bí kỹ kiếm đạo hiển lộ!`; } },
      { rate: 20, loai: 'exp', gia_tri: 0.3, get mo_ta() { return `${CE("nt_tien","✨")} Kiếm ý cộng hưởng bí cảnh, tu vi tăng vọt!`; } },
      { rate: 25, loai: 'mat_linh_thach', gia_tri: 0.04, mo_ta: `${CE("tia_set","⚡")} Phản kiếm! Kiếm khí bật ngược — mất 3% Linh Thạch!` },
    ]},
  the_tu: { id: 'bc_tt', ten: 'Thể Ngộ Địa Mạch', get emoji() { return CE('dt_the_tu','💪'); },
    mo_ta: 'Thể Tu trực tiếp hấp thu linh mạch qua thân thể — cơ thể là cầu nối tốt nhất với đất trời.',
    ket_qua: [
      { rate: 35, loai: 'heal', gia_tri: 3, get mo_ta() { return `${CE("dt_the_tu","💪")} Địa mạch linh lực thấm vào thể xác — hồi phục mạnh mẽ!`; } },
      { rate: 30, loai: 'exp', gia_tri: 0.4, mo_ta: '🌍 Thể ngộ thiên địa — tu vi bùng phát!' },
      { rate: 12, loai: 'linh_thach', gia_tri: 560, get mo_ta() { return `${CE("nt_tien","✨")} Linh khí kết tinh thành ngọc thạch +800!`; } },
      { rate: 23, loai: 'mat_linh_thach', gia_tri: 0.04, mo_ta: `${CE("tia_set","⚡")} Linh mạch phản ứng quá mạnh — tổn hao 2%!` },
    ]},
  phap_tu: { id: 'bc_pt', ten: 'Thiên Nhãn Dò Bí', get emoji() { return CE('dt_phap_tu','👁️'); },
    mo_ta: 'Pháp Tu mở Thiên Nhãn quan sát bí cảnh — pháp lực cao thâm phân tích từng góc khuất nguy hiểm.',
    ket_qua: [
      { rate: 28, loai: 'bi_phap_random', gia_tri: 1, get mo_ta() { return `${CE("ft_linh_ngo","📚")} Thiên Nhãn soi rõ bí pháp ẩn trong di tích!`; } },
      { rate: 28, loai: 'exp', gia_tri: 0.45, get mo_ta() { return `${CE("nt_tien","✨")} Pháp lực cộng hưởng bí cảnh — ngộ đạo sâu sắc!`; } },
      { rate: 15, loai: 'linh_thach', gia_tri: 850, get mo_ta() { return `${CE("tukv","💎")} Thiên Nhãn phát hiện kho báu ẩn — +1.200 Linh Thạch!`; } },
      { rate: 29, loai: 'mat_linh_thach', gia_tri: 0.05, mo_ta: `${CE("tia_set","⚡")} Pháp lực quá tải — tiêu hao 3% Linh Thạch!` },
    ]},
  ma_tu: { id: 'bc_mt', ten: 'Hút Ma Khí Tà Địa', get emoji() { return CE('dt_ma_tu',`${CE("tam_ma","😈")}`); },
    mo_ta: 'Ma Tu cảm nhận luồng ma khí ô uế của bí cảnh — đây chính là thiên đường tà đạo, hấp thụ toàn lực!',
    ket_qua: [
      { rate: 30, loai: 'linh_thach', gia_tri: 1550, get mo_ta() { return `${CE("nq_nghiep","🩸")} Ma khí kết tinh thành tà ngọc — +2.200 Linh Thạch!`; } },
      { rate: 25, loai: 'exp', gia_tri: 0.45, mo_ta: `${CE("tam_ma","😈")} Ma lực cộng hưởng — tu vi tăng trưởng điên cuồng!` },
      { rate: 18, loai: 'bi_phap_random', gia_tri: 1, get mo_ta() { return `${CE("tm_ma_than","🌑")} Ma khí truyền bí kỹ tà đạo cổ đại!`; } },
      { rate: 27, loai: 'mat_linh_thach', gia_tri: 0.07, get mo_ta() { return `${CE("nq_chuong","☠️")} Ma khí phản thực — xói mòn 5% Linh Thạch!`; } },
    ]},
  yeu_tu: { id: 'bc_yt', ten: 'Giao Cảm Linh Vật', get emoji() { return CE('dt_yeu_tu','🦋'); },
    mo_ta: 'Yêu Tu phát hào khí đồng loại — linh vật bí cảnh thân thiện đến gần, dẫn đường đến kho báu.',
    ket_qua: [
      { rate: 35, loai: 'linh_thao_random', gia_tri: 4, get mo_ta() { return `${CE("lt_linh_chi","🌿")} Linh vật dẫn đến rừng linh thảo cực phẩm — thu 5 loại!`; } },
      { rate: 25, loai: 'heal', gia_tri: 2.0, mo_ta: '🦋 Linh thú ban phước — khí huyết hồi phục dồi dào!' },
      { rate: 15, loai: 'linh_thach', gia_tri: 630, get mo_ta() { return `${CE("nt_tien","✨")} Linh vật tặng ngọc quý +900 Linh Thạch!`; } },
      { rate: 25, loai: 'mat_linh_thach', gia_tri: 0.04, mo_ta: '😅 Linh vật nghịch ngợm lấy mất 2% Linh Thạch!' },
    ]},
  dan_tu: { id: 'bc_dt', ten: 'Linh Thảo Bảo Địa', get emoji() { return CE('dt_dan_tu','🌺'); },
    mo_ta: 'Mũi Đan Tu phát hiện hương thơm đặc biệt — nơi đây là linh thảo bảo địa ngàn năm chưa ai biết!',
    ket_qua: [
      { rate: 38, loai: 'linh_thao_random', gia_tri: 5, get mo_ta() { return `${CE("lt_vong_hon_hoa","🌺")} Bảo địa linh thảo cực hiếm — thu hoạch 7 loại thảo dược!`; } },
      { rate: 25, loai: 'heal', gia_tri: 2.5, get mo_ta() { return `${CE("ni_vien_dan","💊")} Hấp thu linh khí bảo địa — hồi phục thần tốc!`; } },
      { rate: 12, loai: 'exp', gia_tri: 0.25, get mo_ta() { return `${CE("nt_tien","✨")} Nghiên cứu linh thảo quý — ngộ đạo đan dược!`; } },
      { rate: 25, loai: 'mat_linh_thach', gia_tri: 0.04, mo_ta: `${CE('warn_icon','⚠️')} Linh thảo độc bùng phát — mất 2% Linh Thạch điều trị!` },
    ]},
  khi_tu: { id: 'bc_kht', ten: 'Khai Phong Khí Cụ Cổ', get emoji() { return CE('dt_khi_tu','⚙️'); },
    mo_ta: 'Khí Tu cảm nhận rung động kim loại cổ đại — kho tàng khí cụ từ thuở khai thiên lập địa hiện ra!',
    ket_qua: [
      { rate: 25, loai: 'linh_thach', gia_tri: 1750, get mo_ta() { return `${CE("kv_sat_tinh","⚙️")} Khai phong bảo khố — thu hoạch **2.500 Linh Thạch**!`; } },
      { rate: 25, loai: 'bi_phap_random', gia_tri: 1, mo_ta: '🔨 Cổ khí truyền thụ rèn đúc bí kỹ tuyệt học!' },
      { rate: 20, loai: 'exp', gia_tri: 0.3, get mo_ta() { return `${CE("nt_tien","✨")} Nghiên cứu cổ khí — ngộ đạo rèn đúc sâu sắc!`; } },
      { rate: 30, loai: 'mat_linh_thach', gia_tri: 0.06, get mo_ta() { return `${CE("bb_loi_hoa_cau","💥")} Cổ khí phát nổ — tiêu hao 4% Linh Thạch!`; } },
    ]},
  tran_tu: { id: 'bc_trt', ten: 'Giải Trận Thu Bảo', get emoji() { return CE('dt_tran_tu','🔮'); },
    mo_ta: 'Trận Tu phân tích cơ cấu bí cảnh chỉ trong nháy mắt — trận pháp không thể che giấu tài bảo!',
    ket_qua: [
      { rate: 30, loai: 'linh_thach', gia_tri: 1120, get mo_ta() { return `${CE("tult_trung","🔮")} Phá giải trận pháp — lộ ra **1.600 Linh Thạch**!`; } },
      { rate: 28, loai: 'bi_phap_random', gia_tri: 1, get mo_ta() { return `${CE("nt_tien","✨")} Cổ trận truyền thụ — bí kỹ trận pháp hiển lộ!`; } },
      { rate: 15, loai: 'exp', gia_tri: 0.3, mo_ta: '📖 Nghiên cứu cổ trận — ngộ đạo trận pháp sâu sắc!' },
      { rate: 27, loai: 'mat_linh_thach', gia_tri: 0.04, mo_ta: `${CE("tia_set","⚡")} Trận pháp phản kích nhẹ — mất 1% Linh Thạch!` },
    ]},
};

const DAO_TU_BC_MOD = {
  kiem_tu: {
    linh_thach: 1.3, bi_phap_random: 1.2,        // LỢI: chiến lợi phẩm & bí pháp hơi tốt hơn
    mat_linh_thach: 2.2, exp: 0.35,              // HẠI: liều lĩnh mất nhiều tài nguyên, học rất chậm
  },
  the_tu: {
    heal: 1.4, mat_linh_thach: 0.6,              // LỢI: hồi phục khá, ít mất linh thạch hơn chút
    exp: 0.3, bi_phap_random: 0.25,              // HẠI: ngộ tính cực kém, hầu như không hiểu bí pháp
  },
  phap_tu: {
    exp: 1.4, bi_phap_random: 1.5,               // LỢI: học tốt, thông thạo bí pháp
    mat_linh_thach: 2.0, linh_thach: 0.35,       // HẠI: thể chất yếu mất tiền nhiều, rất ít chiến lợi
  },
  ma_tu: {
    linh_thach: 1.3, bi_phap_random: 1.2,        // LỢI: may mắn tà đạo vừa phải
    mat_linh_thach: 2.5, exp: 0.4,               // HẠI: tà đạo rủi ro cực cao, tu vi hỗn loạn nặng
  },
  yeu_tu: {
    linh_thao_random: 1.5, heal: 1.3,            // LỢI: thiên nhiên ưu đãi vừa phải
    mat_linh_thach: 2.0, exp: 0.4,               // HẠI: bị kỳ thị mất linh thạch nhiều, học kinh điển kém
  },
  dan_tu: {
    linh_thao_random: 1.8, heal: 1.3,            // LỢI: linh thảo tốt, hồi phục khá
    mat_linh_thach: 2.2, linh_thach: 0.3,        // HẠI: yếu đuối bị cướp nhiều, gần như không có chiến lợi
  },
  khi_tu: {
    linh_thach: 1.4, bi_phap_random: 1.2,        // LỢI: tìm khí cụ & bảo vật tạm được
    linh_thao_random: 0.15, exp: 0.4,             // HẠI: bỏ qua thiên nhiên hoàn toàn, tu vi bị kìm hãm
  },
  tran_tu: {
    mat_linh_thach: 0.5, bi_phap_random: 1.3,    // LỢI: kháng mất linh thạch một phần, nghiên cứu trận pháp
    exp: 0.25, linh_thach: 0.35,                 // HẠI: thụ động rất ít tu vi, chiến lợi phẩm gần như không có
  },
};

async function xuLyBiCanhKetQua(n, t, e) {
  tinhCS(n);
  // Áp tỉ lệ Đạo Tu vào danh sách kết quả trước khi roll
  const dtMod = (n.dao_tu && DAO_TU_BC_MOD[n.dao_tu]) ? DAO_TU_BC_MOD[n.dao_tu] : {};
  const adjKQ = e.ket_qua.map(kq => ({ ...kq, rate: kq.rate * (dtMod[kq.loai] || 1) }));
  const totalRate = adjKQ.reduce((s, k) => s + k.rate, 0);
  const h = totalRate * Math.random();
  let i = 0,
    a = adjKQ[adjKQ.length - 1];
  for (const kq of adjKQ)
    if (((i += kq.rate), h < i)) {
      a = kq;
      break;
    }
  let o = (a.mo_ta || "").replace(/Linh Thạch/g, CE("tult", "💠") + " Linh Thạch");
  const c = getKhiVanBonus(n.khi_van || 30);
  if ("linh_thach" === a.loai) {
    const e = getTT(n, "drop"),
      h = Math.floor(a.gia_tri * (1 + c.bi_canh_bonus + e)),
      lt = calcMaxLinhThach(n, h);
    if (lt > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [lt, t]);
    o = a.mo_ta.replace(fmt(a.gia_tri), lt > 0 ? fmt(lt) : `0 *(túi đầy)*`);
  } else if ("mat_hp" === a.loai) {
    const e = Math.floor(Number(n.linh_thach) * a.gia_tri * 0.06);
    (await db("UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1) WHERE user_id=$2", [e, t]),
      (o = a.mo_ta.replace("Linh Lực", "Linh Thạch") + ` *(−**${fmt(e)}** ${CE("tult", "💠")})*`));
  } else if ("mat_linh_thach" === a.loai) {
    const e = Math.floor(Number(n.linh_thach) * a.gia_tri);
    await db("UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1) WHERE user_id=$2", [e, t]);
  } else if ("heal" === a.loai) {
    const ltHeal = Math.floor(1500 * a.gia_tri),
      ltH = calcMaxLinhThach(n, ltHeal);
    if (ltH > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [ltH, t]);
    o = a.mo_ta.replace("Linh Lực", "Linh Thạch") + ` (+**${fmt(ltH)}** ${CE("tult", "💠")}${ltH < ltHeal ? " *(túi đầy)*" : ""})`;
  } else if ("heal_linh_thach" === a.loai) {
    const ltHT = calcMaxLinhThach(n, a.gia_tri);
    if (ltHT > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [ltHT, t]);
  }
  else if ("exp" === a.loai) {
    const e = Math.floor(calcEXP_active(n) * a.gia_tri),
      h = CANH_GIOI[n.canh_gioi + 1],
      i = Math.floor(10 * Math.random()) + 5,
      c = Math.min(100, (n.cam_ngo || 0) + i);
    (h
      ? await db("UPDATE players SET exp=LEAST(exp+$1,$2), cam_ngo=$3 WHERE user_id=$4", [
          e,
          h.exp_can,
          c,
          t,
        ])
      : await db("UPDATE players SET exp=exp+$1, cam_ngo=$2 WHERE user_id=$3", [e, c, t]),
      (o = `${CE("tutv", "📈")} +**${fmt(e)}** Tu Vi | Cảm Ngộ +**${i}%** (${c}%)`));
  } else if ("bi_phap_random" === a.loai) o = await awardBiPhap(n, t);
  else if ("linh_thao_random" === a.loai) {
    const e = await awardLinhThao(n, t, a.gia_tri);
    o = e
      ? `${CE("lt_linh_chi","🌿")} Hái được **${e.ten} ×${e.gia_tri}**!`
      : "${CE('warn_icon','⚠️')} **Túi quá nặng** — linh thảo rơi xuống đất! Dùng `-tui` để kiểm tra.";
  }
  return { kq: a, resultStr: o };
}


  reg("co_duyen", ["duyen", "coduyen"], async (n) => {
    const t = n.author.id,
      e = await getPlayer(t);
    if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });
    const h = (Date.now() - Number(e.co_duyen_cd || 0)) / 36e5;
    const effectiveCoDuyenCd = 8 * (1 - getTT(e, 'cd_reduce'));
    if (h < effectiveCoDuyenCd) {
      const expiryUnixCoDuyen = Math.floor((Number(e.co_duyen_cd || 0) + effectiveCoDuyenCd * 3_600_000) / 1000);
      return n.reply({
        embeds: [warnE(`Hết CD <t:${expiryUnixCoDuyen}:R> (lúc <t:${expiryUnixCoDuyen}:t>).`)],
      });
    }
    const i = getKhiVanBonus(e.khi_van || 30),
      a = ["mat_linh_thach", "mat_hp", "mat_tam_ma"],
      o = "phong_thuy" === e.nghe,
      c = o && "phong_thuy" === e.thien_phu_nghe,
      _ = c ? 2 : o ? 1.5 : 1,
      u = c ? 0.25 : o ? 0.5 : 1,
      r = 1 + i.co_duyen_bonus;
    // ── Đạo Tu ảnh hưởng Cơ Duyên (multiplier trực tiếp theo event ID) ────────
    // > 1 = sự kiện xảy ra nhiều hơn (kể cả sự kiện XẤU — đây là điểm yếu)
    // < 1 = sự kiện xảy ra ít hơn (kể cả sự kiện TỐT — đây là mặt thiếu sót)
    // ── Cơ Duyên: mỗi Đạo Tu có đúng 3 LỢI và 3 HẠI ──────────────────────
    // LỢI = sự kiện tốt nhiều hơn (>1) HOẶC sự kiện xấu ít hơn (<1)
    // HẠI = sự kiện xấu nhiều hơn (>1) HOẶC sự kiện tốt ít hơn (<1)
    const DAO_TU_CD_MOD = {
      kiem_tu: {
        co_ngoc: 1.3, truyen_thua_bi_mat: 1.2, bi_cuop_giua_duong: 0.6,   // LỢI ×3: vừa phải
        ma_tu_truy_sat: 2.2, dai_ngo_dao: 0.25, linh_duoc_thu: 0.25,       // HẠI ×3: rất nặng
      },
      the_tu: {
        cuu_nguoi_thuong: 1.3, khi_van_tang: 1.2, kiep_nan_thuong: 0.5,    // LỢI ×3: vừa phải
        bi_cuop_giua_duong: 2.0, dai_ngo_dao: 0.2, tien_nhan_truyen_phap: 0.3, // HẠI ×3: rất nặng
      },
      phap_tu: {
        tien_nhan_truyen_phap: 1.5, dai_ngo_dao: 1.4, phap_bao_that_giam: 0.3, // LỢI ×3: vừa phải
        ma_khi_xam_nhap: 2.2, co_ngoc: 0.3, khi_van_tang: 0.3,                 // HẠI ×3: rất nặng
      },
      ma_tu: {
        co_ngoc: 1.3, bi_canh_phat_hien: 1.3, tu_vi_sung_man: 1.2,         // LỢI ×3: vừa phải
        ma_khi_xam_nhap: 2.5, bi_cuop_giua_duong: 2.2, tien_nhan_truyen_phap: 0.2, // HẠI ×3: cực nặng
      },
      yeu_tu: {
        linh_duoc_thu: 1.5, tien_canh_ngo: 1.3, vong_hon_nhap_than: 0.5,   // LỢI ×3: vừa phải
        bi_cuop_giua_duong: 2.0, tien_nhan_truyen_phap: 0.2, truyen_thua_bi_mat: 0.3, // HẠI ×3: rất nặng
      },
      dan_tu: {
        linh_duoc_thu: 1.8, tien_canh_ngo: 1.3, cuu_nguoi_thuong: 1.2,    // LỢI ×3: vừa phải
        ma_tu_truy_sat: 2.2, bi_cuop_giua_duong: 2.0, co_ngoc: 0.3,        // HẠI ×3: rất nặng
      },
      khi_tu: {
        co_ngoc: 1.4, bi_canh_phat_hien: 1.3, ma_khi_xam_nhap: 0.5,       // LỢI ×3: vừa phải
        vong_hon_nhap_than: 2.0, phap_bao_that_giam: 1.8, linh_duoc_thu: 0.2, // HẠI ×3: rất nặng
      },
      tran_tu: {
        tien_nhan_truyen_phap: 1.3, dai_ngo_dao: 1.3, phap_bao_that_giam: 0.25, // LỢI ×3: vừa phải
        ma_tu_truy_sat: 2.0, bi_canh_phat_hien: 0.25, khi_van_tang: 0.3,         // HẠI ×3: rất nặng
      },
    };
    const dtDuyenMod = (e.dao_tu && DAO_TU_CD_MOD[e.dao_tu]) ? DAO_TU_CD_MOD[e.dao_tu] : {};
    let d;
    if (e.dao_tu && DAO_TU_EXCLUSIVE_EVENTS[e.dao_tu] && Math.random() < 0.28) {
      // ── Sự kiện đặc thù Đạo Tu (28% cơ hội) ──────────────────────────────
      const excPool = DAO_TU_EXCLUSIVE_EVENTS[e.dao_tu];
      d = excPool[Math.floor(Math.random() * excPool.length)];
    } else {
      const s = CO_DUYEN_EVENTS.map((n) => {
          let w = a.includes(n.hieu_ung.loai) ? (n.rate * u) / r : n.rate * _ * r;
          if (dtDuyenMod[n.id]) w *= dtDuyenMod[n.id];
          return { ...n, w };
        }),
        l = s.reduce((n, t) => n + t.w, 0),
        m = Math.random() * l;
      let g = 0;
      d = CO_DUYEN_EVENTS[CO_DUYEN_EVENTS.length - 1];
      for (const n of s)
        if (((g += n.w), m < g)) {
          d = n;
          break;
        }
    }
    await db("UPDATE players SET co_duyen_cd=$1 WHERE user_id=$2", [Date.now(), t]);
    tinhCS(e);
    let p = "";
    const T = d.hieu_ung;
    if ("exp" === T.loai) {
      const n = Math.floor(calcEXP_active(e) * T.gia_tri),
        h = CANH_GIOI[e.canh_gioi + 1];
      (h
        ? await db("UPDATE players SET exp=LEAST(exp+$1,$2) WHERE user_id=$3", [n, h.exp_can, t])
        : await db("UPDATE players SET exp=exp+$1 WHERE user_id=$2", [n, t]),
        (p = `${CE("tutv", "📈")} +**${fmt(n)}** Tu Vi`));
    } else if ("linh_thach" === T.loai) {
      const n = getTT(e, "drop"),
        h = Math.floor(T.gia_tri * (1 + i.bi_canh_bonus + n)),
        ltBC2 = calcMaxLinhThach(e, h);
      if (ltBC2 > 0) await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [ltBC2, t]);
      p = `${CE("tult", "💠")} +**${fmt(ltBC2)}** Linh Thạch${ltBC2 < h ? " *(túi đầy)*" : ""}`;
      // Bonus Trung/Cao cho cảnh giới cao
      if (e.canh_gioi >= 15 && Math.random() < 0.25) {
        const trungQ = e.canh_gioi >= 25 ? 2 : 1;
        const trungGot = calcMaxLinhThachTrung(e, trungQ);
        if (trungGot > 0) {
          await db("UPDATE players SET linh_thach_trung=linh_thach_trung+$1 WHERE user_id=$2", [trungGot, t]);
          p += `\n${CE("tult_trung","🔮")} +**${trungGot} Linh Thạch Trung** *(thiên địa tinh hoa)*`;
        }
      }
      if (e.canh_gioi >= 25 && Math.random() < 0.10) {
        const caoGot = calcMaxLinhThachCao(e, 1);
        if (caoGot > 0) {
          await db("UPDATE players SET linh_thach_cao=linh_thach_cao+$1 WHERE user_id=$2", [caoGot, t]);
          p += `\n${CE("tult_cao","💚")} +**1 Linh Thạch Cao** 🌟 *(kỳ ngộ thiên phẩm!)*`;
        }
      }
    } else if ("mat_linh_thach" === T.loai) {
      const n = Math.floor(Number(e.linh_thach) * T.gia_tri);
      (await db("UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1) WHERE user_id=$2", [n, t]),
        (p = `💸 Mất **${fmt(n)}** Linh Thạch!`));
    } else if ("mat_hp" === T.loai) {
      const n = Math.floor(Number(e.linh_thach) * T.gia_tri * 0.06);
      (await db("UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1) WHERE user_id=$2", [n, t]),
        (p = `${CE("tia_set","⚡")} Bị tấn công! Mất **${fmt(n)}** ${CE("tult", "💠")} Linh Thạch!`));
    } else if ("bi_phap_random" === T.loai) p = await awardBiPhap(e, t);
    else if ("ngo_dao" === T.loai)
      if (e.binh_canh) {
        const n = Math.max(80, e.cam_ngo || 0);
        await db("UPDATE players SET binh_canh=FALSE, cam_ngo=$1 WHERE user_id=$2", [n, t]);
        const h = Math.floor(3 * Math.random()) + 1;
        (await db("UPDATE players SET ngo_tinh=LEAST(100,ngo_tinh+$1) WHERE user_id=$2", [h, t]),
          (p = `${CE("tip_icon","💡")} **Đại Ngộ Đạo — Phá Bình Cảnh!**\nBình Cảnh đã tan | Cảm Ngộ tăng lên **${n}%** | Ngộ Tính +${h}!\n*Dùng \`-dot_pha\` để đột phá ngay!*`));
      } else {
        const n = Math.floor(15 * Math.random()) + 10,
          h = Math.min(100, (e.cam_ngo || 0) + n);
        (await db(
          "UPDATE players SET cam_ngo=$1, ngo_tinh=LEAST(100,ngo_tinh+1) WHERE user_id=$2",
          [h, t],
        ),
          (p = `${CE("tip_icon","💡")} **Đại Ngộ Đạo!** Cảm Ngộ +**${n}%** → **${h}%** | Ngộ Tính +1`));
      }
    else if ("mat_tam_ma" === T.loai) {
      const n = e.tam_ma ?? 100,
        h = Math.max(-100, n + T.gia_tri);
      (await db(
        "UPDATE players SET tam_ma=$1, nhan_qua=GREATEST(-100,nhan_qua-5), ma_khi=ma_khi+5 WHERE user_id=$2",
        [h, t],
      ),
        (p = `${CE("tam_ma","😈")} Đạo Tâm: **${n}** → **${h}** | Ma Khí +5`));
    } else if ("linh_thao_random" === T.loai) {
      const n = await awardLinhThao(e, t, T.gia_tri);
      p = n
        ? `🌿 Nhặt được **${n.gia_tri}x ${n.ten}** ${n.emoji}!`
        : "${CE('warn_icon','⚠️')} **Túi quá nặng** — linh thảo bị mất! Dùng `-tui` để kiểm tra.";
    } else if ("cong_duc" === T.loai) {
      const n = 10;
      (await db(
        "UPDATE players SET nhan_qua=LEAST(100,nhan_qua+$1), cong_duc=cong_duc+$2, khi_van=LEAST(100,khi_van+$3) WHERE user_id=$4",
        [T.gia_tri, T.gia_tri, n, t],
      ),
        (p = `${CE("tam_nhan","😇")} +**${T.gia_tri} Công Đức** | Nhân Quả +${T.gia_tri} | Khí Vận +${n}!`));
    } else if ("khi_van_bonus" === T.loai)
      (await db("UPDATE players SET khi_van=LEAST(100,khi_van+$1) WHERE user_id=$2", [
        T.gia_tri,
        t,
      ]),
        (p = `${CE("tukv", "🍀")} Khí Vận +**${T.gia_tri}**!`));
    else if ("tau_hoa" === T.loai) {
      const n = Math.floor(Number(e.linh_thach) * (T.hp || 0) * 0.06),
        h = Math.floor(Number(e.linh_thach) * (T.lt || 0)) + n,
        i = Math.max(-100, (e.tam_ma ?? 100) + (T.tam_ma || 0));
      await db(
        "UPDATE players SET linh_thach=GREATEST(0,linh_thach-$1), tam_ma=$2, ma_khi=ma_khi+10, nhan_qua=GREATEST(-100,nhan_qua-3) WHERE user_id=$3",
        [h, i, t],
      );
      const a = [];
      (h > 0 && a.push(`-**${fmt(h)}** ${CE("tult", "💠")} Linh Thạch`),
        T.tam_ma && a.push(`Đạo Tâm **${T.tam_ma}**`),
        (p = `💥 ${a.join(" | ")}! Ma Khí +10`));
    } else if ("khi_van_giam" === T.loai) {
      const n = Math.max(0, (e.khi_van || 30) + (T.gia_tri || -15)),
        h = Math.max(0, (e.cam_ngo || 0) + (T.cam_ngo || 0));
      (await db("UPDATE players SET khi_van=$1, cam_ngo=$2 WHERE user_id=$3", [n, h, t]),
        (p = `🌑 Khí Vận **${T.gia_tri}** → **${n}**${T.cam_ngo ? ` | Cảm Ngộ **${T.cam_ngo}%** → **${h}%**` : ""}`));
    }
    const b = ![
      "ma_tu_truy_sat",
      "linh_vat_tan_cong",
      "ma_khi_xam_nhap",
      "thien_loi_kha_than",
      "vong_hon_nhap_than",
      "bi_cuop_giua_duong",
      "kiep_nan_thuong",
      "khi_van_giam_su_kien",
      "phap_bao_that_giam",
    ].includes(d.id);
    return n.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${d.emoji} ${d.ten}`)
          .setColor(b ? 15258701 : 12597547)
          .setAuthor({ name: "🌌 Cơ Duyên Hội Ngộ" })
          .setDescription(`${d.mo_ta ? `*${d.mo_ta}*\n\n` : ""}${b ? "🎊" : "${CE('warn_icon','⚠️')}"} **${p}**`)
          .setThumbnail(n.author.displayAvatarURL())
          .setFooter({
            text: `${CEu("tukv", "💎")} Khí Vận: ${e.khi_van || 30}/100 · CD: 8h${e.dao_tu && DAO_TU[e.dao_tu] ? ` · ${CEu(e.dao_tu, "⚔️")} ${DAO_TU[e.dao_tu].ten} ảnh hưởng duyên` : ' · Chưa chọn Đạo Tu (-dao_tu_chon)'}`,
          }),
      ],
    });
  });

