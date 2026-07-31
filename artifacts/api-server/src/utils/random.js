'use strict';
/**
 * utils/random.js
 * Random-outcome helpers and static game-world data.
 */
const { HUYET_MACH } = require('../data');
const { CE } = require('../systems/emoji');

const randomLC = () => {
  // Phân tầng hiếm cho -bat_dau
  // Huyền Thoại: Thiên 2% | Cực Hiếm: Hỗn Độn 5%
  // Hiếm: Âm · Dương · Lôi · Phong 7% mỗi = 28% | Thường: Kim · Mộc · Thủy · Hỏa · Thổ 13% mỗi = 65%
  const roll = Math.random() * 100;
  if (roll < 2)  return 'thien';
  if (roll < 7)  return 'hon_don';
  if (roll < 14) return 'am';
  if (roll < 21) return 'duong';
  if (roll < 28) return 'thunder';
  if (roll < 35) return 'phong';
  if (roll < 48) return 'kim';
  if (roll < 61) return 'moc';
  if (roll < 74) return 'thuy';
  if (roll < 87) return 'hoa';
  return 'tho';
};

const randomHM = () => {
  let roll = Math.random() * 100;
  let acc = 0;
  for (const [key, data] of Object.entries(HUYET_MACH)) {
    acc += data.rate;
    if (roll < acc) return key;
  }
  return 'pham';
};

const getTamMa = (score) => {
  if (score >= 80)  return { get emoji() { return CE("tam_nhan","😇"); }, ten: 'Nhân Đạo',   mo_ta: '+15% Tu Tốc, +10% Thủ Lực' };
  if (score >= 40)  return { get emoji() { return CE("tam_trung","😐"); }, ten: 'Trung Dung',  mo_ta: 'Không hiệu ứng đặc biệt' };
  if (score >= 0)   return { get emoji() { return CE("tam_ma","😈"); }, ten: 'Ma Đạo',      mo_ta: '+20% Công Lực, -10% Thủ Lực' };
  return                   { get emoji() { return CE("tam_ac","👿"); }, ten: 'Ác Ma',       mo_ta: '+35% Công Lực, -20% Thủ Lực' };
};

const CHIEU_THUC = {
  thuan_duong:  ['Thuần Dương Bổng Pháp', 'Lôi Đình Chưởng', 'Thiên Lôi Tụ Kích', 'Dương Khí Bùng Phát', 'Liệt Hỏa Vân Kích'],
  ngu_hanh:     ['Ngũ Hành Thuật Pháp', 'Kim Mộc Hỗn Giao', 'Thổ Hành Trọng Kích', 'Thủy Hỏa Tương Phá', 'Liên Hoàn Ngũ Hành'],
  diet_tien:    ['Diệt Tiên Nhất Kiếm', 'Kiếm Ý Phá Hư Không', 'Linh Kiếm Túc Sát', 'Đoạn Tiên Kiếm Khí', 'Kiếm Xuyên Tâm Mạch'],
  van_thuy:     ['Vạn Thủy Liên Hoa', 'Thủy Kính Phản Chiếu', 'Băng Hà Bức Ép', 'Thác Nước Thiên Nhai', 'Triều Kiếm Vô Địch'],
  am_duong:     ['Âm Dương Song Kiếm', 'Thái Cực Quyền Pháp', 'Hắc Bạch Hỗn Nguyên', 'Âm Dương Nghịch Chuyển', 'Hào Quang Thiên Địa'],
  thien_long:   ['Thiên Long Phá Trận', 'Rồng Vàng Giáng Thế', 'Long Khí Xung Thiên', 'Thiên Long Hý Châu', 'Vạn Lý Long Uy'],
  ma_dao:       ['Huyết Ma Trảm', 'Ma Khí Tụ Kích', 'Tà Pháp Nghịch Thiên', 'Huyết Sắc Thiên Đao', 'Ma Vương Đoạt Phách'],
  thanh_lien:   ['Thanh Liên Kiếm Khí', 'Lưỡng Nghi Kiếm Trận', 'Thiên Địa Thanh Tâm', 'Bạch Hoa Kiếm Vũ', 'Liên Đài Thánh Quang'],
  hon_don_kinh: ['Hỗn Độn Khai Thiên', 'Thái Cực Vô Cực Chưởng', 'Nguyên Sơ Chi Lực', 'Hư Không Quy Nhất', 'Vạn Đạo Hồi Nguyên'],
  default:      ['Linh Lực Xung Kích', 'Pháp Lực Bùng Phát', 'Thiên Địa Đột Kích', 'Huyền Khí Tụ Kích', 'Linh Thuật Khai Phát'],
};

function getChieu(congPhapId) {
  const list = CHIEU_THUC[congPhapId] || CHIEU_THUC.default;
  return list[Math.floor(Math.random() * list.length)];
}

module.exports = { randomLC, randomHM, getTamMa, CHIEU_THUC, getChieu };
