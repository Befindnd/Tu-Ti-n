'use strict';
const { EmbedBuilder } = require('discord.js');
const { CUSTOM_EMOJI, initCustomEmoji } = require('../systems/emoji');
const { reg } = require('../core/registry');

const ADMIN_ID = process.env.ADMIN_ID || '';

reg('emoji_debug', ['emojidebug', 'edebug'], async (msg, _args, client) => {
  // Chỉ ADMIN_ID hoặc người có quyền Administrator trong server mới dùng được
  const isAdmin = (ADMIN_ID && msg.author.id === ADMIN_ID) || msg.member?.permissions?.has('Administrator');
  if (!isAdmin) return;

  const lines = [];

  // 1. Kiểm tra client.application
  if (!client.application) {
    lines.push('❌ `client.application` = null → bot chưa login đúng');
  } else {
    lines.push(`✅ client.application.id = \`${client.application.id}\``);
  }

  // 2. Kiểm tra Application Emojis manager có tồn tại không (discord.js ≥14.15.0)
  if (!client.application?.emojis) {
    lines.push('❌ `client.application.emojis` không tồn tại');
    lines.push('   → discord.js quá cũ, cần nâng lên **≥14.15.0**');
    try {
      const v = require('discord.js').version;
      lines.push(`   → Version hiện tại: \`${v}\``);
    } catch {}
  } else {
    lines.push('✅ Application Emojis manager có mặt');
    try {
      await client.application.emojis.fetch();
      const count = client.application.emojis.cache.size;
      lines.push(`✅ Discord emoji store: **${count}** emoji đã upload lên Discord`);
      if (count === 0) {
        lines.push(`   ${CE('warn_icon','⚠️')} Chưa có emoji nào được upload — cần chạy \`-emoji_reload\``);
      }
    } catch (err) {
      lines.push(`❌ Fetch emoji lỗi: \`${err.message}\``);
      if (err.status === 401 || err.status === 403) {
        lines.push('   → DISCORD_TOKEN không hợp lệ hoặc thiếu quyền');
      }
    }
  }

  // 3. Kiểm tra CUSTOM_EMOJI hiện tại trong bộ nhớ bot
  const sampleKeys = ['lc_kim', 'vp_da_linh_thu', 'linh_tu_dan', 'bp_hoa_long_phong', 'lt_doc_lang'];
  lines.push('');
  lines.push('**Mẫu CUSTOM_EMOJI trong bộ nhớ:**');
  for (const k of sampleKeys) {
    const v = CUSTOM_EMOJI[k];
    const isCustom = v && v.startsWith('<:');
    lines.push(`${isCustom ? '✅' : CE('warn_icon','⚠️')} \`${k}\` = \`${v ?? '(undefined)'}\``);
  }

  // 4. Thống kê
  const allVals = Object.values(CUSTOM_EMOJI);
  const customCount = allVals.filter(v => v && v.startsWith('<:')).length;
  const unicodeCount = allVals.length - customCount;
  lines.push('');
  lines.push(`**Tổng:** ${customCount} custom ✅ | ${unicodeCount} Unicode fallback ${CE('warn_icon','⚠️')}`);

  // 5. Gợi ý
  if (customCount === 0) {
    lines.push('');
    lines.push('**🔧 Thử fix:**');
    if (!client.application?.emojis) {
      lines.push('→ Cập nhật `"discord.js": "^14.16.3"` trong package.json trên Railway');
    } else {
      lines.push('→ Gõ `-emoji_reload` để upload lại toàn bộ emoji ngay bây giờ');
    }
  }

  await msg.reply({
    embeds: [
      new EmbedBuilder()
        .setTitle('🔍 Emoji Debug')
        .setDescription(lines.join('\n'))
        .setColor(customCount > 0 ? 0x00ff00 : 0xff4444)
        .setTimestamp(),
    ],
  });
});

// Chỉ admin mới dùng được lệnh reload (tốn thời gian + rate limit Discord)
reg('emoji_reload', ['ereload'], async (msg, _args, client) => {
  // Fail-closed: block khi ADMIN_ID chưa set thay vì cho qua
  if (!ADMIN_ID || msg.author.id !== ADMIN_ID) return;

  const sent = await msg.reply('⏳ Đang upload lại toàn bộ emoji... (mất khoảng 3–5 phút)');

  try {
    process.env.EMOJI_FORCE_REFRESH = '1';
    await initCustomEmoji(client);
    process.env.EMOJI_FORCE_REFRESH = '0';

    const allVals = Object.values(CUSTOM_EMOJI);
    const ok = allVals.filter(v => v && v.startsWith('<:')).length;
    await sent.edit(`✅ Xong! **${ok}/${allVals.length}** emoji upload thành công.`);
  } catch (err) {
    process.env.EMOJI_FORCE_REFRESH = '0';
    await sent.edit(`❌ Lỗi khi upload: \`${err.message}\``);
  }
});
