'use strict';
const { EmbedBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { reg } = require('../core/registry');
const { CUSTOM_EMOJI } = require('../systems/emoji');

const GROUP_NAMES = {
  'lc_': 'Linh Căn', 'hm_': 'Huyết Mạch', 'tult': 'Tiên Thiên',
  'tuatk': 'Stat', 'tudef': 'Stat', 'tuhp': 'Stat', 'tutv': 'Stat',
  'tucn': 'Stat', 'tukv': 'Stat', 'tunt': 'Stat', 'tutm': 'Stat', 'tustar': 'Stat',
  'linh_tu_dan': 'Đan Dược', 'cuu_pham_dan': 'Đan Dược', 'tu_khi_dan': 'Đan Dược',
  'khai_ngo_dan': 'Đan Dược', 'phach_nguyen_dan': 'Đan Dược', 'tuyet_tinh_dan': 'Đan Dược',
  'thai_thanh_dan': 'Đan Dược', 'van_linh_dan': 'Đan Dược', 'nguyen_than_dan': 'Đan Dược',
  'thien_de_dan': 'Đan Dược', 'pha_canh_dan': 'Đan Dược', 'hoi_xuan_dan': 'Đan Dược',
  'dan_pham_': 'Đan Phẩm', 'lt_linh': 'Linh Thảo', 'lt_hoa': 'Linh Thảo',
  'lt_long': 'Linh Thảo', 'lt_tuyet': 'Linh Thảo', 'lt_thien_c': 'Linh Thảo',
  'lt_thien_n': 'Linh Thảo', 'lt_vong': 'Linh Thảo', 'lt_huyet_m': 'Linh Thảo',
  'lt_doc': 'Linh Thú', 'lt_hoa_h': 'Linh Thú', 'lt_bang_h': 'Linh Thú',
  'lt_dia_ng': 'Linh Thú', 'lt_loi': 'Linh Thú', 'lt_dia_l': 'Linh Thú',
  'lt_phong': 'Linh Thú', 'lt_am': 'Linh Thú', 'lt_huyet_s': 'Linh Thú',
  'lt_bang_p': 'Linh Thú', 'lt_dia_ng': 'Linh Thú', 'lt_kim': 'Linh Thú',
  'lt_cuu': 'Linh Thú', 'lt_thanh_l': 'Linh Thú', 'lt_bach': 'Linh Thú',
  'lt_huyen_v': 'Linh Thú', 'lt_chu': 'Linh Thú', 'lt_hon_d': 'Linh Thú',
  'lt_thai': 'Linh Thú', 'lt_tien_l': 'Linh Thú',
  'cp_': 'Công Pháp', 'bp_': 'Bí Pháp', 'ng_': 'Ngọc Giản',
  'vk_': 'Vũ Khí', 'bb_': 'Bảo Bối', 'vp_': 'Vật Phẩm',
  'dt_': 'Đạo Tử', 'nt_': 'Ngộ Tính', 'nq_': 'Nhân Quả',
  'pl_': 'Phù Lục', 'ptv_': 'Phong Thủy', 'dp_': 'Động Phủ',
  'tt_': 'Truyền Thừa', 'tm_': 'Tông Môn', 'tmcb_': 'Tông Môn Cấp Bậc',
  'kv_': 'Khoáng Vật',
};

function getGroup(key) {
  for (const [prefix, name] of Object.entries(GROUP_NAMES)) {
    if (key.startsWith(prefix)) return name;
  }
  return 'Khác';
}

function isCustom(val) {
  return typeof val === 'string' && (val.startsWith('<:') || val.startsWith('<a:'));
}

reg(
  'emoji_status',
  ['emojistatus', 'es', 'estatus'],
  async (msg) => {
    const allKeys = Object.keys(CUSTOM_EMOJI);
    const total = allKeys.length;
    const uploaded = allKeys.filter(k => isCustom(CUSTOM_EMOJI[k])).length;
    const unicode = total - uploaded;

    // Group breakdown
    const groups = {};
    for (const key of allKeys) {
      const g = getGroup(key);
      if (!groups[g]) groups[g] = { total: 0, uploaded: 0 };
      groups[g].total++;
      if (isCustom(CUSTOM_EMOJI[key])) groups[g].uploaded++;
    }

    const pct = total > 0 ? Math.round((uploaded / total) * 100) : 0;
    const bar = buildBar(pct);

    const lines = Object.entries(groups)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, g]) => {
        const st = g.uploaded === g.total
          ? '✅' : g.uploaded === 0 ? '❌' : '🔄';
        return `${st} **${name}**: ${g.uploaded}/${g.total}`;
      });

    const embed = new EmbedBuilder()
      .setTitle('📊 Trạng Thái Emoji Hệ Thống')
      .setColor(uploaded === total ? 0x00cc44 : uploaded === 0 ? 0xcc0000 : 0xf5a623)
      .setDescription(
        `**Tổng cộng:** ${total} emoji\n` +
        `✅ Đã upload Discord: **${uploaded}**\n` +
        `⏳ Chưa upload (unicode): **${unicode}**\n` +
        `\n${bar} **${pct}%**\n` +
        `\n📦 **Chi tiết theo nhóm:**\n${lines.join('\n')}`
      )
      .setFooter({ text: 'Emoji được upload tự động khi bot khởi động • -xem_emoji để xem đầy đủ' })
      .setTimestamp();

    await msg.reply({ embeds: [embed] });
  }
);

function buildBar(pct) {
  const filled = Math.round(pct / 10);
  return '█'.repeat(filled) + '░'.repeat(10 - filled);
}
