'use strict';

const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
} = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer } = require('../db/players');
const { CE } = require('../systems/emoji');
const {
  DAI_CANH_GIOI, CANH_GIOI, getCG,
} = require('../data');
const {
  fmt, fmtLT, calcSpend, SEP, SEP2, SEP3, errE, warnE, okE,
  reg,
} = require('../utils');

const MIN_CANH_GIOI_TAO = 10; // Kim Đan Sơ Kỳ (Tầng 10)
const PHI_TAO_TONG_MON = 5000; // 5,000 Linh Thạch

reg("tong_mon", ["tm", "mon_phai", "tongmon"], async (msg, args) => {
  const userId = msg.author.id;
  const subCmd = (args[0] || "help").toLowerCase();

  // 1. Menu hướng dẫn
  if (subCmd === "help" || subCmd === "huong_dan") {
    const embed = new EmbedBuilder()
      .setTitle("🏯 HỆ THỐNG TÔNG MÔN & PK TÔNG MÔN CHIẾN")
      .setColor(15105570)
      .setDescription(
        `*Khai sơn lập phái, luyện trận phòng thủ, phát hịch tuyên chiến đoạt tài nguyên!*\n\n${SEP}\n` +
        `🔹 \`-tongmon tao <tên> [khẩu hiệu]\` : Khai sơn lập phái (Yêu cầu: Kim Đan Kỳ & 5,000 Linh Thạch)\n` +
        `🔹 \`-tongmon thongtin [tên]\` : Xem thông tin chi tiết Tông Môn & Hộ Sơn Trận Pháp\n` +
        `🔹 \`-tongmon gia_nhap <tên>\` : Gia nhập Tông Môn của đạo hữu khác\n` +
        `🔹 \`-tongmon donggop <số lượng>\` : Cống nạp Linh Thạch vào Ngân Khố Tông Môn\n` +
        `🔹 \`-tongmon nangcap\` : Nâng cấp Hộ Sơn Trận Pháp phòng ngự PK\n` +
        `⚔️ \`-tongmon tuyenchien <tên địch>\` : Phát động PK Huyết Chiến với Tông Môn khác\n` +
        `⚔️ \`-tongmon tapkich\` : Oanh tạc Hộ Sơn Trận Pháp địch, cướp 20% Ngân Khố & Điểm PK\n` +
        `🏆 \`-tongmon bxh\` : Bảng Xếp Hạng Điểm PK Thế Lực Tông Môn\n` +
        `🚪 \`-tongmon roi\` : Rời khỏi Tông Môn hiện tại\n${SEP}`
      )
      .setFooter({ text: "Tu Tiên Discord Bot • Tiền tố: -" });
    return msg.reply({ embeds: [embed] });
  }

  // 2. Lấy thông tin người chơi
  const p = await getPlayer(userId);
  if (!p) return msg.reply({ embeds: [errE("Đạo hữu chưa tạo nhân vật! Hãy gõ `-bat_dau` trước.")] });

  // 3. LỆNH: -tongmon bxh (Xem BXH Thế Lực)
  if (subCmd === "bxh" || subCmd === "top") {
    try {
      const res = await db("SELECT * FROM sects ORDER BY pk_points DESC, wars_won DESC LIMIT 10");
      if (!res.rows || res.rows.length === 0) {
        return msg.reply({ embeds: [warnE("Hiện chưa có Tông Môn nào trong thiên hạ!")] });
      }

      const list = res.rows.map((s, idx) => {
        const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `**#${idx + 1}**`;
        return `${medal} **${s.name}** (Cấp ${s.level})\n` +
               `👑 Tông Chủ: **${s.leader_name}** | 🛡️ Trận Pháp: Cấp ${s.formation_level}\n` +
               `⚔️ Điểm PK: **${fmt(s.pk_points)}** | Thắng: **${s.wars_won}** • Thua: **${s.wars_lost}**\n` +
               `💎 Ngân Khố: **${fmt(s.spirit_treasury)}** ${CE("tult", "💠")}\n`;
      }).join("\n");

      const embed = new EmbedBuilder()
        .setTitle("🏆 BẢNG XẾP HẠNG THẾ LỰC PK TÔNG MÔN")
        .setColor(16766720)
        .setDescription(`${SEP2}\n${list}\n${SEP}`)
        .setFooter({ text: "Tu Tiên Discord Bot" });
      return msg.reply({ embeds: [embed] });
    } catch (err) {
      console.error("Lỗi BXH Tông Môn:", err);
      return msg.reply({ embeds: [errE("Không thể tải Bảng Xếp Hạng lúc này!")] });
    }
  }

  // 4. LỆNH: -tongmon tao <tên> [khẩu hiệu]
  if (subCmd === "tao" || subCmd === "create" || subCmd === "lap") {
    const sectName = args[1]?.trim();
    const slogan = args.slice(2).join(" ") || "Nhất đạo thông thiên, vạn cổ trường tồn!";

    if (!sectName) {
      return msg.reply({ embeds: [errE("Cú pháp: `-tongmon tao <Tên Tông Môn> [Khẩu hiệu]`")] });
    }

    if (p.tong_mon) {
      return msg.reply({ embeds: [warnE(`Đạo hữu đang ở trong **${p.tong_mon}** rồi! Dùng \`-tongmon roi\` trước.`)] });
    }

    // Kiểm tra cảnh giới (Kim Đan Kỳ trở lên, canh_gioi >= 10)
    if (p.canh_gioi < MIN_CANH_GIOI_TAO) {
      const cgTen = getCG(p.canh_gioi)?.ten || `Tầng ${p.canh_gioi}`;
      return msg.reply({
        embeds: [errE(`Tu vi chưa đủ! Cần đạt cảnh giới **Kim Đan Kỳ** (Tầng ${MIN_CANH_GIOI_TAO}) trở lên mới có đủ tư cách Khai Tông Lập Phái!\nHiện tại: **${cgTen}**`)],
      });
    }

    // Kiểm tra và trừ 5,000 Linh Thạch
    const spend = calcSpend(p, PHI_TAO_TONG_MON);
    if (!spend) {
      return msg.reply({
        embeds: [errE(`Không đủ Linh Thạch! Cần **${fmt(PHI_TAO_TONG_MON)}** ${CE("tult", "💠")} để xây dựng sơn môn.\nHiện có: **${fmt(p.linh_thach)}** ${CE("tult", "💠")}`)],
      });
    }

    try {
      // Kiểm tra tên tông môn đã tồn tại chưa
      const check = await db("SELECT id FROM sects WHERE LOWER(name) = LOWER($1)", [sectName]);
      if (check.rows.length > 0) {
        return msg.reply({ embeds: [errE(`Tông Môn mang tên **${sectName}** đã tồn tại trong tu chân giới!`)] });
      }

      // Trừ linh thạch người chơi
      await db(
        "UPDATE players SET linh_thach=$1, linh_thach_trung=$2, linh_thach_cao=$3, tong_mon=$4, tong_mon_cap='tong_chu' WHERE user_id=$5",
        [spend.newThuong, spend.newTrung, spend.newCao, sectName, userId]
      );

      // Thêm tông môn mới
      await db(
        `INSERT INTO sects (name, leader_id, leader_name, level, spirit_treasury, formation_level, formation_durability, max_formation_durability, pk_points, slogan)
         VALUES ($1, $2, $3, 1, 1000, 1, 10000, 10000, 1000, $4)`,
        [sectName, userId, msg.author.username, slogan]
      );

      const embed = new EmbedBuilder()
        .setTitle(`🚩 KHAI TÔNG LẬP PHÁI THÀNH CÔNG: 【${sectName}】`)
        .setColor(15105570)
        .setDescription(
          `Thiên địa linh khí chấn động! Đạo hữu **${msg.author.username}** đã chính thức sáng lập Tông Môn, sẵn sàng tranh bá tu chân giới!\n\n${SEP}\n` +
          `👑 **Tông Chủ:** ${msg.author.username}\n` +
          `🛡️ **Hộ Sơn Trận Pháp:** Cấp 1 (10,000 / 10,000 HP)\n` +
          `💎 **Ngân Khố Khởi Đầu:** 1,000 ${CE("tult", "💠")}\n` +
          `⚔️ **Điểm PK Thế Lực:** 1,000 Điểm\n` +
          `📜 **Tông Quy:** *"${slogan}"*\n${SEP}\n` +
          `💡 Dùng \`-tongmon donggop\` để nạp quỹ, \`-tongmon nangcap\` để gia cố trận pháp!`
        );

      return msg.reply({ embeds: [embed] });
    } catch (err) {
      console.error("Lỗi tạo tông môn:", err);
      return msg.reply({ embeds: [errE("Đã có lỗi xảy ra khi khai tông lập phái. Vui lòng thử lại!")] });
    }
  }

  // 5. LỆNH: -tongmon thongtin [tên]
  if (subCmd === "thongtin" || subCmd === "info" || subCmd === "xem") {
    const searchName = args.slice(1).join(" ")?.trim() || p.tong_mon;
    if (!searchName) {
      return msg.reply({ embeds: [warnE("Đạo hữu chưa gia nhập Tông Môn nào!\nDùng `-tongmon tao <tên>` hoặc `-tongmon bxh` để xem.")] });
    }

    try {
      const res = await db("SELECT * FROM sects WHERE LOWER(name) = LOWER($1) OR name = $1 LIMIT 1", [searchName]);
      if (!res.rows || res.rows.length === 0) {
        return msg.reply({ embeds: [errE(`Không tìm thấy Tông Môn **${searchName}**!`)] });
      }

      const s = res.rows[0];
      const memberCount = await db("SELECT COUNT(*) FROM players WHERE tong_mon = $1", [s.name]);
      const totalMembers = parseInt(memberCount.rows[0]?.count || "1");

      const embed = new EmbedBuilder()
        .setTitle(`🏯 TÔNG MÔN: 【${s.name}】 (Cấp ${s.level})`)
        .setColor(15105570)
        .setDescription(
          `*"${s.slogan}"*\n\n${SEP}\n` +
          `👑 **Tông Chủ:** ${s.leader_name}\n` +
          `👥 **Môn Nhân:** ${totalMembers} / ${s.max_members} Đệ tử\n` +
          `💎 **Ngân Khố:** **${fmt(s.spirit_treasury)}** ${CE("tult", "💠")}\n` +
          `🛡️ **Hộ Sơn Trận Pháp:** Cấp **${s.formation_level}** (${fmt(s.formation_durability)} / ${fmt(s.max_formation_durability)} HP)\n` +
          `⚔️ **Điểm PK Thế Lực:** **${fmt(s.pk_points)}** (Thắng: ${s.wars_won} | Thua: ${s.wars_lost})\n${SEP}`
        );

      return msg.reply({ embeds: [embed] });
    } catch (err) {
      console.error("Lỗi xem tông môn:", err);
      return msg.reply({ embeds: [errE("Không thể xem thông tin Tông Môn lúc này.")] });
    }
  }

  // 6. LỆNH: -tongmon gia_nhap <tên>
  if (subCmd === "gia_nhap" || subCmd === "join") {
    const targetName = args.slice(1).join(" ")?.trim();
    if (!targetName) return msg.reply({ embeds: [errE("Cú pháp: `-tongmon gia_nhap <Tên Tông Môn>`")] });
    if (p.tong_mon) return msg.reply({ embeds: [warnE(`Đạo hữu đang ở trong **${p.tong_mon}**! Dùng \`-tongmon roi\` trước.`)] });

    try {
      const res = await db("SELECT * FROM sects WHERE LOWER(name) = LOWER($1) LIMIT 1", [targetName]);
      if (!res.rows || res.rows.length === 0) {
        return msg.reply({ embeds: [errE(`Tông Môn **${targetName}** không tồn tại!`)] });
      }

      const s = res.rows[0];
      await db("UPDATE players SET tong_mon=$1, tong_mon_cap='ngoai_mon' WHERE user_id=$2", [s.name, userId]);
      return msg.reply({
        embeds: [okE(`Chúc mừng đạo hữu đã gia nhập **${s.name}** với thân phận **Ngoại Môn Đệ Tử**!`)],
      });
    } catch (err) {
      return msg.reply({ embeds: [errE("Lỗi khi gia nhập Tông Môn.")] });
    }
  }

  // 7. LỆNH: -tongmon donggop <số lượng>
  if (subCmd === "donggop" || subCmd === "dong_gop" || subCmd === "donate") {
    if (!p.tong_mon) return msg.reply({ embeds: [warnE("Đạo hữu chưa gia nhập Tông Môn nào!")] });
    const amount = parseInt(args[1]);
    if (isNaN(amount) || amount <= 0) {
      return msg.reply({ embeds: [errE("Cú pháp: `-tongmon donggop <Số Linh Thạch>`")] });
    }

    const spend = calcSpend(p, amount);
    if (!spend) {
      return msg.reply({ embeds: [errE(`Không đủ Linh Thạch! Hiện có: **${fmt(p.linh_thach)}** ${CE("tult", "💠")}`)] });
    }

    try {
      await db(
        "UPDATE players SET linh_thach=$1, linh_thach_trung=$2, linh_thach_cao=$3 WHERE user_id=$4",
        [spend.newThuong, spend.newTrung, spend.newCao, userId]
      );
      await db("UPDATE sects SET spirit_treasury = spirit_treasury + $1 WHERE name = $2", [amount, p.tong_mon]);

      return msg.reply({
        embeds: [okE(`Đạo hữu đã cống hiến **${fmt(amount)}** ${CE("tult", "💠")} vào Ngân Khố **${p.tong_mon}**!`)],
      });
    } catch (err) {
      return msg.reply({ embeds: [errE("Lỗi khi đóng góp Linh Thạch.")] });
    }
  }

  // 8. LỆNH: -tongmon nangcap (Nâng cấp Trận Pháp)
  if (subCmd === "nangcap" || subCmd === "nang_cap") {
    if (!p.tong_mon) return msg.reply({ embeds: [warnE("Đạo hữu chưa gia nhập Tông Môn nào!")] });
    if (p.tong_mon_cap !== "tong_chu" && p.tong_mon_cap !== "pho_tong_chu") {
      return msg.reply({ embeds: [errE("Chỉ Tông Chủ hoặc Phó Tông Chủ mới có quyền nâng cấp Hộ Sơn Trận Pháp!")] });
    }

    try {
      const res = await db("SELECT * FROM sects WHERE name = $1 LIMIT 1", [p.tong_mon]);
      if (!res.rows || res.rows.length === 0) return msg.reply({ embeds: [errE("Không tìm thấy Tông Môn!")] });

      const s = res.rows[0];
      const cost = s.formation_level * 5000;
      if (BigInt(s.spirit_treasury) < BigInt(cost)) {
        return msg.reply({
          embeds: [errE(`Ngân Khố không đủ Linh Thạch! Cần **${fmt(cost)}** ${CE("tult", "💠")} (Hiện có: **${fmt(s.spirit_treasury)}**)`)]
        });
      }

      const newLvl = s.formation_level + 1;
      const newDur = (newLvl * 10000);

      await db(
        `UPDATE sects SET spirit_treasury = spirit_treasury - $1, formation_level = $2, formation_durability = $3, max_formation_durability = $3 WHERE id = $4`,
        [cost, newLvl, newDur, s.id]
      );

      return msg.reply({
        embeds: [okE(`🛡️ Hộ Sơn Trận Pháp của **${s.name}** đã nâng cấp lên **Cấp ${newLvl}**!\nĐộ bền tối đa tăng lên **${fmt(newDur)} HP**!`)],
      });
    } catch (err) {
      return msg.reply({ embeds: [errE("Lỗi khi nâng cấp Hộ Sơn Trận Pháp.")] });
    }
  }

  // 9. LỆNH: -tongmon tuyenchien <tên địch>
  if (subCmd === "tuyenchien" || subCmd === "tuyen_chien" || subCmd === "war") {
    if (!p.tong_mon) return msg.reply({ embeds: [warnE("Đạo hữu chưa gia nhập Tông Môn nào!")] });
    if (p.tong_mon_cap !== "tong_chu" && p.tong_mon_cap !== "pho_tong_chu") {
      return msg.reply({ embeds: [errE("Chỉ Tông Chủ hoặc Phó Tông Chủ mới có quyền Tuyên Chiến!")] });
    }

    const enemyName = args.slice(1).join(" ")?.trim();
    if (!enemyName) return msg.reply({ embeds: [errE("Cú pháp: `-tongmon tuyenchien <Tên Tông Môn Địch>`")] });
    if (enemyName.toLowerCase() === p.tong_mon.toLowerCase()) {
      return msg.reply({ embeds: [errE("Không thể tuyên chiến với chính Tông Môn của mình!")] });
    }

    try {
      const mySectRes = await db("SELECT * FROM sects WHERE name = $1 LIMIT 1", [p.tong_mon]);
      const enemySectRes = await db("SELECT * FROM sects WHERE LOWER(name) = LOWER($1) LIMIT 1", [enemyName]);

      if (!enemySectRes.rows || enemySectRes.rows.length === 0) {
        return msg.reply({ embeds: [errE(`Không tìm thấy Tông Môn đối thủ 【${enemyName}】!`)] });
      }

      const mySect = mySectRes.rows[0];
      const enemySect = enemySectRes.rows[0];

      await db(
        "INSERT INTO sect_wars (attacker_sect_id, defender_sect_id, status) VALUES ($1, $2, 'active')",
        [mySect.id, enemySect.id]
      );

      const embed = new EmbedBuilder()
        .setTitle("🔥 CHIẾN THƯ HUYẾT SÁT TÔNG MÔN!")
        .setColor(15158332)
        .setDescription(
          `⚔️ Tông Môn **【${mySect.name}】** đã chính thức phát động PK Huyết Chiến với **【${enemySect.name}】**!\n\n` +
          `Toàn thể môn nhân hai phái hãy mau chóng tập kết, sử dụng lệnh \`-tongmon tapkich\` để oanh tạc đại trận của đối phương!`
        );

      return msg.reply({ embeds: [embed] });
    } catch (err) {
      console.error("Lỗi tuyên chiến:", err);
      return msg.reply({ embeds: [errE("Lỗi khi phát động tuyên chiến.")] });
    }
  }

  // 10. LỆNH: -tongmon tapkich
  if (subCmd === "tapkich" || subCmd === "tap_kich" || subCmd === "attack") {
    if (!p.tong_mon) return msg.reply({ embeds: [warnE("Đạo hữu chưa gia nhập Tông Môn nào!")] });

    try {
      const mySectRes = await db("SELECT * FROM sects WHERE name = $1 LIMIT 1", [p.tong_mon]);
      if (!mySectRes.rows || mySectRes.rows.length === 0) return msg.reply({ embeds: [errE("Lỗi Tông Môn.")] });
      const mySect = mySectRes.rows[0];

      const warRes = await db(
        "SELECT * FROM sect_wars WHERE attacker_sect_id = $1 AND status = 'active' ORDER BY id DESC LIMIT 1",
        [mySect.id]
      );

      if (!warRes.rows || warRes.rows.length === 0) {
        return msg.reply({ embeds: [warnE("Tông Môn của đạo hữu hiện không trong trạng thái tuyên chiến với phái nào! Dùng `-tongmon tuyenchien <tên>` trước.")] });
      }

      const war = warRes.rows[0];
      const enemySectRes = await db("SELECT * FROM sects WHERE id = $1 LIMIT 1", [war.defender_sect_id]);
      const enemySect = enemySectRes.rows[0];

      // Tính sát thương dựa trên cảnh giới và chỉ số người chơi
      const dmg = Math.max(500, (p.canh_gioi * 250) + Math.floor(Math.random() * 500));
      const currentDur = BigInt(enemySect.formation_durability);
      const newDur = currentDur > BigInt(dmg) ? currentDur - BigInt(dmg) : 0n;

      if (newDur === 0n) {
        // Trận pháp sụp đổ: Phe công thắng, cướp 20% ngân khố và nhận 250 Điểm PK
        const plunder = BigInt(enemySect.spirit_treasury) / 5n;
        await db("UPDATE sects SET formation_durability = max_formation_durability, spirit_treasury = spirit_treasury - $1, pk_points = pk_points - 100, wars_lost = wars_lost + 1 WHERE id = $2", [plunder, enemySect.id]);
        await db("UPDATE sects SET spirit_treasury = spirit_treasury + $1, pk_points = pk_points + 250, wars_won = wars_won + 1 WHERE id = $2", [plunder, mySect.id]);
        await db("UPDATE sect_wars SET status = 'attacker_won', plundered_stones = $1, pk_points_exchanged = 250, ended_at = NOW() WHERE id = $2", [plunder, war.id]);

        return msg.reply({
          embeds: [okE(`💥 **HỘ SƠN TRẬN PHÁP CỦA 【${enemySect.name}】 ĐÃ SỤP ĐỔ!**\n\n🎉 **【${mySect.name}】** toàn thắng! Cướp được **${fmt(plunder)}** ${CE("tult", "💠")} vào Ngân Khố và đoạt lấy **+250 Điểm PK Thế Lực**!`)],
        });
      } else {
        await db("UPDATE sects SET formation_durability = $1 WHERE id = $2", [newDur, enemySect.id]);
        return msg.reply({
          embeds: [okE(`⚔️ Đạo hữu **${msg.author.username}** vận dụng linh lực oanh kích Hộ Sơn Trận Pháp **【${enemySect.name}】**, gây **${fmt(dmg)}** sát thương!\n🛡️ Độ bền trận pháp địch còn lại: **${fmt(newDur)} / ${fmt(enemySect.max_formation_durability)} HP**`)],
        });
      }
    } catch (err) {
      console.error("Lỗi tập kích:", err);
      return msg.reply({ embeds: [errE("Lỗi khi thực hiện tập kích!")] });
    }
  }

  // 11. LỆNH: -tongmon roi (Rời Tông Môn)
  if (subCmd === "roi" || subCmd === "leave") {
    if (!p.tong_mon) return msg.reply({ embeds: [warnE("Đạo hữu chưa gia nhập Tông Môn nào!")] });

    try {
      const oldSect = p.tong_mon;
      await db("UPDATE players SET tong_mon = NULL, tong_mon_cap = 'ngoai_mon' WHERE user_id = $1", [userId]);
      return msg.reply({ embeds: [okE(`Đạo hữu đã rời khỏi **${oldSect}**, trở về làm một Tán Tu tự do.`)] });
    } catch (err) {
      return msg.reply({ embeds: [errE("Lỗi khi rời Tông Môn.")] });
    }
  }

  return msg.reply({ embeds: [errE("Lệnh không hợp lệ! Gõ `-tongmon help` để xem hướng dẫn.")] });
});
