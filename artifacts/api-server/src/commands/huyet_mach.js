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
  CONG_PHAP, BI_PHAP, NGHE, VU_KHI, BAO_BOI, LINH_THAO,
  NGOC_GIAN_DATA, DAN_DUOC, DAN_PHAM, REN_LUYEN_CAP, calcDanTyLe, PHU_LUC_DATA,
  THIEN_KIEP_KQ, THIEN_KIEP_NGUONG, getThienKiepLoai,
  PHONG_THUY_VAN, DONG_PHU, TRUYEN_THUA_LIST,
  TONG_MON_CAP_BAC, TONG_MON, CO_DUYEN_EVENTS,
  BI_CANH_SESSIONS, BI_CANH_CD_H, BI_CANH_LUA_CHON,
  NHIEM_VU_LIST,
  CP_GIA, BP_GIA,
  CG_EMOJI, getNgoTinh, getKhiVanBonus, getNhanQua, getTT,
} = require('../data');
const {
  getDailyMissionState,
  BAG_WEIGHTS, getDanKg, getBagCapacity, calcBagWeight, canAddToBag,
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
const { checkNgheDotPha } = require('./cultivation');
const ADMIN_ID = process.env.ADMIN_ID || '';

const NOI_TAI_AN_INFO = {
  tu_la: {
    ten: 'Bạo Sát Chi Bản',
    hieu_ung: '⚔️ Bạo kích **+15%** vĩnh viễn',
    dieu_kien: '30 trận PvP thắng',
    get emoji() { return CE('hm_tu_la','🔥'); },
    ce: 'hm_tu_la',
  },
  co_than: {
    ten: 'Cổ Thần Bất Diệt',
    hieu_ung: '🛡️ Miễn khắc chế ngũ hành + DEF **+20%** vĩnh viễn · Miễn bạo kích',
    dieu_kien: 'Vượt Thiên Kiếp Nguyên Anh (cảnh giới 18)',
    get emoji() { return CE('hm_co_than','✨'); },
    ce: 'hm_co_than',
  },
  thien_long: {
    ten: 'Thiên Long Uy Linh',
    hieu_ung: '👑 ATK **+45%**, DEF **+40%**, EXP **+25%** · Miễn mọi khắc chế ngũ hành · Bạo kích **+20%** · Hồi **10% HP**/lượt',
    dieu_kien: 'Chinh phục tầng 30 Tháp Thí Luyện (tầng cuối)',
    get emoji() { return CE('hm_thien_long','🐲'); },
    ce: 'hm_thien_long',
  },
  hon_don_the: {
    ten: 'Hỗn Độn Khai Thiên',
    hieu_ung: '🌌 ATK **+60%**, DEF **+50%**, EXP **+30%** · Miễn mọi khắc chế · Không thể bị crit · Bạo kích **+30%** · Hồi **15% HP**/lượt',
    dieu_kien: 'Thắng 100 trận PvP',
    get emoji() { return CE('hm_hon_don','🌀'); },
    ce: 'hm_hon_don',
  },
};




  reg("huyet_mach", ["huyet", "huyet_toc", "huyetmach"], async (msg, args) => {
    const e = msg.author.id,
      h = (args[0] || "xem").toLowerCase(),
      i = await getPlayer(e);
    if (!i) return msg.reply({ embeds: [errE("Dùng `-bat_dau`!")] });
    if ("xem" === h) {
      const t = LINH_CAN[i.linh_can],
        e = HUYET_MACH[i.huyet_mach];
      const ntaInfo = NOI_TAI_AN_INFO[i.huyet_mach];
      const ntaField = ntaInfo ? {
        name: i.noi_tai_an_unlocked
          ? `${ntaInfo.emoji} Nội Tại Ẩn — Đã Khai Mở`
          : `${CE('lock_icon','🔒')} Nội Tại Ẩn — Chưa Khai Mở`,
        value: i.noi_tai_an_unlocked
          ? `✅ **${ntaInfo.ten}**\n${ntaInfo.hieu_ung}`
          : `*Huyết mạch của ngươi ẩn chứa bí tịch chưa được đánh thức.*\n🔓 Điều kiện: **${ntaInfo.dieu_kien}**\n*Dùng \`-kham_pha_noi_tai\` để xem chi tiết*`,
        inline: false,
      } : null;
      const fields = [
        {
          name: `${t.emoji} Linh Căn: ${t.ten}`,
          value: `${CE("tuatk", "⚔️")} +${Math.round(100 * t.bonus_atk)}%  ${CE("tudef", "🛡️")} +${Math.round(100 * t.bonus_def)}%  ${CE("tutv", "📈")} +${Math.round(100 * t.bonus_exp)}%\n*${LINH_CAN_MO_TA[i.linh_can]}*\n${CE('warn_icon','⚠️')} Thiên mệnh — **vĩnh viễn không thay đổi**`,
          inline: false,
        },
        {
          name: `${CE(e.ce_name, e.emoji)} Huyết Mạch: ${e.ten}`,
          value: `${CE("nt_tien","✨")} Nhân toàn bộ chỉ số: **×${e.multiplier}** | Tỉ lệ: ${e.rate}%${ntaInfo && !i.noi_tai_an_unlocked ? '' : `\n*${e.mo_ta}*`}`,
          inline: false,
        },
        ...(ntaField ? [ntaField] : []),
        {
          name: "📊 Tất Cả Cấp Độ",
          value: Object.entries(HUYET_MACH)
            .filter(([, n]) => n.rate > 0)
            .map(([, n]) => `${CE(n.ce_name, n.emoji)} **${n.ten}**: ×${n.multiplier} *(${n.rate}%)*`)
            .join("\n"),
          inline: false,
        },
        {
          name: `${CE("tt_hon_don","🌀")} Chuyển Hóa`,
          value: "`-huyet_mach chuyen_hoa` — **30%** thành công | " + CE("tult", "💠") + " **50,000**",
          inline: false,
        },
        {
          name: `${CE("ve_huyet_mach","🩸")} Vé Đổi Huyết Mạch`,
          value: `\`-huyet_mach doi\` — Random huyết mạch mới theo tỉ lệ thiên mệnh ${CE("ve_huyet_mach","🩸")}` +
            (Number(i.ve_doi_huyet || 0) > 0 ? ` · Có **${i.ve_doi_huyet} vé**` : " · Mua tại `-donate`") +
            `\n${CE('tult','💠')} Đổi vé dư lấy **250 Linh Thạch/vé** → dùng \`-tb\` tab Linh Thạch`,
          inline: false,
        },
        {
          name: `${CE("tukv","💎")} Vé Huyết Mạch VIP`,
          value: `\`-huyet_mach doi_vip\` — Thăng cấp huyết mạch **+1 bậc** đảm bảo! (Max: ${CE("hm_tien", "🐉")} Thanh Long)` +
            (Number(i.ve_doi_huyet_vip || 0) > 0 ? ` · Có **${i.ve_doi_huyet_vip} vé VIP**` : " · Mua tại `-donate`"),
          inline: false,
        },
        {
          name: `${CE("vk_linh_thuong","🔱")} Vé Nâng Cấp Huyết Mạch`,
          value: `\`-huyet_mach nang_cap\` — Nâng lên **Tu La Sát Thần** hoặc **Cổ Thần Hóa Thân** ngẫu nhiên (50/50) ${CE('tunt','🎯')}` +
            (Number(i.ve_nang_cap_huyet || 0) > 0 ? ` · Có **${i.ve_nang_cap_huyet} vé**` : " · Kiếm qua sự kiện"),
          inline: false,
        },
      ];
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("🧬 Huyết Mạch & Linh Căn")
            .setColor(15158332)
            .addFields(fields),
        ],
      });
    }
    if ("chuyen_hoa" === h) {
      if ("hon_don_the" === i.huyet_mach)
        return msg.reply({
          embeds: [
            okE(
              `${CE("tt_hon_don","🌀")} Ngươi đang sở hữu **Hỗn Độn Chi Thể** — huyết mạch tuyệt đỉnh vũ trụ! Không thể chuyển hóa thêm.`,
            ),
          ],
        });
      if ("tien" === i.huyet_mach)
        return msg.reply({
          embeds: [
            okE(
              "🐉 Đã đạt **Thanh Long Huyết** — huyết mạch tối cao! 🌀 Hỗn Độn Chi Thể chỉ có qua `-donate`.",
            ),
          ],
        });
      if (Number(i.linh_thach) < 5e4)
        return msg.reply({
          embeds: [
            errE(
              `Cần **50,000 ${CE("tult", "💠")}** để thử chuyển hóa!\nHiện có: **${fmt(i.linh_thach)} ${CE("tult", "💠")}**`,
            ),
          ],
        });
      await db("UPDATE players SET linh_thach=GREATEST(0,linh_thach-50000) WHERE user_id=$1", [e]);
      const t = ["pham", "linh", "than", "thanh", "tien"],
        h = t.indexOf(i.huyet_mach);
      if (Math.random() < 0.3) {
        const a = t[h + 1],
          o = HUYET_MACH[a];
        return (
          await db("UPDATE players SET huyet_mach=$1, noi_tai_an_unlocked=false WHERE user_id=$2", [a, e]),
          msg.reply({
            embeds: [
              new EmbedBuilder()
                .setTitle(`${CE("tucn","🌟")} Chuyển Hóa Thành Công!`)
                .setColor(16766720)
                .setDescription(
                  `${CE(HUYET_MACH[i.huyet_mach].ce_name, HUYET_MACH[i.huyet_mach].emoji)} **${HUYET_MACH[i.huyet_mach].ten}** ➜ ${CE(o.ce_name, o.emoji)} **${o.ten}**\n${CE("nt_tien","✨")} ×${o.multiplier}\n\n-50,000 ${CE("tult", "💠")}`,
                ),
            ],
          })
        );
      }
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle("💔 Chuyển Hóa Thất Bại!")
            .setColor(15158332)
            .setDescription(
              "*Thiên cơ không thuận...*\n\nMất **50,000 " +
                CE("tult", "💠") +
                "**.\n*Hãy thử lại khi có duyên phận!*",
            ),
        ],
      });
    }
    if ("doi" === h) {
      if (Number(i.ve_doi_huyet || 0) < 1)
        return msg.reply({
          embeds: [
            errE(
              `Không có **Vé Đổi Huyết Mạch** ${CE("ve_huyet_mach","🩸")}!\nMua tại \`-donate\` → **Đặc Biệt** → Vé Đổi Huyết Mạch (59k VND).`,
            ),
          ],
        });
      if ("hon_don_the" === i.huyet_mach)
        return msg.reply({
          embeds: [
            okE(
              `${CE("tt_hon_don","🌀")} Ngươi đang sở hữu **Hỗn Độn Chi Thể** — huyết mạch tuyệt đỉnh vũ trụ!\n\n${CE('warn_icon','⚠️')} Không thể dùng Vé Đổi Huyết Mạch để thay đổi — sẽ làm mất Hỗn Độn Chi Thể!`,
            ),
          ],
        });
      const t = ["pham", "linh", "than", "thanh", "tien", "tu_la", "co_than"],
        h = t.map((n) => HUYET_MACH[n].rate),
        a = h.reduce((n, t) => n + t, 0);
      let o = Math.random() * a,
        c = t[t.length - 1];
      for (let n = 0; n < t.length; n++)
        if (((o -= h[n]), o <= 0)) {
          c = t[n];
          break;
        }
      const _ = HUYET_MACH[c];
      await db(
        "UPDATE players SET huyet_mach=$1, ve_doi_huyet=GREATEST(0,ve_doi_huyet-1), noi_tai_an_unlocked=false WHERE user_id=$2",
        [c, e],
      );
      const u = c === i.huyet_mach,
        r = HUYET_MACH[i.huyet_mach];
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE("ve_huyet_mach","🩸")} Vé Đổi Huyết Mạch — Kết Quả!`)
            .setColor(u ? 11184810 : 16766720)
            .setDescription(
              "*Thiên cơ vận chuyển, huyết mạch được định đoạt...*\n\n" +
                (u
                  ? `${CE(_.ce_name, _.emoji)} **${_.ten}** — Huyết mạch **không đổi** (thiên mệnh đã định!)\n${CE("nt_tien","✨")} Nhân chỉ số: **×${_.multiplier}**`
                  : `${CE(r.ce_name, r.emoji)} **${r.ten}** ➜ ${CE(_.ce_name, _.emoji)} **${_.ten}**\n${CE("nt_tien","✨")} Nhân chỉ số: **×${_.multiplier}**`) +
                `\n\n${CE("ve_huyet_mach","🩸")} Tiêu **1 Vé Đổi Huyết Mạch** *(random theo tỉ lệ thiên mệnh)*\n` +
                `*Còn lại: **${Math.max(0, Number(i.ve_doi_huyet || 0) - 1)} vé***`,
            )
            .setFooter({
              text: `Tỉ lệ: Phàm ${HUYET_MACH.pham.rate}% · Bạch Hổ ${HUYET_MACH.linh.rate}% · Chu Tước ${HUYET_MACH.than.rate}% · Huyền Vũ ${HUYET_MACH.thanh.rate}% · Thanh Long ${HUYET_MACH.tien.rate}% · Tu La ${HUYET_MACH.tu_la.rate}% · Cổ Thần ${HUYET_MACH.co_than.rate}%`,
            }),
        ],
      });
    }
    if ("doi_vip" === h) {
      if (Number(i.ve_doi_huyet_vip || 0) < 1)
        return msg.reply({
          embeds: [
            errE(
              `Không có **Vé Huyết Mạch VIP** ${CE("tukv","💎")}!\nMua tại \`-donate\` → **Đặc Biệt** → Vé Huyết Mạch VIP (149k VND).`,
            ),
          ],
        });
      const t = ["pham", "linh", "than", "thanh", "tien"];
      if (i.huyet_mach === "tu_la" || i.huyet_mach === "co_than")
        return msg.reply({
          embeds: [
            okE(
              `${CE(HUYET_MACH[i.huyet_mach].ce_name, HUYET_MACH[i.huyet_mach].emoji)} Ngươi đang sở hữu **${HUYET_MACH[i.huyet_mach].ten}** — huyết mạch huyền bí tối thượng!\n\n${CE("tt_hon_don","🌀")} **Hỗn Độn Chi Thể** chỉ có thể đạt được qua \`-donate\` trực tiếp.`,
            ),
          ],
        });
      if ("tien" === i.huyet_mach)
        return msg.reply({
          embeds: [
            okE(
              "🐉 Đã đạt **Thanh Long Huyết** — huyết mạch tối cao dành cho người thường!\n\n🌀 **Hỗn Độn Chi Thể** chỉ có thể đạt được qua `-donate` trực tiếp.",
            ),
          ],
        });
      if (!t.includes(i.huyet_mach))
        return msg.reply({
          embeds: [
            okE(
              `${CE("tt_hon_don","🌀")} Ngươi đang sở hữu **Hỗn Độn Chi Thể** — huyết mạch tuyệt đỉnh! Không thể thăng cấp hơn nữa.`,
            ),
          ],
        });
      const h = t.indexOf(i.huyet_mach),
        a = t[h + 1];
      if (!a) return msg.reply({ embeds: [okE("🐉 Huyết mạch đã ở cấp tối đa!")] });
      const o = HUYET_MACH[a],
        c = HUYET_MACH[i.huyet_mach];
      return (
        await db(
          "UPDATE players SET huyet_mach=$1, ve_doi_huyet_vip=GREATEST(0,ve_doi_huyet_vip-1), noi_tai_an_unlocked=false WHERE user_id=$2",
          [a, e],
        ),
        msg.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${CE("tukv","💎")} Vé Huyết Mạch VIP — Thành Công!`)
              .setColor(11141375)
              .setDescription(
                `*Thiên địa chấn động, huyết mạch cổ xưa thức tỉnh...*\n\n${CE(c.ce_name, c.emoji)} **${c.ten}** ➜ ${CE(o.ce_name, o.emoji)} **${o.ten}**\n${CE("nt_tien","✨")} Nhân chỉ số: **×${o.multiplier}**\n\n${CE("tukv","💎")} Tiêu **1 Vé Huyết Mạch VIP** *(thăng cấp đảm bảo 100%)*\n*Còn lại: **${Math.max(0, Number(i.ve_doi_huyet_vip || 0) - 1)} vé VIP***`,
              )
              .setFooter({
                text:
                  "tien" === a
                    ? "Đã đạt Thanh Long — huyết mạch tối cao! 🌀 Hỗn Độn Chi Thể chỉ có qua -donate"
                    : "Huyết Mạch thăng cấp — Sức mạnh vô biên!",
              }),
          ],
        })
      );
    }
    if ("nang_cap" === h) {
      if (Number(i.ve_nang_cap_huyet || 0) < 1)
        return msg.reply({
          embeds: [errE(`Không có **Vé Nâng Cấp Huyết Mạch** ${CE("vk_linh_thuong","🔱")}!\nKiếm qua sự kiện hoặc từ admin.`)],
        });
      if (i.huyet_mach === "thien_long" || i.huyet_mach === "hon_don_the")
        return msg.reply({
          embeds: [okE(`${CE(HUYET_MACH[i.huyet_mach].ce_name, HUYET_MACH[i.huyet_mach].emoji)} Ngươi đang sở hữu **${HUYET_MACH[i.huyet_mach].ten}** — đã vượt qua Tu La / Cổ Thần rồi! Không thể dùng vé này.`)],
        });
      const nangCapResult = Math.random() < 0.5 ? "tu_la" : "co_than";
      const nangCapHM = HUYET_MACH[nangCapResult];
      const nangCapOld = HUYET_MACH[i.huyet_mach];
      const nangCapSame = nangCapResult === i.huyet_mach;
      await db(
        "UPDATE players SET huyet_mach=$1, ve_nang_cap_huyet=GREATEST(0,ve_nang_cap_huyet-1), noi_tai_an_unlocked=false WHERE user_id=$2",
        [nangCapResult, e],
      );
      return msg.reply({
        embeds: [
          new EmbedBuilder()
            .setTitle(`${CE("vk_linh_thuong","🔱")} Vé Nâng Cấp Huyết Mạch — Kết Quả!`)
            .setColor(nangCapSame ? 11184810 : 10181046)
            .setDescription(
              "*Cổ huyết tổ tiên thức tỉnh, huyết mạch dị biến...*\n\n" +
                (nangCapSame
                  ? `${CE(nangCapHM.ce_name, nangCapHM.emoji)} **${nangCapHM.ten}** — Huyết mạch **không đổi** (thiên mệnh đã chọn!)\n${CE("nt_tien","✨")} Nhân chỉ số: **×${nangCapHM.multiplier}**`
                  : `${CE(nangCapOld.ce_name, nangCapOld.emoji)} **${nangCapOld.ten}** ➜ ${CE(nangCapHM.ce_name, nangCapHM.emoji)} **${nangCapHM.ten}**\n${CE("nt_tien","✨")} Nhân chỉ số: **×${nangCapHM.multiplier}**`) +
                `\n\n${CE("vk_linh_thuong","🔱")} Tiêu **1 Vé Nâng Cấp Huyết Mạch** *(50% Tu La Sát Thần · 50% Cổ Thần Hóa Thân)*\n` +
                `*Còn lại: **${Math.max(0, Number(i.ve_nang_cap_huyet || 0) - 1)} vé***`,
            )
            .setFooter({
              text: "Tu La Sát Thần ×3.8 | ATK +55%, Bạo Kích +25% ⚔️  ·  Cổ Thần Hóa Thân ×3.4 | DEF +30%, Hồi 8% HP/lượt 🛡️",
            }),
        ],
      });
    }
    return msg.reply({ embeds: [errE("`-huyet_mach [xem | chuyen_hoa | doi | doi_vip | nang_cap]`")] });
  });

