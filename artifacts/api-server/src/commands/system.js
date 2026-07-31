'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, StringSelectMenuOptionBuilder, MessageFlags,
} = require('discord.js');
const { db } = require('../db/pool');
const { getPlayer, awardBiPhap, awardLinhThao } = require('../db/players');
const { CE, CUSTOM_EMOJI, initCustomEmoji } = require('../systems/emoji');
const antiraid = require('../core/antiraid');
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
const ADMIN_ID = process.env.ADMIN_ID || '';

// ─────────────────────────────────────────────────────────────────────────────
// Dữ liệu hướng dẫn theo mục — dùng bởi -hd và shopHandler (hd_menu)
// ─────────────────────────────────────────────────────────────────────────────
const HD_GROUPS = {
  tubat: {
    get emoji() { return CE("ft_tu_luyen","🧘"); }, ten: 'Tu Luyện & Đột Phá', color: 0x3498DB,
    lenh: [
      '**`-bd`** — Tạo nhân vật *(1 lần duy nhất)*',
      '**`-tt`** — Xem hồ sơ & chỉ số nhân vật',
      '**`-tl`** — Tu luyện tích Tu Vi *(CD 1h)*',
      '**`-tl sk`** — Bỏ qua CD bằng Linh Thạch',
      '**`-dp`** — Đột phá khi Cảm Ngộ ≥ 60%',
      '**`-vk`** — Vượt Thiên Kiếp',
      '**`-cg`** — Danh sách 39 cảnh giới & Tu Vi yêu cầu',
      '**`-daily`** — Điểm danh nhận thưởng mỗi ngày',
      '**`-nv`** — Xem & nhận nhiệm vụ ngày',
      '**`-daotu`** — Chọn Đạo Tử *(hướng tu luyện)*',
    ].join('\n'),
    chu: '⬡ Tu luyện → tích **Tu Vi + Cảm Ngộ** → khi Cảm Ngộ ≥ 60% thì dùng `-dp`\n⬡ Thiên Kiếp xuất hiện tầng **10 · 14 · 18 · 22 · 26 · 30 · 34 · 38 · 39** — dùng `-vk`\n⬡ Cảm Ngộ reset về 0 sau mỗi đột phá thành công',
  },

  ngotinh: {
    emoji: '🧠', ten: 'Ngộ Tính & Nội Tại', color: 0x9B59B6,
    lenh: [
      '**`-ngo`** — Xem danh sách Cổ Thư lĩnh ngộ',
      '**`-linh_ngo doc <id>`** — Đọc & lĩnh ngộ Cổ Thư *(CD 2h)*',
      '**`-linh_ngo ke_thua`** — Danh sách Truyền Thừa Cổ Đại',
      '**`-linh_ngo ke_thua chon <id>`** — Tiếp nhận Truyền Thừa',
      '**`-noi_tai_an`** — Khai mở Nội Tại Ẩn *(cần Huyết Mạch Thạch)*',
      '**`-tt_ngoc`** — Thần Thông từ Ngọc Giản',
      '**`-tamma`** — Xem & tu luyện Đạo Tâm',
      '**`-huyet`** — Nâng cấp Huyết Mạch',
      '**`-linhcan`** — Đổi Linh Căn *(cần Vé)*',
    ].join('\n'),
    chu: '⬡ **Ngộ Tính cao** → tỉ lệ lĩnh ngộ Cổ Thư tăng từ 30% → 80%\n⬡ **Khí Vận** ảnh hưởng Cơ Duyên & Bí Cảnh · **Nhân Quả** ảnh hưởng Thiên Kiếp\n⬡ Nội Tại Ẩn mở hướng tu đặc biệt tiềm ẩn trong Huyết Mạch',
  },

  pvp: {
    emoji: '⚔️', ten: 'Chiến Đấu & Tháp', color: 0xE74C3C,
    lenh: [
      '**`-pvp @người`** — Tỷ thí trực tiếp *(CD 30ph)*',
      '**`-am @người`** — Ám sát bí mật *(CD 45ph)*',
      '**`-trinh_sat @người`** — Trinh sát chỉ số đối thủ *(CD 30ph)*',
      '**`-ht @người`** — Hút tu vi *(Huyết Ma · CD 1h)*',
      '**`-bp`** — Xem Bí Pháp đã học & cửa hàng',
      '**`-bp su_dung <id>`** — Kích hoạt Bí Pháp ngoài PvP',
      '**`-ttl`** — Tháp Thí Luyện *(30 tầng)*',
      '**`-ttl dokho`** — Xem thủ vệ & độ khó từng tầng',
      '**`-rankthap`** — Bảng xếp hạng Tháp Thử Luyện',
    ].join('\n'),
    chu: '⬡ Trong PvP: nhấn **📜 Bí Pháp** để thi triển chiêu thức đặc biệt\n⬡ Chênh **1 đại cảnh**: -30% ATK · **2 đại cảnh**: -80% · **≥3**: từ chối chiến\n⬡ Tháp reset hàng tuần · phần thưởng đặc biệt mỗi **5 tầng**',
  },

  tongmon: {
    emoji: '🏯', ten: 'Tông Môn', color: 0xE67E22,
    lenh: [
      '**`-tm`** — Xem Tứ Đại Tông Môn & thế mạnh',
      '**`-tm gia_nhap <id>`** — Gia nhập tông môn',
      '**`-tm thong_tin`** — Thông tin tông môn đang ở',
      '**`-tm cap`** — Danh sách cấp bậc trong tông',
      '**`-tm len_cap`** — Thăng cấp trong tông môn',
      '**`-tm roi`** — Rời tông môn *(có phạt Linh Thạch)*',
    ].join('\n'),
    chu: '⬡ Cấp bậc: **Ngoại Môn → Nội Môn → Chân Truyền → Thánh Tử → Tông Chủ**\n⬡ Cấp càng cao → bonus chiến đấu & Tu Vi càng lớn\n⬡ Mỗi tông có thế mạnh riêng — dùng `-tm` để so sánh trước khi gia nhập',
  },

  trangbi: {
    emoji: '🛡️', ten: 'Trang Bị & Công Pháp', color: 0x2ECC71,
    lenh: [
      '**`-tb`** — Trang bị & mua Phi Khí / Linh Bảo',
      '**`-cp`** — Xem Công Pháp đang tu & danh sách',
      '**`-cp doi <id>`** — Đổi Công Pháp *(tốn Linh Thạch)*',
      '**`-bp`** — Xem Bí Pháp đã học & cửa hàng',
      '**`-bp su_dung <id>`** — Kích hoạt Bí Pháp ngoài PvP',
      '**`-rl`** — Tôi luyện Phi Khí +1 → +10 *(Phi Khí Sư)*',
      '**`-dong_phu`** — Xem & nâng cấp Động Phủ',
    ].join('\n'),
    chu: '⬡ Rèn **+1→+8** dùng Khoáng Vật · **+9→+10** cần Nguyên Liệu Linh Thú hiếm\n⬡ Linh Bảo rớt từ Linh Thú hoặc mua trong cửa hàng `-tb`',
  },

  nghe: {
    emoji: '🏪', ten: 'Đạo Pháp & Nghề', color: 0x1ABC9C,
    lenh: [
      '**`-nghe xem`** — Xem & chọn Đạo Pháp *(nghề)*',
      '**`-ni`** — Chi tiết nghề & đặc kỹ',
      '**`-hsn`** — Hồ sơ nghề + xác suất đột phá thực',
      '',
      '🌀 **Ngộ Đạo Sư** — `-dai_ngo` · `-truyen_dao` · `-thach_ngo` · `-cong_huong` · `-dao_kinh`',
      '🔱 **Phi Khí Sư** — `-khai_quang` · `-bao_linh` · `-sac_ben` · `-vo_trang` · `-bo_khi` · `-linh_bieu`',
      '⚗️ **Luyện Đan Sư** — `-luyen_dan` · `-dung_dan` · `-ban_dan` · `-dan_kho` · `-tang_dan`',
      '📜 **Phù Lục Sư** — `-ve_phu` · `-dung_phu` · `-phu_bo_tro` · `-phu_pham` · `-ve_phong_an`',
      '💉 **Dược Sư** — `-chua_thuong` · `-luyen_thuoc` · `-kham_benh` · `-che_doc` · `-giai_doc`',
      '🗡️ **Ám Vệ** — `-am_sat` · `-luc_soat` · `-an_ngu` · `-trinh_sat` · `-xa_tinh` · `-sat_y`',
      '🧭 **Phong Thủy Sư** — `-phong_thuy boi` · `-khai_van` · `-cau_phuc` · `-tien_tri` · `-tran_van`',
    ].join('\n'),
    chu: '⬡ Mỗi Đạo Pháp có **lệnh độc quyền riêng** — nghề khác không dùng được\n⬡ Dùng `-hsn` để xem xác suất đột phá thực tế của mình',
  },

  coduyen: {
    emoji: '🌌', ten: 'Cơ Duyên & Bí Cảnh', color: 0x8E44AD,
    lenh: [
      '**`-duyen`** — Tìm kiếm cơ duyên *(CD 8h)*',
      '**`-bic`** — Vào Bí Cảnh thám hiểm *(CD 4h)*',
      '**`-bic chon <1-5>`** — Chọn hành động trong Bí Cảnh',
      '**`-klt`** — Kiếm Linh Thảo ngoài trời',
    ].join('\n'),
    chu: '⬡ **Khí Vận cao** → kết quả cơ duyên & bí cảnh tốt hơn đáng kể\n⬡ Cứu người trong Cơ Duyên → **+Công Đức +Khí Vận**\n⬡ Bí Cảnh có thể tìm Công Pháp · Bí Pháp · Linh Thảo cực quý',
  },

  tui: {
    emoji: '🎒', ten: 'Túi & Vật Phẩm', color: 0x7F8C8D,
    lenh: [
      '**`-bag`** — Xem túi đồ & trọng lượng',
      '**`-vatpham`** — Xem vật phẩm đặc biệt',
      '**`-dd <id> [số]`** — Dùng Đan Dược từ túi',
      '**`-lthuoc`** — Luyện thuốc từ Linh Thảo *(Dược Sư · CD 45ph)*',
      '**`-vut linh_thao <id> <số>`** — Vứt bỏ Linh Thảo',
      '**`-vut dan_duoc <id> <số>`** — Vứt bỏ Đan Dược',
      '**`-vut phu_luc <id> <số>`** — Vứt bỏ Phù Lục',
      '**`-vut bao_boi <id>`** — Vứt Linh Bảo *(không hoàn tác!)*',
    ].join('\n'),
    chu: '⬡ Trọng lượng: Linh Thảo 0.2~0.8kg · Đan Dược 0.3~1.2kg · Linh Bảo 1.5~12kg\n⬡ Đột phá cảnh giới → tự động tăng sức chứa túi',
  },

  xahoi: {
    emoji: '📊', ten: 'Xếp Hạng & Tiện Ích', color: 0xF1C40F,
    lenh: [
      '**`-bxh`** — Top 10 cảnh giới cao nhất',
      '**`-bxh linh_thach`** — Top 10 giàu có nhất (Thường)',
      '**`-bxh linh_thach_trung`** — Top 10 Linh Thạch Trung',
      '**`-bxh linh_thach_cao`** — Top 10 Linh Thạch Cao',
      '**`-bxh pvp`** — Top 10 PvP',
      '**`-rankthap`** — Top 10 Tháp Thử Luyện',
      '**`-code`** — Nhập mã Giftcode',
      '**`-nap`** — Nạp Linh Thạch *(ấn nút chọn gói)*',
    ].join('\n'),
    chu: '⬡ Bảng xếp hạng cập nhật thời gian thực sau mỗi đột phá\n⬡ Giftcode phát qua sự kiện · stream · hoạt động cộng đồng · donate',
  },

  linhtu: {
    emoji: '🐉', ten: 'Linh Thú & Chế Tạo', color: 0x27AE60,
    lenh: [
      '**`-san`** — Xuất chinh săn Linh Thú *(team 1-3 người)*',
      '**`-san nx`** — Xem bậc & phần thưởng Linh Thú',
      '  ╰ Thường **15ph** · Hiếm **30ph** · Quý **45ph** · Huyền **1h** · Thần **1.5h**',
      '**`-kq_mine`** — Khai mỏ lấy Sắt Tinh *(Phi Khí Sư · CD 1h)*',
      '**`-rl`** — Tôi luyện Phi Khí +1 → +10',
      '**`-ld`** — Luyện chế Đan Dược *(Luyện Đan Sư)*',
    ].join('\n'),
    chu: '⬡ Linh Thú rớt **Nguyên Liệu** chế Linh Bảo — dùng `-san nx` xem chi tiết\n⬡ Linh Huyết · Linh Cốt · Thần Hồn · Tinh Huyết → buff chỉ số vĩnh viễn\n⬡ Vé Đổi Linh Căn chỉ có từ **Giftcode hoặc Donate**',
  },
};

// ─── Lệnh -hd (Hướng dẫn) ────────────────────────────────────────────────────
reg('huong_dan', ['hd', 'lenh', 'help', 'huongdan'], async (n) => {
  const embed = new EmbedBuilder()
    .setTitle('📖 Tu Tiên — Hướng Dẫn')
    .setColor(0x5865F2)
    .addFields(
      {
        name: '🚀 Bắt đầu nhanh',
        value: [
          '**1.** `-bd` — Tạo nhân vật',
          '**2.** `-nghe xem` — Chọn Đạo Pháp *(quan trọng!)*',
          '**3.** `-tl` — Tu luyện mỗi **1h**',
          '**4.** `-dp` — Đột phá khi Cảm Ngộ ≥ 60%',
          '**5.** `-san` — Săn Linh Thú kiếm nguyên liệu',
        ].join('\n'),
        inline: false,
      },
      {
        name: '⏰ Lịch hàng ngày',
        value: `🗓️ \`-daily\` · 🌌 \`-duyen\` *(8h)* · 🗝️ \`-bic vao\` *(4h)* · ${CE("ft_tu_luyen","🧘")} \`-tl\` *(1h)* · 📋 \`-nv\``,
        inline: false,
      },
    )
    .setFooter({ text: 'Tu Tiên Bot  •  Chọn mục bên dưới để xem chi tiết' });

  const menu = new StringSelectMenuBuilder()
    .setCustomId('hd_menu')
    .setPlaceholder('📚 Chọn mục hướng dẫn...')
    .addOptions(
      Object.entries(HD_GROUPS).map(([key, g]) =>
        new StringSelectMenuOptionBuilder()
          .setValue(key)
          .setLabel(g.ten)
          .setEmoji(g.emoji),
      ),
    );

  return n.reply({
    embeds: [embed],
    components: [new ActionRowBuilder().addComponents(menu)],
  }).catch(() => {});
});

const maintenance   = require('../core/maintenance');
const channels      = require('../core/channels');
const pvpChannels   = require('../core/pvp_channels');
const ttlChannels   = require('../core/ttl_channels');
const sanChannels   = require('../core/san_channels');
const dvChannels    = require('../core/dv_channels');
const antiraidLog   = require('../core/antiraid_log');

// ── Lệnh -kenh (Admin: quản lý whitelist kênh) ───────────────────────────
reg('kenh', ['channel', 'kenh_setup'], async (msg, args) => {
  // Lệnh này chỉ hoạt động trong server (không phải DM)
  if (!msg.guild)
    return msg.reply({ embeds: [errE('❌ Lệnh này chỉ dùng được trong server!')] }).catch(() => {});

  // Cho phép: bot owner HOẶC thành viên có quyền Quản Lý Server / Administrator
  const isBotOwner    = msg.author.id === ADMIN_ID;
  const isServerAdmin = !!(msg.member?.permissions?.has?.('ManageGuild') ||
                           msg.member?.permissions?.has?.('Administrator'));
  if (!isBotOwner && !isServerAdmin)
    return msg.reply({ embeds: [errE('❌ Bạn cần quyền **Quản Lý Server** hoặc **Administrator** để dùng lệnh này!')] }).catch(() => {});

  const sub = (args[0] || '').toLowerCase();

  // -kenh them / add  →  thêm kênh hiện tại hoặc kênh mention/id
  if (sub === 'them' || sub === 'add' || sub === 'thêm') {
    // Lấy channel từ mention hoặc ID trong args[1], fallback về kênh hiện tại
    let targetId   = msg.channel.id;
    let targetName = msg.channel.name;
    if (args[1]) {
      const match = args[1].match(/^<#(\d+)>$/) || args[1].match(/^(\d+)$/);
      if (match) {
        targetId = match[1];
        const ch = msg.guild?.channels?.cache?.get(targetId);
        targetName = ch ? ch.name : targetId;
      }
    }
    await channels.addChannel(msg.guild.id, targetId);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Đã Thêm Kênh Được Phép')
          .setColor(0x2ECC71)
          .setDescription(
            `📢 Kênh **#${targetName}** (\`${targetId}\`) đã được thêm vào danh sách.\n\n` +
            `${CE('lock_icon','🔒')} **Whitelist đang BẬT** — bot chỉ hoạt động ở các kênh đã thêm.\n` +
            `📋 Xem danh sách: \`-kenh xem\` · Tắt giới hạn: \`-kenh tat\``
          ),
      ],
    }).catch(() => {});
  }

  // -kenh xoa / remove  →  xoá kênh
  if (sub === 'xoa' || sub === 'remove' || sub === 'xóa') {
    let targetId   = msg.channel.id;
    let targetName = msg.channel.name;
    if (args[1]) {
      const match = args[1].match(/^<#(\d+)>$/) || args[1].match(/^(\d+)$/);
      if (match) {
        targetId = match[1];
        const ch = msg.guild?.channels?.cache?.get(targetId);
        targetName = ch ? ch.name : targetId;
      }
    }
    await channels.removeChannel(msg.guild.id, targetId);
    const remaining = channels.list(msg.guild.id);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🗑️ Đã Xoá Kênh')
          .setColor(0xE74C3C)
          .setDescription(
            `❌ Kênh **#${targetName}** (\`${targetId}\`) đã được xoá khỏi danh sách.\n\n` +
            (remaining.length === 0
              ? `${CE('warn_icon','⚠️')} Danh sách rỗng — whitelist sẽ **tự động tắt** (bot dùng được ở mọi kênh).`
              : `📋 Còn lại **${remaining.length}** kênh trong whitelist.`)
          ),
      ],
    }).catch(() => {});
  }

  // -kenh tat / off  →  tắt whitelist
  if (sub === 'tat' || sub === 'off' || sub === 'tắt') {
    await channels.setEnabled(msg.guild.id, false);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🟢 Whitelist Kênh — TẮT')
          .setColor(0x2ECC71)
          .setDescription(
            `✅ Giới hạn kênh đã **TẮT**.\n` +
            `🌐 Bot hoạt động ở **tất cả kênh** trên server.\n\n` +
            `*(Danh sách kênh vẫn được giữ — bật lại: \`-kenh bat\`)*`
          ),
      ],
    }).catch(() => {});
  }

  // -kenh bat / on  →  bật lại whitelist
  if (sub === 'bat' || sub === 'on' || sub === 'bật') {
    const list = channels.list(msg.guild.id);
    if (list.length === 0) {
      return msg.reply({
        embeds: [warnE(`${CE('warn_icon','⚠️')} Danh sách kênh đang rỗng!\nThêm kênh trước: \`-kenh them #kênh\``)],
      }).catch(() => {});
    }
    await channels.setEnabled(msg.guild.id, true);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle(`${CE('lock_icon','🔒')} Whitelist Kênh — BẬT`)
          .setColor(0xF39C12)
          .setDescription(
            `✅ Giới hạn kênh đã **BẬT**.\n` +
            `${CE('lock_icon','🔒')} Bot chỉ hoạt động ở **${list.length}** kênh được phép.\n\n` +
            `Dùng \`-kenh xem\` để xem danh sách.`
          ),
      ],
    }).catch(() => {});
  }

  // -kenh xem / list  →  xem danh sách (default nếu không có sub)
  const list    = channels.list(msg.guild.id);
  const enabled = channels.isEnabled(msg.guild.id);
  let desc = `**Trạng thái:** ${enabled ? `${CE('lock_icon','🔒')} **BẬT** — bot chỉ hoạt động ở kênh được phép` : '🟢 **TẮT** — bot hoạt động ở tất cả kênh'}\n\n`;
  if (list.length === 0) {
    desc += `📭 *Chưa có kênh nào trong danh sách.*\n\n`;
    desc += `**💡 Hướng dẫn setup nhanh:**\n`;
    desc += `1️⃣ Vào kênh muốn chơi bot → gõ \`-kenh them\`\n`;
    desc += `2️⃣ Lặp lại nếu muốn thêm nhiều kênh\n`;
    desc += `3️⃣ Whitelist tự động BẬT khi thêm kênh đầu tiên\n\n`;
    desc += `*Khi BẬT: người dùng gõ lệnh sai kênh sẽ nhận DM hướng dẫn, tin nhắn bị xóa ngay — chat chung hoàn toàn sạch!*`;
  } else {
    desc += `**Kênh được phép (${list.length}):**\n`;
    list.forEach((id) => {
      const ch = msg.guild?.channels?.cache?.get(id);
      desc += `▸ ${ch ? `<#${id}>` : `\`${id}\``}\n`;
    });
    if (enabled) {
      desc += `\n✅ *Người dùng gõ sai kênh → nhận DM riêng + lệnh bị xóa ngay, chat chung không bị ảnh hưởng.*`;
    }
  }
  desc += `\n\n**Lệnh quản lý:**\n\`-kenh them [#kênh]\` · \`-kenh xoa [#kênh]\` · \`-kenh bat\` · \`-kenh tat\``;
  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('📢 Quản Lý Kênh Bot — Tu Tiên')
        .setColor(enabled ? 0xF39C12 : 0x2ECC71)
        .setDescription(desc)
        .setFooter({ text: `Server: ${msg.guild?.name || ''}` }),
    ],
  }).catch(() => {});
});

// ── Lệnh -pvp_kenh (Admin: quản lý whitelist kênh PvP) ──────────────────
reg('pvp_kenh', ['pvp_channel'], async (msg, args) => {
  if (!msg.guild)
    return msg.reply({ embeds: [errE('❌ Lệnh này chỉ dùng được trong server!')] }).catch(() => {});

  const isBotOwner    = msg.author.id === ADMIN_ID;
  const isServerAdmin = !!(msg.member?.permissions?.has?.('ManageGuild') ||
                           msg.member?.permissions?.has?.('Administrator'));
  if (!isBotOwner && !isServerAdmin)
    return msg.reply({ embeds: [errE('❌ Bạn cần quyền **Quản Lý Server** hoặc **Administrator** để dùng lệnh này!')] }).catch(() => {});

  const sub = (args[0] || '').toLowerCase();

  // -pvp_kenh them / add
  if (sub === 'them' || sub === 'add' || sub === 'thêm') {
    let targetId   = msg.channel.id;
    let targetName = msg.channel.name;
    if (args[1]) {
      const match = args[1].match(/^<#(\d+)>$/) || args[1].match(/^(\d+)$/);
      if (match) {
        targetId = match[1];
        const ch = msg.guild?.channels?.cache?.get(targetId);
        targetName = ch ? ch.name : targetId;
      }
    }
    await pvpChannels.addChannel(msg.guild.id, targetId);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Đã Thêm Kênh PvP')
          .setColor(0xE74C3C)
          .setDescription(
            `⚔️ Kênh **#${targetName}** (\`${targetId}\`) đã được thêm vào danh sách kênh PvP.\n\n` +
            `🔒 **Whitelist PvP đang BẬT** — lệnh PvP chỉ hoạt động ở kênh được phép.\n` +
            `📋 Xem danh sách: \`-pvp_kenh xem\` · Tắt giới hạn: \`-pvp_kenh tat\``
          ),
      ],
    }).catch(() => {});
  }

  // -pvp_kenh xoa / remove
  if (sub === 'xoa' || sub === 'remove' || sub === 'xóa') {
    let targetId   = msg.channel.id;
    let targetName = msg.channel.name;
    if (args[1]) {
      const match = args[1].match(/^<#(\d+)>$/) || args[1].match(/^(\d+)$/);
      if (match) {
        targetId = match[1];
        const ch = msg.guild?.channels?.cache?.get(targetId);
        targetName = ch ? ch.name : targetId;
      }
    }
    await pvpChannels.removeChannel(msg.guild.id, targetId);
    const remaining = pvpChannels.list(msg.guild.id);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🗑️ Đã Xoá Kênh PvP')
          .setColor(0x95A5A6)
          .setDescription(
            `❌ Kênh **#${targetName}** đã được xoá khỏi danh sách PvP.\n\n` +
            (remaining.length === 0
              ? `⚠️ Danh sách rỗng — whitelist PvP đã **tự động tắt** (PvP dùng được ở mọi kênh).`
              : `📋 Còn lại **${remaining.length}** kênh PvP trong whitelist.`)
          ),
      ],
    }).catch(() => {});
  }

  // -pvp_kenh tat / off
  if (sub === 'tat' || sub === 'off' || sub === 'tắt') {
    await pvpChannels.setEnabled(msg.guild.id, false);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🟢 Whitelist Kênh PvP — TẮT')
          .setColor(0x2ECC71)
          .setDescription(
            `✅ Giới hạn kênh PvP đã **TẮT**.\n` +
            `🌐 Lệnh PvP hoạt động ở **tất cả kênh** trên server.\n\n` +
            `*(Danh sách vẫn được giữ — bật lại: \`-pvp_kenh bat\`)*`
          ),
      ],
    }).catch(() => {});
  }

  // -pvp_kenh bat / on
  if (sub === 'bat' || sub === 'on' || sub === 'bật') {
    const list = pvpChannels.list(msg.guild.id);
    if (list.length === 0) {
      return msg.reply({
        embeds: [warnE(`⚠️ Danh sách kênh PvP đang rỗng!\nThêm kênh trước: \`-pvp_kenh them #kênh\``)],
      }).catch(() => {});
    }
    await pvpChannels.setEnabled(msg.guild.id, true);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('⚔️ Whitelist Kênh PvP — BẬT')
          .setColor(0xE74C3C)
          .setDescription(
            `✅ Giới hạn kênh PvP đã **BẬT**.\n` +
            `⚔️ Lệnh PvP chỉ hoạt động ở **${list.length}** kênh được phép.\n\n` +
            `Dùng \`-pvp_kenh xem\` để xem danh sách.`
          ),
      ],
    }).catch(() => {});
  }

  // -pvp_kenh xem / list (default)
  const list    = pvpChannels.list(msg.guild.id);
  const enabled = pvpChannels.isEnabled(msg.guild.id);
  let desc = `**Trạng thái:** ${enabled ? `⚔️ **BẬT** — PvP chỉ ở kênh được phép` : '🟢 **TẮT** — PvP hoạt động ở tất cả kênh'}\n\n`;
  if (list.length === 0) {
    desc += `📭 *Chưa có kênh nào trong danh sách.*\n\n`;
    desc += `**💡 Hướng dẫn setup:**\n`;
    desc += `1️⃣ Vào kênh muốn chơi PvP → gõ \`-pvp_kenh them\`\n`;
    desc += `2️⃣ Lặp lại nếu muốn thêm nhiều kênh\n`;
    desc += `3️⃣ Whitelist tự động BẬT khi thêm kênh đầu tiên\n\n`;
    desc += `*Khi BẬT: PvP ngoài kênh chỉ định sẽ bị xóa + DM hướng dẫn người dùng.*\n\n`;
    desc += `**Lệnh PvP bị giới hạn:** \`-pvp\` · \`-dau\` · \`-cuong_chien\` · \`-am_sat\``;
  } else {
    desc += `**Kênh PvP được phép (${list.length}):**\n`;
    list.forEach((id) => {
      const ch = msg.guild?.channels?.cache?.get(id);
      desc += `▸ ${ch ? `<#${id}>` : `\`${id}\``}\n`;
    });
    desc += `\n**Lệnh PvP bị giới hạn:** \`-pvp\` · \`-dau\` · \`-cuong_chien\` · \`-am_sat\``;
    if (enabled) {
      desc += `\n\n✅ *PvP sai kênh → DM riêng + xóa lệnh ngay, server sạch sẽ.*`;
    }
  }
  desc += `\n\n**Lệnh quản lý:**\n\`-pvp_kenh them [#kênh]\` · \`-pvp_kenh xoa [#kênh]\` · \`-pvp_kenh bat\` · \`-pvp_kenh tat\``;
  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('⚔️ Quản Lý Kênh PvP — Tu Tiên')
        .setColor(enabled ? 0xE74C3C : 0x2ECC71)
        .setDescription(desc)
        .setFooter({ text: `Server: ${msg.guild?.name || ''}` }),
    ],
  }).catch(() => {});
});

// ── Lệnh -ttl_kenh (Admin: quản lý whitelist kênh Tháp Thị Luyện) ────────
reg('ttl_kenh', ['ttl_channel'], async (msg, args) => {
  if (!msg.guild)
    return msg.reply({ embeds: [errE('❌ Lệnh này chỉ dùng được trong server!')] }).catch(() => {});

  const isBotOwner    = msg.author.id === ADMIN_ID;
  const isServerAdmin = !!(msg.member?.permissions?.has?.('ManageGuild') ||
                           msg.member?.permissions?.has?.('Administrator'));
  if (!isBotOwner && !isServerAdmin)
    return msg.reply({ embeds: [errE('❌ Bạn cần quyền **Quản Lý Server** hoặc **Administrator** để dùng lệnh này!')] }).catch(() => {});

  const sub = (args[0] || '').toLowerCase();

  // -ttl_kenh them / add
  if (sub === 'them' || sub === 'add' || sub === 'thêm') {
    let targetId   = msg.channel.id;
    let targetName = msg.channel.name;
    if (args[1]) {
      const match = args[1].match(/^<#(\d+)>$/) || args[1].match(/^(\d+)$/);
      if (match) {
        targetId = match[1];
        const ch = msg.guild?.channels?.cache?.get(targetId);
        targetName = ch ? ch.name : targetId;
      }
    }
    await ttlChannels.addChannel(msg.guild.id, targetId);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Đã Thêm Kênh Tháp Thị Luyện')
          .setColor(0x9B59B6)
          .setDescription(
            `🏯 Kênh **#${targetName}** (\`${targetId}\`) đã được thêm vào danh sách kênh Tháp Thị Luyện.\n\n` +
            `🔒 **Whitelist TTL đang BẬT** — lệnh \`-ttl\` chỉ hoạt động ở kênh được phép.\n` +
            `📋 Xem danh sách: \`-ttl_kenh xem\` · Tắt giới hạn: \`-ttl_kenh tat\``
          ),
      ],
    }).catch(() => {});
  }

  // -ttl_kenh xoa / remove
  if (sub === 'xoa' || sub === 'remove' || sub === 'xóa') {
    let targetId   = msg.channel.id;
    let targetName = msg.channel.name;
    if (args[1]) {
      const match = args[1].match(/^<#(\d+)>$/) || args[1].match(/^(\d+)$/);
      if (match) {
        targetId = match[1];
        const ch = msg.guild?.channels?.cache?.get(targetId);
        targetName = ch ? ch.name : targetId;
      }
    }
    await ttlChannels.removeChannel(msg.guild.id, targetId);
    const remaining = ttlChannels.list(msg.guild.id);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🗑️ Đã Xoá Kênh Tháp Thị Luyện')
          .setColor(0x95A5A6)
          .setDescription(
            `❌ Kênh **#${targetName}** đã được xoá khỏi danh sách TTL.\n\n` +
            (remaining.length === 0
              ? `⚠️ Danh sách rỗng — whitelist TTL đã **tự động tắt** (TTL dùng được ở mọi kênh).`
              : `📋 Còn lại **${remaining.length}** kênh TTL trong whitelist.`)
          ),
      ],
    }).catch(() => {});
  }

  // -ttl_kenh tat / off
  if (sub === 'tat' || sub === 'off' || sub === 'tắt') {
    await ttlChannels.setEnabled(msg.guild.id, false);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🟢 Whitelist Kênh TTL — TẮT')
          .setColor(0x2ECC71)
          .setDescription(
            `✅ Giới hạn kênh Tháp Thị Luyện đã **TẮT**.\n` +
            `🌐 Lệnh \`-ttl\` hoạt động ở **tất cả kênh** trên server.\n\n` +
            `*(Danh sách vẫn được giữ — bật lại: \`-ttl_kenh bat\`)*`
          ),
      ],
    }).catch(() => {});
  }

  // -ttl_kenh bat / on
  if (sub === 'bat' || sub === 'on' || sub === 'bật') {
    const list = ttlChannels.list(msg.guild.id);
    if (list.length === 0) {
      return msg.reply({
        embeds: [warnE(`⚠️ Danh sách kênh TTL đang rỗng!\nThêm kênh trước: \`-ttl_kenh them #kênh\``)],
      }).catch(() => {});
    }
    await ttlChannels.setEnabled(msg.guild.id, true);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🏯 Whitelist Kênh TTL — BẬT')
          .setColor(0x9B59B6)
          .setDescription(
            `✅ Giới hạn kênh Tháp Thị Luyện đã **BẬT**.\n` +
            `🏯 Lệnh \`-ttl\` chỉ hoạt động ở **${list.length}** kênh được phép.\n\n` +
            `Dùng \`-ttl_kenh xem\` để xem danh sách.`
          ),
      ],
    }).catch(() => {});
  }

  // -ttl_kenh xem / list (default)
  const list    = ttlChannels.list(msg.guild.id);
  const enabled = ttlChannels.isEnabled(msg.guild.id);
  let desc = `**Trạng thái:** ${enabled ? `🏯 **BẬT** — TTL chỉ ở kênh được phép` : '🟢 **TẮT** — TTL hoạt động ở tất cả kênh'}\n\n`;
  if (list.length === 0) {
    desc += `📭 *Chưa có kênh nào trong danh sách.*\n\n`;
    desc += `**💡 Hướng dẫn setup:**\n`;
    desc += `1️⃣ Vào kênh muốn chơi Tháp → gõ \`-ttl_kenh them\`\n`;
    desc += `2️⃣ Lặp lại nếu muốn thêm nhiều kênh\n`;
    desc += `3️⃣ Whitelist tự động BẬT khi thêm kênh đầu tiên\n\n`;
    desc += `*Khi BẬT: TTL ngoài kênh chỉ định sẽ bị xóa + DM hướng dẫn người dùng.*\n\n`;
    desc += `**Lệnh bị giới hạn:** \`-ttl\` · \`-thi_luyen\` · \`-tower\``;
  } else {
    desc += `**Kênh Tháp Thị Luyện được phép (${list.length}):**\n`;
    list.forEach((id) => {
      const ch = msg.guild?.channels?.cache?.get(id);
      desc += `▸ ${ch ? `<#${id}>` : `\`${id}\``}\n`;
    });
    desc += `\n**Lệnh bị giới hạn:** \`-ttl\` · \`-thi_luyen\` · \`-tower\``;
    if (enabled) {
      desc += `\n\n✅ *TTL sai kênh → DM riêng + xóa lệnh ngay, server sạch sẽ.*`;
    }
  }
  desc += `\n\n**Lệnh quản lý:**\n\`-ttl_kenh them [#kênh]\` · \`-ttl_kenh xoa [#kênh]\` · \`-ttl_kenh bat\` · \`-ttl_kenh tat\``;
  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('🏯 Quản Lý Kênh Tháp Thị Luyện — Tu Tiên')
        .setColor(enabled ? 0x9B59B6 : 0x2ECC71)
        .setDescription(desc)
        .setFooter({ text: `Server: ${msg.guild?.name || ''}` }),
    ],
  }).catch(() => {});
});

// ── Lệnh -san_kenh (Admin: quản lý whitelist kênh Săn Linh Thú) ──────────
reg('san_kenh', ['san_channel'], async (msg, args) => {
  if (!msg.guild)
    return msg.reply({ embeds: [errE('❌ Lệnh này chỉ dùng được trong server!')] }).catch(() => {});

  const isBotOwner    = msg.author.id === ADMIN_ID;
  const isServerAdmin = !!(msg.member?.permissions?.has?.('ManageGuild') ||
                           msg.member?.permissions?.has?.('Administrator'));
  if (!isBotOwner && !isServerAdmin)
    return msg.reply({ embeds: [errE('❌ Bạn cần quyền **Quản Lý Server** hoặc **Administrator** để dùng lệnh này!')] }).catch(() => {});

  const sub = (args[0] || '').toLowerCase();

  // -san_kenh them / add
  if (sub === 'them' || sub === 'add' || sub === 'thêm') {
    let targetId   = msg.channel.id;
    let targetName = msg.channel.name;
    if (args[1]) {
      const match = args[1].match(/^<#(\d+)>$/) || args[1].match(/^(\d+)$/);
      if (match) {
        targetId = match[1];
        const ch = msg.guild?.channels?.cache?.get(targetId);
        targetName = ch ? ch.name : targetId;
      }
    }
    await sanChannels.addChannel(msg.guild.id, targetId);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Đã Thêm Kênh Săn Linh Thú')
          .setColor(0x27AE60)
          .setDescription(
            `🦌 Kênh **#${targetName}** (\`${targetId}\`) đã được thêm vào danh sách kênh Săn Linh Thú.\n\n` +
            `🔒 **Whitelist Săn đang BẬT** — lệnh \`-san\` chỉ hoạt động ở kênh được phép.\n` +
            `📋 Xem danh sách: \`-san_kenh xem\` · Tắt giới hạn: \`-san_kenh tat\``
          ),
      ],
    }).catch(() => {});
  }

  // -san_kenh xoa / remove
  if (sub === 'xoa' || sub === 'remove' || sub === 'xóa') {
    let targetId   = msg.channel.id;
    let targetName = msg.channel.name;
    if (args[1]) {
      const match = args[1].match(/^<#(\d+)>$/) || args[1].match(/^(\d+)$/);
      if (match) {
        targetId = match[1];
        const ch = msg.guild?.channels?.cache?.get(targetId);
        targetName = ch ? ch.name : targetId;
      }
    }
    await sanChannels.removeChannel(msg.guild.id, targetId);
    const remaining = sanChannels.list(msg.guild.id);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🗑️ Đã Xoá Kênh Săn Linh Thú')
          .setColor(0x95A5A6)
          .setDescription(
            `❌ Kênh **#${targetName}** đã được xoá khỏi danh sách Săn.\n\n` +
            (remaining.length === 0
              ? `⚠️ Danh sách rỗng — whitelist Săn đã **tự động tắt** (Săn dùng được ở mọi kênh).`
              : `📋 Còn lại **${remaining.length}** kênh Săn trong whitelist.`)
          ),
      ],
    }).catch(() => {});
  }

  // -san_kenh tat / off
  if (sub === 'tat' || sub === 'off' || sub === 'tắt') {
    await sanChannels.setEnabled(msg.guild.id, false);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🟢 Whitelist Kênh Săn — TẮT')
          .setColor(0x2ECC71)
          .setDescription(
            `✅ Giới hạn kênh Săn Linh Thú đã **TẮT**.\n` +
            `🌐 Lệnh \`-san\` hoạt động ở **tất cả kênh** trên server.\n\n` +
            `*(Danh sách vẫn được giữ — bật lại: \`-san_kenh bat\`)*`
          ),
      ],
    }).catch(() => {});
  }

  // -san_kenh bat / on
  if (sub === 'bat' || sub === 'on' || sub === 'bật') {
    const list = sanChannels.list(msg.guild.id);
    if (list.length === 0) {
      return msg.reply({
        embeds: [warnE(`⚠️ Danh sách kênh Săn đang rỗng!\nThêm kênh trước: \`-san_kenh them #kênh\``)],
      }).catch(() => {});
    }
    await sanChannels.setEnabled(msg.guild.id, true);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🦌 Whitelist Kênh Săn — BẬT')
          .setColor(0x27AE60)
          .setDescription(
            `✅ Giới hạn kênh Săn Linh Thú đã **BẬT**.\n` +
            `🦌 Lệnh \`-san\` chỉ hoạt động ở **${list.length}** kênh được phép.\n\n` +
            `Dùng \`-san_kenh xem\` để xem danh sách.`
          ),
      ],
    }).catch(() => {});
  }

  // -san_kenh xem / list (default)
  const list    = sanChannels.list(msg.guild.id);
  const enabled = sanChannels.isEnabled(msg.guild.id);
  let desc = `**Trạng thái:** ${enabled ? `🦌 **BẬT** — Săn chỉ ở kênh được phép` : '🟢 **TẮT** — Săn hoạt động ở tất cả kênh'}\n\n`;
  if (list.length === 0) {
    desc += `📭 *Chưa có kênh nào trong danh sách.*\n\n`;
    desc += `**💡 Hướng dẫn setup:**\n`;
    desc += `1️⃣ Vào kênh muốn đi săn → gõ \`-san_kenh them\`\n`;
    desc += `2️⃣ Lặp lại nếu muốn thêm nhiều kênh\n`;
    desc += `3️⃣ Whitelist tự động BẬT khi thêm kênh đầu tiên\n\n`;
    desc += `*Khi BẬT: Săn ngoài kênh chỉ định sẽ bị xóa + DM hướng dẫn người dùng.*\n\n`;
    desc += `**Lệnh bị giới hạn:** \`-san\` · \`-san_linh_thu\` · \`-hunt\``;
  } else {
    desc += `**Kênh Săn Linh Thú được phép (${list.length}):**\n`;
    list.forEach((id) => {
      const ch = msg.guild?.channels?.cache?.get(id);
      desc += `▸ ${ch ? `<#${id}>` : `\`${id}\``}\n`;
    });
    desc += `\n**Lệnh bị giới hạn:** \`-san\` · \`-san_linh_thu\` · \`-hunt\``;
    if (enabled) {
      desc += `\n\n✅ *Săn sai kênh → DM riêng + xóa lệnh ngay, server sạch sẽ.*`;
    }
  }
  desc += `\n\n**Lệnh quản lý:**\n\`-san_kenh them [#kênh]\` · \`-san_kenh xoa [#kênh]\` · \`-san_kenh bat\` · \`-san_kenh tat\``;
  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('🦌 Quản Lý Kênh Săn Linh Thú — Tu Tiên')
        .setColor(enabled ? 0x27AE60 : 0x2ECC71)
        .setDescription(desc)
        .setFooter({ text: `Server: ${msg.guild?.name || ''}` }),
    ],
  }).catch(() => {});
});

// ── Lệnh -dv_kenh (Admin: quản lý whitelist kênh Đố Vui) ─────────────────
reg('dv_kenh', ['dv_channel'], async (msg, args) => {
  if (!msg.guild)
    return msg.reply({ embeds: [errE('❌ Lệnh này chỉ dùng được trong server!')] }).catch(() => {});

  const isBotOwner    = msg.author.id === ADMIN_ID;
  const isServerAdmin = !!(msg.member?.permissions?.has?.('ManageGuild') ||
                           msg.member?.permissions?.has?.('Administrator'));
  if (!isBotOwner && !isServerAdmin)
    return msg.reply({ embeds: [errE('❌ Bạn cần quyền **Quản Lý Server** hoặc **Administrator** để dùng lệnh này!')] }).catch(() => {});

  const sub = (args[0] || '').toLowerCase();

  // -dv_kenh them / add
  if (sub === 'them' || sub === 'add' || sub === 'thêm') {
    let targetId   = msg.channel.id;
    let targetName = msg.channel.name;
    if (args[1]) {
      const match = args[1].match(/^<#(\d+)>$/) || args[1].match(/^(\d+)$/);
      if (match) {
        targetId = match[1];
        const ch = msg.guild?.channels?.cache?.get(targetId);
        targetName = ch ? ch.name : targetId;
      }
    }
    await dvChannels.addChannel(msg.guild.id, targetId);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Đã Thêm Kênh Đố Vui')
          .setColor(0xF39C12)
          .setDescription(
            `🎯 Kênh **#${targetName}** (\`${targetId}\`) đã được thêm vào danh sách kênh Đố Vui.\n\n` +
            `🔒 **Whitelist Đố Vui đang BẬT** — lệnh \`-dv\` chỉ hoạt động ở kênh được phép.\n` +
            `📋 Xem danh sách: \`-dv_kenh xem\` · Tắt giới hạn: \`-dv_kenh tat\``
          ),
      ],
    }).catch(() => {});
  }

  // -dv_kenh xoa / remove
  if (sub === 'xoa' || sub === 'remove' || sub === 'xóa') {
    let targetId   = msg.channel.id;
    let targetName = msg.channel.name;
    if (args[1]) {
      const match = args[1].match(/^<#(\d+)>$/) || args[1].match(/^(\d+)$/);
      if (match) {
        targetId = match[1];
        const ch = msg.guild?.channels?.cache?.get(targetId);
        targetName = ch ? ch.name : targetId;
      }
    }
    await dvChannels.removeChannel(msg.guild.id, targetId);
    const remaining = dvChannels.list(msg.guild.id);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🗑️ Đã Xoá Kênh Đố Vui')
          .setColor(0x95A5A6)
          .setDescription(
            `❌ Kênh **#${targetName}** đã được xoá khỏi danh sách Đố Vui.\n\n` +
            (remaining.length === 0
              ? `⚠️ Danh sách rỗng — whitelist Đố Vui đã **tự động tắt** (Đố Vui dùng được ở mọi kênh).`
              : `📋 Còn lại **${remaining.length}** kênh Đố Vui trong whitelist.`)
          ),
      ],
    }).catch(() => {});
  }

  // -dv_kenh tat / off
  if (sub === 'tat' || sub === 'off' || sub === 'tắt') {
    await dvChannels.setEnabled(msg.guild.id, false);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🟢 Whitelist Kênh Đố Vui — TẮT')
          .setColor(0x2ECC71)
          .setDescription(
            `✅ Giới hạn kênh Đố Vui đã **TẮT**.\n` +
            `🌐 Lệnh \`-dv\` hoạt động ở **tất cả kênh** trên server.\n\n` +
            `*(Danh sách vẫn được giữ — bật lại: \`-dv_kenh bat\`)*`
          ),
      ],
    }).catch(() => {});
  }

  // -dv_kenh bat / on
  if (sub === 'bat' || sub === 'on' || sub === 'bật') {
    const list = dvChannels.list(msg.guild.id);
    if (list.length === 0) {
      return msg.reply({
        embeds: [warnE(`⚠️ Danh sách kênh Đố Vui đang rỗng!\nThêm kênh trước: \`-dv_kenh them #kênh\``)],
      }).catch(() => {});
    }
    await dvChannels.setEnabled(msg.guild.id, true);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🎯 Whitelist Kênh Đố Vui — BẬT')
          .setColor(0xF39C12)
          .setDescription(
            `✅ Giới hạn kênh Đố Vui đã **BẬT**.\n` +
            `🎯 Lệnh \`-dv\` chỉ hoạt động ở **${list.length}** kênh được phép.\n\n` +
            `Dùng \`-dv_kenh xem\` để xem danh sách.`
          ),
      ],
    }).catch(() => {});
  }

  // -dv_kenh xem / list (default)
  const list    = dvChannels.list(msg.guild.id);
  const enabled = dvChannels.isEnabled(msg.guild.id);
  let desc = `**Trạng thái:** ${enabled ? `🎯 **BẬT** — Đố Vui chỉ ở kênh được phép` : '🟢 **TẮT** — Đố Vui hoạt động ở tất cả kênh'}\n\n`;
  if (list.length === 0) {
    desc += `📭 *Chưa có kênh nào trong danh sách.*\n\n`;
    desc += `**💡 Hướng dẫn setup:**\n`;
    desc += `1️⃣ Vào kênh muốn chơi Đố Vui → gõ \`-dv_kenh them\`\n`;
    desc += `2️⃣ Lặp lại nếu muốn thêm nhiều kênh\n`;
    desc += `3️⃣ Whitelist tự động BẬT khi thêm kênh đầu tiên\n\n`;
    desc += `*Khi BẬT: Đố Vui ngoài kênh chỉ định sẽ bị xóa + DM hướng dẫn người dùng.*\n\n`;
    desc += `**Lệnh bị giới hạn:** \`-dv\` · \`-do_vui\` · \`-dovui\` · \`-quiz\``;
  } else {
    desc += `**Kênh Đố Vui được phép (${list.length}):**\n`;
    list.forEach((id) => {
      const ch = msg.guild?.channels?.cache?.get(id);
      desc += `▸ ${ch ? `<#${id}>` : `\`${id}\``}\n`;
    });
    desc += `\n**Lệnh bị giới hạn:** \`-dv\` · \`-do_vui\` · \`-dovui\` · \`-quiz\``;
    if (enabled) {
      desc += `\n\n✅ *Đố Vui sai kênh → DM riêng + xóa lệnh ngay, server sạch sẽ.*`;
    }
  }
  desc += `\n\n**Lệnh quản lý:**\n\`-dv_kenh them [#kênh]\` · \`-dv_kenh xoa [#kênh]\` · \`-dv_kenh bat\` · \`-dv_kenh tat\``;
  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('🎯 Quản Lý Kênh Đố Vui — Tu Tiên')
        .setColor(enabled ? 0xF39C12 : 0x2ECC71)
        .setDescription(desc)
        .setFooter({ text: `Server: ${msg.guild?.name || ''}` }),
    ],
  }).catch(() => {});
});

reg('bao_tri', ['maintenance', 'mt'], async (msg, args) => {
  if (msg.author.id !== ADMIN_ID)
    return msg.reply({ embeds: [errE('❌ Chỉ Admin mới dùng được lệnh này!')] }).catch(() => {});

  const sub = (args[0] || '').toLowerCase();

  if (sub === 'bat' || sub === 'on') {
    const reason = args.slice(1).join(' ');
    await maintenance.enable(reason);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('🔧 Chế Độ Bảo Trì — BẬT')
          .setColor(0xF39C12)
          .setDescription(
            `✅ Bot đã **vào chế độ bảo trì**!\n\n` +
            (reason ? `📋 Lý do: **${reason}**\n\n` : '') +
            `👑 Chỉ Admin có thể dùng bot.\n` +
            `🔓 Tắt bảo trì: \`-bao_tri tat\``
          ),
      ],
    }).catch(() => {});
  }

  if (sub === 'tat' || sub === 'off') {
    await maintenance.disable();
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Chế Độ Bảo Trì — TẮT')
          .setColor(0x2ECC71)
          .setDescription('🎉 Bot đã hoạt động trở lại bình thường!\nTất cả người dùng có thể sử dụng bot.'),
      ],
    }).catch(() => {});
  }

  const status = maintenance.isOn();
  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('🔧 Quản Lý Bảo Trì Bot')
        .setColor(status ? 0xF39C12 : 0x2ECC71)
        .setDescription(
          `**Trạng thái hiện tại:** ${status ? '🔴 ĐANG BẢO TRÌ' : '🟢 Hoạt động bình thường'}\n` +
          (status && maintenance.getReason() ? `📋 Lý do: ${maintenance.getReason()}\n` : '') +
          `\n\`-bao_tri bat [lý do]\` — Bật bảo trì\n\`-bao_tri tat\` — Tắt bảo trì`
        ),
    ],
  }).catch(() => {});
});

reg('antiraid', ['raid', 'chongraid'], async (msg, args) => {
  const isOwner      = msg.author.id === ADMIN_ID;
  const isGuildAdmin = msg.member?.permissions?.has('Administrator');
  const sub          = (args[0] || '').toLowerCase();

  // ── setlog / clearlog — cần quyền Admin server hoặc chủ bot ─────────────
  if (sub === 'setlog') {
    if (!isOwner && !isGuildAdmin)
      return msg.reply({ embeds: [errE('❌ Cần quyền **Administrator** của server!')] }).catch(() => {});
    if (!msg.guildId)
      return msg.reply({ embeds: [errE('❌ Lệnh này chỉ dùng được trong server!')] }).catch(() => {});

    // Lấy channel từ mention (#kênh) hoặc ID, fallback về kênh hiện tại
    let targetId   = msg.channel.id;
    let targetName = msg.channel.name;
    if (args[1]) {
      const m = args[1].match(/^<#(\d+)>$/) || args[1].match(/^(\d+)$/);
      if (m) {
        targetId   = m[1];
        const ch   = msg.guild?.channels?.cache?.get(targetId);
        targetName = ch ? ch.name : targetId;
      }
    }
    await antiraidLog.setLogChannel(msg.guildId, targetId);
    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('✅ Đã Cài Kênh Log Anti-Raid')
          .setColor(0x2ECC71)
          .setDescription(
            `📢 Cảnh báo raid sẽ được gửi vào <#${targetId}> (**#${targetName}**).\n\n` +
            `**Các loại cảnh báo sẽ nhận:**\n` +
            `🚨 Command flood — nhiều acc gửi lệnh dồn dập\n` +
            `🚨 Join raid — nhiều acc join cùng lúc\n` +
            `🚨 Young-account burst — nhóm acc mới tạo join dồn dập (botfarm)\n` +
            `${CE('warn_icon','⚠️')} Mention spam — user mass-ping @everyone hoặc nhiều người\n\n` +
            `Để xoá: \`-antiraid clearlog\``,
          ),
      ],
    }).catch(() => {});
  }

  if (sub === 'clearlog') {
    if (!isOwner && !isGuildAdmin)
      return msg.reply({ embeds: [errE('❌ Cần quyền **Administrator** của server!')] }).catch(() => {});
    if (!msg.guildId)
      return msg.reply({ embeds: [errE('❌ Lệnh này chỉ dùng được trong server!')] }).catch(() => {});

    await antiraidLog.clearLogChannel(msg.guildId);
    return msg.reply({
      embeds: [okE('✅ Đã xoá kênh log anti-raid.\nCảnh báo sẽ không còn gửi vào server này nữa.')],
    }).catch(() => {});
  }

  // ── Các lệnh còn lại chỉ dành cho chủ bot ────────────────────────────────
  if (!isOwner)
    return msg.reply({
      embeds: [errE(
        '❌ Chỉ chủ bot mới dùng được lệnh này!\n' +
        '*(Admin server có thể dùng: `-antiraid setlog #kênh`, `-antiraid clearlog`)*',
      )],
    }).catch(() => {});

  if (sub === 'mokhoa' || sub === 'unlock') {
    const target = args[1];
    if (!target)
      return msg.reply({ embeds: [errE('Dùng: `-antiraid mokhoa <guild_id|user_id>`')] }).catch(() => {});
    const g = antiraid.unlockGuild(target);
    const u = antiraid.unlockUser(target);
    return msg.reply({
      embeds: [okE(
        g || u
          ? `✅ Đã mở khóa \`${target}\`${g ? ' (server)' : ''}${u ? ' (user)' : ''}.`
          : `${CE('warn_icon','⚠️')} \`${target}\` hiện không bị khóa.`,
      )],
    }).catch(() => {});
  }

  // ── status (default) ─────────────────────────────────────────────────────
  const c          = antiraid.getConfig();
  const logChannel = msg.guildId ? antiraidLog.getLogChannel(msg.guildId) : null;

  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('🛡️ Anti-Raid — Trạng Thái')
        .setColor(0x3498DB)
        .addFields(
          {
            name: '⚡ 1. Command Burst (server)',
            value:
              `> ${c.guildBurstCommands} lệnh / ${c.guildBurstUsers}+ acc trong ${c.guildWindowMs / 1000}s\n` +
              `→ Khóa lệnh toàn server **${c.guildLockMs / 1000}s**`,
            inline: false,
          },
          {
            name: '🔒 2. Spam Escalation (user)',
            value:
              `${c.violationThreshold} lần vi phạm cooldown / ${c.violationWindowMs / 1000}s\n` +
              `→ Khóa lệnh cá nhân **${c.lockoutMs / 60_000} phút**`,
            inline: false,
          },
          {
            name: '🔞 3. New-Account Guard',
            value: `Acc < **${c.minAccountAgeDays} ngày** tuổi bị chặn giftcode & đấu giá`,
            inline: false,
          },
          {
            name: '🚪 4. Join-Burst Detector',
            value:
              `${c.joinBurstCount}+ acc join trong **${c.joinWindowMs / 1000}s**\n` +
              `→ ${c.autoTimeoutOnJoinRaid
                ? `Timeout **${c.joinTimeoutMs / 60_000} phút**` +
                  (c.kickFallbackOnJoinRaid ? ' (kick fallback nếu thiếu quyền Timeout)' : '')
                : `${CE('warn_icon','⚠️')} Chỉ cảnh báo — auto-timeout TẮT`
              }`,
            inline: false,
          },
          {
            name: '🤖 5. Young-Account Burst (Botfarm)',
            value:
              `${c.youngAccountBurstCount}+ acc mới tạo (< ${c.youngAccountAgeDays} ngày) join trong ${c.joinWindowMs / 1000}s\n` +
              `→ Trigger ngay cả khi tổng số join chưa đạt ngưỡng`,
            inline: false,
          },
          {
            name: '📣 6. Mention Spam',
            value:
              `${c.mentionSpamTriggerCount}+ tin nhắn có ≥${c.mentionSpamPerMsg} mention trong ${c.mentionSpamWindowMs / 1000}s\n` +
              `→ Khóa lệnh **${c.mentionSpamLockoutMs / 60_000} phút** + Discord timeout`,
            inline: false,
          },
          {
            name: '📢 Kênh Log Server Này',
            value: logChannel ? `<#${logChannel}>` : '*(chưa cài — dùng `-antiraid setlog #kênh`)*',
            inline: false,
          },
        )
        .setFooter({ text: 'Chỉnh threshold qua env ANTIRAID_* | -antiraid mokhoa <id> để mở khóa' }),
    ],
  }).catch(() => {});
});

reg('thong_ke', ['adminstats', 'tk'], async (msg) => {
  if (msg.author.id !== ADMIN_ID)
    return msg.reply({ embeds: [errE('❌ Chỉ Admin mới dùng được lệnh này!')] }).catch(() => {});

  try {
    const [totalRes, active24hRes, active7dRes, topLtRes, totalLtRes, recentPayRes, topPvpRes, topTowerRes] =
      await Promise.all([
        db('SELECT COUNT(*) FROM players'),
        db("SELECT COUNT(*) FROM players WHERE last_active > NOW() - INTERVAL '24 hours'"),
        db("SELECT COUNT(*) FROM players WHERE last_active > NOW() - INTERVAL '7 days'"),
        db('SELECT username, linh_thach FROM players ORDER BY linh_thach DESC LIMIT 5'),
        db('SELECT SUM(linh_thach) FROM players'),
        db("SELECT username, goi_id, amount, paid_at FROM pending_payments WHERE status='paid' ORDER BY paid_at DESC LIMIT 5"),
        db('SELECT username, pvp_wins FROM players ORDER BY pvp_wins DESC LIMIT 3'),
        db('SELECT username, thap_tang FROM players ORDER BY thap_tang DESC LIMIT 3'),
      ]);

    const total     = Number(totalRes.rows[0].count);
    const active24h = Number(active24hRes.rows[0].count);
    const active7d  = Number(active7dRes.rows[0].count);
    const totalLt   = Number(totalLtRes.rows[0].sum || 0);
    const pvpNow    = Math.floor(COMBAT_SESSIONS.size / 2);

    let desc = `${SEP2}\n`;
    desc += `👥 **Người chơi:** ${fmt(total)} tổng · ${fmt(active24h)} hôm nay · ${fmt(active7d)} tuần này\n`;
    desc += `${CE('tult','💠')} **Tổng Linh Thạch:** ${fmt(totalLt)}\n`;
    desc += `${CE('tuatk','⚔️')} **Trận PvP đang diễn ra:** ${pvpNow}\n`;
    desc += `${SEP}\n`;

    desc += `**💰 Top Linh Thạch:**\n`;
    topLtRes.rows.forEach((r, i) => {
      desc += `${i + 1}. **${r.username}** — ${fmt(r.linh_thach)} ${CE('tult','💠')}\n`;
    });

    desc += `${SEP}\n**${CE('tuatk','⚔️')} Top PvP Wins:**\n`;
    topPvpRes.rows.forEach((r, i) => {
      desc += `${i + 1}. **${r.username}** — ${r.pvp_wins} trận\n`;
    });

    desc += `${SEP}\n**🗼 Top Tháp Thử Luyện:**\n`;
    topTowerRes.rows.forEach((r, i) => {
      desc += `${i + 1}. **${r.username}** — Tầng ${r.thap_tang}\n`;
    });

    if (recentPayRes.rows.length > 0) {
      desc += `${SEP}\n**💳 Thanh Toán Gần Nhất:**\n`;
      recentPayRes.rows.forEach((r) => {
        const d = new Date(r.paid_at);
        const dateStr = `${d.getDate()}/${d.getMonth() + 1} ${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
        desc += `▸ **${r.username}** — ${r.goi_id} · ${fmt(r.amount)}đ *(${dateStr})*\n`;
      });
    }

    return msg.reply({
      embeds: [
        new EmbedBuilder()
          .setTitle('📊 Thống Kê Bot Tu Tiên')
          .setColor(0x5865F2)
          .setDescription(desc)
          .setTimestamp()
          .setFooter({ text: `Admin: ${msg.author.username} · ${new Date().toLocaleDateString('vi-VN')}` }),
      ],
    });
  } catch (e) {
    return msg.reply({ embeds: [errE(`Lỗi truy vấn: ${e.message}`)] });
  }
});

// ── -emoji_debug (Admin: xem trạng thái emoji + tự re-init) ─────────────
reg('emoji_debug', ['edb', 'emoji_status'], async (msg, args) => {
  if (msg.author.id !== ADMIN_ID)
    return msg.reply({ embeds: [errE('❌ Chỉ Admin!')] }).catch(() => {});

  const sub = (args[0] || 'xem').toLowerCase();

  // -emoji_debug reinit → force re-init emoji
  if (sub === 'reinit' || sub === 'reload') {
    await msg.reply({ embeds: [warnE('🔄 Đang re-init emoji... (có thể mất vài phút)')] });
    try {
      await initCustomEmoji(msg.client);
      const loaded = Object.keys(CUSTOM_EMOJI).length;
      return msg.channel.send({ embeds: [okE(`✅ Re-init xong! **${loaded}** emoji đã load.`)] });
    } catch (e) {
      return msg.channel.send({ embeds: [errE(`❌ Re-init lỗi: ${e.message}`)] });
    }
  }

  // -emoji_debug xem → xem trạng thái
  const total = Object.keys(CUSTOM_EMOJI).length;
  const KEY_EMOJIS = [
    'tult','tult_trung','tult_cao',
    'tuatk','tudef','tuhp','tutv',
    'tia_set','tucn','cd_timer','tult',
    'tam_nhan','tam_trung','tam_ma','tam_ac',
  ];

  const lines = KEY_EMOJIS.map(k => {
    const val = CUSTOM_EMOJI[k];
    if (val) return `✅ \`${k}\` → ${val}`;
    return `❌ \`${k}\` → **CHƯA LOAD** (dùng fallback Unicode)`;
  });

  // Thử gọi Discord API để check kết nối
  let apiStatus = '';
  try {
    const token = msg.client.token;
    const appId = msg.client.application?.id;
    if (!token || !appId) {
      apiStatus = `❌ token=${token ? 'có' : 'KHÔNG'} | appId=${appId ?? 'KHÔNG'}`;
    } else {
      const res = await fetch(`https://discord.com/api/v10/applications/${appId}/emojis`, {
        headers: { Authorization: `Bot ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      const count = (data.items ?? data ?? []).length;
      apiStatus = res.ok
        ? `✅ API OK — Discord có **${count}** emoji đã upload`
        : `❌ API lỗi HTTP ${res.status}: ${JSON.stringify(data).slice(0, 100)}`;
    }
  } catch (e) {
    apiStatus = `❌ fetch lỗi: ${e.message}`;
  }

  return msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('🔍 Emoji Debug')
        .setColor(total > 0 ? 0x00cc88 : 0xe74c3c)
        .setDescription(
          `**Tổng emoji đã load vào CUSTOM_EMOJI:** ${total}\n\n` +
          `**Discord API:**\n${apiStatus}\n\n` +
          `**Key emojis:**\n${lines.join('\n')}\n\n` +
          `Dùng \`-emoji_debug reinit\` để force reload lại toàn bộ emoji.`
        ),
    ],
  });
});

module.exports = { HD_GROUPS };
