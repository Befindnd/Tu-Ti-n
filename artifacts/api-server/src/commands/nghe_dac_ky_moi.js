'use strict';
/**
 * nghe_dac_ky_moi.js — Loader tổng hợp đặc kỹ mới cho 7 nghề
 *
 * Mỗi nghề nằm trong file riêng:
 *   am_ve.js        — 🗡️  Ám Vệ      (trinh_sat, xa_tinh, sat_y)
 *   phi_khi_su.js   — 🔱  Phi Khí Sư (bo_khi, linh_bieu)
 *   phu_luc_su.js   — 📜  Phù Lục Sư (phu_pham, ve_phong_an)
 *   phong_thuy.js   — 🧭  Phong Thủy  (tien_tri, tran_van)
 *   duoc_su.js      — 💉  Dược Sư     (che_doc, giai_doc)
 *   luyen_dan.js    — ⚗️   Luyện Đan  (dan_kho, tang_dan)
 *   ngo_dao_su.js   — 🌀  Ngộ Đạo Sư (cong_huong, dao_kinh)
 */
require('./nghe_dac_ky/am_ve');
require('./nghe_dac_ky/phi_khi_su');
require('./nghe_dac_ky/phu_luc_su');
require('./nghe_dac_ky/phong_thuy');
require('./nghe_dac_ky/duoc_su');
require('./nghe_dac_ky/luyen_dan');
require('./nghe_dac_ky/ngo_dao_su');
