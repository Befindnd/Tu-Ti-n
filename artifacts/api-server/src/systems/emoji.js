'use strict';
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
let _sharp = null;
try { _sharp = require('sharp'); } catch (_) {}

// ── Hash cache: tự detect ảnh thay đổi để re-upload đúng emoji cần thiết ──
const HASH_CACHE_PATH = path.resolve(__dirname, '../assets/.emoji_hash_cache.json');
function _loadHashCache() {
  try { return JSON.parse(fs.readFileSync(HASH_CACHE_PATH, 'utf8')); } catch { return {}; }
}
function _saveHashCache(cache) {
  try { fs.writeFileSync(HASH_CACHE_PATH, JSON.stringify(cache, null, 2)); } catch (e) {
    console.warn('⚠️ Không lưu được hash cache:', e.message);
  }
}
function _hashBuf(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

const CUSTOM_EMOJI = {
  lc_kim: '🥇', lc_moc: '🌿', lc_thuy: '💧', lc_hoa: '🔥', lc_tho: '🪨',
  lc_phong: '🌪️', lc_thunder: '⚡', lc_duong: '☀️', lc_am: '🌙', lc_hon_don: '🌌',
  lc_thien: '🌟', lc_vo_cuc: '♾️',
  ve_linh_can: '🔮', ve_huyet_mach: '🩸', ve_nghe: '🎫', ve_gacha: '🎰',
  rarity_pho_thong: '⚪', rarity_hiem: '🔵', rarity_su_thi: '🟣', rarity_huyen_thoai: '🔴', rarity_than_thanh: '⭐',
  tult: '💠', tult_trung: '🔮', tult_cao: '💚', hm_pham: '🩶', hm_linh: '🐯', hm_than: '🦩', hm_thanh: '🐢',
  hm_tien: '🐉', hm_tu_la: '🔥', hm_co_than: '✨', hm_hon_don: '🌀', hm_thien_long: '🐲',
  tutv: '📈', tuatk: '⚔️', tudef: '🛡️',
  linh_tu_dan: '🌀', linh_tu_dan_sp: '💠', tu_khi_dan: '⚡', khai_ngo_dan: '🧠', phach_nguyen_dan: '🔥',
  tuyet_tinh_dan: '❄️', thai_thanh_dan: '💛', van_linh_dan: '🍑', cuu_pham_dan: '✨',
  cuu_pham_dan_sp: '🔷', nguyen_than_dan: '🌀',
  thien_de_dan: '👑', pha_canh_dan: '🌌', hoi_xuan_dan: '🌸',
  tuhp: '❤️', tustar: '⭐', tutm: '🏯', tukv: '💎', tucn: '🌟', tunt: '🎯',
  dan_pham_ha: '🤍', dan_pham_trung: '💚', dan_pham_thuong: '💙', dan_pham_cuc: '💜',
  lt_linh_chi: '🌿', lt_hoa_linh: '🪷', lt_long_huyet: '🔴',
  lt_tuyet: '❄️', lt_thien_can: '🌱', lt_thien_nhan_qua: '🍑', lt_vong_hon_hoa: '🌺',
  lt_huyet_mach_thach: '💎',
  cp_thap_huyen: '📜', cp_ngu_hanh: '☯️', cp_thien_long: '🐉', cp_van_thuy: '💧',
  cp_am_duong: '☯️', cp_ma_dao: '🩸', cp_diet_tien: '🗡️', cp_hon_don_kinh: '🌌',
  cp_thanh_lien: '🪷',
  bp_hoa_long_phong: '🔥', bp_bang_vu: '❄️', bp_than_loi: '⚡', bp_kim_than: '🥇',
  bp_hoi_phuc: '🌿', bp_tam_hoa: '🌸', bp_huyet_sat: '☠️', bp_thien_ha_de_nhat_kiem: '🗡️',
  bp_thien_dia_lo: '🔥', bp_van_kiem_quy_tong: '⚔️', bp_hong_mong_chi_the: '🌌',
    bp_moc_linh_bi_phap: '🌿', bp_hoa_linh_bi_phap: '🔥', bp_thuy_linh_bi_phap: '💧',
    bp_tho_linh_bi_phap: '🪨', bp_loi_linh_bi_phap: '⚡', bp_nguyet_anh_bi_phap: '🌙',
    bp_thai_duong_bi_phap: '☀️', bp_kim_cuong_bi_phap: '💎', bp_long_huyet_bi_phap: '🩸',
    bp_thien_ung_bi_phap: '🦅', bp_huyen_linh_bi_phap: '🌀', bp_thien_menh_bi_phap: '⭐',
    bp_bat_hoang_bi_phap: '👑', bp_vo_thuong_bi_phap: '🌌',
    ng_ngung_khi_thuat: '🌀', ng_linh_giac: '🦅', ng_the_phach_cuong_hoa: '🐉',
  ng_khinh_cong: '🌊', ng_linh_khi_ho_the: '🔷', ng_kim_chung_trao: '🌙',
  ng_thiet_bo_sam: '🦁', ng_thien_phuc: '🔥', ng_tu_luyen: '⚡', ng_hoi_xuan: '🌸',
  lt_doc_lang: '🐺', lt_hoa_ho: '🦊', lt_bang_hung: '🐻', lt_dia_nga: '🦎',
  lt_loi_bao: '🐆', lt_dia_long: '🐉', lt_phong_ung: '🦅', lt_am_tac: '🦜',
  lt_huyet_su: '🦁', lt_bang_phuong: '🦚', lt_dia_nguc_quy: '👿', lt_kim_tuoc: '🐦',
  lt_cuu_vi_ho: '🦊', lt_thanh_long: '🐉', lt_bach_ho: '🐯', lt_huyen_vu: '🐢',
  lt_chu_tuoc: '🔥', lt_hon_don_thu: '👾', lt_thai_co_long: '🐲', lt_tien_linh: '✨',
  vp_da_linh_thu: '🟫', vp_long_linh_thu: '🪶', vp_rang_vuot: '🦷',
  vp_xuong_linh_thu: '🦴', vp_tinh_thach_nho: '💎', vp_nanh_linh_thu: '🗡️',
  vp_tinh_thach_trung: '💠', vp_xuong_huyen_linh: '🌀', vp_vay_linh_long: '🐉',
  vp_tinh_thach_than: '⭐', vp_tim_than_thu: '❤️', vp_linh_hon_than_thu: '👻',
  // VŨ KHÍ — mỗi phi khí có emoji riêng biệt, phù hợp lore
  vk_kiem_go: '🪵',   // Phác Mộc Linh Phù — gỗ linh mộc
  vk_kiem_sat: '⚔️',  // Tinh Thiết Phi Kiếm — kiếm sắt chuẩn
  vk_kiem_dong: '❄️', // Hàn Băng Địa Kiếm — kiếm băng
  vk_linh_kiem: '🔮', // Thiên Nguyên Linh Phong Kiếm — linh khí
  vk_linh_thuong: '🔱', // Thanh Long Huyền Thiên Thương — thương/giáo
  vk_nhu_y_con: '🪄',  // Như Ý Kiền Khôn Chủy — như ý thần côn
  vk_tien_kiem: '✨',  // Thanh Hư Tiên Phong Kiếm — tiên phẩm
  vk_tu_tinh_kiem: '💜', // Tử Tinh Thiên Ngoại Kiếm — tử tinh huyền ảo
  vk_than_kiem: '⚡',  // Vạn Kiếp Thần Lôi Kiếm — thần lôi
  vk_than_cung: '🏹',  // Hư Không Thần Uy Cung — thần cung
  vk_cuu_long_kich: '🐉', // Cửu Long Thần Binh Kích — cửu long
  vk_hong_mong_kiem: '🌌', // Hồng Mông Khai Thiên Kiếm — hỗn độn khai thiên
  vk_nhat_luan_kiem: '☀️', // Nhật Luân Thánh Kiếm — nhật luân
  vk_tuyet_tinh_thuong: '🧊', // Tuyết Tinh Hàn Nguyên Thương — băng tinh (khác ❄️)
  vk_am_ma_kiem: '🌑', // Ám Ma Cửu Huyền Kiếm — ám ma
  vk_ngoc_quang_kiem: '💚',  // Ngọc Quang Thiên Linh Kiếm — ngọc xanh linh quang
  vk_thien_uy_phu: '🪓',    // Thiên Uy Linh Phong Phủ — phủ thần
  vk_thanh_long_kiem: '🐲',  // Thanh Long Cửu Thiên Kiếm — thanh long
  // BẢO BỐI — mỗi linh bảo có emoji riêng, phù hợp công năng
  bb_linh_thai: '🧿',   // Thái Hư Linh Ngọc Bội — ngọc bội hộ thân
  bb_van_bao_tui: '👜', // Càn Khôn Hư Không Nang — túi không gian
  bb_tui_da_thu: '🎒',  // Túi Da Thú — túi da
  bb_loi_hoa_cau: '💥', // Lôi Hỏa Thiên Vân Châu — bùng nổ lôi hỏa
  bb_ho_than_kinh: '🪞', // Hộ Đạo Thiên Mục Kính — kính bảo hộ
  bb_tien_phu: '🌸',    // Tụ Linh Tiên Ngọc Phủ — tiên khí
  bb_kien_long_giap: '🐉', // Huyền Long Bất Hoại Lân Giáp — giáp long vảy
  bb_am_duong_bai: '☯️', // Âm Dương Thái Cực Bài — thái cực
  bb_hong_mong_chu: '🌌', // Hồng Mông Huyền Thiên Châu — hỗn độn
  bb_thien_long_giap: '🐲', // Thiên Long Hộ Thể Giáp — thiên long (khác 🐉)
  bb_bat_qua_kinh: '🔯', // Bát Quái Kiền Khôn Kính — bát quái
  bb_vo_bien_nhan: '💍', // Vô Biên Kiền Khôn Nhẫn — nhẫn thần
  bb_linh_thu_ho_tam: '💗', // Linh Thú Hộ Tâm Kính — hộ tâm
  bb_da_thu_sat_khi: '🗡️', // Dã Thú Sát Khí Bội — sát khí công
  bb_tinh_thach_hoi_linh: '💎', // Tinh Thạch Hồi Linh Bát — tinh thạch
  bb_huyen_long_tam_chau: '🟣', // Huyền Long Tam Châu — ba viên ngọc
  bb_than_thu_tam_ngoc: '💚', // Thần Thú Tâm Ngọc — tâm ngọc
  bb_linh_hon_am_khi: '👻',  // Linh Hồn Ám Khí — linh hồn ám khí
  bb_phong_linh_boi: '🌀',  // Phong Linh Huyền Vân Bội — phong khí né tránh
  bb_hoa_am_nhan: '🔥',    // Hỏa Âm Huyền Thiên Nhẫn — phản sát thương
  bb_cuu_tinh_giap: '🛡️',  // Cửu Tinh Thiên Ngoại Trọng Giáp — giáp nặng phòng thủ
  bb_huyen_khong_linh_nang: '🌀', // Huyền Không Linh Nang — túi thiên phẩm +25kg
  bb_thien_dia_dai_nang: '🌌',   // Thiên Địa Kiền Khôn Đại Nang — túi thần phẩm +30kg
  // NGHE
  ng_luyen_dan: '⚗️', ng_phi_khi_su: '🔱', ng_phu_luc_su: '📜', ng_am_ve: '🗡️',
  ng_phong_thuy_su: '🧭', ng_duoc_su: '💉', ng_ngo_dao_su: '🌀', ng_cong_thu_ven_toan: '⚖️',
  // NGHE - NI SKILL ICONS (field labels trong -ni display)
  ni_ngo_tinh: '🌀', ni_binh_canh: '🧱', ni_dai_ngo: '🧘', ni_truyen_dao: '☯️',
  ni_khi_van: '🌬️', ni_dan_duoc: '⚗️', ni_phi_khi: '🔱', ni_phu_luc: '📜',
  ni_am_sat: '🗡️', ni_chua_thuong: '💉',
  ni_vien_dan: '💊', ni_ban_dan: '🏪', ni_tang_dan: '🎁',
  ni_sat_tinh: '⚙️', ni_khai_quang: '⛏️', ni_sac_ben: '⚡',
  ni_ve_phu: '✍️', ni_ve_phong_an: '🛡️', ni_phu_bo_tro: '🤝', ni_pvp: '⚔️',
  ni_an_ngu: '😴', ni_trinh_sat: '🕵️', ni_sat_y: '🌑',
  ni_boi: '🔮', ni_khai_van: '🌟', ni_tien_tri: '🔭', ni_tran_van: '⛅', ni_cau_phuc: '🤝',
  ni_than_the: '❤️', ni_che_doc: '☠️', ni_giai_doc: '💊',
  ni_dac_ky: '⭐',
  cd_timer: '⏳',
  lock_icon: '🔒',
  // DAO_TU
  dt_kiem_tu: '⚔️', dt_the_tu: '💪', dt_phap_tu: '🧘', dt_ma_tu: '🔥',
  dt_yeu_tu: '🐉', dt_dan_tu: '🌿', dt_khi_tu: '🛠️', dt_tran_tu: '🧿',
  // NGO_TINH
  nt_pham: '🪨', nt_linh: '🌿', nt_dia: '💠', nt_thien: '🔮', nt_tien: '✨',
  // NHAN_QUA
  nq_vien_man: '☀️', nq_cong_duc: '😇', nq_tieu: '🌿', nq_trung: '⚖️',
  nq_nghiep: '🩸', nq_sau: '👿', nq_chuong: '☠️',
  // PHU_LUC
  pl_ho_than: '🛡️', pl_sat_phong: '⚔️', pl_linh_hoi: '💚', pl_tu_toc: '⚡',
  pl_khai_ngo: '🌟', pl_thien_dia: '☯️', pl_pha_canh: '💥',
  // PHONG_THUY_VAN
  ptv_dai_cat: '🌟', ptv_tieu_cat: '✨', ptv_binh: '⚖️', ptv_tieu_hung: '☁️', ptv_dai_hung: '💀',
  // DONG_PHU
  dp_linh_son: '🏔️', dp_hoa_van: '🌋', dp_bang_phong: '❄️', dp_tien_canh: '🌸',
  // TRUYEN_THUA
  tt_thien_long: '🐉', tt_van_thuy: '💧', tt_ma_dao: '🩸', tt_kiem_dao: '🗡️', tt_hon_don: '🌀',
  // TONG_MON
  tm_thanh_van: '🌸', tm_huyen_thien: '🌌', tm_van_kiem: '🗡️', tm_ma_than: '🌑',
  // TONG_MON_CAP_BAC
  tmcb_ngoai_mon: '🪶', tmcb_noi_mon: '🌿', tmcb_chan_truyen: '🔥', tmcb_thanh_tu: '🌸', tmcb_tong_chu: '👑',
  // KHOANG_VAT
  kv_sat_tinh: '⚙️', kv_huyen_thiet: '🪨', kv_tinh_cang: '⚔️', kv_thien_tiet: '✨', kv_vong_tinh: '🌠',
  // ĐẠO THƯƠNG — hiển thị cấp độ thương thế trong profile
  dt_nhe:  '🟡',  // Đạo Thương Cấp 1 — nhẹ
  dt_trung: '🟠', // Đạo Thương Cấp 2 — trung
  dt_nang:  '🔴', // Đạo Thương Cấp 3 — nặng (khóa lệnh)
  // TÍNH NĂNG — icon đại diện cho từng tính năng nhỏ trong game
  ft_am_sat:        '🗡️',  // Ám Sát — ám khí ám sát
  ft_dao_tam:       '🧿',  // Đạo Tâm — tâm linh tu luyện
  ft_vuot_kiep:     '🌩️', // Vượt Kiếp — thiên kiếp
  ft_thap:          '🏯',  // Tháp Thử Thách — tháp tu tiên
  ft_bi_canh:       '🗺️', // Bí Cảnh — cổng vào bí cảnh
  ft_nhiem_vu:      '📋',  // Nhiệm Vụ — cuộn nhiệm vụ
  ft_linh_ngo:      '📚',  // Linh Ngộ — đọc cổ thư
  ft_ban_dan:       '⚗️',  // Bán Đan — lò đan dược
  ft_san_linh:      '🏹',  // Săn Linh Thú — săn thú
  ft_co_duyen:      '🌠',  // Cơ Duyên — gặp cơ duyên
  ft_pvp:           '⚔️',  // PvP — song kiếm giao tranh
  // TÍNH NĂNG MỚI — có ảnh thật (ft_xxx_nobg.png)
  ft_dot_pha:       '💥',  // Đột Phá — phá cảnh giới
  ft_tu_luyen:      '🧘',  // Tu Luyện — tĩnh tâm tu tập
  ft_luyen_dan:     '⚗️',  // Luyện Đan — luyện đan trong lò
  ft_trang_bi:      '🛡️', // Trang Bị — vũ khí giáp trụ
  ft_tui:           '👜',  // Túi — càn khôn nang
  ft_gia_toc:       '🏰',  // Gia Tộc — gia tộc tu tiên
  ft_daily:         '📅',  // Điểm Danh — nhận thưởng hàng ngày
  ft_dau_gia:       '🔨',  // Đấu Giá — đấu giá linh bảo
  ft_vat_pham:      '💼',  // Vật Phẩm — kho vật phẩm
  ft_huyet_mach:    '🩸',  // Huyết Mạch — huyết mạch tổ tiên
  // TÍNH NĂNG — chỉ có emoji Unicode
  ft_linh_can:      '🌱',  // Linh Căn — căn cơ tu luyện
  ft_cong_phap:     '📖',  // Công Pháp — bí kíp tu luyện
  ft_profile:       '🪪',  // Hồ Sơ — thông tin đạo hữu
  ft_tong_mon:      '🏛️', // Tông Môn — môn phái tu tiên
  ft_dong_phu:      '🏔️', // Động Phủ — nơi tu luyện riêng
  ft_linh_thao:     '🌿',  // Linh Thảo — dược thảo linh khí
  ft_khai_quang:    '✨',  // Khai Quang — khắc văn linh khí
  ft_phu_phep:      '📜',  // Phù Phép — bùa chú linh phù
  ft_than_thong:    '🌟',  // Thần Thông — thần thông đại pháp
  ft_bxh:           '🏆',  // Bảng Xếp Hạng — bảng cường giả
  ft_bxh_thap:      '🗼',  // BXH Tháp — bảng xếp hạng tháp
  ft_phong_thuy:    '🧭',  // Phong Thủy — địa lý phong thủy
  ft_kham_pha:      '🗺️', // Khám Phá — khám phá bí cảnh
  // BÍ CẢNH OPTIONS
  bc_mao_hiem:      '⚠️',  // Mạo Hiểm Tầng Sâu
  bc_kham_pha_co_dien: '🏛️', // Khám Phá Cổ Điện
  bc_thu_hoach_linh_duoc: '🌿', // Thu Hoạch Linh Dược
  bc_co_tran_huy_diet: '🕸️',  // Kích Hoạt Cổ Trận Hủy Diệt
  bc_duong_dau_thu_than: '🐯', // Đương Đầu Thú Thần
  bc_truyen_thua_co_dai: '📜',  // Nhận Truyền Thừa Cổ Đại
  bc_tranh_doat_linh_bao: '💎', // Tranh Đoạt Linh Bảo
  bc_dau_phap_tu_si: '⚔️',    // Đấu Pháp Tu Sĩ Địch
  bc_khai_thac_linh_mach: '⛏️',// Khai Thác Linh Mạch
  bc_rut_lui: '🚪',             // Rút Lui Khỏi Bí Cảnh
  ft_kham_benh:     '🩺',  // Khám Bệnh — chẩn trị đạo thương
  ft_healing:       '💚',  // Chữa Bệnh — hồi phục linh lực
  ft_hap_thu:       '🔮',  // Hấp Thu — hấp thu linh khí
  ft_dung_dan:      '💊',  // Dùng Đan — phục dụng đan dược
  ft_bao_linh:      '🐾',  // Bao Linh — thu phục linh thú
  ft_do_vui:        '🎲',  // Đố Vui — trò chơi thú vị
  ft_luyen_thuoc:   '🧪',  // Luyện Thuốc — chưng cất linh dược
  ft_giftcode:      '🎁',  // Gift Code — quà mã đặc biệt
  ft_social:        '🤝',  // Xã Hội — giao lưu đạo hữu
  ft_dao_tu_path:   '🛤️', // Đạo Tu Path — chọn đường tu luyện
  ft_xem_dao_thuong:'🩸',  // Xem Đạo Thương — kiểm tra thương thế
  ft_bi_phap:       '📕',  // Bí Pháp — bí kíp tuyệt học
  ft_linh_bao:      '🔮',  // Linh Bảo — bảo bối thần kỳ
  ft_nghe:          '🛠️', // Nghề — nghề nghiệp đặc biệt
  ft_am_ve:         '🗡️', // Ám Vệ — vệ sĩ bí mật
  ft_thong_ke:      '📊',  // Thống Kê — số liệu gia tộc
  ft_thu_hoi:       '🔙',  // Thu Hồi — thu hồi vật phẩm
  ft_vut:           '🗑️', // Vứt — bỏ vật phẩm
  ft_donate:        '💰',  // Donate — ủng hộ server
  // DONATE UI — icon riêng cho embed Lần Đầu
  donate_gift:      '🎁',  // Hộp quà Lần Đầu — title + select menu
  tip_icon:         '💡',  // Tip / gợi ý — trong mô tả donate
  warn_icon:        '⚠️',  // Cảnh báo — trong embed donate
  thien_kiep:  '⚡',  // Thiên Kiếp — lôi kiếp thần hình
  tia_set:     '⚡',  // Tia Sét — sấm linh tổng quát
  // ĐẠO TÂM TRẠNG THÁI — trạng thái tâm cảnh tu luyện
  tam_nhan:    '😇',  // Nhân Đạo (≥80) — tâm từ bi
  tam_trung:   '😐',  // Trung Dung (40-79) — tâm bình hòa
  tam_ma:      '😈',  // Ma Đạo (0-39) — tâm ma tính
  tam_ac:      '👿',  // Ác Ma (<0) — tâm tàn ác
  // GIA TỘC — fallback Unicode khi custom emoji chưa upload
  gt_moc_linh: '🌿', gt_hoa_linh: '🔥', gt_thuy_linh: '💧', gt_tho_linh: '🪨',
  gt_loi_linh: '⚡', gt_nguyet_anh: '🌙', gt_thai_duong: '☀️', gt_kim_cuong: '💎',
  gt_long_huyet: '🐉', gt_thien_ung: '🦅', gt_huyen_linh: '🌀',
  gt_thien_menh: '⭐', gt_bat_hoang: '👑', gt_vo_thuong: '🌌',
};
const CE = (n, t = '') => CUSTOM_EMOJI[n] || t;
  // Snapshot Unicode values BEFORE initCustomEmoji overwrites them
  const UNICODE_EMOJI = Object.freeze({ ...CUSTOM_EMOJI });
  // CEu = CE Unicode — trả về Unicode emoji, dùng cho footer/text-only context
  // vì Discord embed footer không render custom emoji <:name:id>
  const CEu = (n, t = '') => UNICODE_EMOJI[n] || t;

// Trả về CDN URL của custom emoji (để dùng setThumbnail/setImage trong embed)
// Format CUSTOM_EMOJI khi đã upload: "<:name:id>" hoặc "<a:name:id>"
const getCEUrl = (n, size = 256) => {
  const val = CUSTOM_EMOJI[n];
  if (!val) return null;
  const m = val.match(/<a?:\w+:(\d+)>/);
  if (!m) return null;
  return `https://cdn.discordapp.com/emojis/${m[1]}.png?size=${size}`;
};

const LINH_THU_IMG_FILES = {
  doc_lang:     'lt_doc_lang_nobg.png',
  hoa_ho:       'lt_hoa_ho_nobg.png',
  bang_hung:    'lt_bang_hung_nobg.png',
  dia_nga:      'lt_dia_nga_nobg.png',
  loi_bao:      'lt_loi_bao_nobg.png',
  dia_long:     'lt_dia_long_nobg.png',
  phong_ung:    'lt_phong_ung_nobg.png',
  am_tac:       'lt_am_tac_nobg.png',
  huyet_su:     'lt_huyet_su_nobg.png',
  bang_phuong:  'lt_bang_phuong_nobg.png',
  dia_nguc_quy: 'lt_dia_nguc_quy_nobg.png',
  kim_tuoc:     'lt_kim_tuoc_nobg.png',
  cuu_vi_ho:    'lt_cuu_vi_ho_nobg.png',
  thanh_long:   'lt_thanh_long_nobg.png',
  bach_ho:      'lt_bach_ho_nobg.png',
  huyen_vu:     'lt_huyen_vu_nobg.png',
  chu_tuoc:     'lt_chu_tuoc_nobg.png',
  hon_don_thu:  'lt_hon_don_thu_nobg.png',
  thai_co_long: 'lt_thai_co_long_nobg.png',
  tien_linh:    'lt_tien_linh_nobg.png',
};
const getLinhThuAttachment = (id) => {
  const filename = LINH_THU_IMG_FILES[id];
  if (!filename) return null;
  const fullPath = path.join(CARD_DIR, filename);
  if (!fs.existsSync(fullPath)) return null;
  return { attachment: fullPath, name: 'lt_beast.png' };
};

const CARD_FILES = {
  cp_thap_huyen: 'cp_thap_huyen_card.png',
  cp_ngu_hanh: 'cp_ngu_hanh_card.png',
  cp_thien_long: 'cp_thien_long_card.png',
  cp_van_thuy: 'cp_van_thuy_card.png',
  cp_am_duong: 'cp_am_duong_card.png',
  cp_ma_dao: 'cp_ma_dao_card.png',
  cp_diet_tien: 'cp_diet_tien_card.png',
  cp_hon_don_kinh: 'cp_hon_don_kinh_card.png',
  cp_thanh_lien: 'cp_thanh_lien_card.png',
  bp_hoa_long_phong: 'bp_hoa_long_phong_card.png',
  bp_bang_vu: 'bp_bang_vu_card.png',
  bp_than_loi: 'bp_than_loi_card.png',
  bp_kim_than: 'bp_kim_than_card.png',
  bp_hoi_phuc: 'bp_hoi_phuc_card.png',
  bp_tam_hoa: 'bp_tam_hoa_card.png',
  bp_huyet_sat: 'bp_huyet_sat_card.png',
  bp_thien_ha_de_nhat_kiem: 'bp_thien_ha_de_nhat_kiem_card.png',
};
const CARD_DIR = path.join(__dirname, '../assets/images');
const getCardAttachment = (key) => {
  const filename = CARD_FILES[key];
  if (!filename) return null;
  const fullPath = path.join(CARD_DIR, filename);
  if (!fs.existsSync(fullPath)) return null;
  return { attachment: fullPath, name: 'card.png' };
};

function _makePNG(n, t) {
  const e = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let t = n;
    for (let n = 0; n < 8; n++) t = 1 & t ? 3988292384 ^ (t >>> 1) : t >>> 1;
    e[n] = t;
  }
  const h = (n, t) => {
      const h = Buffer.allocUnsafe(4);
      h.writeUInt32BE(t.length);
      const i = Buffer.from(n, "ascii"),
        a = Buffer.allocUnsafe(4);
      return (
        a.writeUInt32BE(
          ((n) => {
            let t = -1;
            for (const h of n) t = (t >>> 8) ^ e[255 & (t ^ h)];
            return (-1 ^ t) >>> 0;
          })(Buffer.concat([i, t])),
        ),
        Buffer.concat([h, i, t, a])
      );
    },
    i = Buffer.allocUnsafe(n * (1 + 4 * n));
  for (let e = 0; e < n; e++) {
    i[e * (1 + 4 * n)] = 0;
    for (let h = 0; h < n; h++) {
      const a = t(h, e, n),
        o = e * (1 + 4 * n) + 1 + 4 * h;
      ((i[o] = a[0]), (i[o + 1] = a[1]), (i[o + 2] = a[2]), (i[o + 3] = a[3] ?? 255));
    }
  }
  const a = Buffer.allocUnsafe(13);
  return (
    a.writeUInt32BE(n, 0),
    a.writeUInt32BE(n, 4),
    (a[8] = 8),
    (a[9] = 6),
    (a[10] = a[11] = a[12] = 0),
    Buffer.concat([
      Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
      h("IHDR", a),
      h("IDAT", zlib.deflateSync(i)),
      h("IEND", Buffer.alloc(0)),
    ])
  );
}
const _lerp = (n, t, e) => Math.round(n + (t - n) * Math.min(1, Math.max(0, e))),
  _dist = (n, t, e, h) => Math.sqrt((n - e) ** 2 + (t - h) ** 2),
  _clamp = (n, t = 0, e = 255) => Math.min(e, Math.max(t, n)),
  EMOJI_DEFS = [],
  STAT_IMG_DEFS_EXTRA = [
    { name: "tuhp",      file: "tuhp_nobg.png" },
    { name: "tustar",    file: "tustar_nobg.png" },
    { name: "tutm",      file: "tutm_nobg.png" },
    { name: "tukv",      file: "tukv_nobg.png" },
    { name: "tucn",      file: "tucn_nobg.png" },
    { name: "tunt",      file: "tunt_nobg.png" },
    { name: "lock_icon", file: "lock_nobg.png" },
  ],
  LINH_CAN_IMG_DEFS = [
    { name: "lc_kim", file: "kim_nobg.png" },
    { name: "lc_moc", file: "moc_nobg.png" },
    { name: "lc_thuy", file: "thuy_nobg.png" },
    { name: "lc_hoa", file: "hoa_nobg.png" },
    { name: "lc_tho", file: "tho_nobg.png" },
    { name: "lc_phong", file: "phong_nobg.png" },
    { name: "lc_thunder", file: "loi_nobg.png" },
    { name: "lc_duong", file: "duong_nobg.png" },
    { name: "lc_am", file: "am_nobg.png" },
    { name: "lc_hon_don", file: "hon_don_nobg.png" },
    { name: "lc_thien", file: "thien_linh_can_nobg.png" },
    { name: "lc_vo_cuc", file: "vo_cuc_linh_can_nobg.png" },
  ],
  HUYET_MACH_IMG_DEFS = [
    { name: "tult",       file: "linh_thach_nobg.png" },
    { name: "tult_trung", file: "linh_thach_trung_nobg.png" },
    { name: "tult_cao",   file: "linh_thach_cao_nobg.png" },
    { name: "hm_pham", file: "pham_huyet_nobg.png" },
    { name: "hm_linh", file: "bach_ho_huyet_nobg.png" },
    { name: "hm_than", file: "chu_tuoc_huyet_nobg.png" },
    { name: "hm_thanh", file: "huyen_vu_huyet_nobg.png" },
    { name: "hm_tien", file: "thanh_long_huyet_nobg.png" },
    { name: "hm_tu_la", file: "tu_la_huyet_nobg.png" },
    { name: "hm_co_than", file: "co_than_huyet_nobg.png" },
    { name: "hm_hon_don", file: "hon_don_chi_the_nobg.png" },
    { name: "hm_thien_long", file: "thien_long_huyet_nobg.png" },
  ],
  DAN_DUOC_IMG_DEFS = [
    { name: "linh_tu_dan",     file: "linh_tu_dan_nobg.png" },
    { name: "tu_khi_dan",      file: "tu_khi_dan_nobg.png" },
    { name: "khai_ngo_dan",    file: "khai_ngo_dan_nobg.png" },
    { name: "phach_nguyen_dan",file: "phach_nguyen_dan_nobg.png" },
    { name: "tuyet_tinh_dan",  file: "tuyet_tinh_dan_nobg.png" },
    { name: "thai_thanh_dan",  file: "thai_thanh_dan_nobg.png" },
    { name: "van_linh_dan",    file: "van_linh_dan_nobg.png" },
    { name: "cuu_pham_dan",    file: "cuu_pham_dan_nobg.png" },
    { name: "thien_de_dan",    file: "thien_de_dan_nobg.png" },
    { name: "pha_canh_dan",    file: "pha_canh_dan_nobg.png" },
    { name: "hoi_xuan_dan",    file: "hoi_xuan_dan_nobg.png" },
    { name: "cuu_pham_dan_sp", file: "cuu_pham_dan_sp_nobg.png" },
    { name: "linh_tu_dan_sp",  file: "linh_tu_dan_sp_nobg.png" },
    { name: "nguyen_than_dan", file: "nguyen_than_dan_nobg.png" },
  ],
  DAN_PHAM_IMG_DEFS = [
    { name: "dan_pham_ha",     file: "ha_pham_nobg.png" },
    { name: "dan_pham_trung",  file: "trung_pham_nobg.png" },
    { name: "dan_pham_thuong", file: "thuong_pham_nobg.png" },
    { name: "dan_pham_cuc",    file: "cuc_pham_nobg.png" },
  ],
  LINH_THAO_IMG_DEFS = [
    { name: "lt_linh_chi",         file: "tu_hu_thao_nobg.png" },
    { name: "lt_hoa_linh",         file: "bich_ha_lien_nobg.png" },
    { name: "lt_long_huyet",       file: "long_tinh_thao_nobg.png" },
    { name: "lt_tuyet",            file: "tuyet_linh_thao_nobg.png" },
    { name: "lt_thien_can",        file: "thien_dia_linh_can_nobg.png" },
    { name: "lt_thien_nhan_qua",   file: "thien_nhan_qua_nobg.png" },
    { name: "lt_vong_hon_hoa",     file: "dia_nguc_huyet_lien_nobg.png" },
    { name: "lt_huyet_mach_thach", file: "huyet_mach_thach_nobg.png" },
  ],
  CONG_PHAP_IMG_DEFS = [
    { name: "cp_thap_huyen",   file: "cp_thap_huyen_nobg.png" },
    { name: "cp_ngu_hanh",     file: "cp_ngu_hanh_nobg.png" },
    { name: "cp_thien_long",   file: "cp_thien_long_nobg.png" },
    { name: "cp_van_thuy",     file: "cp_van_thuy_nobg.png" },
    { name: "cp_am_duong",     file: "cp_am_duong_nobg.png" },
    { name: "cp_ma_dao",       file: "cp_ma_dao_nobg.png" },
    { name: "cp_diet_tien",    file: "cp_diet_tien_nobg.png" },
    { name: "cp_hon_don_kinh", file: "cp_hon_don_kinh_nobg.png" },
    { name: "cp_thanh_lien",   file: "cp_thanh_lien_nobg.png" },
  ],
  BI_PHAP_IMG_DEFS = [
    { name: "bp_hoa_long_phong",          file: "bp_hoa_long_phong_nobg.png" },
    { name: "bp_bang_vu",                 file: "bp_bang_vu_nobg.png" },
    { name: "bp_than_loi",                file: "bp_than_loi_nobg.png" },
    { name: "bp_kim_than",                file: "bp_kim_than_nobg.png" },
    { name: "bp_hoi_phuc",                file: "bp_hoi_phuc_nobg.png" },
    { name: "bp_tam_hoa",                 file: "bp_tam_hoa_nobg.png" },
    { name: "bp_huyet_sat",               file: "bp_huyet_sat_nobg.png" },
    { name: "bp_thien_ha_de_nhat_kiem",   file: "bp_thien_ha_de_nhat_kiem_nobg.png" },
    { name: "bp_thien_dia_lo",            file: "bp_thien_dia_lo_nobg.png" },
    { name: "bp_van_kiem_quy_tong",       file: "bp_van_kiem_quy_tong_nobg.png" },
    { name: "bp_hong_mong_chi_the",       file: "hong_mong_chi_the_nobg.png" },
      { name: "bp_moc_linh_bi_phap",        file: "moc_linh_bi_phap_nobg.png" },
      { name: "bp_hoa_linh_bi_phap",        file: "hoa_linh_bi_phap_nobg.png" },
      { name: "bp_thuy_linh_bi_phap",       file: "thuy_linh_bi_phap_nobg.png" },
      { name: "bp_tho_linh_bi_phap",        file: "tho_linh_bi_phap_nobg.png" },
      { name: "bp_loi_linh_bi_phap",        file: "loi_linh_bi_phap_nobg.png" },
      { name: "bp_nguyet_anh_bi_phap",      file: "nguyet_anh_bi_phap_nobg.png" },
      { name: "bp_thai_duong_bi_phap",      file: "thai_duong_bi_phap_nobg.png" },
      { name: "bp_kim_cuong_bi_phap",       file: "kim_cuong_bi_phap_nobg.png" },
      { name: "bp_long_huyet_bi_phap",      file: "long_huyet_bi_phap_nobg.png" },
      { name: "bp_thien_ung_bi_phap",       file: "thien_ung_bi_phap_nobg.png" },
      { name: "bp_huyen_linh_bi_phap",      file: "huyen_linh_bi_phap_nobg.png" },
      { name: "bp_thien_menh_bi_phap",      file: "thien_menh_bi_phap_nobg.png" },
      { name: "bp_bat_hoang_bi_phap",       file: "bat_hoang_bi_phap_nobg.png" },
      { name: "bp_vo_thuong_bi_phap",       file: "vo_thuong_bi_phap_nobg.png" },
    ],
    STAT_IMG_DEFS = [
    { name: "tutv",  file: "tutv_nobg.png" },
    { name: "tuatk", file: "tuatk_nobg.png" },
    { name: "tudef", file: "tudef_nobg.png" },
  ],
  NGOC_GIAN_IMG_DEFS = [
    { name: "ng_ngung_khi_thuat",   file: "ng_ngung_khi_thuat_nobg.png" },
    { name: "ng_linh_giac",         file: "ng_linh_giac_nobg.png" },
    { name: "ng_the_phach_cuong_hoa", file: "ng_the_phach_cuong_hoa_nobg.png" },
    { name: "ng_khinh_cong",        file: "ng_khinh_cong_nobg.png" },
    { name: "ng_linh_khi_ho_the",   file: "ng_linh_khi_ho_the_nobg.png" },
    { name: "ng_kim_chung_trao",    file: "ng_kim_chung_trao_nobg.png" },
    { name: "ng_thiet_bo_sam",      file: "ng_thiet_bo_sam_nobg.png" },
    { name: "ng_thien_phuc",        file: "ng_thien_phuc_nobg.png" },
    { name: "ng_tu_luyen",          file: "ng_tu_luyen_nobg.png" },
    { name: "ng_hoi_xuan",          file: "ng_hoi_xuan_nobg.png" },
    { name: "ng_cong_thu_ven_toan", file: "ng_cong_thu_ven_toan_nobg.png" },
  ],
  LINH_THU_IMG_DEFS = [
    { name: "lt_doc_lang",      file: "lt_doc_lang_nobg.png" },
    { name: "lt_hoa_ho",        file: "lt_hoa_ho_nobg.png" },
    { name: "lt_bang_hung",     file: "lt_bang_hung_nobg.png" },
    { name: "lt_dia_nga",       file: "lt_dia_nga_nobg.png" },
    { name: "lt_loi_bao",       file: "lt_loi_bao_nobg.png" },
    { name: "lt_dia_long",      file: "lt_dia_long_nobg.png" },
    { name: "lt_phong_ung",     file: "lt_phong_ung_nobg.png" },
    { name: "lt_am_tac",        file: "lt_am_tac_nobg.png" },
    { name: "lt_huyet_su",      file: "lt_huyet_su_nobg.png" },
    { name: "lt_bang_phuong",   file: "lt_bang_phuong_nobg.png" },
    { name: "lt_dia_nguc_quy",  file: "lt_dia_nguc_quy_nobg.png" },
    { name: "lt_kim_tuoc",      file: "lt_kim_tuoc_nobg.png" },
    { name: "lt_cuu_vi_ho",     file: "lt_cuu_vi_ho_nobg.png" },
    { name: "lt_thanh_long",    file: "lt_thanh_long_nobg.png" },
    { name: "lt_bach_ho",       file: "lt_bach_ho_nobg.png" },
    { name: "lt_huyen_vu",      file: "lt_huyen_vu_nobg.png" },
    { name: "lt_chu_tuoc",      file: "lt_chu_tuoc_nobg.png" },
    { name: "lt_hon_don_thu",   file: "lt_hon_don_thu_nobg.png" },
    { name: "lt_thai_co_long",  file: "lt_thai_co_long_nobg.png" },
    { name: "lt_tien_linh",     file: "lt_tien_linh_nobg.png" },
  ],
  VU_KHI_IMG_DEFS = [
    { name: "vk_kiem_go",           file: "vk_kiem_go_nobg.png" },
    { name: "vk_kiem_sat",          file: "vk_kiem_sat_nobg.png" },
    { name: "vk_kiem_dong",         file: "vk_kiem_dong_nobg.png" },
    { name: "vk_linh_kiem",         file: "vk_linh_kiem_nobg.png" },
    { name: "vk_linh_thuong",       file: "vk_linh_thuong_nobg.png" },
    { name: "vk_nhu_y_con",         file: "vk_nhu_y_con_nobg.png" },
    { name: "vk_tien_kiem",         file: "vk_tien_kiem_nobg.png" },
    { name: "vk_tu_tinh_kiem",      file: "vk_tu_tinh_kiem_nobg.png" },
    { name: "vk_than_kiem",         file: "vk_than_kiem_nobg.png" },
    { name: "vk_than_cung",         file: "vk_than_cung_nobg.png" },
    { name: "vk_cuu_long_kich",     file: "vk_cuu_long_kich_nobg.png" },
    { name: "vk_hong_mong_kiem",    file: "vk_hong_mong_kiem_nobg.png" },
    { name: "vk_nhat_luan_kiem",    file: "vk_nhat_luan_kiem_nobg.png" },
    { name: "vk_tuyet_tinh_thuong", file: "vk_tuyet_tinh_thuong_nobg.png" },
    { name: "vk_am_ma_kiem",        file: "vk_am_ma_kiem_nobg.png" },
    { name: "vk_ngoc_quang_kiem",   file: "vk_ngoc_quang_kiem_nobg.png" },
    { name: "vk_thien_uy_phu",      file: "vk_thien_uy_phu_nobg.png" },
    { name: "vk_thanh_long_kiem",   file: "vk_thanh_long_kiem_nobg.png" },
  ],
  BAO_BOI_IMG_DEFS = [
    { name: "bb_linh_thai",            file: "bb_linh_thai_nobg.png" },
    { name: "bb_van_bao_tui",          file: "bb_van_bao_tui_nobg.png" },
    { name: "bb_tui_da_thu",           file: "bb_tui_da_thu_nobg.png" },
    { name: "bb_loi_hoa_cau",          file: "bb_loi_hoa_cau_nobg.png" },
    { name: "bb_ho_than_kinh",         file: "bb_ho_than_kinh_nobg.png" },
    { name: "bb_tien_phu",             file: "bb_tien_phu_nobg.png" },
    { name: "bb_kien_long_giap",       file: "bb_kien_long_giap_nobg.png" },
    { name: "bb_am_duong_bai",         file: "bb_am_duong_bai_nobg.png" },
    { name: "bb_hong_mong_chu",        file: "bb_hong_mong_chu_nobg.png" },
    { name: "bb_thien_long_giap",      file: "bb_thien_long_giap_nobg.png" },
    { name: "bb_bat_qua_kinh",         file: "bb_bat_qua_kinh_nobg.png" },
    { name: "bb_vo_bien_nhan",         file: "bb_vo_bien_nhan_nobg.png" },
    { name: "bb_linh_thu_ho_tam",      file: "bb_linh_thu_ho_tam_nobg.png" },
    { name: "bb_da_thu_sat_khi",       file: "bb_da_thu_sat_khi_nobg.png" },
    { name: "bb_tinh_thach_hoi_linh",  file: "bb_tinh_thach_hoi_linh_nobg.png" },
    { name: "bb_huyen_long_tam_chau",  file: "bb_huyen_long_tam_chau_nobg.png" },
    { name: "bb_than_thu_tam_ngoc",    file: "bb_than_thu_tam_ngoc_nobg.png" },
    { name: "bb_linh_hon_am_khi",      file: "bb_linh_hon_am_khi_nobg.png" },
    { name: "bb_phong_linh_boi",       file: "bb_phong_linh_boi_nobg.png" },
    { name: "bb_hoa_am_nhan",          file: "bb_hoa_am_nhan_nobg.png" },
    { name: "bb_cuu_tinh_giap",        file: "bb_cuu_tinh_giap_nobg.png" },
    { name: "bb_huyen_khong_linh_nang",file: "bb_huyen_khong_linh_nang_nobg.png" },
    { name: "bb_thien_dia_dai_nang",   file: "bb_thien_dia_dai_nang_nobg.png" },
  ],

  NGHE_IMG_DEFS = [
    { name: "ng_luyen_dan",     file: "ng_luyen_dan_nobg.png" },
    { name: "ng_phi_khi_su",    file: "ng_phi_khi_su_nobg.png" },
    { name: "ng_phu_luc_su",    file: "ng_phu_luc_su_nobg.png" },
    { name: "ng_am_ve",         file: "ng_am_ve_nobg.png" },
    { name: "ng_phong_thuy_su", file: "ng_phong_thuy_su_nobg.png" },
    { name: "ng_duoc_su",       file: "ng_duoc_su_nobg.png" },
    { name: "ng_ngo_dao_su",    file: "ng_ngo_dao_su_nobg.png" },
    { name: "ni_ngo_tinh",    file: "ni_ngo_tinh_nobg.png" },
    { name: "ni_binh_canh",   file: "ni_binh_canh_nobg.png" },
    { name: "ni_dai_ngo",     file: "ni_dai_ngo_nobg.png" },
    { name: "ni_truyen_dao",  file: "ni_truyen_dao_nobg.png" },
    { name: "ni_khi_van",     file: "ni_khi_van_nobg.png" },
    { name: "ni_dan_duoc",    file: "ni_dan_duoc_nobg.png" },
    { name: "ni_phi_khi",     file: "ni_phi_khi_nobg.png" },
    { name: "ni_phu_luc",     file: "ni_phu_luc_nobg.png" },
    { name: "ni_am_sat",      file: "ni_am_sat_nobg.png" },
    { name: "ni_chua_thuong", file: "ni_chua_thuong_nobg.png" },
    { name: "ni_vien_dan",    file: "ni_vien_dan_nobg.png" },
    { name: "ni_ban_dan",     file: "ni_ban_dan_nobg.png" },
    { name: "ni_tang_dan",    file: "ni_tang_dan_nobg.png" },
    { name: "ni_sat_tinh",    file: "ni_sat_tinh_nobg.png" },
    { name: "ni_khai_quang",  file: "ni_khai_quang_nobg.png" },
    { name: "ni_sac_ben",     file: "ni_sac_ben_nobg.png" },
    { name: "ni_ve_phu",      file: "ni_ve_phu_nobg.png" },
    { name: "ni_ve_phong_an", file: "ni_ve_phong_an_nobg.png" },
    { name: "ni_phu_bo_tro",  file: "ni_phu_bo_tro_nobg.png" },
    { name: "ni_pvp",         file: "ni_pvp_nobg.png" },
    { name: "ni_ren_luyen",   file: "ni_ren_luyen_nobg.png" },
    { name: "ni_thach_ngo",   file: "ni_thach_ngo_nobg.png" },
    { name: "ni_phu_pham",    file: "ni_phu_pham_nobg.png" },
    { name: "ni_xa_tinh",     file: "ni_xa_tinh_nobg.png" },
    { name: "ni_kiem_linh_thao", file: "ni_kiem_linh_thao_nobg.png" },
    { name: "ni_dung_phu",    file: "ni_dung_phu_nobg.png" },
    { name: "ni_an_ngu",      file: "ni_an_ngu_nobg.png" },
    { name: "ni_trinh_sat",   file: "ni_trinh_sat_nobg.png" },
    { name: "ni_sat_y",       file: "ni_sat_y_nobg.png" },
    { name: "ni_boi",         file: "ni_boi_nobg.png" },
    { name: "ni_khai_van",    file: "ni_khai_van_nobg.png" },
    { name: "ni_tien_tri",    file: "ni_tien_tri_nobg.png" },
    { name: "ni_tran_van",    file: "ni_tran_van_nobg.png" },
    { name: "ni_cau_phuc",    file: "ni_cau_phuc_nobg.png" },
    { name: "ni_than_the",    file: "ni_than_the_nobg.png" },
    { name: "ni_che_doc",     file: "ni_che_doc_nobg.png" },
    { name: "ni_giai_doc",    file: "ni_giai_doc_nobg.png" },
    { name: "ni_dac_ky",     file: "ni_dac_ky_nobg.png" },
    { name: "cd_timer",      file: "cd_timer_nobg.png"  },
  ],
  DAO_TU_IMG_DEFS = [
    { name: "dt_kiem_tu",  file: "dt_kiem_tu_nobg.png" },
    { name: "dt_the_tu",   file: "dt_the_tu_nobg.png" },
    { name: "dt_phap_tu",  file: "dt_phap_tu_nobg.png" },
    { name: "dt_ma_tu",    file: "dt_ma_tu_nobg.png" },
    { name: "dt_yeu_tu",   file: "dt_yeu_tu_nobg.png" },
    { name: "dt_dan_tu",   file: "dt_dan_tu_nobg.png" },
    { name: "dt_khi_tu",   file: "dt_khi_tu_nobg.png" },
    { name: "dt_tran_tu",  file: "dt_tran_tu_nobg.png" },
  ],
  NGO_TINH_IMG_DEFS = [
    { name: "nt_pham",  file: "nt_pham_nobg.png" },
    { name: "nt_linh",  file: "nt_linh_nobg.png" },
    { name: "nt_dia",   file: "nt_dia_nobg.png" },
    { name: "nt_thien", file: "nt_thien_nobg.png" },
    { name: "nt_tien",  file: "nt_tien_nobg.png" },
  ],
  NHAN_QUA_IMG_DEFS = [
    { name: "nq_vien_man", file: "nq_vien_man_nobg.png" },
    { name: "nq_cong_duc", file: "nq_cong_duc_nobg.png" },
    { name: "nq_tieu",     file: "nq_tieu_nobg.png" },
    { name: "nq_trung",    file: "nq_trung_nobg.png" },
    { name: "nq_nghiep",   file: "nq_nghiep_nobg.png" },
    { name: "nq_sau",      file: "nq_sau_nobg.png" },
    { name: "nq_chuong",   file: "nq_chuong_nobg.png" },
  ],
  PHU_LUC_IMG_DEFS = [
    { name: "pl_ho_than",   file: "pl_ho_than_nobg.png" },
    { name: "pl_sat_phong", file: "pl_sat_phong_nobg.png" },
    { name: "pl_linh_hoi",  file: "pl_linh_hoi_nobg.png" },
    { name: "pl_tu_toc",    file: "pl_tu_toc_nobg.png" },
    { name: "pl_khai_ngo",  file: "pl_khai_ngo_nobg.png" },
    { name: "pl_thien_dia", file: "pl_thien_dia_nobg.png" },
    { name: "pl_pha_canh",  file: "pl_pha_canh_nobg.png" },
  ],
  PHONG_THUY_IMG_DEFS = [
    { name: "ptv_dai_cat",   file: "ptv_dai_cat_nobg.png" },
    { name: "ptv_tieu_cat",  file: "ptv_tieu_cat_nobg.png" },
    { name: "ptv_binh",      file: "ptv_binh_nobg.png" },
    { name: "ptv_tieu_hung", file: "ptv_tieu_hung_nobg.png" },
    { name: "ptv_dai_hung",  file: "ptv_dai_hung_nobg.png" },
  ],
  DONG_PHU_IMG_DEFS = [
    { name: "dp_linh_son",    file: "dp_linh_son_nobg.png" },
    { name: "dp_hoa_van",     file: "dp_hoa_van_nobg.png" },
    { name: "dp_bang_phong",  file: "dp_bang_phong_nobg.png" },
    { name: "dp_tien_canh",   file: "dp_tien_canh_nobg.png" },
  ],
  TRUYEN_THUA_IMG_DEFS = [
    { name: "tt_thien_long", file: "tt_thien_long_nobg.png" },
    { name: "tt_van_thuy",   file: "tt_van_thuy_nobg.png" },
    { name: "tt_ma_dao",     file: "tt_ma_dao_nobg.png" },
    { name: "tt_kiem_dao",   file: "tt_kiem_dao_nobg.png" },
    { name: "tt_hon_don",    file: "tt_hon_don_nobg.png" },
  ],
  TONG_MON_IMG_DEFS = [
    { name: "tm_thanh_van",   file: "tm_thanh_van_nobg.png" },
    { name: "tm_huyen_thien", file: "tm_huyen_thien_nobg.png" },
    { name: "tm_van_kiem",    file: "tm_van_kiem_nobg.png" },
    { name: "tm_ma_than",     file: "tm_ma_than_nobg.png" },
  ],
  TONG_MON_CAPBAC_IMG_DEFS = [
    { name: "tmcb_ngoai_mon",  file: "tmcb_ngoai_mon_nobg.png" },
    { name: "tmcb_noi_mon",    file: "tmcb_noi_mon_nobg.png" },
    { name: "tmcb_chan_truyen", file: "tmcb_chan_truyen_nobg.png" },
    { name: "tmcb_thanh_tu",   file: "tmcb_thanh_tu_nobg.png" },
    { name: "tmcb_tong_chu",   file: "tmcb_tong_chu_nobg.png" },
  ],
  KHOANG_VAT_IMG_DEFS = [
    { name: "kv_sat_tinh",    file: "kv_sat_tinh_nobg.png" },
    { name: "kv_huyen_thiet", file: "kv_huyen_thiet_nobg.png" },
    { name: "kv_tinh_cang",   file: "kv_tinh_cang_nobg.png" },
    { name: "kv_thien_tiet",  file: "kv_thien_tiet_nobg.png" },
    { name: "kv_vong_tinh",   file: "kv_vong_tinh_nobg.png" },
  ],
  DAO_THUONG_IMG_DEFS = [
    { name: "dt_nhe",   file: "dt_nhe_nobg.png" },
    { name: "dt_trung", file: "dt_trung_nobg.png" },
    { name: "dt_nang",  file: "dt_nang_nobg.png" },
  ],
  TINH_NANG_IMG_DEFS = [
    { name: "ft_am_sat",    file: "ft_am_sat_nobg.png" },
    { name: "ft_dao_tam",   file: "ft_dao_tam_nobg.png" },
    { name: "ft_vuot_kiep", file: "ft_vuot_kiep_nobg.png" },
    { name: "ft_thap",      file: "ft_thap_nobg.png" },
    { name: "ft_bi_canh",   file: "ft_bi_canh_nobg.png" },
    { name: "ft_nhiem_vu",  file: "ft_nhiem_vu_nobg.png" },
    { name: "ft_linh_ngo",  file: "ft_linh_ngo_nobg.png" },
    { name: "ft_ban_dan",   file: "ft_ban_dan_nobg.png" },
    { name: "ft_san_linh",  file: "ft_san_linh_nobg.png" },
    { name: "ft_co_duyen",  file: "ft_co_duyen_nobg.png" },
    { name: "ft_pvp",       file: "ft_pvp_nobg.png" },
    // Tính năng mới — ảnh thật AI-generated
    { name: "ft_dot_pha",   file: "ft_dot_pha_nobg.png" },
    { name: "ft_tu_luyen",  file: "ft_tu_luyen_nobg.png" },
    { name: "ft_luyen_dan", file: "ft_luyen_dan_nobg.png" },
    { name: "ft_trang_bi",  file: "ft_trang_bi_nobg.png" },
    { name: "ft_tui",       file: "ft_tui_nobg.png" },
    { name: "ft_gia_toc",   file: "ft_gia_toc_nobg.png" },
    { name: "ft_daily",     file: "ft_daily_nobg.png" },
    { name: "ft_dau_gia",   file: "ft_dau_gia_nobg.png" },
    { name: "ft_vat_pham",  file: "ft_vat_pham_nobg.png" },
    { name: "ft_huyet_mach",file: "ft_huyet_mach_nobg.png" },
    // Batch 2 — linh_can, cong_phap, tong_mon, dong_phu, linh_thao, khai_quang, phu_phep, than_thong, bxh, phong_thuy
    { name: "ft_linh_can",  file: "ft_linh_can_nobg.png" },
    { name: "ft_cong_phap", file: "ft_cong_phap_nobg.png" },
    { name: "ft_tong_mon",  file: "ft_tong_mon_nobg.png" },
    { name: "ft_dong_phu",  file: "ft_dong_phu_nobg.png" },
    { name: "ft_linh_thao", file: "ft_linh_thao_nobg.png" },
    { name: "ft_khai_quang",file: "ft_khai_quang_nobg.png" },
    { name: "ft_phu_phep",  file: "ft_phu_phep_nobg.png" },
    { name: "ft_than_thong",file: "ft_than_thong_nobg.png" },
    { name: "ft_bxh",       file: "ft_bxh_nobg.png" },
    { name: "ft_phong_thuy",file: "ft_phong_thuy_nobg.png" },
    // Batch 3 — profile, nghe, kham_pha, healing, hap_thu, dung_dan, bi_phap, bao_linh, am_ve, dao_tu
    { name: "ft_profile",   file: "ft_profile_nobg.png" },
    { name: "ft_nghe",      file: "ft_nghe_nobg.png" },
    { name: "ft_kham_pha",  file: "ft_kham_pha_nobg.png" },
    { name: "ft_healing",   file: "ft_healing_nobg.png" },
    { name: "ft_hap_thu",   file: "ft_hap_thu_nobg.png" },
    { name: "ft_dung_dan",  file: "ft_dung_dan_nobg.png" },
    { name: "ft_bi_phap",   file: "ft_bi_phap_nobg.png" },
    { name: "ft_linh_bao",  file: "ft_linh_bao_nobg.png" },
    { name: "ft_bao_linh",  file: "ft_bao_linh_nobg.png" },
    { name: "ft_am_ve",     file: "ft_am_ve_nobg.png" },
    { name: "ft_dao_tu",    file: "ft_dao_tu_nobg.png" },
    // Bí Cảnh option icons
    { name: "bc_mao_hiem",           file: "bc_mao_hiem_nobg.png" },
    { name: "bc_kham_pha_co_dien",   file: "bc_kham_pha_co_dien_nobg.png" },
    { name: "bc_thu_hoach_linh_duoc",file: "bc_thu_hoach_linh_duoc_nobg.png" },
    { name: "bc_co_tran_huy_diet",   file: "bc_co_tran_huy_diet_nobg.png" },
    { name: "bc_duong_dau_thu_than",  file: "bc_duong_dau_thu_than_nobg.png" },
    { name: "bc_truyen_thua_co_dai",  file: "bc_truyen_thua_co_dai_nobg.png" },
    { name: "bc_tranh_doat_linh_bao", file: "bc_tranh_doat_linh_bao_nobg.png" },
    { name: "bc_dau_phap_tu_si",      file: "bc_dau_phap_tu_si_nobg.png" },
    { name: "bc_khai_thac_linh_mach", file: "bc_khai_thac_linh_mach_nobg.png" },
    { name: "bc_rut_lui",             file: "bc_rut_lui_nobg.png" },
    // Batch 4 — do_vui, donate, giftcode, kham_benh, luyen_thuoc, social, thong_ke, thu_hoi, vut, xem_dao_thuong
    { name: "ft_do_vui",       file: "ft_do_vui_nobg.png" },
    { name: "ft_donate",       file: "ft_donate_nobg.png" },
    { name: "ft_giftcode",     file: "ft_giftcode_nobg.png" },
    { name: "ft_kham_benh",    file: "ft_kham_benh_nobg.png" },
    { name: "ft_luyen_thuoc",  file: "ft_luyen_thuoc_nobg.png" },
    { name: "ft_social",       file: "ft_social_nobg.png" },
    { name: "ft_thong_ke",     file: "ft_thong_ke_nobg.png" },
    { name: "ft_thu_hoi",      file: "ft_thu_hoi_nobg.png" },
    { name: "ft_vut",          file: "ft_vut_nobg.png" },
    { name: "ft_xem_dao_thuong",file: "ft_xem_dao_thuong_nobg.png" },
    { name: "ft_bxh_thap",     file: "ft_bxh_thap_nobg.png" },
    { name: "ft_dao_tu_path",  file: "ft_dao_tu_path_nobg.png" },
    { name: "thien_kiep",   file: "thien_kiep_nobg.png" },
    { name: "tia_set",      file: "tia_set_nobg.png"    },
    { name: "tam_nhan",     file: "tam_nhan_nobg.png" },
    { name: "tam_trung",    file: "tam_trung_nobg.png" },
    { name: "tam_ma",       file: "tam_ma_nobg.png" },
    { name: "tam_ac",       file: "tam_ac_nobg.png" },
    // Vé đổi — ticket emojis (AI-generated)
    { name: "ve_linh_can",   file: "ve_linh_can.png" },
    { name: "ve_huyet_mach", file: "ve_huyet_mach.png" },
    { name: "ve_nghe",       file: "ve_nghe.png" },
    { name: "ve_gacha",      file: "ve_gacha.png" },
    // Độ hiếm Gacha — rarity gem icons (AI-generated)
    { name: "rarity_pho_thong",   file: "rarity_pho_thong_nobg.png"   },
    { name: "rarity_hiem",        file: "rarity_hiem_nobg.png"        },
    { name: "rarity_su_thi",      file: "rarity_su_thi_nobg.png"      },
    { name: "rarity_huyen_thoai", file: "rarity_huyen_thoai_nobg.png" },
    { name: "rarity_than_thanh",  file: "rarity_than_thanh_nobg.png"  },
    // ── Donate UI icons — gift box, tip, warn ────────────────────────────
    { name: "donate_gift", file: "donate_gift_nobg.png" },
    { name: "tip_icon",    file: "tip_icon_nobg.png"    },
    { name: "warn_icon",   file: "warn_icon_nobg.png"   },
    // ── Hộp quà Lần Đầu — 7 tier gift boxes ─────────────────────────────
    { name: "gift_nhap_dao",  file: "gift_nhap_dao_nobg.png"  },
    { name: "gift_linh_can",  file: "gift_linh_can_nobg.png"  },
    { name: "gift_tui_tru",   file: "gift_tui_tru_nobg.png"   },
    { name: "gift_phi_thang", file: "gift_phi_thang_nobg.png" },
    { name: "gift_khai_dao",  file: "gift_khai_dao_nobg.png"  },
    { name: "gift_vo_song",   file: "gift_vo_song_nobg.png"   },
    { name: "gift_thien_dia", file: "gift_thien_dia_nobg.png" },
  ],
  GIA_TOC_IMG_DEFS = [
    { name: "gt_moc_linh",   file: "gt_moc_linh.png" },
    { name: "gt_hoa_linh",   file: "gt_hoa_linh.png" },
    { name: "gt_thuy_linh",  file: "gt_thuy_linh.png" },
    { name: "gt_tho_linh",   file: "gt_tho_linh.png" },
    { name: "gt_loi_linh",   file: "gt_loi_linh.png" },
    { name: "gt_nguyet_anh", file: "gt_nguyet_anh.png" },
    { name: "gt_thai_duong", file: "gt_thai_duong.png" },
    { name: "gt_kim_cuong",  file: "gt_kim_cuong.png" },
    { name: "gt_long_huyet", file: "gt_long_huyet.png" },
    { name: "gt_thien_ung",  file: "gt_thien_ung.png" },
    { name: "gt_huyen_linh", file: "gt_huyen_linh.png" },
    { name: "gt_thien_menh", file: "gt_thien_menh.png" },
    { name: "gt_bat_hoang",  file: "gt_bat_hoang.png" },
    { name: "gt_vo_thuong",  file: "gt_vo_thuong.png" },
  ],
  CANH_GIOI_IMG_DEFS = [
    { name: "rank_pham_nhan",  file: "rank_pham_nhan.png" },
    { name: "rank_luyen_khi",  file: "rank_luyen_khi.png" },
    { name: "rank_truc_co",    file: "rank_truc_co.png" },
    { name: "rank_ket_dan",    file: "rank_ket_dan.png" },
    { name: "rank_nguyen_anh", file: "rank_nguyen_anh.png" },
    { name: "rank_hoa_than",   file: "rank_hoa_than.png" },
    { name: "rank_luyen_hu",   file: "rank_luyen_hu.png" },
    { name: "rank_hop_the",    file: "rank_hop_the.png" },
    { name: "rank_dai_thua",   file: "rank_dai_thua.png" },
    { name: "rank_do_kiep",    file: "rank_do_kiep.png" },
    { name: "rank_tien_nhan",  file: "rank_tien_nhan.png" },
  ],
  VAT_PHAM_IMG_DEFS = [
    { name: "vp_da_linh_thu",           file: "da_linh_thu_nobg.png" },
    { name: "vp_long_linh_thu",         file: "long_linh_thu_nobg.png" },
    { name: "vp_rang_vuot",             file: "rang_vuot_nobg.png" },
    { name: "vp_xuong_linh_thu",        file: "xuong_linh_thu_nobg.png" },
    { name: "vp_tinh_thach_nho",        file: "tinh_thach_nho_nobg.png" },
    { name: "vp_nanh_linh_thu",         file: "nanh_linh_thu_nobg.png" },
    { name: "vp_tinh_thach_trung",      file: "tinh_thach_trung_nobg.png" },
    { name: "vp_xuong_huyen_linh",      file: "xuong_huyen_linh_nobg.png" },
    { name: "vp_vay_linh_long",         file: "vay_linh_long_nobg.png" },
    { name: "vp_tinh_thach_than",       file: "tinh_thach_than_nobg.png" },
    { name: "vp_tim_than_thu",          file: "vp_tim_than_thu_nobg.png" },
    { name: "vp_linh_hon_than_thu",     file: "vp_linh_hon_than_thu_nobg.png" },
  ];

// ── Raw Discord API helpers (không phụ thuộc discord.js version) ──────────
async function _discordAPI(token, method, endpoint, body) {
  const url = `https://discord.com/api/v10${endpoint}`;
  const opts = {
    method,
    headers: { Authorization: `Bot ${token}`, 'Content-Type': 'application/json', 'User-Agent': 'TuTienBot/1.0' },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function initCustomEmoji(client) {
  const _delay = (ms) => new Promise((r) => setTimeout(r, ms));

  const total =
    EMOJI_DEFS.length +
    LINH_CAN_IMG_DEFS.length +
    HUYET_MACH_IMG_DEFS.length +
    DAN_DUOC_IMG_DEFS.length +
    DAN_PHAM_IMG_DEFS.length +
    LINH_THAO_IMG_DEFS.length +
    CONG_PHAP_IMG_DEFS.length +
    BI_PHAP_IMG_DEFS.length +
    STAT_IMG_DEFS.length +
    STAT_IMG_DEFS_EXTRA.length +
    NGOC_GIAN_IMG_DEFS.length +
    LINH_THU_IMG_DEFS.length +
    VAT_PHAM_IMG_DEFS.length +
    VU_KHI_IMG_DEFS.length +
    BAO_BOI_IMG_DEFS.length +
    NGHE_IMG_DEFS.length +
    DAO_TU_IMG_DEFS.length +
    NGO_TINH_IMG_DEFS.length +
    NHAN_QUA_IMG_DEFS.length +
    PHU_LUC_IMG_DEFS.length +
    PHONG_THUY_IMG_DEFS.length +
    DONG_PHU_IMG_DEFS.length +
    TRUYEN_THUA_IMG_DEFS.length +
    TONG_MON_IMG_DEFS.length +
    TONG_MON_CAPBAC_IMG_DEFS.length +
    KHOANG_VAT_IMG_DEFS.length +
    CANH_GIOI_IMG_DEFS.length +
    GIA_TOC_IMG_DEFS.length +
    DAO_THUONG_IMG_DEFS.length +
    TINH_NANG_IMG_DEFS.length;

  const token = client.token;
  const appId = client.application?.id;

  if (!token || !appId) {
    console.error('❌ [Emoji] Thiếu token hoặc application ID — bỏ qua upload emoji.');
    console.error(`   token=${token ? 'có' : 'KHÔNG CÓ'}, appId=${appId ?? 'KHÔNG CÓ'}`);
    return;
  }

  console.log(`🎨 [Emoji] Bắt đầu khởi tạo emoji (appId=${appId})...`);

  // Lấy danh sách emoji hiện có qua raw API
  let existingMap = {};
  try {
    const { status, data } = await _discordAPI(token, 'GET', `/applications/${appId}/emojis`);
    if (status !== 200) {
      console.error(`❌ [Emoji] GET /emojis thất bại: HTTP ${status} — ${JSON.stringify(data).slice(0, 120)}`);
      if (status === 401) console.error('   → DISCORD_TOKEN không hợp lệ!');
      if (status === 403) console.error('   → Bot thiếu quyền quản lý Application Emojis.');
      return;
    }
    const list = data.items ?? data ?? [];
    for (const e of list) existingMap[e.name] = e;
    console.log(`🎨 [Emoji] Discord hiện có: ${list.length} emoji.`);
  } catch (err) {
    console.error(`❌ [Emoji] Không gọi được Discord API: ${err.message}`);
    return;
  }

  let ok = 0, registered = 0, replaced = 0, failed = 0;

  async function _register(name, getImageData, forceRefresh = false) {
    const existing = existingMap[name];
    if (existing && !forceRefresh) {
      CUSTOM_EMOJI[name] = `<:${existing.name}:${existing.id}>`;
      ok++;
      return;
    }

    let imgBuffer = await getImageData();
    if (!imgBuffer) {
      if (existing) {
        CUSTOM_EMOJI[name] = `<:${existing.name}:${existing.id}>`;
        ok++;
      } else {
        console.warn(`⚠️ Bỏ qua [${name}]: không có file ảnh`);
        failed++;
      }
      return;
    }

    // Auto-resize nếu ảnh > 256KB (giới hạn Discord cho custom emoji)
    const DISCORD_EMOJI_LIMIT = 256 * 1024;
    if (imgBuffer.length > DISCORD_EMOJI_LIMIT) {
      if (_sharp) {
        try {
          const origKB = Math.round(imgBuffer.length / 1024);
          imgBuffer = await _sharp(imgBuffer)
            .resize(128, 128, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
            .png({ compressionLevel: 9 })
            .toBuffer();
          // Nếu vẫn còn lớn hơn 256KB, thu nhỏ thêm
          if (imgBuffer.length > DISCORD_EMOJI_LIMIT) {
            imgBuffer = await _sharp(imgBuffer)
              .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
              .png({ compressionLevel: 9 })
              .toBuffer();
          }
          console.log(`🗜️ [${name}] resize ${origKB}KB → ${Math.round(imgBuffer.length/1024)}KB`);
        } catch (resizeErr) {
          console.warn(`⚠️ resize [${name}] lỗi: ${resizeErr.message}`);
        }
      } else {
        console.warn(`⚠️ [${name}] ảnh ${Math.round(imgBuffer.length/1024)}KB > 256KB, sharp chưa cài — bỏ qua upload`);
        if (existing) {
          CUSTOM_EMOJI[name] = `<:${existing.name}:${existing.id}>`;
          ok++;
        } else {
          failed++;
        }
        return;
      }
    }

    // Xóa emoji cũ nếu cần refresh
    if (existing && forceRefresh) {
      const { status } = await _discordAPI(token, 'DELETE', `/applications/${appId}/emojis/${existing.id}`);
      if (status !== 204 && status !== 200) {
        console.warn(`⚠️ Không xóa được emoji cũ [${name}]: HTTP ${status}`);
      }
      await _delay(600);
    }

    // Validate tên emoji theo đúng quy định Discord: 2-32 ký tự, chỉ chữ/số/gạch dưới
    if (!/^[a-zA-Z0-9_]{2,32}$/.test(name)) {
      console.warn(`❌ [${name}] tên emoji không hợp lệ (phải 2-32 ký tự chữ/số/gạch dưới) — bỏ qua`);
      failed++;
      return;
    }

    // Convert Buffer → data URI (encodeImage sẽ re-encode PNG "sạch" qua sharp nếu có,
    // để loại bỏ mọi metadata/chunk bất thường có thể khiến Discord trả 400 Invalid Form Body)
    async function _encodeImage(buf) {
      if (_sharp) {
        try {
          return await _sharp(buf).png({ compressionLevel: 9 }).toBuffer();
        } catch (e) {
          console.warn(`⚠️ [${name}] re-encode qua sharp lỗi: ${e.message} — dùng ảnh gốc`);
          return buf;
        }
      }
      return buf;
    }

    // Endpoint tạo emoji của Discord có rate limit riêng, khắt khe hơn nhiều
    // và KHÔNG theo cơ chế rate limit thông thường (theo doc chính thức của Discord:
    // "Routes for controlling emojis do not follow the normal rate limit conventions...
    //  you may encounter 429s"). Vì vậy khi bị 429 phải nghỉ đúng theo `retry_after`
    // Discord trả về (có thể vài chục giây tới vài phút), KHÔNG dùng backoff cố định
    // ngắn như lỗi thường — nếu không, các emoji bị 429 sẽ luôn thất bại sau khi đã
    // xoá emoji cũ (forceRefresh) và không có gì thay thế → hiện icon vỡ.
    const MAX_RETRY = 3;
    const MAX_RATE_LIMIT_WAITS = 5; // số lần tối đa chịu chờ do 429 trước khi bỏ cuộc
    let attempt = 1;
    let rateLimitWaits = 0;
    while (attempt <= MAX_RETRY) {
      await _delay(1200);

      // Từ lần thử thứ 2 trở đi, re-encode ảnh qua sharp để loại trừ khả năng
      // PNG gốc chứa chunk/metadata mà Discord không chấp nhận.
      const uploadBuf = attempt > 1 ? await _encodeImage(imgBuffer) : imgBuffer;
      const b64 = uploadBuf.toString('base64');
      const dataUri = `data:image/png;base64,${b64}`;

      const { status, data } = await _discordAPI(token, 'POST', `/applications/${appId}/emojis`, {
        name,
        image: dataUri,
      });

      if (status === 201 || status === 200) {
        CUSTOM_EMOJI[name] = `<:${data.name}:${data.id}>`;
        ok++;
        if (existing) replaced++; else registered++;
        return;
      }

      if (status === 429 && rateLimitWaits < MAX_RATE_LIMIT_WAITS) {
        // Discord trả retry_after tính bằng giây trong body khi 429.
        const retryAfterSec = Number(data?.retry_after ?? 5);
        const wait = Math.ceil(Math.max(retryAfterSec, 1) * 1000) + 500;
        rateLimitWaits++;
        console.warn(`⏳ [${name}] bị rate limit (429) — chờ ${Math.round(wait / 1000)}s rồi thử lại (lần chờ ${rateLimitWaits}/${MAX_RATE_LIMIT_WAITS})...`);
        await _delay(wait);
        continue; // không tính vào MAX_RETRY, vì đây không phải lỗi thật
      }

      // Log chi tiết lỗi thật từ Discord (bao gồm field-level errors) thay vì chỉ message chung chung
      const detail = data?.errors ? JSON.stringify(data.errors).slice(0, 300) : (data?.message ?? JSON.stringify(data).slice(0, 200));
      const wait = attempt * 4000;
      console.warn(`⚠️ [${name}] lần ${attempt}/${MAX_RETRY}: HTTP ${status} ${detail} — thử lại sau ${wait}ms`);
      attempt++;
      if (attempt <= MAX_RETRY) await _delay(wait);
    }
    console.warn(`❌ [${name}] thất bại sau ${MAX_RETRY} lần thử`);
    failed++;
  }

  for (const def of EMOJI_DEFS) {
    await _register(def.name, () => _makePNG(64, def.draw));
  }

  const IMG_GROUPS = [
    ...LINH_CAN_IMG_DEFS,
    ...HUYET_MACH_IMG_DEFS,
    ...DAN_DUOC_IMG_DEFS,
    ...DAN_PHAM_IMG_DEFS,
    ...LINH_THAO_IMG_DEFS,
    ...CONG_PHAP_IMG_DEFS,
    ...BI_PHAP_IMG_DEFS,
    ...STAT_IMG_DEFS,
    ...STAT_IMG_DEFS_EXTRA,
    ...NGOC_GIAN_IMG_DEFS,
    ...LINH_THU_IMG_DEFS,
    ...VAT_PHAM_IMG_DEFS,
    ...VU_KHI_IMG_DEFS,
    ...BAO_BOI_IMG_DEFS,
    ...NGHE_IMG_DEFS,
    ...DAO_TU_IMG_DEFS,
    ...NGO_TINH_IMG_DEFS,
    ...NHAN_QUA_IMG_DEFS,
    ...PHU_LUC_IMG_DEFS,
    ...PHONG_THUY_IMG_DEFS,
    ...DONG_PHU_IMG_DEFS,
    ...TRUYEN_THUA_IMG_DEFS,
    ...TONG_MON_IMG_DEFS,
    ...TONG_MON_CAPBAC_IMG_DEFS,
    ...KHOANG_VAT_IMG_DEFS,
    ...CANH_GIOI_IMG_DEFS,
    ...GIA_TOC_IMG_DEFS,
    ...DAO_THUONG_IMG_DEFS,
    ...TINH_NANG_IMG_DEFS,
  ];
  const forceRefreshAll = process.env.EMOJI_FORCE_REFRESH === '1';
  const hashCache = _loadHashCache();
  // Lần đầu chưa có cache → chỉ xây cache, KHÔNG force refresh gì cả
  const isFirstRun = Object.keys(hashCache).length === 0;
  if (isFirstRun) console.log('🎨 [Emoji] Lần đầu chạy hash cache — chỉ xây cache, không re-upload hàng loạt.');
  const newHashCache = { ...hashCache };

  for (const def of IMG_GROUPS) {
    const filePath = path.resolve(__dirname, '../assets/images', def.file);
    let shouldRefresh = forceRefreshAll;
    if (!shouldRefresh && !isFirstRun && fs.existsSync(filePath)) {
      const buf = fs.readFileSync(filePath);
      const curHash = _hashBuf(buf);
      if (hashCache[def.name] !== curHash) {
        shouldRefresh = true;
        console.log(`🔄 [${def.name}] ảnh thay đổi → tự re-upload`);
      }
      newHashCache[def.name] = curHash;
    } else if (fs.existsSync(filePath)) {
      newHashCache[def.name] = _hashBuf(fs.readFileSync(filePath));
    }
    await _register(def.name, () => {
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ File không tồn tại: ${def.name} (${def.file})`);
        return null;
      }
      return fs.readFileSync(filePath);
    }, shouldRefresh);
  }

  _saveHashCache(newHashCache);

  const notes = [];
  if (registered > 0) notes.push(`mới: ${registered}`);
  if (replaced > 0) notes.push(`cập nhật: ${replaced}`);
  const noteStr = notes.length ? ` (${notes.join(', ')})` : '';
  console.log(`🎨 Application emoji: ✅ ${ok}/${total}${noteStr}${failed > 0 ? ` | ❌ ${failed} thất bại` : ''}`);
}

module.exports = { CUSTOM_EMOJI, UNICODE_EMOJI, CE, CEu, getCEUrl, getCardAttachment, getLinhThuAttachment, initCustomEmoji };
