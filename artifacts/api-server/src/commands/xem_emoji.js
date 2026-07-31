'use strict';
const {
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
} = require('discord.js');
const { CUSTOM_EMOJI, CE } = require('../systems/emoji');
const { reg } = require('../core/registry');

// ── Danh sách các nhóm emoji ──────────────────────────────────────────────
const GROUPS = [
  {
    label: '🌿 Linh Căn', color: 0x2ecc71,
    keys: ['lc_kim','lc_moc','lc_thuy','lc_hoa','lc_tho','lc_phong','lc_thunder','lc_duong','lc_am','lc_hon_don','lc_thien','lc_vo_cuc'],
    names: ['Kim','Mộc','Thủy','Hỏa','Thổ','Phong','Lôi','Dương','Âm','Hỗn Độn','Thiên','Vô Cực'],
  },
  {
    label: '🩸 Huyết Mạch', color: 0xe74c3c,
    keys: ['tult','hm_pham','hm_linh','hm_than','hm_thanh','hm_tien','hm_tu_la','hm_co_than','hm_hon_don','hm_thien_long'],
    names: ['Linh Thạch','Phàm Huyết','Linh (Bạch Hổ)','Thần (Chu Tước)','Thánh (Huyền Vũ)','Tiên (Thanh Long)','Tứ La','Cô Thân','Hỗn Độn Chi Thể','Thiên Long'],
  },
  {
    label: '⚗️ Đan Dược', color: 0x9b59b6,
    keys: ['linh_tu_dan','linh_tu_dan_sp','tu_khi_dan','khai_ngo_dan','phach_nguyen_dan','tuyet_tinh_dan','thai_thanh_dan','van_linh_dan','cuu_pham_dan','cuu_pham_dan_sp','nguyen_than_dan','thien_de_dan','pha_canh_dan','hoi_xuan_dan'],
    names: ['Linh Tụ Đan','Linh Tụ Đan SP','Tu Khí Đan','Khai Ngộ Đan','Phách Nguyên Đan','Tuyết Tinh Đan','Thái Thanh Đan','Vạn Linh Đan','Cửu Phẩm Đan','Cửu Phẩm Đan SP','Nguyên Thần Đan','Thiên Đế Đan','Phá Cảnh Đan','Hồi Xuân Đan'],
  },
  {
    label: '💊 Đan Phẩm', color: 0x8e44ad,
    keys: ['dan_pham_ha','dan_pham_trung','dan_pham_thuong','dan_pham_cuc'],
    names: ['Hạ Phẩm','Trung Phẩm','Thượng Phẩm','Cực Phẩm'],
  },
  {
    label: '🌿 Linh Thảo', color: 0x27ae60,
    keys: ['lt_linh_chi','lt_hoa_linh','lt_long_huyet','lt_tuyet','lt_thien_can','lt_thien_nhan_qua','lt_vong_hon_hoa','lt_huyet_mach_thach'],
    names: ['Linh Chi (Tư Hư Thảo)','Hoa Linh (Bích Hà Liên)','Long Huyết (Long Tinh Thảo)','Tuyết (Tuyết Linh Thảo)','Thiên Can','Thiên Nhẫn Quả','Vong Hồn Hoa','Huyết Mạch Thạch'],
  },
  {
    label: '📜 Công Pháp', color: 0x3498db,
    keys: ['cp_thap_huyen','cp_ngu_hanh','cp_thien_long','cp_van_thuy','cp_am_duong','cp_ma_dao','cp_diet_tien','cp_hon_don_kinh','cp_thanh_lien'],
    names: ['Thập Huyền','Ngũ Hành','Thiên Long','Vạn Thủy','Âm Dương','Ma Đao','Diệt Tiên','Hỗn Độn Kinh','Thanh Liên'],
  },
  {
    label: '🔥 Bí Pháp', color: 0xe67e22,
    keys: ['bp_hoa_long_phong','bp_bang_vu','bp_than_loi','bp_kim_than','bp_hoi_phuc','bp_tam_hoa','bp_huyet_sat','bp_thien_ha_de_nhat_kiem','bp_thien_dia_lo','bp_van_kiem_quy_tong','bp_hong_mong_chi_the'],
    names: ['Hỏa Long Phong','Băng Vũ','Thần Lôi','Kim Thân','Hồi Phục','Tam Hoa','Huyết Sát','Thiên Hạ Đệ Nhất Kiếm','Thiên Địa Lò','Vạn Kiếm Quy Tông','Hồng Mông Chi Thể'],
  },
  {
    label: '💎 Ngọc Giản', color: 0x1abc9c,
    keys: ['ng_ngung_khi_thuat','ng_linh_giac','ng_the_phach_cuong_hoa','ng_khinh_cong','ng_linh_khi_ho_the','ng_kim_chung_trao','ng_thiet_bo_sam','ng_thien_phuc','ng_tu_luyen','ng_hoi_xuan','ng_cong_thu_ven_toan'],
    names: ['Ngưng Khí Thuật','Linh Giác','Thể Phách Cường Hóa','Khinh Công','Linh Khí Hộ Thể','Kim Chung Trạo','Thiết Bộ Sam','Thiên Phúc','Tu Luyện','Hồi Xuân','Công Thủ Vẹn Toàn'],
  },
  {
    label: '🐉 Linh Thú', color: 0xc0392b,
    keys: ['lt_doc_lang','lt_hoa_ho','lt_bang_hung','lt_dia_nga','lt_loi_bao','lt_dia_long','lt_phong_ung','lt_am_tac','lt_huyet_su','lt_bang_phuong','lt_dia_nguc_quy','lt_kim_tuoc','lt_cuu_vi_ho','lt_thanh_long','lt_bach_ho','lt_huyen_vu','lt_chu_tuoc','lt_hon_don_thu','lt_thai_co_long','lt_tien_linh'],
    names: ['Độc Lang','Hỏa Hổ','Băng Hùng','Địa Nga','Lôi Báo','Địa Long','Phong Ưng','Ám Tắc','Huyết Sư','Băng Phụng','Địa Ngục Quỷ','Kim Tước','Cửu Vĩ Hồ','Thanh Long','Bạch Hổ','Huyền Vũ','Chu Tước','Hỗn Độn Thú','Thái Cổ Long','Tiên Linh'],
  },
  {
    label: '⚔️ Vũ Khí', color: 0x7f8c8d,
    keys: ['vk_kiem_go','vk_kiem_sat','vk_kiem_dong','vk_linh_kiem','vk_linh_thuong','vk_nhu_y_con','vk_tien_kiem','vk_tu_tinh_kiem','vk_than_kiem','vk_than_cung','vk_cuu_long_kich','vk_hong_mong_kiem','vk_nhat_luan_kiem','vk_tuyet_tinh_thuong','vk_am_ma_kiem'],
    names: ['Kiếm Gỗ','Kiếm Sắt','Kiếm Đồng','Linh Kiếm','Linh Thương','Như Ý Côn','Tiên Kiếm','Tứ Tình Kiếm','Thần Kiếm','Thần Cung','Cửu Long Kích','Hồng Mông Kiếm','Nhật Luân Kiếm','Tuyết Tinh Thương','Ám Ma Kiếm'],
  },
  {
    label: '🎒 Bảo Bối', color: 0xd35400,
    keys: ['bb_linh_thai','bb_van_bao_tui','bb_tui_da_thu','bb_loi_hoa_cau','bb_ho_than_kinh','bb_tien_phu','bb_kien_long_giap','bb_am_duong_bai','bb_hong_mong_chu','bb_thien_long_giap','bb_bat_qua_kinh','bb_vo_bien_nhan','bb_linh_thu_ho_tam','bb_da_thu_sat_khi','bb_tinh_thach_hoi_linh','bb_huyen_long_tam_chau','bb_than_thu_tam_ngoc','bb_linh_hon_am_khi'],
    names: ['Linh Thai','Vạn Bảo Túi','Túi Da Thú','Lôi Hỏa Cầu','Hộ Thân Kính','Tiên Phủ','Kiên Long Giáp','Âm Dương Bài','Hồng Mông Chú','Thiên Long Giáp','Bát Quái Kính','Vô Biên Nhẫn','Linh Thú Hộ Tâm','Đả Thú Sát Khí','Tinh Thạch Hồi Linh','Huyền Long Tam Châu','Thần Thú Tâm Ngọc','Linh Hồn Ám Khí'],
  },
  {
    label: '🏯 Nghề', color: 0x16a085,
    keys: ['ng_luyen_dan','ng_phi_khi_su','ng_phu_luc_su','ng_am_ve','ng_phong_thuy_su','ng_duoc_su','ng_ngo_dao_su'],
    names: ['Luyện Đan','Phi Khí Sư','Phù Lục Sư','Ám Vệ','Phong Thủy Sư','Dược Sư','Ngộ Đạo Sư'],
  },
  {
    label: `${CE("ft_tu_luyen","🧘")} Đạo Tu`, color: 0x8e44ad,
    keys: ['dt_kiem_tu','dt_the_tu','dt_phap_tu','dt_ma_tu','dt_yeu_tu','dt_dan_tu','dt_khi_tu','dt_tran_tu'],
    names: ['Kiếm Tu','Thể Tu','Pháp Tu','Ma Tu','Yêu Tu','Đan Tu','Khí Tu','Trận Tu'],
  },
  {
    label: '✨ Ngộ Tính', color: 0xf39c12,
    keys: ['nt_pham','nt_linh','nt_dia','nt_thien','nt_tien'],
    names: ['Phàm','Linh','Địa','Thiên','Tiên'],
  },
  {
    label: '⚖️ Nhân Quả', color: 0x2c3e50,
    keys: ['nq_vien_man','nq_cong_duc','nq_tieu','nq_trung','nq_nghiep','nq_sau','nq_chuong'],
    names: ['Viên Mãn','Công Đức','Tiểu','Trung','Nghiệp','Sâu','Chướng'],
  },
  {
    label: '📋 Phù Lục', color: 0x27ae60,
    keys: ['pl_ho_than','pl_sat_phong','pl_linh_hoi','pl_tu_toc','pl_khai_ngo','pl_thien_dia','pl_pha_canh'],
    names: ['Hộ Thân','Sát Phong','Linh Hồi','Tốc Tốc','Khai Ngộ','Thiên Địa','Phá Cảnh'],
  },
  {
    label: '🌟 Phong Thủy Vận', color: 0xf1c40f,
    keys: ['ptv_dai_cat','ptv_tieu_cat','ptv_binh','ptv_tieu_hung','ptv_dai_hung'],
    names: ['Đại Cát','Tiểu Cát','Bình','Tiểu Hung','Đại Hung'],
  },
  {
    label: '🏔️ Động Phủ', color: 0x34495e,
    keys: ['dp_linh_son','dp_hoa_van','dp_bang_phong','dp_tien_canh'],
    names: ['Linh Sơn','Hỏa Vân','Băng Phong','Tiên Cảnh'],
  },
  {
    label: '📜 Truyền Thừa', color: 0xe74c3c,
    keys: ['tt_thien_long','tt_van_thuy','tt_ma_dao','tt_kiem_dao','tt_hon_don'],
    names: ['Thiên Long','Vạn Thủy','Ma Đao','Kiếm Đạo','Hỗn Độn'],
  },
  {
    label: '🏯 Tông Môn', color: 0x9b59b6,
    keys: ['tm_thanh_van','tm_huyen_thien','tm_van_kiem','tm_ma_than'],
    names: ['Thanh Vân','Huyền Thiên','Vạn Kiếm','Ma Thần'],
  },
  {
    label: '🎖️ Cấp Bậc Tông', color: 0x8e44ad,
    keys: ['tmcb_ngoai_mon','tmcb_noi_mon','tmcb_chan_truyen','tmcb_thanh_tu','tmcb_tong_chu'],
    names: ['Ngoại Môn','Nội Môn','Chân Truyền','Thanh Tú','Tông Chủ'],
  },
  {
    label: '⚙️ Khoáng Vật', color: 0x95a5a6,
    keys: ['kv_sat_tinh','kv_huyen_thiet','kv_tinh_cang','kv_thien_tiet','kv_vong_tinh'],
    names: ['Sắt Tinh','Huyền Thiết','Tinh Cang','Thiên Tiết','Vong Tinh'],
  },
  {
    label: '🟫 Vật Phẩm Linh Thú', color: 0xa04000,
    keys: ['vp_da_linh_thu','vp_long_linh_thu','vp_rang_vuot','vp_xuong_linh_thu','vp_tinh_thach_nho','vp_nanh_linh_thu','vp_tinh_thach_trung','vp_xuong_huyen_linh','vp_vay_linh_long','vp_tinh_thach_than','vp_tim_than_thu','vp_linh_hon_than_thu'],
    names: ['Da Linh Thú','Long Linh Thú','Răng Vuốt','Xương Linh Thú','Tinh Thạch Nhỏ','Nanh Linh Thú','Tinh Thạch Trung','Xương Huyền Linh','Vảy Linh Long','Tinh Thạch Thần','Tim Thần Thú','Linh Hồn Thần Thú'],
  },
  {
    label: '🧬 Gia Tộc', color: 0xe67e22,
    keys: ['gt_moc_linh','gt_hoa_linh','gt_thuy_linh','gt_tho_linh','gt_loi_linh','gt_nguyet_anh','gt_thai_duong','gt_kim_cuong','gt_long_huyet','gt_thien_ung','gt_huyen_linh','gt_thien_menh','gt_bat_hoang','gt_vo_thuong'],
    names: ['Mộc Linh','Hỏa Linh','Thủy Linh','Thổ Linh','Lôi Linh','Nguyệt Ảnh','Thái Dương','Kim Cương','Long Huyết','Thiên Ưng','Huyền Linh','Thiên Mệnh','Bát Hoàng','Vô Thường'],
  },
  {
    label: '🩸 Đạo Thương', color: 0xc0392b,
    keys: ['dt_nhe','dt_trung','dt_nang'],
    names: ['Nhẹ (Cấp 1)','Trung (Cấp 2)','Nặng (Cấp 3)'],
  },
  {
    label: '📊 Chỉ Số', color: 0x2980b9,
    keys: ['tutv','tuatk','tudef','tuhp','tustar','tutm','tukv','tucn','tunt'],
    names: ['TV','ATK','DEF','HP','Sao','Tu Môn','KV','CN','NT'],
  },
];

// ── Build embed for a group ───────────────────────────────────────────────
function buildGroupEmbed(group, pageIdx, totalPages) {
  const lines = group.keys.map((key, i) => {
    const val = CUSTOM_EMOJI[key];
    const isCustom = val && val.startsWith('<:');
    const icon = isCustom ? val : (val || '❓');
    const status = isCustom ? '✅' : `${CE('warn_icon','⚠️')}`;
    return `${icon} ${status} \`${key}\` — ${group.names[i] ?? key}`;
  });

  const customCount = group.keys.filter(k => {
    const v = CUSTOM_EMOJI[k];
    return v && v.startsWith('<:');
  }).length;
  const total = group.keys.length;

  return new EmbedBuilder()
    .setTitle(group.label)
    .setDescription(lines.join('\n'))
    .setColor(group.color)
    .setFooter({ text: `Trang ${pageIdx + 1}/${totalPages} · Custom: ${customCount}/${total} · ✅ custom Discord | ${CE('warn_icon','⚠️')} unicode` })
    .setTimestamp();
}

// ── Navigation buttons ────────────────────────────────────────────────────
function buildRow(pageIdx, totalPages) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('xe_prev')
      .setLabel('◀ Trước')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIdx === 0),
    new ButtonBuilder()
      .setCustomId('xe_info')
      .setLabel(`${pageIdx + 1} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId('xe_next')
      .setLabel('Sau ▶')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(pageIdx >= totalPages - 1),
  );
}

// ── Command ───────────────────────────────────────────────────────────────
reg('xem_emoji', ['xemoji', 'xe'], async (msg, _args) => {
  const totalPages = GROUPS.length;
  let pageIdx = 0;

  const sent = await msg.reply({
    embeds: [buildGroupEmbed(GROUPS[0], 0, totalPages)],
    components: [buildRow(0, totalPages)],
  });

  const collector = sent.createMessageComponentCollector({
    filter: (i) => i.user.id === msg.author.id,
    time: 120_000,
  });

  collector.on('collect', async (interaction) => {
    if (interaction.customId === 'xe_prev' && pageIdx > 0) pageIdx--;
    else if (interaction.customId === 'xe_next' && pageIdx < totalPages - 1) pageIdx++;
    else { await interaction.deferUpdate(); return; }

    await interaction.update({
      embeds: [buildGroupEmbed(GROUPS[pageIdx], pageIdx, totalPages)],
      components: [buildRow(pageIdx, totalPages)],
    });
  });

  collector.on('end', async () => {
    try {
      await sent.edit({ components: [] });
    } catch {}
  });
});
