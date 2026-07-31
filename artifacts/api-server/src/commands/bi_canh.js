'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer, awardBiPhap, awardLinhThao } = require('../db/players');
const { CE } = require('../systems/emoji');
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

// ── Lựa chọn Bí Cảnh đặc thù từng Đạo Tu ────────────────────────────────────
const DAO_TU_BI_CANH_CHOICES = {
  kiem_tu: { id: 'bc_kt', ten: 'Kiếm Tâm Chiếu Cảnh', get emoji() { return CE("dt_kiem_tu","⚔️"); },
    mo_ta: 'Dùng kiếm ý quét qua bí cảnh — sát khí vạch đường, Kiếm Tu dễ tìm thấy kho báu ẩn giấu.',
    ket_qua: [
      { rate: 30, loai: 'linh_thach', gia_tri: 1250, get mo_ta() { return `${CE("tuatk","⚔️")} Kiếm khí phá ấn — tìm được **1.800 Linh Thạch**!`; } },
      { rate: 25, loai: 'bi_phap_random', gia_tri: 1, get mo_ta() { return `${CE("ft_am_sat","🗡️")} Kiếm tâm cảm ứng — bí kỹ kiếm đạo hiển lộ!`; } },
      { rate: 20, loai: 'exp', gia_tri: 0.3, get mo_ta() { return `${CE("nt_tien","✨")} Kiếm ý cộng hưởng bí cảnh, tu vi tăng vọt!`; } },
      { rate: 25, loai: 'mat_linh_thach', gia_tri: 0.04, mo_ta: `${CE("tia_set","⚡")} Phản kiếm! Kiếm khí bật ngược — mất 3% Linh Thạch!` },
    ]},
  the_tu: { id: 'bc_tt', ten: 'Thể Ngộ Địa Mạch', get emoji() { return CE("dt_the_tu","💪"); },
    mo_ta: 'Thể Tu trực tiếp hấp thu linh mạch qua thân thể — cơ thể là cầu nối tốt nhất với đất trời.',
    ket_qua: [
      { rate: 35, loai: 'heal', gia_tri: 3, get mo_ta() { return `${CE("dt_the_tu","💪")} Địa mạch linh lực thấm vào thể xác — hồi phục mạnh mẽ!`; } },
      { rate: 30, loai: 'exp', gia_tri: 0.4, mo_ta: '🌍 Thể ngộ thiên địa — tu vi bùng phát!' },
      { rate: 12, loai: 'linh_thach', gia_tri: 560, get mo_ta() { return `${CE("nt_tien","✨")} Linh khí kết tinh thành ngọc thạch +800!`; } },
      { rate: 23, loai: 'mat_linh_thach', gia_tri: 0.04, mo_ta: `${CE("tia_set","⚡")} Linh mạch phản ứng quá mạnh — tổn hao 2%!` },
    ]},
  phap_tu: { id: 'bc_pt', ten: 'Thiên Nhãn Dò Bí', get emoji() { return CE("dt_phap_tu",`${CE("ft_tu_luyen","🧘")}`); },
    mo_ta: 'Pháp Tu mở Thiên Nhãn quan sát bí cảnh — pháp lực cao thâm phân tích từng góc khuất nguy hiểm.',
    ket_qua: [
      { rate: 28, loai: 'bi_phap_random', gia_tri: 1, get mo_ta() { return `${CE("ft_linh_ngo","📚")} Thiên Nhãn soi rõ bí pháp ẩn trong di tích!`; } },
      { rate: 28, loai: 'exp', gia_tri: 0.45, get mo_ta() { return `${CE("nt_tien","✨")} Pháp lực cộng hưởng bí cảnh — ngộ đạo sâu sắc!`; } },
      { rate: 15, loai: 'linh_thach', gia_tri: 850, get mo_ta() { return `${CE("tukv","💎")} Thiên Nhãn phát hiện kho báu ẩn — +1.200 Linh Thạch!`; } },
      { rate: 29, loai: 'mat_linh_thach', gia_tri: 0.05, mo_ta: `${CE("tia_set","⚡")} Pháp lực quá tải — tiêu hao 3% Linh Thạch!` },
    ]},
  ma_tu: { id: 'bc_mt', ten: 'Hút Ma Khí Tà Địa', get emoji() { return CE("dt_ma_tu","🔥"); },
    mo_ta: 'Ma Tu cảm nhận luồng ma khí ô uế của bí cảnh — đây chính là thiên đường tà đạo, hấp thụ toàn lực!',
    ket_qua: [
      { rate: 30, loai: 'linh_thach', gia_tri: 1550, get mo_ta() { return `${CE("nq_nghiep","🩸")} Ma khí kết tinh thành tà ngọc — +2.200 Linh Thạch!`; } },
      { rate: 25, loai: 'exp', gia_tri: 0.45, mo_ta: `${CE("tam_ma","😈")} Ma lực cộng hưởng — tu vi tăng trưởng điên cuồng!` },
      { rate: 18, loai: 'bi_phap_random', gia_tri: 1, get mo_ta() { return `${CE("tm_ma_than","🌑")} Ma khí truyền bí kỹ tà đạo cổ đại!`; } },
      { rate: 27, loai: 'mat_linh_thach', gia_tri: 0.07, get mo_ta() { return `${CE("nq_chuong","☠️")} Ma khí phản thực — xói mòn 5% Linh Thạch!`; } },
    ]},
  yeu_tu: { id: 'bc_yt', ten: 'Giao Cảm Linh Vật', get emoji() { return CE("dt_yeu_tu","🐉"); },
    mo_ta: 'Yêu Tu phát hào khí đồng loại — linh vật bí cảnh thân thiện đến gần, dẫn đường đến kho báu.',
    ket_qua: [
      { rate: 35, loai: 'linh_thao_random', gia_tri: 4, get mo_ta() { return `${CE("lt_linh_chi","🌿")} Linh vật dẫn đến rừng linh thảo cực phẩm — thu 5 loại!`; } },
      { rate: 25, loai: 'heal', gia_tri: 2.0, mo_ta: '🦋 Linh thú ban phước — khí huyết hồi phục dồi dào!' },
      { rate: 15, loai: 'linh_thach', gia_tri: 630, get mo_ta() { return `${CE("nt_tien","✨")} Linh vật tặng ngọc quý +900 Linh Thạch!`; } },
      { rate: 25, loai: 'mat_linh_thach', gia_tri: 0.04, mo_ta: '😅 Linh vật nghịch ngợm lấy mất 2% Linh Thạch!' },
    ]},
  dan_tu: { id: 'bc_dt', ten: 'Linh Thảo Bảo Địa', get emoji() { return CE("dt_dan_tu","🌿"); },
    mo_ta: 'Mũi Đan Tu phát hiện hương thơm đặc biệt — nơi đây là linh thảo bảo địa ngàn năm chưa ai biết!',
    ket_qua: [
      { rate: 38, loai: 'linh_thao_random', gia_tri: 5, get mo_ta() { return `${CE("lt_vong_hon_hoa","🌺")} Bảo địa linh thảo cực hiếm — thu hoạch 7 loại thảo dược!`; } },
      { rate: 25, loai: 'heal', gia_tri: 2.5, get mo_ta() { return `${CE("ni_vien_dan","💊")} Hấp thu linh khí bảo địa — hồi phục thần tốc!`; } },
      { rate: 12, loai: 'exp', gia_tri: 0.25, get mo_ta() { return `${CE("nt_tien","✨")} Nghiên cứu linh thảo quý — ngộ đạo đan dược!`; } },
      { rate: 25, loai: 'mat_linh_thach', gia_tri: 0.04, mo_ta: `${CE('warn_icon','⚠️')} Linh thảo độc bùng phát — mất 2% Linh Thạch điều trị!` },
    ]},
  khi_tu: { id: 'bc_kht', ten: 'Khai Phong Khí Cụ Cổ', get emoji() { return CE("dt_khi_tu","🛠️"); },
    mo_ta: 'Khí Tu cảm nhận rung động kim loại cổ đại — kho tàng khí cụ từ thuở khai thiên lập địa hiện ra!',
    ket_qua: [
      { rate: 25, loai: 'linh_thach', gia_tri: 1750, get mo_ta() { return `${CE("kv_sat_tinh","⚙️")} Khai phong bảo khố — thu hoạch **2.500 Linh Thạch**!`; } },
      { rate: 25, loai: 'bi_phap_random', gia_tri: 1, mo_ta: '🔨 Cổ khí truyền thụ rèn đúc bí kỹ tuyệt học!' },
      { rate: 20, loai: 'exp', gia_tri: 0.3, get mo_ta() { return `${CE("nt_tien","✨")} Nghiên cứu cổ khí — ngộ đạo rèn đúc sâu sắc!`; } },
      { rate: 30, loai: 'mat_linh_thach', gia_tri: 0.06, get mo_ta() { return `${CE("bb_loi_hoa_cau","💥")} Cổ khí phát nổ — tiêu hao 4% Linh Thạch!`; } },
    ]},
  tran_tu: { id: 'bc_trt', ten: 'Giải Trận Thu Bảo', get emoji() { return CE("dt_tran_tu","🧿"); },
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
  } else if ("linh_thach_trung" === a.loai) {
    const want = Math.max(1, a.gia_tri || 1);
    const qty = calcMaxLinhThachTrung(n, want);
    if (qty > 0) await db("UPDATE players SET linh_thach_trung=linh_thach_trung+$1 WHERE user_id=$2", [qty, t]);
    o = qty > 0
      ? `${CE("tult_trung","🔮")} **+${qty} Linh Thạch Trung** ✨ ${a.mo_ta_extra || "*(vật quý hiếm!)*"}${qty < want ? ` *(túi đầy, chỉ nhận ${qty}/${want})*` : ""}`
      : `${CE("tult_trung","🔮")} ~~+${want} Linh Thạch Trung~~ *(túi quá nặng — rơi mất!)*`;
  } else if ("linh_thach_cao" === a.loai) {
    const want = Math.max(1, a.gia_tri || 1);
    const qty = calcMaxLinhThachCao(n, want);
    if (qty > 0) await db("UPDATE players SET linh_thach_cao=linh_thach_cao+$1 WHERE user_id=$2", [qty, t]);
    o = qty > 0
      ? `${CE("tult_cao","💚")} **+${qty} Linh Thạch Cao** 🌟 ${a.mo_ta_extra || "*(thiên phẩm cực hiếm!)*"}${qty < want ? ` *(túi đầy, chỉ nhận ${qty}/${want})*` : ""}`
      : `${CE("tult_cao","💚")} ~~+${want} Linh Thạch Cao~~ *(túi quá nặng — rơi mất!)*`;
  } else if ("bi_phap_random" === a.loai) o = await awardBiPhap(n, t);
  else if ("linh_thao_random" === a.loai) {
    const e = await awardLinhThao(n, t, a.gia_tri);
    o = e
      ? `${CE("lt_linh_chi","🌿")} Hái được **${e.ten} ×${e.gia_tri}**!`
      : "${CE('warn_icon','⚠️')} **Túi quá nặng** — linh thảo rơi xuống đất! Dùng `-tui` để kiểm tra.";
  }
  // ── Bonus Linh Thạch Trung/Cao cho cảnh giới cao ────────────────────────
  // Chỉ áp dụng khi kết quả không phải tiêu hao (mat_*)
  const isPositive = !['mat_linh_thach','mat_hp'].includes(a.loai);
  if (isPositive && n.canh_gioi >= 15) {
    const trungChance = n.canh_gioi >= 25 ? 0.30 : 0.20;
    if (Math.random() < trungChance) {
      const trungWant = n.canh_gioi >= 30 ? 2 : 1;
      const trungQty = calcMaxLinhThachTrung(n, trungWant);
      if (trungQty > 0) {
        await db("UPDATE players SET linh_thach_trung=linh_thach_trung+$1 WHERE user_id=$2", [trungQty, t]);
        o += `\n${CE("tult_trung","🔮")} **+${trungQty} Linh Thạch Trung** *(thiên địa tinh hoa kết thành)*`;
      }
    }
    if (n.canh_gioi >= 25 && Math.random() < 0.10) {
      const caoQty = calcMaxLinhThachCao(n, 1);
      if (caoQty > 0) {
        await db("UPDATE players SET linh_thach_cao=linh_thach_cao+$1 WHERE user_id=$2", [caoQty, t]);
        o += `\n${CE("tult_cao","💚")} **+1 Linh Thạch Cao** 🌟 *(thiên phẩm kỳ ngộ!)*`;
      }
    }
  }
  return { kq: a, resultStr: o };
}


  reg("bi_canh", ["bic", "bicanh"], async (n, t) => {
    const userId = n.author.id,
      sub = (t[0] || "xem").toLowerCase(),
      player = await getPlayer(userId);
    if (!player) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });

    const elapsedH = (Date.now() - Number(player.bi_canh_cd || 0)) / 36e5;
    const effectiveBiCanhCd = BI_CANH_CD_H * (1 - getTT(player, 'cd_reduce'));
    const cdActive = elapsedH < effectiveBiCanhCd;

    function cdMsg() {
      const expiryUnix = Math.floor((Number(player.bi_canh_cd || 0) + effectiveBiCanhCd * 3_600_000) / 1000);
      return warnE(
        `${CE("cd_timer","⏳")} Bí Cảnh vẫn đang hồi phục! Hết CD <t:${expiryUnix}:R> (lúc <t:${expiryUnix}:t>).\n` +
        `Dùng \`-bi_canh xem\` để kiểm tra trạng thái.`
      );
    }

    if ("xem" === sub) {
      const sess = BI_CANH_SESSIONS.get(userId);
      if (sess && Date.now() - sess.ts < 3e5) {
        const emb = new EmbedBuilder()
          .setTitle(`${CE("ft_bi_canh","🗺️")} Bí Cảnh — Đang Khám Phá`)
          .setColor(10181046)
          .setDescription("Chọn hành động:\n━━━━━━━━━━━━━━━━━━━━");
        for (const ch of sess.choices)
          emb.addFields({ name: `${ch.emoji} ${ch.id}. ${ch.ten}`, value: ch.mo_ta, inline: false });
        return emb.setFooter({ text: "Dùng -bi_canh chon <1-5> | Hết hạn sau 5 phút" }),
          n.reply({ embeds: [emb] });
      }
      if (cdActive) return n.reply({ embeds: [cdMsg()] });
      return n.reply({
        embeds: [okE(CE("ft_bi_canh","🗺️") + " Bí Cảnh đã sẵn sàng!\nDùng `-bi_canh vao` để tiến vào.\nCD: 4 giờ/lần")],
      });
    }

    if ("vao" === sub) {
      if (cdActive) {
        console.log(`[bi_canh] CD block: user=${userId} (${player.username}) bi_canh_cd=${player.bi_canh_cd} elapsed=${elapsedH.toFixed(2)}h`);
        return n.reply({ embeds: [cdMsg()] });
      }
      const existingSess = BI_CANH_SESSIONS.get(userId);
      if (existingSess && Date.now() - existingSess.ts < 3e5) {
        return n.reply({ embeds: [warnE("Ngươi đang có bí cảnh mở rồi!\nDùng `-bi_canh xem` để xem lại, hoặc `-bi_canh chon <1-5>` để chọn.")] });
      }
      const lastChoice = BI_CANH_LUA_CHON[BI_CANH_LUA_CHON.length - 1];
      const dtBcChoice = (player.dao_tu && DAO_TU_BI_CANH_CHOICES[player.dao_tu])
        ? DAO_TU_BI_CANH_CHOICES[player.dao_tu] : null;
      const genericSlots = dtBcChoice ? 3 : 4;
      const choices = [...BI_CANH_LUA_CHON.slice(0, -1)]
        .sort(() => Math.random() - 0.5)
        .slice(0, genericSlots)
        .map((c, idx) => ({ ...c, id: dtBcChoice ? idx + 2 : idx + 1 }));
      if (dtBcChoice) choices.unshift({ ...dtBcChoice, id: 1 });
      choices.push({ ...lastChoice, id: choices.length + 1 });
      BI_CANH_SESSIONS.set(userId, { choices, ts: Date.now() });
      await db("UPDATE players SET bi_canh_cd=$1 WHERE user_id=$2", [Date.now(), userId]);
      const emb = new EmbedBuilder()
        .setTitle(`${CE("ft_bi_canh","🗺️")} Bí Cảnh Khai Mở!`)
        .setColor(10181046)
        .setDescription(
          `*Không gian rung chuyển...*\n\n${CE("tukv", "🍀")} Khí Vận: **${player.khi_van || 30}**${player.dao_tu && DAO_TU[player.dao_tu] ? ` · ${DAO_TU[player.dao_tu].emoji} **${DAO_TU[player.dao_tu].ten}** — lựa chọn số 1 là đặc thù của ngươi!` : ' · Chưa chọn Đạo Tu!'}\n\n**Chọn hành động:**\n━━━━━━━━━━━━━━━━━━━━`,
        );
      for (const ch of choices)
        emb.addFields({ name: `${ch.emoji} ${ch.id}. ${ch.ten}`, value: ch.mo_ta, inline: false });
      return emb.setFooter({ text: "Dùng -bi_canh chon <1-5> | Hết hạn sau 5 phút" }),
        n.reply({ embeds: [emb] });
    }

    if ("chon" === sub) {
      const sess = BI_CANH_SESSIONS.get(userId);
      if (!sess || Date.now() - sess.ts > 3e5) {
        BI_CANH_SESSIONS.delete(userId);
        return n.reply({ embeds: [errE("Không có bí cảnh nào đang mở!\nDùng `-bi_canh vao`.")] });
      }
      const pick = parseInt(t[1]);
      if (!pick || pick < 1 || pick > sess.choices.length)
        return n.reply({ embeds: [errE(`Chọn từ 1 đến ${sess.choices.length}!`)] });
      const chosen = sess.choices[pick - 1];
      BI_CANH_SESSIONS.delete(userId);
      const { kq: kq, resultStr: resultStr } = await xuLyBiCanhKetQua(player, userId, chosen),
        isGood = !["mat_hp", "mat_linh_thach", "nothing"].includes(kq.loai);
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE("ft_bi_canh","🗺️")} ${chosen.emoji} ${chosen.ten}`)
            .setColor(isGood ? 16766720 : 15158332)
            .setDescription(`*${chosen.mo_ta}*\n\n**Kết quả:**\n${resultStr}`)
            .setFooter({ text: "CD tiếp theo: 4h | Khí Vận ảnh hưởng phần thưởng" }),
        ],
      });
    }
    return n.reply({ embeds: [errE("`-bi_canh [vao | xem | chon <1-5>]`")] });
  });

