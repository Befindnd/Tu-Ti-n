'use strict';
/**
 * data/tower_data.js
 * Static game data for the Tower of Trials (Tháp Thí Luyện).
 *
 * Extracted from commands/tower.js to separate data from logic.
 * Contains: challenges, enemy pools, enemy skills.
 */

const { CE } = require('../systems/emoji');
// ── Floor challenges (30 questions) ─────────────────────────────────────────
const TOWER_CHALLENGES = [
  // ─── TẦNG 1-5: Cơ bản ───
  {
    question: "🌿 **Ngũ hành tương sinh** — Thủy sinh ra nguyên tố nào?",
    options: ["A. Kim", "B. Mộc", "C. Hỏa", "D. Thổ"],
    correct: "b",
  },
  {
    question: `${CE("ft_tu_luyen","🧘")} Khi tu luyện bị **Tẩu Hỏa Nhập Ma**, cách xử lý đúng nhất là gì?`,
    options: ["A. Tiếp tục đột phá mạnh mẽ", "B. Uống thêm đan dược", "C. Ngừng lại, tĩnh tâm bình khí", "D. Dùng bí pháp tấn công ra ngoài"],
    correct: "c",
  },
  {
    question: "🔥 Ngũ hành tương khắc — **Hỏa** khắc nguyên tố nào?",
    options: ["A. Thủy", "B. Kim", "C. Mộc", "D. Thổ"],
    correct: "b",
  },
  {
    question: `${CE("tia_set","⚡")} Linh Căn **Lôi** hệ phù hợp nhất với loại công pháp nào?`,
    options: ["A. Vạn Thủy Kinh (thủy)", "B. Thanh Liên Pháp (mộc)", "C. Thiên Lôi Chi Thuật", "D. Hỗn Độn Kinh"],
    correct: "c",
  },
  {
    question: "🗺️ Trong linh trận bẫy, con đường **an toàn nhất** thường là?",
    options: ["A. Đường phát sáng rực rỡ", "B. Đường có hoa linh thảo nở rộ", "C. Đường tối, không có dấu hiệu nào", "D. Đường có ánh lửa dẫn đường"],
    correct: "c",
  },
  // ─── TẦNG 6-10: Trung cấp ───
  {
    question: "💎 Phẩm cấp đan dược từ **thấp đến cao** là?",
    options: ["A. Hạ → Trung → Thượng → Cực", "B. Sơ → Trung → Cao → Đỉnh", "C. Phàm → Thượng → Tiên → Thần", "D. Hạ → Linh → Tiên → Thánh"],
    correct: "a",
  },
  {
    question: `${CE("tam_ac","👿")} Ma Tu và Chính Tu khác nhau cơ bản ở điểm gì?`,
    options: ["A. Sức mạnh chiến đấu", "B. Tuổi thọ và ngoại hình", "C. Đạo Tâm và hướng tu luyện", "D. Lượng linh thạch tích lũy"],
    correct: "c",
  },
  {
    question: "🩸 Huyết Thức của Ma Đạo khi HP < 30% cho hiệu ứng gì?",
    options: ["A. Hồi phục HP đầy đủ", "B. ATK +15% nhưng tiếp tục hao HP", "C. Bất tử trong 1 lượt đánh", "D. Tốc độ tấn công tăng gấp đôi"],
    correct: "b",
  },
  {
    question: "🌸 Loại Thiên Kiếp nào nguy hiểm nhất với **tu sĩ Ma Đạo** (Đạo Tâm thấp)?",
    options: ["A. Lôi Kiếp", "B. Hồng Trần Kiếp", "C. Nhân Quả Kiếp", "D. Tâm Ma Kiếp"],
    correct: "d",
  },
  {
    question: "⭐ **TẦNG 10** — Hỗn Độn Linh Căn có đặc điểm đặc biệt gì trong ngũ hành chiến đấu?",
    options: ["A. Yếu hơn tất cả linh căn khác", "B. Chỉ tương thích 1 nguyên tố", "C. Không thể tu luyện bí pháp", "D. Khắc chế tất cả nguyên tố, không bị khắc"],
    correct: "d",
  },
  // ─── TẦNG 11-15: Khó hơn ───
  {
    question: "⚔️ Trong chiến đấu, **Uy Áp** ảnh hưởng như thế nào?",
    options: ["A. Tăng ATK của mình 50%", "B. Giảm Công Lực của kẻ yếu hơn", "C. Hút HP đối thủ mỗi lượt", "D. Vô hiệu hóa bí pháp đối thủ"],
    correct: "b",
  },
  {
    question: "🏯 Tông Môn nào **không yêu cầu** Cảnh Giới tối thiểu?",
    options: ["A. Huyền Thiên Tông (T5)", "B. Vạn Kiếm Môn (T10)", "C. Thanh Vân Tông", "D. Ma Thần Điện (T10)"],
    correct: "c",
  },
  {
    question: "💊 **Đạo Thương** cấp 3 (nặng nhất) ảnh hưởng gì đến tu sĩ?",
    options: ["A. Không có ảnh hưởng nào", "B. Chỉ giảm ATK", "C. Giảm ATK và DEF nghiêm trọng trong chiến đấu", "D. Mất tất cả linh thạch"],
    correct: "c",
  },
  {
    question: "🌌 Truyền Thừa nào yêu cầu Cảnh Giới cao nhất — **Tầng 30**?",
    options: ["A. Thiên Long Truyền Thừa", "B. Kiếm Đạo Truyền Thừa (T22)", "C. Hỗn Độn Cổ Truyền", "D. Ma Đạo Truyền Thừa (T18)"],
    correct: "c",
  },
  {
    question: "💫 **TẦNG 15** — Người đứng đầu Tông Môn cần bao nhiêu điểm Đóng Góp và Cảnh Giới tối thiểu?",
    options: ["A. T25 + 100,000 đóng góp", "B. T35 + 1,000,000 đóng góp", "C. T30 + 500,000 đóng góp", "D. T40 + 2,000,000 đóng góp"],
    correct: "b",
  },
  // ─── TẦNG 16-20: Cao cấp ───
  {
    question: "🧪 Khi luyện đan **thất bại**, tỷ lệ thu hồi nguyên liệu là bao nhiêu?",
    options: ["A. 100% nguyên liệu", "B. 0% — mất trắng", "C. 50% nguyên liệu", "D. 25% nguyên liệu"],
    correct: "b",
  },
  {
    question: "⚖️ Trong công thức tính **Chiến Lực**, yếu tố nào có trọng số cao nhất?",
    options: ["A. Phòng Thủ (DEF)", "B. HP tối đa", "C. Tấn Công (ATK)", "D. Cảnh Giới"],
    correct: "c",
  },
  {
    question: "🎒 Sức chứa túi trữ vật mặc định khi mới bắt đầu là bao nhiêu kg?",
    options: ["A. 50 kg", "B. 100 kg", "C. 150 kg", "D. 200 kg"],
    correct: "b",
  },
  {
    question: "⚔️ Trong PvP, cơ chế **Bảo Vệ Tân Thủ** hoạt động đến Cảnh Giới nào?",
    options: ["A. Tầng 5", "B. Tầng 10", "C. Tầng 15", "D. Không có cơ chế này"],
    correct: "b",
  },
  {
    question: "🌟 **TẦNG 20** — Khi đột phá Cảnh Giới thất bại do **Thiên Kiếp**, điều gì xảy ra với Tu Vi?",
    options: ["A. Tu Vi về 0", "B. Mất 30% Tu Vi hiện tại", "C. Không mất Tu Vi, chỉ mất HP", "D. Mất toàn bộ Tu Vi tích lũy cho đột phá đó"],
    correct: "d",
  },
  // ─── TẦNG 21-25: Chuyên gia ───
  {
    question: "🌀 Kỹ năng **Hộ Thể** trong chiến đấu giảm sát thương nhận vào còn bao nhiêu %?",
    options: ["A. 20%", "B. 25%", "C. 35%", "D. 50%"],
    correct: "c",
  },
  {
    question: "📜 Bí Pháp tấn công có **chi phí HP** — loại Bí Pháp này thuộc trường phái nào?",
    options: ["A. Kiếm Đạo Chính Tông", "B. Ma Đạo hoặc Huyết Đạo", "C. Phong Hệ đặc biệt", "D. Hỗn Độn Cổ Pháp"],
    correct: "b",
  },
  {
    question: "🔢 **CD Hồi Linh Khí** trong Tháp Thí Luyện là bao nhiêu lượt sau khi dùng?",
    options: ["A. 2 lượt", "B. 3 lượt", "C. 4 lượt", "D. 5 lượt"],
    correct: "b",
  },
  {
    question: "💎 Truyền Thừa **Thiên Long** yêu cầu Cảnh Giới bao nhiêu?",
    options: ["A. Tầng 20", "B. Tầng 25", "C. Tầng 28", "D. Tầng 30"],
    correct: "b",
  },
  {
    question: "💎 **TẦNG 25** — Điều kiện kích hoạt **Tâm Ma Kiếp** trong Thiên Kiếp là gì?",
    options: ["A. HP < 10% khi vượt kiếp", "B. Đạo Tâm < 50 và tu theo Ma Đạo", "C. Dùng bí pháp cấm trong vượt kiếp", "D. Bất kỳ tu sĩ Ma Đạo nào vượt kiếp"],
    correct: "b",
  },
  // ─── TẦNG 26-30: Huyền Thánh ───
  {
    question: "🩺 **Linh Dược Hồi Phục** (lệnh `-hoi_phuc`) có CD bao nhiêu phút?",
    options: ["A. 15 phút", "B. 20 phút", "C. 30 phút", "D. 60 phút"],
    correct: "c",
  },
  {
    question: `${CE("tia_set","⚡")} Khi Bí Pháp **Bạo Kích** kích hoạt, hệ số nhân sát thương là bao nhiêu?`,
    options: ["A. ×1.5", "B. ×2.0", "C. ×2.2", "D. ×3.0"],
    correct: "b",
  },
  {
    question: "🌌 **Hỗn Độn Cổ Truyền** ban cho người học đặc điểm nào dưới đây?",
    options: ["A. Miễn nhiễm hoàn toàn Thiên Kiếp", "B. Tăng 100% ATK vĩnh viễn", "C. Tương thích mọi Linh Căn, học mọi Bí Pháp", "D. Không thể bị tấn công trong 3 lượt đầu PvP"],
    correct: "c",
  },
  {
    question: "🏆 Trong bảng xếp hạng Tháp Thí Luyện, kỷ lục **tầng cao nhất** được tính theo điều kiện nào?",
    options: ["A. Số lần vào tháp nhiều nhất", "B. Tổng linh thạch kiếm được", "C. Tầng cao nhất đã chinh phục (lưu vĩnh viễn)", "D. Tầng đạt được trong lần gần nhất"],
    correct: "c",
  },
  {
    question: "👑 **TẦNG CUỐI — THIÊN ĐỊA THÁCH THỨC!** Trong ngũ hành, chuỗi tương sinh ĐẦY ĐỦ theo thứ tự đúng là?",
    options: [
      "A. Mộc → Hỏa → Thổ → Kim → Thủy → Mộc",
      "B. Hỏa → Mộc → Thổ → Kim → Thủy → Hỏa",
      "C. Thủy → Mộc → Hỏa → Kim → Thổ → Thủy",
      "D. Kim → Thủy → Mộc → Hỏa → Thổ → Kim",
    ],
    correct: "a",
  },
];

// ── Enemy pools by tier ───────────────────────────────────────────────────────
const ENEMY_POOLS = {
  low:    ["Yêu Hồ Tử", "Thạch Tinh Quái", "Hỏa Linh Thú", "Lôi Điểu Yêu", "Băng Linh Thú"],
  mid:    ["Địa Yêu Tu Sĩ", "Hắc Ám Tu Sĩ", "Phong Vân Kiếm Khách", "Huyết Sát Tu Sĩ", "Băng Linh Sứ"],
  high:   ["Thiên Kiêu Tu Sĩ", "Cổ Ma Tông Đệ Tử", "Kiếm Đạo Cao Thủ", "Thánh Địa Tinh Nhuệ", "Hỗn Nguyên Tu Sĩ"],
  boss:   ["Tháp Thủ Thần Linh 👁️", "Cổ Đại Thần Thú 🐉", "Bí Cảnh Linh Vệ ⚔️", "Huyền Thiên Đại Năng 🌌", "Hỗn Độn Ma Tôn 💀"],
  elite:  ["Thiên Kiếp Sứ Giả ☄️", "Cổ Thần Linh Vệ 🌟", "Huyền Cơ Thánh Giả ✨", "Bất Diệt Chiến Ma 🔥", `Thiên Địa Cấm Binh ${CE("tia_set","⚡")}`],
  legend: ["Cổ Đại Thần Ma 💀", "Thiên Đạo Phán Quan ⚖️", "Vô Thượng Linh Vương 👁️‍🗨️", "Hỗn Độn Thần Linh 🌀", "Cửu Thiên Thần Tướng 🌌"],
  myth:   ["Thiên Đế Hiện Thân 👑", "Vô Cực Đạo Tôn ♾️", "Hỗn Nguyên Thánh Ma ☠️", "Cổ Thần Tái Lâm 🔱", "Tuyệt Thế Chiến Thần ⚔️💥"],
};

// ── Enemy special skills by tier ─────────────────────────────────────────────
const ENEMY_SKILL_DATA = {
  basic: {
    name: 'Thần Thông Giáng Thế',
    emoji: '🌀',
    atkMult: 1.35,
    cd: 4,
  },
  mid: {
    name: 'Huyết Sát Linh Vân',
    emoji: '🩸',
    atkMult: 1.50,
    debuffAtkPct: 0.30,
    cd: 4,
  },
  high: {
    name: 'Thiên Ma Diệt Thế Trận',
    emoji: '🌌',
    atkMult: 1.88,
    selfHealPct: 0.10,
    cd: 4,
  },
  legend: {
    name: 'Hỗn Nguyên Thánh Pháp',
    emoji: '☠️',
    atkMult: 2.25,
    ignoreDefPct: 0.50,
    cd: 5,
  },
};

/**
 * Get the appropriate enemy skill definition for a given floor.
 * @param {number} floor
 * @returns {object}
 */
function getEnemySkill(floor) {
  if (floor >= 26) return ENEMY_SKILL_DATA.legend;
  if (floor >= 20) return ENEMY_SKILL_DATA.high;
  if (floor >= 12) return ENEMY_SKILL_DATA.mid;
  return ENEMY_SKILL_DATA.basic;
}

module.exports = { TOWER_CHALLENGES, ENEMY_POOLS, ENEMY_SKILL_DATA, getEnemySkill };
