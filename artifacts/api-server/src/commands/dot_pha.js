'use strict';
const { EmbedBuilder } = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer } = require('../db/players');
const { CE } = require('../systems/emoji');
const { CANH_GIOI, NGHE, THIEN_KIEP_NGUONG, CG_EMOJI } = require('../data');
const { fmt, getCG, pBar, errE, warnE, okE, tinhCS, reg } = require('../utils');
const { awardDanhVong, DV_POINTS, getDanhVongBonus } = require('../utils/danh_vong');
const { calcDotPhaSuccess } = require('../game/cultivation_engine');
const { checkNgheDotPha } = require('./cultivation');

  reg("dot_pha", ["dp_break", "dotpha"], async (n) => {
    const t = n.author.id,
      e = await getPlayer(t);
    if (!e) return n.reply({ embeds: [errE("Dùng `-bat_dau` trước!")] });
    const h = CANH_GIOI[e.canh_gioi + 1],
      i = Number(e.exp);
    if (!h)
      return n.reply({
        embeds: [okE("🌌 Ngươi đã đạt đỉnh tu luyện — không còn cảnh giới nào cao hơn!")],
      });
    if (THIEN_KIEP_NGUONG.has(h.cap))
      return i < h.exp_can
        ? n.reply({
            embeds: [
              errE(
                `Tu Vi chưa đủ để đột phá!\nCần: **${fmt(h.exp_can)}** | Hiện có: **${fmt(i)}**`,
              ),
            ],
          })
        : n.reply({
            embeds: [
              new EmbedBuilder()
                .setColor(16737792)
                .setTitle("🌩 Thiên Kiếp Tầng " + h.cap + " Đang Chờ!")
                .setDescription(`${CE("tia_set","⚡")} Dùng **\`-vuot_kiep\`** để vượt qua!\n${CE('warn_icon','⚠️')} Cần Đạo Tâm ≥ 30 *(Ma Tu miễn)*`),
            ],
          });
    if (i < h.exp_can) {
      const t = Math.min(99, Math.floor((i / h.exp_can) * 100));
      return n.reply({
        embeds: [
          errE(
            `Tu Vi chưa đầy để đột phá!\nCần: **${fmt(h.exp_can)}** | Hiện có: **${fmt(i)}** (${t}%)\n\nTiếp tục dùng \`-tu_luyen\` để tích lũy tu vi.`,
          ),
        ],
      });
    }
    const a = e.cam_ngo || 0;
    if (a < 60)
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(15965202)
            .setDescription(`${CE('tip_icon','💡')} Cảm Ngộ: ${pBar(a)} **${a}%** — cần **60%** để đột phá!\n*Tăng mỗi lần \`-tu_luyen\`, nhanh hơn khi Ngộ Tính cao.*`),
        ],
      });
    if (e.binh_canh)
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(9109504)
            .setDescription(
              e.nghe === 'ngo_dao_su'
                ? "🧱 **Tâm cảnh bị phong bế** — đột phá thất bại!\n*Dùng `-pha_binh_canh` để khai thông bình cảnh trước.*"
                : "🧱 **Tâm cảnh bị phong bế** — đột phá thất bại!\n*Dùng `-co_duyen` hoặc `-bi_canh` để khai thông.*"
            ),
        ],
      });
    if (e.la_ma_tu ? e.tam_ma < -40 : e.tam_ma < 20) {
      const t = e.la_ma_tu
        ? `*Ma Tu lún quá sâu vào Ma Đạo — tâm thần hỗn loạn, không thể đột phá!*\n\nMa Tâm: **${e.tam_ma}** | Cần: **≥ -40**\n${CE("tip_icon","💡")} Dùng \`-dao_tam tinh_hoa\` để giảm Ma Khí.`
        : `Đạo Tâm không đủ để đột phá!\nĐạo Tâm: **${e.tam_ma}** | Cần: **≥ 20**\nDùng \`-dao_tam tinh_hoa\` để tịnh hóa.`;
      return n.reply({ embeds: [errE(t)] });
    }
    const linh_thach_can = h.cap >= 10
      ? Math.max(1600, h.cap * 400)   // Trúc Cơ → Tiên Nhân: giảm 1/2
      : Math.max(1600, h.cap * 800);  // Luyện Khí: giữ nguyên
    // Linh Thạch Trung/Cao cho cảnh giới cao (flat cost)
    const trung_can = h.cap >= 15 && h.cap < 25 ? 1 : 0;
    const cao_can   = h.cap >= 25 ? 1 : 0;
    if (Number(e.linh_thach) < linh_thach_can)
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(3447003)
            .setDescription(`${CE("tult","💠")} Cần **${fmt(linh_thach_can)}** Linh Thạch để đột phá — hiện có **${fmt(Number(e.linh_thach))}**`),
        ],
      });
    if (trung_can > 0 && Number(e.linh_thach_trung || 0) < trung_can)
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(9699539)
            .setDescription(`${CE("tult_trung","🔮")} Cảnh giới **${h.ten}** cần **${trung_can} Linh Thạch Trung** để đột phá!\nHiện có: **${fmt(Number(e.linh_thach_trung||0))}**\n\n*Quy đổi bằng \`-tb\` → tab 💠 Linh Thạch (5.000 Thường = 1 Trung)*`),
        ],
      });
    if (cao_can > 0 && Number(e.linh_thach_cao || 0) < cao_can)
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(5025616)
            .setDescription(`${CE("tult_cao","💚")} Cảnh giới **${h.ten}** cần **${cao_can} Linh Thạch Cao** để đột phá!\nHiện có: **${fmt(Number(e.linh_thach_cao||0))}**\n\n*Quy đổi bằng \`-tb\` → tab 💠 Linh Thạch (10 Trung = 1 Cao)*`),
        ],
      });
    const o = checkNgheDotPha(e);
    if (!o.ok) {
      const ngheTen = e.nghe ? NGHE[e.nghe] : null,
        ngheTieuDe = ngheTen
          ? `${ngheTen.emoji} Điều Kiện Nghề Chưa Đủ — ${ngheTen.ten}!`
          : "🚫 Chưa Chọn Nghề — Không Thể Đột Phá!",
        ngheHuong = ngheTen
          ? "Hoàn thành điều kiện nghề rồi dùng -dot_pha lại!"
          : "Chọn nghề bằng -chon_nghe rồi dùng -dot_pha lại!";
      return n.reply({
        embeds: [
          new EmbedBuilder()
            .setColor(15105570)
            .setDescription(`${CE('warn_icon','⚠️')} **${ngheTieuDe}**\n${o.msg}\n\n*${ngheHuong}*`),
        ],
      });
    }
    // Trừ Linh Thạch Thường (atomic guard)
    const deductRes = await db(
      "UPDATE players SET linh_thach=linh_thach-$1 WHERE user_id=$2 AND linh_thach>=$1 RETURNING linh_thach",
      [linh_thach_can, t],
    );
    if (!deductRes.rows.length)
      return n.reply({ embeds: [errE(`Linh Thạch đã thay đổi — không đủ ${fmt(linh_thach_can)} ${CE('tult','💠')} để đột phá!`)] });
    // Trừ Linh Thạch Trung/Cao (atomic — guard chống race condition)
    if (trung_can > 0) {
      const r2 = await db(
        "UPDATE players SET linh_thach_trung=linh_thach_trung-$1 WHERE user_id=$2 AND linh_thach_trung>=$1 RETURNING linh_thach_trung",
        [trung_can, t],
      );
      if (!r2.rows.length) {
        await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [linh_thach_can, t]); // hoàn lại LT thường
        return n.reply({ embeds: [errE(`Linh Thạch Trung đã thay đổi — không đủ ${trung_can} ${CE("tult_trung","🔮")} để đột phá!`)] });
      }
    }
    if (cao_can > 0) {
      const r3 = await db(
        "UPDATE players SET linh_thach_cao=linh_thach_cao-$1 WHERE user_id=$2 AND linh_thach_cao>=$1 RETURNING linh_thach_cao",
        [cao_can, t],
      );
      if (!r3.rows.length) {
        await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [linh_thach_can, t]);
        if (trung_can > 0) await db("UPDATE players SET linh_thach_trung=linh_thach_trung+$1 WHERE user_id=$2", [trung_can, t]);
        return n.reply({ embeds: [errE(`Linh Thạch Cao đã thay đổi — không đủ ${cao_can} ${CE("tult_cao","💚")} để đột phá!`)] });
      }
    }
    // ── Bảo vệ LT: nếu DB lỗi sau khi đã trừ tiền, hoàn lại toàn bộ ─────────
    try {
    if (o.consume_vat_pham) {
      const vp = { ...(e.vat_pham || {}) };
      for (const [k, amt] of Object.entries(o.consume_vat_pham))
        vp[k] = Math.max(0, Number(vp[k] || 0) - amt);
      await db("UPDATE players SET vat_pham=$1 WHERE user_id=$2", [JSON.stringify(vp), t]);
    }
    const dvBonus  = getDanhVongBonus(e.danh_vong);
    const baseRate = o.fixed_rate !== undefined ? o.fixed_rate : calcDotPhaSuccess(e, o);
    const r        = Math.max(0.01, Math.min(0.99, baseRate + dvBonus.dot_pha));
    if (Math.random() < r) {
      const h = e.canh_gioi + 1,
        i = CANH_GIOI[h],
        a = tinhCS({ ...e, canh_gioi: h }),
        c = a.hp_max,
        _ = Math.min(c, Math.max(1, Number(e.hp)));
      return (
        await db(
          "UPDATE players SET canh_gioi=$1, hp_max=$2, hp=$3, cam_ngo=0, exp=0, binh_canh=FALSE WHERE user_id=$4",
          [h, c, _, t],
        ),
        awardDanhVong(t, DV_POINTS.DOT_PHA),
        n.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(`${CE("tucn","🌟")} ĐỘT PHÁ CẢNH GIỚI THÀNH CÔNG!`)
              .setColor(16766720)
              .setThumbnail(n.author.displayAvatarURL())
              .setDescription(
                `${CG_EMOJI(e.canh_gioi)} ~~**${getCG(e.canh_gioi).ten}**~~ → ${CG_EMOJI(h)} **${i.ten}** ✨\n` +
                (trung_can > 0 ? `*${CE("tult_trung","🔮")} −${trung_can} Linh Thạch Trung đã tiêu thụ*\n` : "") +
                (cao_can   > 0 ? `*${CE("tult_cao","💚")} −${cao_can} Linh Thạch Cao đã tiêu thụ*\n` : ""),
              )
              .addFields(
                {
                  name: `${CE("tuatk", "⚔️")} Công Lực Mới`,
                  value: `**${fmt(a.atk)}**`,
                  inline: !0,
                },
                {
                  name: `${CE("tudef", "🛡️")} Thủ Lực Mới`,
                  value: `**${fmt(a.def)}**`,
                  inline: !0,
                },
                {
                  name: `${CE("tuhp", "💜")} HP Tối Đa`,
                  value: `**${fmt(a.hp_max)}**`,
                  inline: !0,
                },
              )
              .setFooter({
                text: `Xác suất thành công: ${Math.round(100 * r)}% · Cảm Ngộ reset — tiếp tục tu luyện để đột phá kế tiếp!${o.bonus > 0 ? ` · Bonus nghề: +${Math.round(100 * o.bonus)}%` : ""}`,
              }),
          ],
        })
      );
    }
    {
      const binhCanhRate = 0.22,
        coBC = Math.random() < binhCanhRate,
        camNgoMat = Math.floor(0.20 * a),
        camNgoConLai = Math.max(0, a - camNgoMat);
      return (
        coBC
          ? await db("UPDATE players SET binh_canh=TRUE, cam_ngo=$1 WHERE user_id=$2", [camNgoConLai, t])
          : await db("UPDATE players SET cam_ngo=$1 WHERE user_id=$2", [camNgoConLai, t]),
        awardDanhVong(t, -3), // đột phá thất bại: -3 DV
        n.reply({
          embeds: [
            new EmbedBuilder()
              .setTitle(coBC ? "🧱 ĐỘT PHÁ THẤT BẠI — KINH MẠCH TẮC NGHẼN!" : "💔 Đột Phá Thất Bại!")
              .setColor(coBC ? 9109504 : 15158332)
              .setThumbnail(n.author.displayAvatarURL())
              .setDescription(
                (coBC
                  ? `🧱 **Bình Cảnh hình thành!** Đường đột phá bị phong bế.\n${CE("tip_icon","💡")} Cảm Ngộ -${camNgoMat}% → còn **${camNgoConLai}%**\n*Tìm \`-co_duyen\` hoặc \`-bi_canh\` để khai thông.*`
                  : `💔 Tâm linh chưa đủ vững — thất bại!\n${CE("tip_icon","💡")} Cảm Ngộ -${camNgoMat}% → còn **${camNgoConLai}%**\n*Tiếp tục tu luyện tích lũy Cảm Ngộ.*`) +
                (trung_can > 0 ? `\n${CE("tult_trung","🔮")} −${trung_can} Linh Thạch Trung đã tiêu thụ trong lần thử.` : "") +
                (cao_can   > 0 ? `\n${CE("tult_cao","💚")} −${cao_can} Linh Thạch Cao đã tiêu thụ trong lần thử.` : ""),
              )
              .setFooter({ text: `Xác suất thành công: ${Math.round(100 * r)}%` }),
          ],
        })
      );
    }
    } catch (dbErr) {
      // DB lỗi sau khi đã trừ LT → hoàn lại toàn bộ để tránh mất tiền oan
      console.error('[dot_pha] DB error after LT deduction — restoring:', dbErr.message);
      await db("UPDATE players SET linh_thach=linh_thach+$1 WHERE user_id=$2", [linh_thach_can, t]).catch(() => {});
      if (trung_can > 0) await db("UPDATE players SET linh_thach_trung=linh_thach_trung+$1 WHERE user_id=$2", [trung_can, t]).catch(() => {});
      if (cao_can   > 0) await db("UPDATE players SET linh_thach_cao=linh_thach_cao+$1 WHERE user_id=$2", [cao_can, t]).catch(() => {});
      return n.reply({ embeds: [errE('Lỗi hệ thống — Linh Thạch đã được hoàn trả. Thử lại sau!')] }).catch(() => {});
    }
  });
