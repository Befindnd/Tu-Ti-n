'use strict';

const { CE } = require('../systems/emoji');

/**
 * data/gia_toc.js
 * Dữ liệu Gia Tộc — được gán ngẫu nhiên khi người chơi dùng -bat_dau.
 *
 * Mỗi gia tộc có:
 *   id         - khóa lưu trong DB
 *   ten        - tên hiển thị
 *   emoji      - biểu tượng (getter → trả về CE() image emoji nếu đã upload)
 *   do_quy     - độ quý hiếm: 'pham' | 'thuong' | 'quy' | 'sử_thi' | 'huyen_thoai'
 *   mo_ta      - mô tả gia tộc
 *   bonus      - mô tả hiệu ứng cộng thêm (hiển thị cho người chơi)
 *   atk_bonus  - % cộng thêm ATK  (0.05 = +5%)
 *   def_bonus  - % cộng thêm DEF
 *   hp_bonus   - % cộng thêm HP tối đa
 *   crit_bonus - cộng thêm tỷ lệ bạo kích (0.03 = +3%)
 *   tu_vi_bonus- % EXP tu luyện nhận thêm
 *   weight     - trọng số rút thăm (số càng thấp → càng hiếm)
 *   bi_phap_id - ID bí pháp độc quyền của gia tộc
 *   bi_phap_ten- Tên bí pháp độc quyền
 *   bi_phap_yc - Cảnh giới tối thiểu để học bí pháp gia tộc
 */

const GIA_TOC = [
  // ─── Phàm Cấp (Rất phổ biến) ───────────────────────────────────────────
  {
    id: 'moc_linh',
    ce_name: 'gt_moc_linh',
    ten: 'Mộc Linh Tộc',
    get emoji() { return CE(this.ce_name, '🌿'); },
    do_quy: 'pham',
    do_quy_ten: 'Phàm Tộc',
    mo_ta: 'Hậu duệ của các linh sư thảo nguyên cổ đại, hòa mình vào sinh khí đất trời. Thể chất bền bỉ, hồi phục nhanh.',
    bonus: '+8% HP Tối Đa',
    atk_bonus: 0,
    def_bonus: 0,
    hp_bonus: 0.08,
    crit_bonus: 0,
    tu_vi_bonus: 0,
    weight: 20,
    bi_phap_id: 'moc_linh_bi_phap',
    bi_phap_ten: 'Linh Mộc Tái Sinh Pháp',
    bi_phap_yc: 0,
  },
  {
    id: 'hoa_linh',
    ce_name: 'gt_hoa_linh',
    ten: 'Hỏa Linh Tộc',
    get emoji() { return CE(this.ce_name, '🔥'); },
    do_quy: 'pham',
    do_quy_ten: 'Phàm Tộc',
    mo_ta: 'Dòng dõi của những chiến binh lửa thiêu đốt kẻ thù từ ngàn dặm. Sức tấn công vượt trội người thường.',
    bonus: '+8% ATK',
    atk_bonus: 0.08,
    def_bonus: 0,
    hp_bonus: 0,
    crit_bonus: 0,
    tu_vi_bonus: 0,
    weight: 20,
    bi_phap_id: 'hoa_linh_bi_phap',
    bi_phap_ten: 'Hỏa Linh Nghiệp Hỏa Quyền',
    bi_phap_yc: 0,
  },
  {
    id: 'thuy_linh',
    ce_name: 'gt_thuy_linh',
    ten: 'Thủy Linh Tộc',
    get emoji() { return CE(this.ce_name, '💧'); },
    do_quy: 'pham',
    do_quy_ten: 'Phàm Tộc',
    mo_ta: 'Hậu nhân của thủy thần cổ đại, thân thể như lớp giáp nước không thể xuyên thủng. Phòng thủ kiên cố.',
    bonus: '+8% DEF',
    atk_bonus: 0,
    def_bonus: 0.08,
    hp_bonus: 0,
    crit_bonus: 0,
    tu_vi_bonus: 0,
    weight: 20,
    bi_phap_id: 'thuy_linh_bi_phap',
    bi_phap_ten: 'Thủy Linh Bảo Thân Kết',
    bi_phap_yc: 0,
  },
  {
    id: 'tho_linh',
    ce_name: 'gt_tho_linh',
    ten: 'Thổ Linh Tộc',
    get emoji() { return CE(this.ce_name, '🪨'); },
    do_quy: 'pham',
    do_quy_ten: 'Phàm Tộc',
    mo_ta: 'Gia tộc cổ xưa sống giữa lòng đất, thân thể rắn chắc như đá núi. Phòng thủ và sinh lực đều vững.',
    bonus: '+5% DEF, +5% HP',
    atk_bonus: 0,
    def_bonus: 0.05,
    hp_bonus: 0.05,
    crit_bonus: 0,
    tu_vi_bonus: 0,
    weight: 18,
    bi_phap_id: 'tho_linh_bi_phap',
    bi_phap_ten: 'Địa Sơn Thiết Giáp Công',
    bi_phap_yc: 0,
  },
  // ─── Thường Cấp (Phổ biến) ──────────────────────────────────────────────
  {
    id: 'loi_linh',
    ce_name: 'gt_loi_linh',
    ten: 'Lôi Linh Tộc',
    get emoji() { return CE(this.ce_name, '⚡'); },
    do_quy: 'thuong',
    do_quy_ten: 'Thường Tộc',
    mo_ta: 'Hậu duệ của Lôi Thần, mang sấm sét trong huyết mạch. Mỗi đòn đánh đều có thể xé toạc bầu trời.',
    bonus: '+5% ATK, +3% Bạo Kích',
    atk_bonus: 0.05,
    def_bonus: 0,
    hp_bonus: 0,
    crit_bonus: 0.03,
    tu_vi_bonus: 0,
    weight: 12,
    bi_phap_id: 'loi_linh_bi_phap',
    bi_phap_ten: 'Thiên Lôi Vạn Kích Pháp',
    bi_phap_yc: 3,
  },
  {
    id: 'nguyet_anh',
    ce_name: 'gt_nguyet_anh',
    ten: 'Nguyệt Ảnh Tộc',
    get emoji() { return CE(this.ce_name, '🌙'); },
    do_quy: 'thuong',
    do_quy_ten: 'Thường Tộc',
    mo_ta: 'Ẩn mình trong bóng trăng, chuyên về nghệ thuật ám sát và đánh lén. Nguy hiểm khi đối mặt trực tiếp.',
    bonus: '+10% ATK, +4% Bạo Kích',
    atk_bonus: 0.10,
    def_bonus: 0,
    hp_bonus: 0,
    crit_bonus: 0.04,
    tu_vi_bonus: 0,
    weight: 10,
    bi_phap_id: 'nguyet_anh_bi_phap',
    bi_phap_ten: 'Nguyệt Ảnh Liên Hoàn Kích',
    bi_phap_yc: 3,
  },
  {
    id: 'thai_duong',
    ce_name: 'gt_thai_duong',
    ten: 'Thái Dương Tộc',
    get emoji() { return CE(this.ce_name, '☀️'); },
    do_quy: 'thuong',
    do_quy_ten: 'Thường Tộc',
    mo_ta: 'Dòng máu của những kẻ tu luyện dưới ánh mặt trời, hấp thụ dương khí tuyệt vời. Tu vi tiến nhanh hơn người.',
    bonus: '+10% Tu Vi nhận được',
    atk_bonus: 0,
    def_bonus: 0,
    hp_bonus: 0,
    crit_bonus: 0,
    tu_vi_bonus: 0.10,
    weight: 10,
    bi_phap_id: 'thai_duong_bi_phap',
    bi_phap_ten: 'Thái Dương Hồi Quang Pháp',
    bi_phap_yc: 3,
  },
  {
    id: 'kim_cuong',
    ce_name: 'gt_kim_cuong',
    ten: 'Kim Cương Tộc',
    get emoji() { return CE(this.ce_name, '💎'); },
    do_quy: 'thuong',
    do_quy_ten: 'Thường Tộc',
    mo_ta: 'Thân thể rèn luyện đến độ cứng như kim cương, không mũi tên nào xuyên qua được.',
    bonus: '+12% DEF',
    atk_bonus: 0,
    def_bonus: 0.12,
    hp_bonus: 0,
    crit_bonus: 0,
    tu_vi_bonus: 0,
    weight: 10,
    bi_phap_id: 'kim_cuong_bi_phap',
    bi_phap_ten: 'Kim Cương Bất Phá Thần Công',
    bi_phap_yc: 3,
  },
  // ─── Quý Cấp (Hiếm) ─────────────────────────────────────────────────────
  {
    id: 'long_huyet',
    ce_name: 'gt_long_huyet',
    ten: 'Long Huyết Tộc',
    get emoji() { return CE(this.ce_name, '🐉'); },
    do_quy: 'quy',
    do_quy_ten: 'Quý Tộc',
    mo_ta: 'Huyết thống thiêng liêng của Thần Long cổ đại chảy trong người. Sức mạnh và sinh lực vượt xa phàm nhân.',
    bonus: '+10% ATK, +10% HP, +5% DEF',
    atk_bonus: 0.10,
    def_bonus: 0.05,
    hp_bonus: 0.10,
    crit_bonus: 0,
    tu_vi_bonus: 0,
    weight: 5,
    bi_phap_id: 'long_huyet_bi_phap',
    bi_phap_ten: 'Thần Long Giáng Thế Kiếm',
    bi_phap_yc: 8,
  },
  {
    id: 'thien_ung',
    ce_name: 'gt_thien_ung',
    ten: 'Thiên Ưng Tộc',
    get emoji() { return CE(this.ce_name, '🦅'); },
    do_quy: 'quy',
    do_quy_ten: 'Quý Tộc',
    mo_ta: 'Hậu duệ của Ưng Vương tung hoành trời cao, mắt thấy ngàn dặm, tấn công chính xác như sấm sét.',
    bonus: '+12% ATK, +6% Bạo Kích',
    atk_bonus: 0.12,
    def_bonus: 0,
    hp_bonus: 0,
    crit_bonus: 0.06,
    tu_vi_bonus: 0,
    weight: 5,
    bi_phap_id: 'thien_ung_bi_phap',
    bi_phap_ten: 'Ưng Vương Thiên Giáng Cú',
    bi_phap_yc: 8,
  },
  {
    id: 'huyen_linh',
    ce_name: 'gt_huyen_linh',
    ten: 'Huyền Linh Tộc',
    get emoji() { return CE(this.ce_name, '🌀'); },
    do_quy: 'quy',
    do_quy_ten: 'Quý Tộc',
    mo_ta: 'Gia tộc bí ẩn thông hiểu huyền cơ thiên địa, tu luyện nhanh như điện xẹt, ngộ tính trời sinh.',
    bonus: '+15% Tu Vi nhận được, +5% ATK',
    atk_bonus: 0.05,
    def_bonus: 0,
    hp_bonus: 0,
    crit_bonus: 0,
    tu_vi_bonus: 0.15,
    weight: 4,
    bi_phap_id: 'huyen_linh_bi_phap',
    bi_phap_ten: 'Huyền Không Diệt Thiên Quyết',
    bi_phap_yc: 8,
  },
  // ─── Sử Thi Cấp (Rất hiếm) ──────────────────────────────────────────────
  {
    id: 'thien_menh',
    ce_name: 'gt_thien_menh',
    ten: 'Thiên Mệnh Tộc',
    get emoji() { return CE(this.ce_name, '⭐'); },
    do_quy: 'su_thi',
    do_quy_ten: 'Sử Thi Tộc',
    mo_ta: 'Được thiên đạo chọn lựa từ thuở khai thiên tịch địa, thân mang thiên mệnh, vạn linh quy phục.',
    bonus: '+8% ATK, +8% DEF, +8% HP, +5% Tu Vi',
    atk_bonus: 0.08,
    def_bonus: 0.08,
    hp_bonus: 0.08,
    crit_bonus: 0,
    tu_vi_bonus: 0.05,
    weight: 2,
    bi_phap_id: 'thien_menh_bi_phap',
    bi_phap_ten: 'Thiên Mệnh Lôi Phán Quyết',
    bi_phap_yc: 15,
  },
  {
    id: 'bat_hoang',
    ce_name: 'gt_bat_hoang',
    ten: 'Bát Hoang Tộc',
    get emoji() { return CE(this.ce_name, '👑'); },
    do_quy: 'su_thi',
    do_quy_ten: 'Sử Thi Tộc',
    mo_ta: 'Bá chủ bát hoang, lục hợp đều quy phục trước dòng tộc này. Chiến lực tuyệt đỉnh vượt ngoài sự tưởng tượng.',
    bonus: '+15% ATK, +10% DEF, +10% HP',
    atk_bonus: 0.15,
    def_bonus: 0.10,
    hp_bonus: 0.10,
    crit_bonus: 0,
    tu_vi_bonus: 0,
    weight: 2,
    bi_phap_id: 'bat_hoang_bi_phap',
    bi_phap_ten: 'Bát Hoang Chủ Tể Đại Pháp',
    bi_phap_yc: 15,
  },
  // ─── Huyền Thoại Cấp (Cực hiếm) ────────────────────────────────────────
  {
    id: 'vo_thuong',
    ce_name: 'gt_vo_thuong',
    ten: 'Vô Thượng Tộc',
    get emoji() { return CE(this.ce_name, '🌌'); },
    do_quy: 'huyen_thoai',
    do_quy_ten: 'Huyền Thoại Tộc',
    mo_ta: 'Vô thượng, vô địch — gia tộc đứng ở đỉnh cao của tam giới, không ai có thể sánh bằng. Huyết thống thiên cổ thuần khiết nhất.',
    bonus: '+15% ATK, +15% DEF, +15% HP, +8% Tu Vi, +5% Bạo Kích',
    atk_bonus: 0.15,
    def_bonus: 0.15,
    hp_bonus: 0.15,
    crit_bonus: 0.05,
    tu_vi_bonus: 0.08,
    weight: 1,
    bi_phap_id: 'vo_thuong_bi_phap',
    bi_phap_ten: 'Vô Thượng Hư Vô Tiên Kiếm',
    bi_phap_yc: 22,
  },
];

/**
 * Màu embed theo độ quý
 */
const GIA_TOC_MAU = {
  pham:       0x8B8B8B,
  thuong:     0x4CAF50,
  quy:        0x2196F3,
  su_thi:     0x9C27B0,
  huyen_thoai:0xFFD700,
};

/**
 * Emoji độ quý
 */
const GIA_TOC_DO_QUY_EMOJI = {
  pham:        '⬜',
  thuong:      '🟩',
  quy:         '🟦',
  su_thi:      '🟪',
  huyen_thoai: '🟨',
};

/**
 * Rút ngẫu nhiên một gia tộc theo trọng số.
 * @returns {object} Gia tộc được chọn
 */
function randomGiaToc() {
  const totalWeight = GIA_TOC.reduce((s, gt) => s + gt.weight, 0);
  let r = Math.random() * totalWeight;
  for (const gt of GIA_TOC) {
    r -= gt.weight;
    if (r <= 0) return gt;
  }
  return GIA_TOC[0];
}

/**
 * Lấy gia tộc theo ID.
 * @param {string} id
 * @returns {object|null}
 */
function getGiaToc(id) {
  return GIA_TOC.find(gt => gt.id === id) || null;
}

module.exports = { GIA_TOC, GIA_TOC_MAU, GIA_TOC_DO_QUY_EMOJI, randomGiaToc, getGiaToc };
