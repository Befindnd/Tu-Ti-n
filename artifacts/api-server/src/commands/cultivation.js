'use strict';
const { CE } = require('../systems/emoji');

/**
 * commands/cultivation.js
 * Shared cultivation helpers used by multiple command modules.
 * Exported so dot_pha.js and pvp.js can both import.
 */

/**
 * Check profession-specific conditions for breakthrough (đột phá).
 * @param {object} player  Full player row
 * @returns {{ ok: boolean, bonus?: number, msg?: string }}
 */
function checkNgheDotPha(player) {
  if (!player.nghe)
    return {
      ok: false,
      msg: `*Đột phá cảnh giới đòi hỏi phải có một con đường tu hành rõ ràng — ngươi chưa chọn **Nghề** cho mình!*\n\n${CE('tunt','🎯')} Mỗi nghề mang lại điều kiện và phần thưởng đột phá riêng.\n\n${CE("tip_icon","💡")} Dùng **\`-chon_nghe\`** để chọn nghề trước khi đột phá.`,
    };
  const danDuoc = player.dan_duoc || {};
  const phuLuc  = player.phu_luc  || {};
  switch (player.nghe) {
    case "luyen_dan":
      if (Object.values(danDuoc).reduce((acc, v) => acc + Number(v || 0), 0) < 1)
        return {
          ok: false,
          msg: `*Luyện Đan Sư cần có ít nhất **1 đan dược** trong kho để hỗ trợ đột phá — đan dược giúp ổn định pháp lực khi phá vỡ vách ngăn!*\n\n${CE("tip_icon","💡")} Dùng \`-luyen_dan lam <id>\` để luyện đan trước.`,
        };
      return {
        ok: true,
        bonus: Object.entries(danDuoc).some(([id, qty]) => id.includes("_cuc") && Number(qty) > 0)
          ? 0.08
          : 0.03,
      };
    case "luyen_khi":
      return (player.vu_khi_cap || 0) < 1
        ? {
            ok: false,
            msg: `*Phi Khí Sư cần tôi luyện phi khí ít nhất **Cấp +1** trước khi đột phá — phi khí là nguồn sức mạnh cốt lõi, thiếu tôi luyện thì không thể bùng phát!*\n\n${CE("tip_icon","💡")} Dùng \`-ren_luyen nang_cap\` để tôi luyện phi khí.`,
          }
        : { ok: true, bonus: Math.min(0.08, 0.01 * (player.vu_khi_cap || 0)) };
    case "phu_luc": {
      const count = Object.values(phuLuc).reduce((acc, v) => acc + Number(v || 0), 0);
      return count < 1
        ? {
            ok: false,
            msg: `*Phù Lục Sư cần có ít nhất **1 Phù Lục** trong kho để ổn định kinh mạch khi đột phá — phù lục dẫn hướng pháp lực, thiếu chúng tâm cảnh sẽ loạn!*\n\n${CE("tip_icon","💡")} Dùng \`-ve_phu tao <id>\` để vẽ phù lục.`,
          }
        : { ok: true, bonus: count >= 3 ? 0.05 : 0.02 };
    }
    case "an_sat":
      return (player.pvp_wins || 0) < 3
        ? {
            ok: false,
            msg: `*Ám Vệ cần tích lũy **3 chiến thắng PvP** trước khi đột phá — bước vào cảnh giới cao hơn trên con đường ám sát đòi hỏi kinh nghiệm thực chiến!*\n\n${CE("tuatk", "⚔️")} Thắng hiện tại: **${player.pvp_wins || 0}/3**\n${CE("tip_icon","💡")} Dùng \`-pvp @người\` hoặc \`-am_sat @người\` để tích lũy.`,
          }
        : { ok: true, bonus: Math.min(0.06, 0.02 * Math.floor((player.pvp_wins || 0) / 5)) };
    case "phong_thuy":
      return player.phong_thuy_cd && 0 !== Number(player.phong_thuy_cd)
        ? { ok: true, bonus: (player.khi_van || 30) >= 60 ? 0.05 : 0 }
        : {
            ok: false,
            msg: `*Phong Thủy Sư cần xem thiên cơ **ít nhất 1 lần** trước khi đột phá — thiên thời địa lợi phải được tính toán trước khi phá vỡ vách ngăn cảnh giới!*\n\n${CE("tip_icon","💡")} Dùng \`-phong_thuy boi\` để xem thiên cơ.`,
          };
    case "duoc_su": {
      if ((player.dao_thuong || 0) > 0)
        return { ok: false, msg: "*Dược Sư cần **thần thể lành mạnh** (không có Đạo Thương) trước khi đột phá!*\n\n💉 Dùng `-chua_thuong` để chữa lành." };
      return { ok: true, bonus: Number(player.hp) / Math.max(1, Number(player.hp_max)) >= 0.8 ? 0.05 : 0 };
    }
    case "ngo_dao_su": {
      const ngoTinh = Number(player.ngo_tinh || 50);
      if (ngoTinh < 30)
        return {
          ok: false,
          msg: `*Ngộ Đạo Sư cần Ngộ Tính ≥ **30** để khai phá cảnh giới — ngộ tính còn quá thấp, thiên đạo chưa hiển lộ!*\n\nNgộ Tính hiện tại: **${ngoTinh}** | Cần: **30**\n${CE("tip_icon","💡")} Dùng \`-linh_ngo\` để đọc sách tăng Ngộ Tính.`,
        };
      return { ok: true, bonus: Math.min(0.08, ((ngoTinh - 30) / 70) * 0.08) };
    }
    default:
      return { ok: true, bonus: 0 };
  }
}

module.exports = { checkNgheDotPha };
