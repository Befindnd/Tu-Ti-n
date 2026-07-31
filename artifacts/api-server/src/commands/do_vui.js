'use strict';
  const {
    EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags,
  } = require('discord.js');
  const { db }         = require('../db/pool');
  const { getPlayer }  = require('../db/players');
  const { CE, CEu }    = require('../systems/emoji');
  const { fmt, fTime, cdRemMin, cdTsMin, errE, reg, calcMaxLinhThach } = require('../utils');

  // ── Cấu hình ──────────────────────────────────────────────────────────────
  const REWARD_LT    = 15;
  const CD_MIN       = 30;
  const CD_SAI_MIN   = 5;
  const EXPIRE_MS    = 60 * 1000;

  const STREAK_BONUS = [
    { streak: 3, bonus: 10,  msg: '🔥 Streak x3!' },
    { streak: 5, bonus: 25,  msg: '🔥🔥 Streak x5!' },
    { streak: 10, bonus: 60, msg: '💥 Streak x10!! TUYỆT VỜI!' },
  ];

  // ── State in-memory ────────────────────────────────────────────────────────
  const DO_VUI_SESSIONS   = new Map();
  const DO_VUI_STREAK     = new Map();
  const DO_VUI_PROCESSING = new Set();
  const DO_VUI_HISTORY    = new Map();

  const ADMIN_ID = process.env.ADMIN_ID || '';

  // ═══════════════════════════════════════════════════════════════════════════
  // DATA THỰC TẾ (nguồn gia_toc.js & cong_phap.js — dùng để tạo câu hỏi)
  // Phàm:   Mộc(HP8,w20), Hỏa(ATK8,w20), Thủy(DEF8,w20), Thổ(DEF5+HP5,w18)
  // Thường: Lôi(ATK5+Crit3,w12), Nguyệt(ATK10+Crit4,w10), Thái(TuVi10,w10), Kim(DEF12,w10)
  // Quý:    Long(ATK10+DEF5+HP10,w5), Ưng(ATK12+Crit6,w5), Huyền(ATK5+TuVi15,w4)
  // SửThi:  Mệnh(ATK8+DEF8+HP8+TuVi5,w2), Bát(ATK15+DEF10+HP10,w2)
  // HuyenThoai: Vô(ATK15+DEF15+HP15+TuVi8+Crit5,w1)
  // Tổng weight = 139
  // Bí pháp tấn công:  Hỏa 215%, Lôi 245%, Nguyệt 250%  (cooldown đều 3)
  // Bí pháp phòng thủ: Thổ giảm 35%, Thủy giảm 52%       (cooldown đều 3)
  // Bí pháp hồi phục:  Mộc hồi 42%, Thái hồi 44%         (cooldown đều 3)
  // ═══════════════════════════════════════════════════════════════════════════
const QUESTIONS = [

  // ═══ TÍNH TOÁN — NHÓM A: Tấn Công Cơ Bản ═══
  { cau_hoi: 'CL=1.000. Dùng bí pháp **180% CL**. ST gây ra?', dap_an: ['1.800', '1.000', '2.000', '1.180'], dung: 0 },
  { cau_hoi: 'CL=2.500. Dùng bí pháp **200% CL**. ST gây ra?', dap_an: ['5.000', '2.500', '4.500', '7.500'], dung: 0 },
  { cau_hoi: 'CL=3.000. Dùng bí pháp **245% CL** (Lôi Linh tộc). ST gây ra?', dap_an: ['7.350', '6.000', '7.000', '8.000'], dung: 0 },
  { cau_hoi: 'CL=4.000. Dùng bí pháp **260% CL** (Long Huyết tộc). ST gây ra?', dap_an: ['10.400', '8.000', '10.000', '12.000'], dung: 0 },
  { cau_hoi: 'CL=1.500. Dùng bí pháp **290% CL** (Vô Thượng tộc). ST gây ra?', dap_an: ['4.350', '4.000', '4.500', '5.000'], dung: 0 },
  { cau_hoi: 'CL=2.000. Dùng **Tam Hoa Tụ Đỉnh (350%)**. ST gây ra?', dap_an: ['7.000', '6.000', '8.000', '5.000'], dung: 0 },
  { cau_hoi: 'CL=1.000. Dùng **Thiên Địa Hồng Lô (450%)**. ST gây ra?', dap_an: ['4.500', '4.000', '5.000', '3.500'], dung: 0 },
  { cau_hoi: 'CL=800. Dùng **Vạn Kiếm Quy Tông (600%)**. ST gây ra?', dap_an: ['4.800', '4.000', '5.000', '6.000'], dung: 0 },
  { cau_hoi: 'CL=3.500. Dùng **Thiên Hạ Đệ Nhất Kiếm (500%)**. ST gây ra?', dap_an: ['17.500', '15.000', '20.000', '14.000'], dung: 0 },
  { cau_hoi: 'CL=1.200. Dùng **Hỏa Long Phong (250%)**. ST gây ra?', dap_an: ['3.000', '2.400', '3.500', '2.500'], dung: 0 },

  // ═══ TÍNH TOÁN — NHÓM B: Có Passive Đạo Tu ═══
  { cau_hoi: '**Pháp Tu** (passive bí pháp +20%). CL=1.000, dùng bí pháp **300%**. ST gây ra?', dap_an: ['3.600', '3.000', '4.000', '3.200'], dung: 0 },
  { cau_hoi: '**Pháp Tu** (passive +20%). CL=2.000, dùng **Thần Lôi Kiếm Trận (300%)**. ST gây ra?', dap_an: ['7.200', '6.000', '8.000', '7.000'], dung: 0 },
  { cau_hoi: '**Pháp Tu** (passive +20%). CL=1.500, dùng **Huyết Sát Đại Phong (300%)**. ST gây ra?', dap_an: ['5.400', '4.500', '6.000', '5.000'], dung: 0 },
  { cau_hoi: '**Pháp Tu** (passive +20%). CL=3.000, dùng **Tam Hoa (350%)**. ST gây ra?', dap_an: ['12.600', '10.500', '12.000', '13.000'], dung: 0 },
  { cau_hoi: '**Pháp Tu** (passive +20%). CL=2.000, dùng **Thiên Địa Hồng Lô (450%)**. ST gây ra?', dap_an: ['10.800', '9.000', '10.000', '12.000'], dung: 0 },
  { cau_hoi: '**Khí Tu** có vũ khí ATK=2.000. Passive Phi Khí Quần nhân x1.30. CL từ vũ khí thực là bao nhiêu?', dap_an: ['2.600', '2.000', '2.200', '3.000'], dung: 0 },
  { cau_hoi: '**Khí Tu** ATK=1.500 (vũ khí), passive x1.30. Dùng bí pháp **250%**. ST gây ra?', dap_an: ['4.875', '3.750', '5.000', '4.000'], dung: 0 },
  { cau_hoi: '**Kiếm Tu** CL=1.000, bí pháp **300%**, bạo kích xảy ra (hệ số x2). ST gây ra?', dap_an: ['6.000', '3.000', '4.000', '5.000'], dung: 0 },
  { cau_hoi: '**Kiếm Tu** CL=2.000, bí pháp **245%**, bạo kích (hệ số x2). ST gây ra?', dap_an: ['9.800', '4.900', '7.000', '8.000'], dung: 0 },
  { cau_hoi: '**Ma Tu** khi Ma Bùng active (+30% ATK). ATK base=3.000, dùng bí pháp **200%**. ST gây ra?', dap_an: ['7.800', '6.000', '9.000', '8.000'], dung: 0 },

  // ═══ TÍNH TOÁN — NHÓM C: Có Phòng Thủ ═══
  { cau_hoi: 'CL=2.000, bí pháp **260%**. Địch có **Kim Thân Pháp Tướng (-50%)**. ST địch nhận?', dap_an: ['2.600', '5.200', '2.000', '3.120'], dung: 0 },
  { cau_hoi: 'CL=1.000, bí pháp **300%**. Địch mặc **Huyền Long Lân Giáp (-20%)**. ST địch nhận?', dap_an: ['2.400', '3.000', '2.000', '2.800'], dung: 0 },
  { cau_hoi: 'CL=3.000, bí pháp **245%**. Địch có **Hồng Mông Chi Thể (-70%)**. ST địch nhận?', dap_an: ['2.205', '7.350', '3.000', '5.000'], dung: 0 },
  { cau_hoi: 'CL=5.000, bí pháp **350%**. Địch có **Thủy Linh tộc bí pháp (-52%)**. ST địch nhận?', dap_an: ['8.400', '17.500', '10.000', '7.000'], dung: 0 },
  { cau_hoi: 'CL=2.000, bí pháp **300%**. Địch có **Kim Cương tộc bí pháp (-54%)**. ST địch nhận?', dap_an: ['2.760', '6.000', '3.000', '2.000'], dung: 0 },
  { cau_hoi: 'CL=1.000, bí pháp **250%**. Địch có **Thổ Linh tộc bí pháp (-35%)**. ST địch nhận?', dap_an: ['1.625', '2.500', '1.500', '2.000'], dung: 0 },
  { cau_hoi: 'CL=4.000, bí pháp **260%**. Địch có **Lân Giáp (-20%) + Thổ Linh tộc (-35%)**. ST địch nhận?', dap_an: ['5.408', '10.400', '8.320', '6.000'], dung: 0 },
  { cau_hoi: '**Pháp Tu** (+20%) CL=2.000, bí pháp **350%**. Địch có **Kim Thân (-50%)**. ST địch nhận?', dap_an: ['4.200', '7.000', '8.400', '3.500'], dung: 0 },
  { cau_hoi: '**Pháp Tu** (+20%) CL=1.000, bí pháp **450%**. Địch có **Lân Giáp (-20%)**. ST địch nhận?', dap_an: ['4.320', '4.500', '5.400', '3.600'], dung: 0 },
  { cau_hoi: 'CL=10.000, bí pháp **500%**. Địch có **Hồng Mông (-70%) + Kim Cương tộc (-54%)**. ST địch nhận?', dap_an: ['6.900', '50.000', '15.000', '23.000'], dung: 0 },

  // ═══ TÍNH TOÁN — NHÓM D: Phản Đòn & Hồi Máu ═══
  { cau_hoi: '**Yêu Tu** phản đòn 12%. Đòn đánh gây 5.000 ST. Phản lại bao nhiêu?', dap_an: ['600', '500', '1.200', '240'], dung: 0 },
  { cau_hoi: '**Yêu Tu** phản đòn 12%. Đòn đánh gây 8.000 ST. Phản lại bao nhiêu?', dap_an: ['960', '800', '1.200', '480'], dung: 0 },
  { cau_hoi: '**Yêu Tu** hồi 3%/lượt, HP max=10.000. Sau 6 lượt hồi bao nhiêu HP?', dap_an: ['1.800', '3.000', '600', '2.000'], dung: 0 },
  { cau_hoi: 'Bảo bối **Tụ Linh Tiên Ngọc Phủ** hồi 2%/lượt. HP max=50.000. Sau 3 lượt hồi bao nhiêu?', dap_an: ['3.000', '1.000', '2.000', '5.000'], dung: 0 },
  { cau_hoi: '**Yêu Tu** hồi 3%/lượt + **Tụ Linh** hồi 2%/lượt. HP max=20.000. Mỗi lượt hồi bao nhiêu?', dap_an: ['1.000', '600', '400', '1.400'], dung: 0 },
  { cau_hoi: '**Đan Tu** passive hồi 5%/lượt. HP max=8.000. Sau 4 lượt hồi bao nhiêu HP?', dap_an: ['1.600', '4.000', '800', '2.000'], dung: 0 },
  { cau_hoi: '**Đan Tu** hồi 5%/lượt + **Yêu Tu** passive hồi 3%/lượt (cả hai trên cùng nhân vật). HP max=5.000. Mỗi lượt hồi?', dap_an: ['400', '250', '350', '500'], dung: 0 },
  { cau_hoi: '**Tụ Linh Tiên Ngọc Phủ** hồi 2%/lượt. HP max=100.000. Sau 10 lượt chiến đấu hồi tổng bao nhiêu?', dap_an: ['20.000', '10.000', '2.000', '50.000'], dung: 0 },
  { cau_hoi: '**Trận Tu** bị đánh 6.000 ST thô. Passive Trận Pháp -10%, Lân Giáp -20%. ST thực nhận?', dap_an: ['4.320', '4.800', '3.600', '5.400'], dung: 0 },
  { cau_hoi: '**Trận Tu** bị đánh 10.000 ST thô. Passive -10%, Thổ Linh tộc bí pháp -35%. ST thực nhận?', dap_an: ['5.850', '6.500', '5.000', '7.000'], dung: 0 },

  // ═══ TÍNH TOÁN — NHÓM E: Tu Vi & Đan Dược ═══
  { cau_hoi: 'Đan base Tu Vi **2.000**, rơi **Thượng Phẩm (hệ số 1.45x)**. Tu Vi thực nhận?', dap_an: ['2.900', '2.000', '3.000', '2.450'], dung: 0 },
  { cau_hoi: 'Đan base Tu Vi **2.000**, rơi **Cực Phẩm (hệ số 2.2x)**. Tu Vi thực nhận?', dap_an: ['4.400', '2.000', '4.000', '5.000'], dung: 0 },
  { cau_hoi: 'Đan base Tu Vi **2.000**, rơi **Hạ Phẩm (hệ số 0.65x)**. Tu Vi thực nhận?', dap_an: ['1.300', '2.000', '1.500', '1.000'], dung: 0 },
  { cau_hoi: '**Đan Tu** (+15% EXP), dùng đan base **2.000 Tu Vi**, Thượng Phẩm (x1.45). Tu Vi thực?', dap_an: ['3.335', '2.900', '3.000', '4.000'], dung: 0 },
  { cau_hoi: '**Đan Tu** (+15%) + nghe **Luyện Đan Sư** (+8%). Đan base **80.000 Tu Vi**, Cực Phẩm (x2.2). Tu Vi thực?', dap_an: ['210.672', '176.000', '80.000', '192.000'], dung: 0 },
  { cau_hoi: '**Pháp Tu** (+12% EXP) + gia tộc **Thái Dương** (+10% TuVi). Đan base **8.000 Tu Vi**, Trung Phẩm (x1.0). Tu Vi thực?', dap_an: ['9.760', '8.000', '9.000', '10.000'], dung: 0 },
  { cau_hoi: 'Ngộ Đạo Sư lệnh **thach_ngo** nhận +5% Cảm Ngộ. Cảm Ngộ hiện tại 65%. Sau khi dùng là bao nhiêu %?', dap_an: ['70%', '65%', '75%', '67%'], dung: 0 },
  { cau_hoi: 'Đan Tu passive: đan dược hiệu quả +30%. Đan base **500 Tu Vi** Hạ Phẩm (x0.65). Tu Vi thực?', dap_an: ['422.5', '325', '500', '650'], dung: 0 },
  { cau_hoi: 'Nghe **Luyện Đan Sư** (+8%). Đan base **20.000 Tu Vi**, Thượng Phẩm (x1.45). Tu Vi thực?', dap_an: ['31.320', '29.000', '20.000', '30.000'], dung: 0 },
  { cau_hoi: 'Gia tộc **Thái Dương** (+10%) + nghe **Ngộ Đạo Sư** (+5%). Đan base **30.000 Tu Vi**, Cực Phẩm (x2.2). Tu Vi thực?', dap_an: ['77.220', '66.000', '72.000', '80.000'], dung: 0 },

  // ═══ TÍNH TOÁN — NHÓM F: Bạo Kích ═══
  { cau_hoi: 'CL=1.000, bí pháp **300%**, bạo kích hệ số **x2.5** (Tiên Kiếm). ST nếu bạo kích?', dap_an: ['7.500', '3.000', '5.000', '6.000'], dung: 0 },
  { cau_hoi: 'CL=2.000, bí pháp **245%**, bạo kích **x2.8** (Tử Tinh Kiếm). ST nếu bạo kích?', dap_an: ['13.720', '4.900', '9.800', '10.000'], dung: 0 },
  { cau_hoi: 'CL=1.500, bí pháp **260%**, bạo kích **x3** (Thần Kiếm). ST nếu bạo kích?', dap_an: ['11.700', '3.900', '7.800', '10.000'], dung: 0 },
  { cau_hoi: 'CL=2.000, bí pháp **350%**, bạo kích **x4** (Hồng Mông Kiếm). ST nếu bạo kích?', dap_an: ['28.000', '7.000', '14.000', '20.000'], dung: 0 },
  { cau_hoi: '**Pháp Tu** (+20%). CL=1.000, bí pháp **300%**, bạo kích **x2**. ST nếu bạo kích?', dap_an: ['7.200', '3.600', '6.000', '5.000'], dung: 0 },
  { cau_hoi: '**Pháp Tu** (+20%). CL=2.000, bí pháp **350%**, bạo kích **x3.5** (Ám Ma Kiếm). ST nếu bạo kích?', dap_an: ['29.400', '7.000', '14.700', '25.000'], dung: 0 },
  { cau_hoi: 'CL=3.000, bí pháp **290%**, bạo kích **x3.2** (Linh Hồn Ám Khí). Địch có **Lân Giáp (-20%)**. ST nếu bạo kích?', dap_an: ['22.272', '27.840', '8.700', '18.000'], dung: 0 },
  { cau_hoi: 'Bạo kích **Lôi Hỏa Thiên Vân Châu**: đòn gây 5.000 ST + kích nổ thêm 50%. Tổng ST?', dap_an: ['7.500', '5.000', '10.000', '6.000'], dung: 0 },
  { cau_hoi: 'Bạo kích **Lôi Hỏa Thiên Vân Châu**: đòn gây 8.000 ST + kích nổ 50%. Địch có **Thổ Linh tộc (-35%)**. ST thực nhận?', dap_an: ['7.800', '12.000', '5.200', '9.000'], dung: 0 },
  { cau_hoi: 'CL=4.000, bí pháp **245%**, bạo kích **x2.8**. **Pháp Tu** thêm +20%. ST nếu bạo kích?', dap_an: ['32.928', '9.800', '27.440', '30.000'], dung: 0 },

  // ═══ TÍNH TOÁN — NHÓM G: Hút Máu ═══
  { cau_hoi: '**Ám Ma Cửu Huyền Kiếm** hút 10% ST gây ra. Đòn bạo kích gây 14.000 ST. Hút bao nhiêu HP?', dap_an: ['1.400', '140', '2.800', '1.000'], dung: 0 },
  { cau_hoi: '**Ám Ma Kiếm** hút 10%. CL=2.000, bí pháp **300%**, bạo kích **x3.5**. Tổng ST gây ra và HP hút về?', dap_an: ['ST: 21.000, hut: 2.100', 'ST: 6.000, hut: 600', 'ST: 21.000, hut: 1.050', 'ST: 6.000, hut: 2.100'], dung: 0 },
  { cau_hoi: '**Ám Ma Kiếm** hút 10%. Đòn gây 9.000 ST (không bạo kích). HP hút về?', dap_an: ['900', '90', '1.800', '450'], dung: 0 },

  // ═══ TÍNH TOÁN — NHÓM H: Xuyên Giáp ═══
  { cau_hoi: 'CL=5.000. **Hư Không Thần Uy Cung** xuyên giáp 30%. Địch DEF=3.000 (giảm 3.000 ST). DEF thực dụng sau xuyên?', dap_an: ['2.100', '2.700', '3.000', '900'], dung: 0 },
  { cau_hoi: 'CL=8.000. **Cửu Long Thần Binh Kích** xuyên giáp 40%. Địch mặc Lân Giáp (-20%). Bao nhiêu % ST vẫn bị xuyên?', dap_an: 'Xuyên 40% -> DEF chỉ còn 60% hiệu quả, Lân Giap chỉ giam 20%x60%=12%, net giam 48%'.split(',').slice(0,1).concat(['Không xuyên được Lan Giap', 'Xuyên giap va giam ST cong vao nhau', 'Xuyên 40% trừ thẳng 40% ST']), dung: 0 },
  { cau_hoi: 'CL=3.000, **Hư Không Thần Uy Cung** xuyên giáp 30%. Địch DEF giảm được 2.000 ST. DEF thực còn giảm bao nhiêu?', dap_an: ['1.400', '2.000', '600', '1.800'], dung: 0 },

  // ═══ TÍNH TOÁN — NHÓM I: Huyết Sát & Hiệu Ứng Phụ ═══
  { cau_hoi: '**Huyết Sát Đại Phong (300%)** tiêu 15% HP tối đa. HP max=6.000, CL=1.000. ST gây ra và HP tự mất?', dap_an: ['ST: 3.000, mat: 900', 'ST: 3.000, mat: 1.500', 'ST: 1.800, mat: 900', 'ST: 3.000, mat: 600'], dung: 0 },
  { cau_hoi: '**Huyết Sát** tiêu 15% HP max. HP max=20.000. HP mất mỗi lần dùng?', dap_an: ['3.000', '2.000', '1.500', '4.000'], dung: 0 },
  { cau_hoi: '**Pháp Tu** (+20%) dùng **Huyết Sát (300%)**. CL=2.000, HP max=10.000. ST và HP mất?', dap_an: ['ST: 7.200, mat: 1.500', 'ST: 6.000, mat: 1.500', 'ST: 7.200, mat: 3.000', 'ST: 9.000, mat: 1.500'], dung: 0 },

  // ═══ TÍNH TOÁN — NHÓM J: Giá Tổng Hợp ═══
  { cau_hoi: 'Mua **Tiên Kiếm (40.000 LT)** + **Hộ Đạo Kính (10.000 LT)** + **Linh Mộc Hồi Xuân bí pháp (8.000 LT)**. Tổng chi?', dap_an: ['58.000 LT', '50.000 LT', '60.000 LT', '55.000 LT'], dung: 0 },
  { cau_hoi: 'Mua **Tử Tinh Kiếm (100.000 LT)** + **Lân Giáp (150.000 LT)**. Tổng?', dap_an: ['250.000 LT', '200.000 LT', '300.000 LT', '180.000 LT'], dung: 0 },
  { cau_hoi: 'Mua **Tụ Khí Linh Đan** (phí 500 LT) x5 lần + **Khai Ngộ Đan** (phí 800 LT) x3. Tổng phí luyện?', dap_an: ['4.900 LT', '4.000 LT', '5.000 LT', '6.500 LT'], dung: 0 },
  { cau_hoi: '**Luyện Phách Nguyên Đan (phí 2.000 LT)** x4 + **Tuyết Tinh Hàn Đan (phí 4.000 LT)** x2. Tổng phí?', dap_an: ['16.000 LT', '12.000 LT', '20.000 LT', '14.000 LT'], dung: 0 },
  { cau_hoi: 'Mua **Càn Khôn Hư Không Nang (2.000 LT)** + **Lôi Hỏa Thiên Vân Châu (5.000 LT)** + **Hộ Đạo Kính (10.000 LT)**. Tổng?', dap_an: ['17.000 LT', '15.000 LT', '20.000 LT', '12.000 LT'], dung: 0 },
  { cau_hoi: '**Ám Vệ** lệnh an_ngu (3.000 LT) x2 lần + am_sat thành công cướp 30.000 LT. Net nhận được?', dap_an: ['24.000 LT', '30.000 LT', '27.000 LT', '36.000 LT'], dung: 0 },
  { cau_hoi: 'Luyện **Vạn Linh Hoàn** (phí 20.000 LT) x3. Rơi 2 Thượng Phẩm + 1 Hạ Phẩm. TV nhận: 2×(80.000×1.45) + 1×(80.000×0.65). Tổng TV?', dap_an: ['284.000', '240.000', '320.000', '232.000'], dung: 0 },
  { cau_hoi: 'Mua **Hỏa Long Phong bí pháp (5.000 LT)** + **Kim Thân Pháp Tướng (15.000 LT)** + **Thần Lôi Kiếm Trận (20.000 LT)**. Tổng?', dap_an: ['40.000 LT', '35.000 LT', '45.000 LT', '50.000 LT'], dung: 0 },

  // ═══ TÍNH TOÁN — NHÓM K: Trọng Lượng & Sức Chứa ═══
  { cau_hoi: 'Tổng kg mặc định 20kg. Đeo **Lân Giáp (6kg)** + **Tử Tinh Kiếm (7kg)** + **Hộ Đạo Kính (4kg)**. Còn bao nhiêu kg trống?', dap_an: ['3kg', '5kg', '7kg', '1kg'], dung: 0 },
  { cau_hoi: 'Đeo **Hồng Mông Kiếm (12kg)** + **Lân Giáp (6kg)**. Sức chứa 20kg + **Túi Da Thú (+18kg)**. Còn bao nhiêu kg trống?', dap_an: ['20kg', '2kg', '8kg', '14kg'], dung: 0 },
  { cau_hoi: 'Đeo **Ám Ma Kiếm (11kg)** + **Lân Giáp (6kg)** + **Tụ Linh Phủ (6kg)**. Sức chứa mặc định 20kg. Có đeo hết không?', dap_an: ['Khong, vuot 3kg (can 23kg, chi co 20kg)', 'Co, vua du 20kg', 'Co, con 2kg trong', 'Khong, vuot 5kg'], dung: 0 },
  { cau_hoi: 'Sức chứa 20kg + **Càn Khôn Nang (+10kg)** = 30kg. Đeo **Cửu Long Kích (10kg)** + **Âm Dương Bài (9kg)** + **Lân Giáp (6kg)**. Còn?', dap_an: ['5kg', '0kg', '15kg', '10kg'], dung: 0 },

  // ═══ TÍNH TOÁN — NHÓM L: Combo Gia Tộc + Đạo Tu ═══
  { cau_hoi: '**Ma Tu** (+18% ATK), **Hỏa Linh Tộc** (+8% ATK). ATK base=5.000. ATK thực?', dap_an: ['6.300', '5.000', '5.900', '5.800'], dung: 0 },
  { cau_hoi: '**Thể Tu** (-10% ATK), **Mộc Linh Tộc** (+8% HP). HP base=10.000. HP thực?', dap_an: ['10.800', '10.000', '9.200', '11.000'], dung: 0 },
  { cau_hoi: '**Kiếm Tu** (-8% DEF), **Thủy Linh Tộc** (+8% DEF). Net DEF bonus?', dap_an: ['0% (tru nhau)', '+8%', '-8%', '+16%'], dung: 0 },
  { cau_hoi: '**Pháp Tu** (+12% EXP), **Đan Tu** passive cho thêm +15% EXP. Không thể có cả hai nhưng nếu tính tổng: Đan Tu (+15%) + Luyện Đan Sư (+8%) = bao nhiêu % EXP bonus?', dap_an: ['23%', '15%', '8%', '30%'], dung: 0 },
  { cau_hoi: '**Ma Tu** ATK+18%, **Nguyệt Ảnh Tộc** ATK+10%, **Phi Khí Sư** ATK+4%. ATK base=4.000. Tổng ATK bonus từ 3 nguồn và ATK thực?', dap_an: ['Bonus 32%, ATK thuc 5.280', 'Bonus 32%, ATK thuc 5.000', 'Bonus 22%, ATK thuc 4.880', 'Bonus 28%, ATK thuc 5.120'], dung: 0 },
  { cau_hoi: '**Thiên Ưng Tộc** (ATK+12%), **Ám Vệ** (Crit+6%), **Ma Tu** (ATK+18%, Crit+5%). ATK base=3.000. Tổng ATK bonus từ tộc+đạo tu?', dap_an: ['ATK bonus 30%, ATK thuc 3.900', 'ATK bonus 22%, ATK thuc 3.660', 'ATK bonus 18%, ATK thuc 3.540', 'ATK bonus 35%, ATK thuc 4.050'], dung: 0 },
  { cau_hoi: '**Vô Thượng Tộc** (DEF+15%), **Trận Tu** (DEF+15%), **Linh Khí Hộ Thể** Ngọc Gian (ThuLuc+8%). DEF base=10.000. DEF thực từ 2 nguồn đầu?', dap_an: ['13.000 (cong 30%)', '10.000', '12.500', '11.500'], dung: 0 },
  { cau_hoi: '**Thể Tu** HP+15%, **Mộc Linh Tộc** HP+8%, **Thể Phách Cường Hóa** Ngọc Gian HP+20%. HP base=20.000. HP thực từ cả 3?', dap_an: ['28.600', '24.000', '20.000', '30.000'], dung: 0 },

  // ═══ TÍNH TOÁN — NHÓM M: Nhân Quả & Khí Vận ═══
  { cau_hoi: 'Nhân Quả +60 (Công Đức Viên Mãn, KV+25). Phong Thủy Sư cầu phúc tặng +7 KV. KV mới?', dap_an: ['32', '25', '30', '57'], dung: 0 },
  { cau_hoi: 'Nhân Quả -60 (Nghiệp Lực Sâu Nặng, KV-20, tăng kiếp 30%). Tặng công đức +12 điểm. Nhân Quả mới?', dap_an: ['-48', '-72', '-60', '-50'], dung: 0 },
  { cau_hoi: 'Phong Thủy Sư **khai_van** +10 KV. Phong Thủy Sư khác **cau_phuc** tặng +7 KV. KV ban đầu 0. Sau cả hai?', dap_an: ['17', '10', '7', '20'], dung: 0 },

  // ═══ TÍNH TOÁN — NHÓM N: Đa Bước Phức Tạp ═══
  { cau_hoi: '**Pháp Tu** (+20%) + **Vô Thượng Tộc** (+15% ATK). CL=2.000. Dùng **Vạn Kiếm Quy Tông (600%)**. Địch có **Hồng Mông (-70%)**. ST địch nhận?', dap_an: ['3.312', '2.760', '12.000', '5.000'], dung: 0 },
  { cau_hoi: '**Khí Tu** ATK vũ khí=3.000, passive x1.30. **Thiên Ưng Tộc** ATK+12%. CL tổng thực?', dap_an: ['4.368', '3.360', '3.900', '3.600'], dung: 0 },
  { cau_hoi: '**Kiếm Tu** CL=2.000, **Tử Tinh Kiếm** (18% bao kich x2.8). Dùng bí pháp **250%**. Nếu bạo kích xảy ra, ST?', dap_an: ['14.000', '5.000', '7.000', '10.000'], dung: 0 },
  { cau_hoi: '**Pháp Tu** (+20%), **Lôi Linh Tộc** (ATK+5%). CL=1.000 (chỉ tính bí pháp, không cộng ATK vào bí pháp). Dùng **Lôi Linh tộc bí pháp (245%)**. Địch có **Thủy Linh tộc bí pháp (-52%)**. ST thực?', dap_an: ['1.410', '2.940', '1.176', '2.000'], dung: 0 },
  { cau_hoi: '**Ma Tu** Ma Bùng (ATK+30%), CL base=4.000. Dùng **260%** bí pháp. Bạo kích x2. ST?', dap_an: ['27.040', '10.400', '20.800', '13.520'], dung: 0 },
  { cau_hoi: 'Player dùng **Hồng Mông Chi Thể (-70%)** và **Kim Cương tộc bí pháp (-54%)**. Cả hai active cùng lúc. Đòn đến 50.000 ST. ST thực nhận? (áp dụng tuần tự)',dap_an: ['6.900', '50.000', '15.000', '23.000'], dung: 0 },
  { cau_hoi: '**Yêu Tu** phản đòn 12%. Player A đánh Player B gây 9.000 ST. B phản lại. Đồng thời A có **Lân Giáp (-20%)**. ST A nhận từ phản đòn?', dap_an: ['864', '1.080', '900', '720'], dung: 0 },
  { cau_hoi: '**Đan Tu** dùng **Vạn Linh Hoàn** Cực Phẩm (x2.2, base 80.000). Passive +30%. Gia tộc Thái Dương +10%. Tu Vi thực?', dap_an: ['228.800', '176.000', '204.800', '256.000'], dung: 0 },
  { cau_hoi: '**Ám Vệ** dùng **sac_ben** (+15% CL PvP kế tiếp). CL base=2.000, bí pháp **260%**. Địch **Lân Giáp (-20%)**. ST địch nhận?', dap_an: ['4.784', '5.200', '4.160', '6.000'], dung: 0 },
  { cau_hoi: 'CL=5.000. **Hồng Mông Kiếm** bạo kích (25%, x4). Địch có **Kim Cương tộc bí pháp (-54%)**. Nếu bạo kích: ST?', dap_an: ['9.200', '20.000', '40.000', '18.400'], dung: 0 },

  // ═══ NHẬN BIẾT — VŨ KHÍ ═══
  { cau_hoi: 'Vũ khí **Hàn Băng Địa Kiếm** (cap 3): ATK bao nhiêu và giá bao nhiêu LT?', dap_an: ['ATK 80, 2.000 LT', 'ATK 100, 2.000 LT', 'ATK 80, 5.000 LT', 'ATK 80, 3.000 LT'], dung: 0 },
  { cau_hoi: 'Vũ khí **Thiên Nguyên Linh Phong Kiếm** (cap 5): ATK và giá?', dap_an: ['ATK 200, 8.000 LT', 'ATK 280, 8.000 LT', 'ATK 200, 10.000 LT', 'ATK 200, 6.000 LT'], dung: 0 },
  { cau_hoi: 'Vũ khí **Thanh Hư Tiên Phong Kiếm** (cap 10): ATK, giá, bạo kích?', dap_an: ['ATK 800, 40.000 LT, 15% bao kich x2.5', 'ATK 800, 30.000 LT, 15%', 'ATK 1.000, 40.000 LT, 15%', 'ATK 800, 40.000 LT, 10% x2'], dung: 0 },
  { cau_hoi: 'Vũ khí **Tử Tinh Thiên Ngoại Kiếm** (cap 14): ATK, giá, bạo kích?', dap_an: ['ATK 1.800, 100.000 LT, 18% bao kich x2.8', 'ATK 2.000, 100.000 LT, 18%', 'ATK 1.800, 80.000 LT, 18%', 'ATK 1.800, 100.000 LT, 20% x3'], dung: 0 },
  { cau_hoi: '**Vạn Kiếp Thần Lôi Kiếm** (donate, cap 18): ATK và giá?', dap_an: ['ATK 5.000, 200.000 LT', 'ATK 8.000, 200.000 LT', 'ATK 5.000, 150.000 LT', 'ATK 5.000, 400.000 LT'], dung: 0 },
  { cau_hoi: '**Hư Không Thần Uy Cung** (donate, cap 20): ATK và hiệu ứng?', dap_an: ['ATK 8.000, xuyen giap 30%', 'ATK 10.000, xuyen giap 30%', 'ATK 8.000, xuyen giap 40%', 'ATK 8.000, bao kich x3'], dung: 0 },
  { cau_hoi: '**Tuyết Tinh Hàn Nguyên Thương** (donate, cap 24): ATK và hiệu ứng đặc biệt?', dap_an: ['ATK 15.000, 25% dong bang 1 luot', 'ATK 12.000, 25% dong bang', 'ATK 15.000, 30% dong bang', 'ATK 15.000, xuyen giap 25%'], dung: 0 },
  { cau_hoi: '**Ám Ma Cửu Huyền Kiếm** (donate, cap 28): ATK và hiệu ứng?', dap_an: ['ATK 35.000, 30% bao kich x3.5 + hut 10%', 'ATK 30.000, 30% bao kich x3.5', 'ATK 35.000, 25% bao kich x3.5', 'ATK 35.000, 30% x3 + hut 10%'], dung: 0 },
  { cau_hoi: '**Hồng Mông Khai Thiên Kiếm** (donate, cap 30): ATK và giá?', dap_an: ['ATK 50.000, 2.000.000 LT', 'ATK 50.000, 1.500.000 LT', 'ATK 35.000, 2.000.000 LT', 'ATK 50.000, 2.500.000 LT'], dung: 0 },
  { cau_hoi: '**Như Ý Kiền Khôn Chủy** (cap 8): ATK, giá, hiệu ứng?', dap_an: ['ATK 400, 20.000 LT, +20% Thu Luc', 'ATK 400, 15.000 LT, +20% Thu Luc', 'ATK 500, 20.000 LT, +20%', 'ATK 400, 20.000 LT, +20% Cong Luc'], dung: 0 },
  { cau_hoi: '**Tinh Thiết Phi Kiếm** (cap 1): ATK và giá?', dap_an: ['ATK 25, 500 LT', 'ATK 25, 1.000 LT', 'ATK 30, 500 LT', 'ATK 20, 500 LT'], dung: 0 },

  // ═══ NHẬN BIẾT — BẢO BỐI ═══
  { cau_hoi: '**Thái Hư Linh Ngọc Bội** (cap 0): DEF và giá?', dap_an: ['DEF 20, 800 LT', 'DEF 20, 1.000 LT', 'DEF 50, 800 LT', 'DEF 20, 500 LT'], dung: 0 },
  { cau_hoi: '**Lôi Hỏa Thiên Vân Châu** (cap 3): ATK và hiệu ứng?', dap_an: ['ATK 100, 20% kich no them 50%', 'ATK 100, 30% kich no', 'ATK 150, 20% kich no', 'ATK 100, 20% kich no them 30%'], dung: 0 },
  { cau_hoi: '**Hộ Đạo Thiên Mục Kính** (cap 5): DEF, giá, % né?', dap_an: ['DEF 150, 10.000 LT, 30% ne', 'DEF 200, 10.000 LT, 30%', 'DEF 150, 8.000 LT, 30%', 'DEF 150, 10.000 LT, 20%'], dung: 0 },
  { cau_hoi: '**Tụ Linh Tiên Ngọc Phủ** (cap 10): DEF, giá, hồi HP?', dap_an: ['DEF 500, 60.000 LT, hoi 2%/luot', 'DEF 500, 40.000 LT, hoi 2%', 'DEF 800, 60.000 LT, hoi 2%', 'DEF 500, 60.000 LT, hoi 5%'], dung: 0 },
  { cau_hoi: '**Huyền Long Bất Hoại Lân Giáp** (cap 15): DEF, giá, giảm ST?', dap_an: ['DEF 2.000, 150.000 LT, giam 20%', 'DEF 2.000, 100.000 LT, giam 20%', 'DEF 1.500, 150.000 LT, giam 20%', 'DEF 2.000, 150.000 LT, giam 15%'], dung: 0 },
  { cau_hoi: '**Âm Dương Thái Cực Bài** (donate, cap 22): ATK, DEF, giá?', dap_an: ['ATK 1.000, DEF 3.500, 600.000 LT', 'ATK 500, DEF 3.500, 600.000 LT', 'ATK 1.000, DEF 3.000, 600.000 LT', 'ATK 1.000, DEF 3.500, 500.000 LT'], dung: 0 },
  { cau_hoi: '**Linh Hồn Thần Binh Ám Khí** (craft, cap 25): ATK, DEF, bạo kích?', dap_an: ['ATK 3.500, DEF 2.000, 22% bao kich x3.2', 'ATK 3.000, DEF 2.000, 22%', 'ATK 3.500, DEF 1.500, 22%', 'ATK 3.500, DEF 2.000, 20% x3'], dung: 0 },

  // ═══ NHẬN BIẾT — ĐAN DƯỢC ═══
  { cau_hoi: '**Tụ Khí Linh Đan** (cap 3): nguyên liệu và Tu Vi?', dap_an: ['5 Tu Hu Thao + 2 Bich Ha Lien, 2.000 TV', '3 Thao + 2 Lien, 2.000 TV', '5 Thao + 2 Lien, 3.000 TV', '5 Thao + 3 Lien, 2.000 TV'], dung: 0 },
  { cau_hoi: '**Phách Nguyên Đan** (cap 8): nguyên liệu và Tu Vi?', dap_an: ['3 Long Tinh Thao + 3 Bich Ha Lien, 8.000 TV', '2 Long Tinh + 3 Lien, 8.000 TV', '3 Long Tinh + 2 Lien, 8.000 TV', '3 Long Tinh + 3 Lien, 10.000 TV'], dung: 0 },
  { cau_hoi: '**Vạn Linh Hoàn** (cap 22): nguyên liệu và Tu Vi?', dap_an: ['3 Thien Nhan Qua + 2 Tuyet Linh Thao, 80.000 TV', '2 Thien Nhan Qua + 3 Tuyet, 80.000 TV', '3 Thien Nhan Qua + 2 Tuyet, 60.000 TV', '3 Thien Nhan Qua + 2 Tuyet, 100.000 TV'], dung: 0 },
  { cau_hoi: '**Đan Phẩm Cực Phẩm**: hệ số và tỉ lệ rơi?', dap_an: ['x2.2, 7%', 'x2.0, 10%', 'x2.2, 5%', 'x2.5, 7%'], dung: 0 },
  { cau_hoi: '**Linh Thảo Tuyết Linh Thảo**: yêu cầu cap bao nhiêu?', dap_an: ['Cap 15', 'Cap 10', 'Cap 20', 'Cap 12'], dung: 0 },
  { cau_hoi: '**Linh Thảo Thiên Địa Linh Căn**: yêu cầu cap bao nhiêu?', dap_an: ['Cap 20', 'Cap 15', 'Cap 25', 'Cap 18'], dung: 0 },
  { cau_hoi: '**Linh Thảo Địa Ngục Huyết Liên**: yêu cầu cap bao nhiêu?', dap_an: ['Cap 30', 'Cap 25', 'Cap 28', 'Cap 35'], dung: 0 },

  // ═══ NHẬN BIẾT — BÍ PHÁP ═══
  { cau_hoi: '**Hỏa Linh Tộc bí pháp**: ĐÚNG bao nhiêu % CL?', dap_an: ['215%', '200%', '220%', '210%'], dung: 0 },
  { cau_hoi: '**Lôi Linh Tộc bí pháp**: ĐÚNG bao nhiêu % CL và CD?', dap_an: ['245%, cd 3 luot', '240%, cd 3 luot', '250%, cd 3 luot', '245%, cd 4 luot'], dung: 0 },
  { cau_hoi: '**Long Huyết Tộc bí pháp**: ĐÚNG bao nhiêu % CL và CD?', dap_an: ['260%, cd 4 luot', '255%, cd 4 luot', '265%, cd 4 luot', '260%, cd 3 luot'], dung: 0 },
  { cau_hoi: '**Thổ Linh Tộc bí pháp**: ĐÚNG giảm bao nhiêu % ST?', dap_an: ['35%', '30%', '40%', '50%'], dung: 0 },
  { cau_hoi: '**Kim Cương Tộc bí pháp**: ĐÚNG giảm bao nhiêu % ST?', dap_an: ['54%', '50%', '60%', '52%'], dung: 0 },
  { cau_hoi: '**Hồng Mông Chi Thể**: ĐÚNG giảm bao nhiêu % ST? Yêu cầu cap?', dap_an: ['70%, yc cap 28', '70%, yc cap 30', '60%, yc cap 28', '70%, yc cap 25'], dung: 0 },
  { cau_hoi: '**Tam Hoa Tụ Đỉnh** (donate): % CL và CD?', dap_an: ['350%, cd 5 luot, yc cap 18', '350%, cd 4 luot', '300%, cd 5 luot', '400%, cd 5 luot'], dung: 0 },
  { cau_hoi: '**Vạn Kiếm Quy Tông** (donate): % CL và yêu cầu cap?', dap_an: ['600%, yc cap 26', '600%, yc cap 30', '500%, yc cap 26', '600%, yc cap 22'], dung: 0 },
  { cau_hoi: '**Kim Thân Pháp Tướng**: giảm bao nhiêu % ST? Giá và yêu cầu cap?', dap_an: ['50%, 15.000 LT, yc cap 8', '50%, 10.000 LT, yc cap 8', '50%, 15.000 LT, yc cap 10', '40%, 15.000 LT, yc cap 8'], dung: 0 },
  { cau_hoi: '**Huyết Sát Đại Phong**: % CL, % HP tự mất, CD, yêu cầu cap?', dap_an: ['300%, mat 15% HP, cd 6 luot, yc cap 14', '300%, mat 15%, cd 4 luot', '250%, mat 15%, cd 6 luot', '300%, mat 10%, cd 6 luot'], dung: 0 },

  // ═══ NHẬN BIẾT — ĐẠO TU ═══
  { cau_hoi: '**Ma Tu** base stat: ATK bonus, DEF penalty, Crit bonus chính xác?', dap_an: ['ATK+18%, DEF-18%, Crit+5%', 'ATK+20%, DEF-18%, Crit+5%', 'ATK+18%, DEF-15%, Crit+5%', 'ATK+18%, DEF-18%, Crit+8%'], dung: 0 },
  { cau_hoi: '**Thể Tu** base stat: ATK penalty, DEF bonus, HP bonus?', dap_an: ['ATK-10%, DEF+8%, HP+15%', 'ATK-10%, DEF+10%, HP+15%', 'ATK-8%, DEF+8%, HP+15%', 'ATK-10%, DEF+8%, HP+12%'], dung: 0 },
  { cau_hoi: '**Đan Tu** base stat: ATK penalty, EXP bonus, HP bonus?', dap_an: ['ATK-12%, EXP+15%, HP+5%', 'ATK-10%, EXP+15%, HP+5%', 'ATK-12%, EXP+12%, HP+5%', 'ATK-12%, EXP+15%, HP+8%'], dung: 0 },
  { cau_hoi: '**Pháp Tu** base stat: ATK penalty, DEF penalty, EXP bonus?', dap_an: ['ATK-8%, DEF-5%, EXP+12%', 'ATK-10%, DEF-5%, EXP+12%', 'ATK-8%, DEF-8%, EXP+12%', 'ATK-8%, DEF-5%, EXP+15%'], dung: 0 },
  { cau_hoi: '**Ma Tu** passive Ma Bùng: kích hoạt khi HP dưới bao nhiêu %, ATK+?, hao HP/lượt?', dap_an: ['HP<50%, ATK+30%, hao 4%/luot', 'HP<30%, ATK+30%', 'HP<50%, ATK+25%', 'HP<50%, ATK+30%, hao 5%'], dung: 0 },
  { cau_hoi: '**Pháp Tu** passive: bí pháp ST tăng ĐÚNG bao nhiêu %?', dap_an: ['20%', '15%', '25%', '30%'], dung: 0 },
  { cau_hoi: '**Khí Tu** passive Phi Khí Quần: nhân ATK vũ khí lên ĐÚNG bao nhiêu lần?', dap_an: ['x1.30', 'x1.20', 'x1.25', 'x1.50'], dung: 0 },

  // ═══ NHẬN BIẾT — GIA TỘC ═══
  { cau_hoi: '**Hỏa Linh Tộc**: bonus ATK bao nhiêu %?', dap_an: ['+8%', '+5%', '+10%', '+12%'], dung: 0 },
  { cau_hoi: '**Mộc Linh Tộc**: bonus HP bao nhiêu %?', dap_an: ['+8%', '+5%', '+10%', '+12%'], dung: 0 },
  { cau_hoi: '**Nguyệt Ảnh Tộc**: bonus ATK bao nhiêu % và Crit bao nhiêu %?', dap_an: ['ATK+10%, Crit+4%', 'ATK+10%, Crit+3%', 'ATK+12%, Crit+4%', 'ATK+10%, Crit+6%'], dung: 0 },
  { cau_hoi: '**Long Huyết Tộc**: bonus ATK, DEF, HP bao nhiêu %?', dap_an: ['ATK+10%, DEF+5%, HP+10%', 'ATK+12%, DEF+5%, HP+10%', 'ATK+10%, DEF+8%, HP+10%', 'ATK+10%, DEF+5%, HP+12%'], dung: 0 },
  { cau_hoi: '**Vô Thượng Tộc**: bonus ATK, DEF, HP, TuVi, Crit?', dap_an: ['ATK+15%, DEF+15%, HP+15%, TuVi+8%, Crit+5%', 'ATK+20%, DEF+15%, HP+15%', 'ATK+15%, DEF+15%, HP+15%, TuVi+10%', 'ATK+15%, DEF+20%, HP+15%'], dung: 0 },
  { cau_hoi: '**Thiên Mệnh Tộc**: bonus ATK, DEF, HP, TuVi?', dap_an: ['ATK+8%, DEF+8%, HP+8%, TuVi+5%', 'ATK+10%, DEF+8%, HP+8%, TuVi+5%', 'ATK+8%, DEF+8%, HP+8%, TuVi+8%', 'ATK+8%, DEF+10%, HP+8%, TuVi+5%'], dung: 0 },
  { cau_hoi: '**Huyền Linh Tộc**: bonus ATK và TuVi bao nhiêu %?', dap_an: ['ATK+5%, TuVi+15%', 'ATK+8%, TuVi+15%', 'ATK+5%, TuVi+12%', 'ATK+10%, TuVi+15%'], dung: 0 },
  { cau_hoi: '**Thái Dương Tộc**: bonus Tu Vi bao nhiêu %?', dap_an: ['+10%', '+8%', '+12%', '+15%'], dung: 0 },

  // ═══ NHẬN BIẾT — CANH GIỚI ═══
  { cau_hoi: 'Cap **10** (Trúc Cơ Sơ Kỳ): Linh Lực và Công Lực?', dap_an: ['LL 2.000, CL 200', 'LL 1.300, CL 130', 'LL 3.000, CL 300', 'LL 2.000, CL 250'], dung: 0 },
  { cau_hoi: 'Cap **14** (Kết Đan Sơ Kỳ): Linh Lực và Công Lực?', dap_an: ['LL 10.000, CL 1.000', 'LL 6.500, CL 650', 'LL 15.000, CL 1.500', 'LL 10.000, CL 1.200'], dung: 0 },
  { cau_hoi: 'Cap **18** (Nguyên Anh Sơ Kỳ): Linh Lực, Công Lực, Thủ Lực?', dap_an: ['LL 50.000, CL 5.000, TL 3.000', 'LL 32.000, CL 3.200, TL 1.920', 'LL 75.000, CL 7.500, TL 4.500', 'LL 50.000, CL 5.000, TL 4.000'], dung: 0 },
  { cau_hoi: 'Cap **30** (Hợp Thể Sơ Kỳ): Linh Lực bao nhiêu?', dap_an: ['6.000.000', '4.000.000', '9.000.000', '10.000.000'], dung: 0 },
  { cau_hoi: 'Cap **22** (Hóa Thần Sơ Kỳ): Linh Lực bao nhiêu và EXP cần bao nhiêu?', dap_an: ['LL 250.000, can 2.200.000 EXP', 'LL 160.000, can 1.450.000 EXP', 'LL 380.000, can 3.300.000 EXP', 'LL 250.000, can 3.300.000 EXP'], dung: 0 },

  // ═══ NHẬN BIẾT — NGHỀ, HỆ THỐNG ═══
  { cau_hoi: '**Luyện Đan Sư**: bonus EXP bao nhiêu %?', dap_an: ['+8%', '+10%', '+12%', '+6%'], dung: 0 },
  { cau_hoi: '**Phi Khí Sư**: bonus ATK bao nhiêu %?', dap_an: ['+4%', '+6%', '+8%', '+5%'], dung: 0 },
  { cau_hoi: '**Ám Vệ**: bonus Crit bao nhiêu %?', dap_an: ['+6%', '+5%', '+8%', '+10%'], dung: 0 },
  { cau_hoi: '**Ám Vệ** lệnh an_ngu: tốn bao nhiêu LT và ẩn bao nhiêu giờ?', dap_an: ['3.000 LT, 4h', '5.000 LT, 4h', '3.000 LT, 6h', '2.000 LT, 4h'], dung: 0 },
  { cau_hoi: '**Phi Khí Sư** lệnh vo_trang: tốn bao nhiêu LT và CD?', dap_an: ['2.250 LT, CD 5h', '3.000 LT, CD 5h', '2.250 LT, CD 3h', '1.500 LT, CD 5h'], dung: 0 },
  { cau_hoi: '**Ngộ Đạo Sư** lệnh thach_ngo: CD bao nhiêu giờ, nguy cơ phản tác bao nhiêu %?', dap_an: ['CD 20h, nguy co 20-30%', 'CD 10h, nguy co 20%', 'CD 20h, nguy co 50%', 'CD 12h, nguy co 20-30%'], dung: 0 },
  { cau_hoi: '**Phong Thủy Sư** lệnh cau_phuc: tặng bao nhiêu KV và CD?', dap_an: ['+7 KV, CD 5h', '+10 KV, CD 5h', '+7 KV, CD 4h', '+5 KV, CD 5h'], dung: 0 },
  { cau_hoi: '**Ngọc Gian Khinh Công**: bonus gì và yêu cầu cap?', dap_an: ['15% ne tranh PvP, yc cap 12', '20% ne, yc cap 12', '15% ne, yc cap 10', '10% ne, yc cap 12'], dung: 0 },
  { cau_hoi: '**Ngọc Gian Thiên Phúc Chi Thuật**: bonus gì và yêu cầu cap?', dap_an: ['TuVi+10%, Drop+20%, yc cap 25', 'TuVi+15%, Drop+20%', 'TuVi+10%, Drop+15%', 'TuVi+10%, Drop+20%, yc cap 22'], dung: 0 },
  { cau_hoi: '**Nhân Quả Công Đức Viên Mãn** (>=100): KV bonus và giảm kiếp bao nhiêu?', dap_an: ['KV+25, giam kiep 20%', 'KV+30, giam kiep 25%', 'KV+20, giam kiep 20%', 'KV+25, giam kiep 30%'], dung: 0 },
  { cau_hoi: '**Nghiệp Chướng Tột Đỉnh** (<=-100): KV giảm bao nhiêu và tăng kiếp?', dap_an: ['KV-30, tang kiep 50%', 'KV-20, tang kiep 30%', 'KV-25, tang kiep 50%', 'KV-30, tang kiep 30%'], dung: 0 },
  { cau_hoi: '**Tiên Phẩm Ngộ Tính** (81-100): linh_ngo_bonus và tỉ lệ ngộ đạo?', dap_an: ['+100% linh_ngo, ty le 55%', '+60%, ty le 55%', '+100%, ty le 35%', '+100%, ty le 70%'], dung: 0 },
  { cau_hoi: '**Thiên Phẩm Ngộ Tính** (61-80): linh_ngo_bonus và tỉ lệ ngộ đạo?', dap_an: ['+60% linh_ngo, ty le 35%', '+35%, ty le 35%', '+60%, ty le 55%', '+100%, ty le 35%'], dung: 0 },


  // ═══ THÊM TÍNH TOÁN — 80 CÂU NỮA ═══
  { cau_hoi: 'CL=1.000. **Hỏa Linh tộc bí pháp (215%)**. ST gây ra?', dap_an: ['2.150', '2.000', '2.500', '1.500'], dung: 0 },
  { cau_hoi: 'CL=2.000. **Mộc Linh tộc bí pháp** hồi **42% HP**. HP max=10.000. HP hồi được?', dap_an: ['4.200', '2.000', '8.400', '4.000'], dung: 0 },
  { cau_hoi: 'CL=1.000. **Thái Dương tộc bí pháp** hồi **44% HP**. HP max=20.000. HP hồi được?', dap_an: ['8.800', '4.400', '4.000', '10.000'], dung: 0 },
  { cau_hoi: 'CL=3.000. **Nguyệt Ảnh tộc bí pháp (250%)**. ST gây ra?', dap_an: ['7.500', '6.000', '8.000', '5.000'], dung: 0 },
  { cau_hoi: 'CL=2.000. **Thiên Mệnh tộc bí pháp (275%)**. ST gây ra?', dap_an: ['5.500', '5.000', '6.000', '4.000'], dung: 0 },
  { cau_hoi: 'CL=1.500. **Bát Hoang tộc bí pháp (280%)**. ST gây ra?', dap_an: ['4.200', '3.000', '4.500', '5.000'], dung: 0 },
  { cau_hoi: 'CL=2.000. **Huyền Linh tộc bí pháp (255%)**. ST gây ra?', dap_an: ['5.100', '4.000', '5.500', '5.000'], dung: 0 },
  { cau_hoi: 'CL=2.500. **Thiên Ưng tộc bí pháp (265%)**. ST gây ra?', dap_an: ['6.625', '5.000', '7.000', '6.000'], dung: 0 },
  { cau_hoi: 'CL=1.000. **Thủy Linh tộc bí pháp giảm 52%**. Đòn đến 5.000 ST. ST thực nhận?', dap_an: ['2.400', '2.600', '2.500', '4.800'], dung: 0 },
  { cau_hoi: 'CL=2.000. **Thổ Linh tộc bí pháp giảm 35%**. Đòn đến 4.000 ST. ST thực nhận?', dap_an: ['2.600', '2.000', '3.000', '4.000'], dung: 0 },
  { cau_hoi: '**Kiếm Tu** CL=1.000, dùng **Băng Vũ Thiên Hoa (200%)**. Không bạo kích. ST gây ra?', dap_an: ['2.000', '1.000', '1.200', '2.500'], dung: 0 },
  { cau_hoi: '**Kiếm Tu** CL=1.000, dùng **Băng Vũ Thiên Hoa (200%)**. Bạo kích x2. ST?', dap_an: ['4.000', '2.000', '3.000', '6.000'], dung: 0 },
  { cau_hoi: '**Ma Tu** (ATK+18%). ATK base=2.000. ATK thực?', dap_an: ['2.360', '2.000', '2.180', '2.400'], dung: 0 },
  { cau_hoi: '**Thể Tu** (HP+15%). HP base=8.000. HP thực?', dap_an: ['9.200', '8.000', '8.800', '10.000'], dung: 0 },
  { cau_hoi: '**Kiếm Tu** (ATK+12%, DEF-8%). DEF base=3.000. DEF thực?', dap_an: ['2.760', '3.000', '2.400', '3.360'], dung: 0 },
  { cau_hoi: '**Pháp Tu** (EXP+12%). Nhận 5.000 EXP base. EXP thực?', dap_an: ['5.600', '5.000', '6.000', '5.500'], dung: 0 },
  { cau_hoi: '**Đan Tu** (EXP+15%). Đan base 8.000 TV, Trung Phẩm (x1.0). TV thực nhận?', dap_an: ['9.200', '8.000', '9.500', '10.000'], dung: 0 },
  { cau_hoi: 'Yêu Tu (HP+10%). HP base=5.000. HP thực? Hồi 3%/lượt. HP hồi mỗi lượt?', dap_an: ['HP 5.500, hoi 165/luot', 'HP 5.000, hoi 150/luot', 'HP 5.500, hoi 150/luot', 'HP 5.500, hoi 300/luot'], dung: 0 },
  { cau_hoi: 'CL=5.000. Bí pháp **Thiên Hạ Đệ Nhất Kiếm (500%)**. Địch có **Kim Thân (-50%)**. ST?', dap_an: ['12.500', '25.000', '10.000', '15.000'], dung: 0 },
  { cau_hoi: 'CL=3.000. Bí pháp **Vạn Kiếm Quy Tông (600%)**. Địch có **Thổ Linh (-35%)**. ST?', dap_an: ['11.700', '18.000', '9.000', '12.000'], dung: 0 },
  { cau_hoi: 'CL=2.000. Bí pháp **Thiên Địa Hồng Lô (450%)**. Địch có **Lân Giáp (-20%)**. ST?', dap_an: ['7.200', '9.000', '8.000', '6.000'], dung: 0 },
  { cau_hoi: 'CL=1.000. Bí pháp **Hỏa Long Phong (250%)**. Bạo kích **x2**. ST?', dap_an: ['5.000', '2.500', '4.000', '6.000'], dung: 0 },
  { cau_hoi: 'Đan base **500 Tu Vi**, Thượng Phẩm (x1.45). Nghe **Luyện Đan Sư** (+8%). Tu Vi thực?', dap_an: ['783', '725', '500', '800'], dung: 0 },
  { cau_hoi: 'Đan base **30.000 Tu Vi**, Cực Phẩm (x2.2). **Đan Tu** (+15%). TV thực?', dap_an: ['75.900', '66.000', '70.000', '80.000'], dung: 0 },
  { cau_hoi: 'Đan base **150.000 Tu Vi**, Thượng Phẩm (x1.45). Không bonus EXP. TV thực?', dap_an: ['217.500', '150.000', '200.000', '180.000'], dung: 0 },
  { cau_hoi: 'Đan base **80.000 Tu Vi**, Hạ Phẩm (x0.65). **Pháp Tu** (+12%). TV thực?', dap_an: ['58.240', '52.000', '80.000', '55.000'], dung: 0 },
  { cau_hoi: '**Yêu Tu** phản đòn 12%. Địch dùng bí pháp gây 12.000 ST. Phản lại?', dap_an: ['1.440', '1.200', '600', '2.400'], dung: 0 },
  { cau_hoi: '**Yêu Tu** phản đòn 12%. Đòn đến 3.000 ST. Địch có **Lân Giáp (-20%)**. ST phản sau giáp?', dap_an: ['288', '360', '600', '144'], dung: 0 },
  { cau_hoi: 'HP max=15.000. **Đan Tu** hồi 5%/lượt + **Tụ Linh Phủ** hồi 2%/lượt. Sau 5 lượt tổng hồi?', dap_an: ['5.250', '3.750', '7.500', '4.500'], dung: 0 },
  { cau_hoi: 'HP max=30.000. Chỉ **Tụ Linh Phủ** hồi 2%/lượt. Sau 8 lượt tổng hồi?', dap_an: ['4.800', '6.000', '2.400', '8.000'], dung: 0 },
  { cau_hoi: 'Mua vũ khí **Thanh Long Thương (12.000 LT)** + bí pháp **Hỏa Long Phong (5.000 LT)** + bảo bối **Lân Giáp (150.000 LT)**. Tổng?', dap_an: ['167.000 LT', '162.000 LT', '170.000 LT', '165.000 LT'], dung: 0 },
  { cau_hoi: 'Sức chứa 20kg. Đeo **Tiên Kiếm (6kg)** + **Tụ Linh Phủ (6kg)** + **Hộ Đạo Kính (4kg)**. Còn trống?', dap_an: ['4kg', '6kg', '2kg', '0kg'], dung: 0 },
  { cau_hoi: '**Phi Khí Sư** lệnh sac_ben (+15% CL). CL=3.000, bí pháp **260%**. ST (không passive Pháp Tu)?', dap_an: ['8.970', '7.800', '10.000', '8.000'], dung: 0 },
  { cau_hoi: '**Phong Thủy Sư** khai_van (+10 KV) x3 lần trong 12 giờ (CD 4h/lần). KV từ 0 thành?', dap_an: ['30', '10', '40', '20'], dung: 0 },
  { cau_hoi: 'Đan base **2.000 TV** x10 lần luyện. Trung Phẩm (x1.0) mỗi lần. Tổng TV nhận?', dap_an: ['20.000', '10.000', '25.000', '14.000'], dung: 0 },
  { cau_hoi: 'Luyện **Phách Nguyên Đan (phi 2.000 LT/lần)** x6 lần. Tổng phí luyện?', dap_an: ['12.000 LT', '8.000 LT', '16.000 LT', '10.000 LT'], dung: 0 },
  { cau_hoi: '**Ám Vệ** am_sat thành công: cướp 25% LT. Địch mang 40.000 LT. Cướp bao nhiêu?', dap_an: ['10.000 LT', '8.000 LT', '25.000 LT', '12.000 LT'], dung: 0 },
  { cau_hoi: '**Ám Vệ** am_sat thành công: cướp 40% LT. Địch mang 25.000 LT. Cướp bao nhiêu?', dap_an: ['10.000 LT', '15.000 LT', '8.000 LT', '12.500 LT'], dung: 0 },
  { cau_hoi: 'CL=2.000. **Pháp Tu** (+20%). Dùng **Nguyệt Ảnh tộc bí pháp (250%)**. Địch có **Kim Cương tộc (-54%)**. ST?', dap_an: ['2.760', '6.000', '5.000', '3.000'], dung: 0 },
  { cau_hoi: 'CL=1.000. **Kiếm Tu** dùng **Thần Lôi Kiếm Trận (300%)**. Bạo kích **x2.5**. Địch có **Lân Giáp (-20%)**. ST?', dap_an: ['6.000', '7.500', '3.000', '5.000'], dung: 0 },
  { cau_hoi: 'CL=4.000. **Ma Tu** Ma Bùng (+30%). Dùng bí pháp **200%**. Bạo kích **x2**. ST?', dap_an: ['20.800', '8.000', '10.400', '16.000'], dung: 0 },
  { cau_hoi: 'Luyện đan **5 lần**: 2 Cực Phẩm (x2.2), 2 Thượng Phẩm (x1.45), 1 Hạ Phẩm (x0.65). Base 2.000 TV. Tổng TV?', dap_an: ['16.000', '10.000', '14.000', '20.000'], dung: 0 },
  { cau_hoi: '**Pháp Tu** (+20%) + **Thiên Mệnh Tộc** (ATK+8%). ATK base=3.000. CL dùng bí pháp **350%**. Áp dụng gia tộc ATK vào CL (giả sử CL=ATK). ST gây ra?', dap_an: ['11.340', '10.500', '12.000', '10.000'], dung: 0 },
  { cau_hoi: 'Đòn PvP thô 20.000 ST. Có **Hồng Mông Chi Thể (-70%)** + **Trận Tu passive (-10%)**. ST thực nhận?', dap_an: ['5.400', '6.000', '14.000', '4.000'], dung: 0 },
  { cau_hoi: '**Đan Tu** passive đan +30%. Dùng **Khai Ngộ Đan** (base 200 TV Hạ Phẩm x0.65). TV thực?', dap_an: ['169', '130', '200', '260'], dung: 0 },
  { cau_hoi: 'Nhân Quả: từ Nghiệp Lực Tích Tụ (-30) chịu KV-10. Phong Thủy Sư khai_van +10 KV. KV net?', dap_an: ['0', '-10', '+10', '+20'], dung: 0 },
  { cau_hoi: 'HP=500/10.000. **Thể Tu** Cương Thể kích hoạt (HP<30%): ATK+25%. ATK base=2.000. ATK thực?', dap_an: ['2.500', '2.000', '2.250', '3.000'], dung: 0 },
  { cau_hoi: 'CL=6.000. **Vô Thượng tộc bí pháp (290%)**. **Pháp Tu passive (+20%)**. Địch có **Thổ Linh tộc (-35%)**. ST?', dap_an: ['13.572', '17.400', '20.880', '10.000'], dung: 0 },
  { cau_hoi: 'CL=3.000. Dùng **Huyết Sát (300%)** tiêu 15% HP max=12.000. ST gây ra và HP mất?', dap_an: ['ST: 9.000, mat: 1.800', 'ST: 9.000, mat: 3.600', 'ST: 6.000, mat: 1.800', 'ST: 12.000, mat: 1.800'], dung: 0 },
  { cau_hoi: 'CL=1.000. **Ám Ma Kiếm** bạo kích x3.5 (30% xác suất). Bí pháp **260%**. Hút 10% ST. ST và HP hút?', dap_an: ['ST: 9.100, hut: 910', 'ST: 2.600, hut: 260', 'ST: 9.100, hut: 455', 'ST: 7.000, hut: 700'], dung: 0 },
  { cau_hoi: 'Sức chứa tổng = 20+18 (Túi Da Thú) = 38kg. Đang mang: **Hồng Mông Kiếm (12kg)** + **Âm Dương Bài (9kg)** + **Lân Giáp (6kg)** + 5kg vật phẩm. Còn trống?', dap_an: ['6kg', '0kg', '11kg', '5kg'], dung: 0 },
  { cau_hoi: 'Nghe **Dược Sư** (+6% EXP) + gia tộc **Thái Dương** (+10% TuVi). Đan base **10.000 TV**, Thượng Phẩm (x1.45). TV thực?', dap_an: ['16.820', '14.500', '15.950', '10.000'], dung: 0 },
  { cau_hoi: '**Ám Vệ** bo_doc: độc gây 5% HP/lượt x3 lượt. Địch HP max=20.000. Tổng HP độc hại?', dap_an: ['3.000', '1.000', '5.000', '6.000'], dung: 0 },
  { cau_hoi: 'CL=2.000. **Hỏa Linh tộc bí pháp (215%)**. **Pháp Tu passive (+20%)**. ST?', dap_an: ['5.160', '4.300', '6.000', '5.000'], dung: 0 },
  { cau_hoi: 'CL=4.000. **Bát Hoang tộc bí pháp (280%)**. Địch có **Kim Cương tộc (-54%)**. ST?', dap_an: ['5.152', '11.200', '6.000', '4.000'], dung: 0 },
  { cau_hoi: 'CL=2.500. **Thiên Ưng tộc bí pháp (265%)**. Địch có **Lân Giáp (-20%)**. ST?', dap_an: ['5.300', '6.625', '5.000', '4.250'], dung: 0 },
  { cau_hoi: 'CL=1.000. **Thiên Địa Hồng Lô (450%)**. Bạo kích **x4** (Hồng Mông Kiếm). ST?', dap_an: ['18.000', '4.500', '9.000', '12.000'], dung: 0 },
  { cau_hoi: 'Luyện đan **Thiên Đế Nguyên Đan** (phí 80.000 LT) x2 lần. Tổng phí?', dap_an: ['160.000 LT', '80.000 LT', '120.000 LT', '200.000 LT'], dung: 0 },
  { cau_hoi: 'Mua **Hồng Mông Khai Thiên Kiếm (2.000.000 LT)** + **Hồng Mông Chi Thể bí pháp** (ước tính không mua được LT — donate). Chỉ tính giá kiếm. Cần bao nhiêu LT?', dap_an: ['2.000.000 LT', '1.500.000 LT', '500.000 LT', '3.000.000 LT'], dung: 0 },
  { cau_hoi: '**Trận Tu** (DEF+15%) + **Kim Cương Tộc** (DEF+12%). DEF base=5.000. DEF thực?', dap_an: ['6.350', '5.000', '5.600', '7.000'], dung: 0 },
  { cau_hoi: '**Thể Tu** (HP+15%) + **Mộc Linh Tộc** (HP+8%) + **Thể Phách Cường Hóa** (+20%). HP base=10.000. HP thực?', dap_an: ['14.300', '12.300', '13.000', '10.000'], dung: 0 },
  { cau_hoi: '**Ma Tu** (ATK+18%) + **Nguyệt Ảnh Tộc** (ATK+10%). ATK base=5.000. ATK thực?', dap_an: ['6.400', '6.000', '5.900', '5.500'], dung: 0 },
  { cau_hoi: '**Khí Tu** ATK vũ khí=2.500, passive x1.30. Dùng bí pháp **200%**. ST gây ra?', dap_an: ['6.500', '5.000', '3.250', '8.000'], dung: 0 },
  { cau_hoi: 'CL=10.000. **Vạn Kiếm Quy Tông (600%)**. Địch có **Hồng Mông (-70%) + Lân Giáp (-20%)**. ST? (áp tuần tự)',dap_an: ['14.400', '60.000', '18.000', '12.000'], dung: 0 },
  { cau_hoi: 'HP max=50.000. **Mộc Linh tộc bí pháp** hồi **42% HP**. HP hồi được?', dap_an: ['21.000', '20.000', '25.000', '42.000'], dung: 0 },
  { cau_hoi: 'HP max=50.000. **Thái Dương tộc bí pháp** hồi **44% HP**. HP hồi được?', dap_an: ['22.000', '20.000', '25.000', '44.000'], dung: 0 },
  { cau_hoi: '**Linh Giác** Ngọc Gian (+10% Crit PvP) + **Ám Vệ** (+6%) + **Ma Tu** (+5%) + **Lôi Linh Tộc** (+3%). Tổng Crit bonus?', dap_an: ['24%', '21%', '19%', '14%'], dung: 0 },
  { cau_hoi: 'Đòn PvP 15.000 ST. **Khinh Công** (15% né). Né thành công, ST nhận?', dap_an: ['0', '15.000', '12.750', '7.500'], dung: 0 },
  { cau_hoi: 'Đòn PvP 10.000 ST. **Kim Chung Tráo** (-15% ST PvP). ST thực nhận?', dap_an: ['8.500', '10.000', '7.500', '8.000'], dung: 0 },
  { cau_hoi: 'Đòn PvP 10.000 ST. **Thiết Bố Sam** (ThuLuc+15%, ATK+5%). Nếu DEF base 2.000, DEF thực từ Thiết Bố Sam?', dap_an: ['2.300', '2.150', '2.000', '2.500'], dung: 0 },
  { cau_hoi: '**Phi Khí Sư** sac_ben (+15% CL). CL=5.000, bí pháp **350%**. Địch có **Thổ Linh (-35%)**. ST?', dap_an: ['13.256', '17.500', '12.000', '20.000'], dung: 0 },
  { cau_hoi: 'Phong Thủy Sư **khai_van** (+10 KV) + **cau_phuc tặng đồng đạo +7 KV**. Đồng đạo đang có KV=5. KV đồng đạo sau khi nhận?', dap_an: ['12', '5', '15', '7'], dung: 0 },
  { cau_hoi: 'Nhân Quả Công Đức Dày (+15 KV, -10% kiếp). Thiên kiếp base 20%. Tỉ lệ kiếp thực?', dap_an: ['18%', '10%', '20%', '15%'], dung: 0 },
  { cau_hoi: 'Nhân Quả Nghiệp Lực Sâu Nặng (+30% kiếp). Thiên kiếp base 20%. Tỉ lệ kiếp thực?', dap_an: ['26%', '50%', '20%', '30%'], dung: 0 },
  { cau_hoi: 'CL=3.000. **Pháp Tu** (+20%). Dùng **Vô Thượng tộc bí pháp (290%)**. Địch có **Hồng Mông (-70%)**. ST?', dap_an: ['3.132', '10.440', '8.700', '5.000'], dung: 0 },
  { cau_hoi: 'CL=2.000. Dùng **Thiên Ưng tộc bí pháp (265%)**. Bạo kích **x3.2** (Linh Hồn Ám Khí). ST?', dap_an: ['16.960', '5.300', '10.600', '12.000'], dung: 0 },
  { cau_hoi: 'CL=1.000. Dùng **Huyền Linh tộc bí pháp (255%)**. Địch có **Kim Cương tộc (-54%) + Lân Giáp (-20%)**. ST? (tuần tự)', dap_an: ['938', '2.550', '1.173', '1.500'], dung: 0 },
  { cau_hoi: 'Đan Tu dùng **Cửu Phẩm Tiên Đan** (base 150.000 TV). Rơi Cực Phẩm (x2.2). Passive +30%. TV thực?', dap_an: ['429.000', '330.000', '195.000', '300.000'], dung: 0 },
  { cau_hoi: 'CL=8.000. **Bát Hoang tộc bí pháp (280%)**. **Pháp Tu** (+20%). Địch có **Thủy Linh tộc (-52%)**. ST?', dap_an: ['12.902', '26.880', '22.400', '10.000'], dung: 0 },
  { cau_hoi: 'CL=5.000. **Thiên Mệnh tộc bí pháp (275%)**. **Pháp Tu** (+20%). Địch có **Kim Cương tộc (-54%)**. ST?', dap_an: ['7.590', '13.750', '16.500', '6.000'], dung: 0 },


  // ═══ NHÓM 14: Cơ Chế Chiến Đấu Nâng Cao ═══
  { cau_hoi: 'Trong PvP, **Trận Tu** bị đánh 10.000 ST thô. Passive Trận Pháp giảm 10%, Lân Giáp giảm thêm 20%. ST thực nhận là bao nhiêu?', dap_an: ['7.200', '7.000', '8.000', '6.500'], dung: 0 },
  { cau_hoi: '**Yêu Tu** phản đòn 12% trên đòn đánh 8.000 ST. Phản lại bao nhiêu ST?', dap_an: ['960', '800', '1.200', '480'], dung: 0 },
  { cau_hoi: '**Ma Tu** dùng **Nguyệt Ảnh bí pháp (250%)**, CL=2.000, bị địch mặc Lân Giáp (giảm 20%). ST địch nhận?', dap_an: ['4.000', '5.000', '3.500', '4.800'], dung: 0 },
  { cau_hoi: '**Thể Tu** HP=3.000/20.000, Cương Thể kích hoạt (+25% ATK). ATK base=1.000. Đánh thường (không bí pháp) ST gây ra?', dap_an: ['1.250', '1.000', '1.500', '2.000'], dung: 0 },
  { cau_hoi: 'CL=5.000. **Thiên Hạ Đệ Nhất Kiếm (500%)**. Địch mặc **Kim Cương tộc bí pháp (-54%)**. ST địch nhận?', dap_an: ['11.500', '25.000', '12.000', '23.000'], dung: 0 },
  { cau_hoi: 'CL=5.000. **Vạn Kiếm Quy Tông (600%)**. Địch mặc **Hồng Mông Chi Thể (-70%)**. ST địch nhận?', dap_an: ['9.000', '30.000', '15.000', '18.000'], dung: 0 },
  { cau_hoi: 'HP max=100.000. **Tụ Linh Tiên Ngọc Phủ** hồi 2%/lượt + **Yêu Tu** passive hồi 3%/lượt. Tổng hồi mỗi lượt là bao nhiêu HP?', dap_an: ['5.000', '2.000', '3.000', '7.000'], dung: 0 },
  { cau_hoi: '**Khí Tu** ATK=3.000 (đã nhân passive x1.30). Gia tộc Hỏa Linh (+8% ATK). Tổng ATK thực?', dap_an: ['3.240', '3.300', '3.000', '3.480'], dung: 0 },
  { cau_hoi: '**Pháp Tu** dùng **Thiên Địa Hồng Lô (450%)**. CL=2.000. Passive +20% bí pháp. Địch dùng **Thủy Linh tộc bí pháp (-52%)**. ST địch nhận?', dap_an: ['5.184', '9.000', '4.320', '7.200'], dung: 0 },
  { cau_hoi: 'Nếu **Lôi Linh tộc bí pháp (245%)** bắn vào mục tiêu có **Kim Thân Pháp Tướng (-50%)**, CL=1.000. ST gây ra?', dap_an: ['1.225', '2.450', '1.000', '1.450'], dung: 0 },
  { cau_hoi: '**Ma Tu** Ma Bùng (ATK+30%, DEF-15%). Base ATK=4.000. Tổng ATK thực khi Ma Bùng active?', dap_an: ['5.200', '4.600', '5.500', '6.000'], dung: 0 },
  { cau_hoi: '**Đan Tu** passive: Đan dược hiệu quả +30%. Dùng đan Hạ Phẩm (hệ số 0.65x) base 2.000 TV. TV thực nhận?', dap_an: ['1.690', '1.300', '2.000', '2.600'], dung: 0 },

  // ═══ NHÓM 15: Linh Thảo & Craft ═══
  { cau_hoi: '**Túi Da Thú** yêu cầu craft bao nhiêu nguyên liệu và loại gì?', dap_an: ['5 Da Thu + 2 Chi Linh, phi 3.000 LT', '3 Da Thu + 2 Chi Linh, phi 3.000 LT', '5 Da Thu + 3 Chi Linh, phi 3.000 LT', '5 Da Thu + 2 Chi Linh, phi 5.000 LT'], dung: 0 },
  { cau_hoi: '**Linh Hồn Thần Binh Ám Khí** craft cần những gì?', dap_an: ['3 Long Huyet Thach + 5 Hac Thiet + 2 Huyet Mach Thach, phi 50.000 LT', '2 Long Huyet Thach + 5 Hac Thiet + 2 Huyet Mach Thach, phi 50.000 LT', '3 Long Huyet Thach + 3 Hac Thiet + 2 Huyet Mach Thach, phi 50.000 LT', '3 Long Huyet Thach + 5 Hac Thiet + 2 Huyet Mach Thach, phi 80.000 LT'], dung: 0 },
  { cau_hoi: '**Linh Thảo Tử Hư Thảo** (alias Bích Hà Liên): yêu cầu cap tối thiểu bao nhiêu và nặng bao nhiêu kg?', dap_an: ['Cap 0, 0.3kg', 'Cap 0, 0.5kg', 'Cap 5, 0.3kg', 'Cap 3, 0.3kg'], dung: 0 },
  { cau_hoi: '**Linh Thảo Long Tinh Thảo** (alias Long Tinh Thảo): yêu cầu cap tối thiểu bao nhiêu và nặng bao nhiêu kg?', dap_an: ['Cap 10, 0.5kg', 'Cap 5, 0.5kg', 'Cap 10, 0.8kg', 'Cap 12, 0.5kg'], dung: 0 },
  { cau_hoi: '**Vạn Linh Hoàn** (cap 22) nặng bao nhiêu kg và mất bao nhiêu công lực?', dap_an: ['1.2kg, mat 1.000 CL', '0.8kg, mat 1.000 CL', '1.2kg, mat 500 CL', '1.5kg, mat 1.000 CL'], dung: 0 },
  { cau_hoi: '**Khai Ngộ Đan** nặng bao nhiêu kg và mất bao nhiêu Công Lực khi dùng?', dap_an: ['0.3kg, mat 500 CL', '0.5kg, mat 500 CL', '0.3kg, mat 800 CL', '0.3kg, mat 300 CL'], dung: 0 },

  // ═══ NHÓM 16: Thần Thông & Hiệu Ứng Đặc Biệt ═══
  { cau_hoi: 'Thần Thông **Ngũ Hành Độn Thuật**: hiệu ứng chính xác là gì và cooldown bao nhiêu lượt?', dap_an: ['An, tranh 1 luot chien dau, cd 5 luot', 'Tang ATK 50%, cd 3 luot', 'Hoi 50% HP, cd 4 luot', 'Phong an doi thu, cd 5 luot'], dung: 0 },
  { cau_hoi: 'Thần Thông **Linh Hồn Xuất Khiếu**: hiệu ứng chính xác là gì?', dap_an: ['Song song gui ban sao linh hon tan cong, 50% AT co ban', 'Tang 100% ST 1 luot', 'Hoi 100% HP', 'Phong toa vu khi doi thu'], dung: 0 },
  { cau_hoi: 'Thần Thông **Thiên Nhãn Thông**: hiệu ứng chính xác là gì?', dap_an: ['Xem toan bo thong tin stats va vat pham doi thu', 'Tang 30% Cam Ngo', 'Chieu bao kich 100% lan sau', 'Giam 50% DEF doi thu'], dung: 0 },
  { cau_hoi: 'Thần Thông **Vạn Lý Truyền Âm**: hiệu ứng chính xác là gì và tốn bao nhiêu LT?', dap_an: ['Gui tin nhan toi bat ky nguoi choi nao, 500 LT', 'Tang Cam Ngo 10%, 1.000 LT', 'Hoi phuc HP toan bo dong minh, 5.000 LT', 'Chi co the dung voi nguoi cung gia toc'], dung: 0 },
  { cau_hoi: 'Thần Thông **Phân Thân Thuật**: tốn bao nhiêu LT, cooldown bao nhiêu, hiệu ứng?', dap_an: ['5.000 LT, cd 6h, tao phan than nhan 30% AT thay chinh than', '3.000 LT, cd 4h, tao phan than', '5.000 LT, cd 6h, nhan gap doi EXP 1 gio', '5.000 LT, cd 6h, an 1 gio'], dung: 0 },

  // ═══ NHÓM 17: Cơ Chế Game & Hệ Thống ═══
  { cau_hoi: '**Thiên Kiếp** tỉ lệ kích hoạt phụ thuộc vào những yếu tố gì?', dap_an: ['Cap canh gioi, Nhan Qua (Nghiep Luc tang kíp, Cong Duc giam kiep), ti le nen tang canh gioi', 'Chi phu thuoc vao cap canh gioi', 'Random hoan toan', 'Chi phu thuoc vao Nhan Qua'], dung: 0 },
  { cau_hoi: '**Khí Vận** ảnh hưởng đến những cơ chế nào trong game?', dap_an: ['Ti le ngo dao, ti le drop vat pham, ti le thanh cong luy dan, ti le phan xa', 'Chi anh huong ti le ngo dao', 'Chi anh huong drop', 'Anh huong ATK va DEF'], dung: 0 },
  { cau_hoi: '**Cảm Ngộ %** ảnh hưởng trực tiếp đến cơ chế nào?', dap_an: ['Ti le khi tu luyen thanh cong ngu dao (ngo dao) de tang cap canh gioi', 'Ti le drop vat pham', 'Hoi phuc HP sau chien dau', 'Giam phi luyen dan'], dung: 0 },
  { cau_hoi: '**Đạo Tâm** trong game được dùng để làm gì?', dap_an: ['Dieu kien tu luyen canh gioi va dung mot so ki nang Ngo Dao Su', 'Mua vat pham cua hang', 'Tang ATK PvP', 'Giam Thien Kiep'], dung: 0 },
  { cau_hoi: '**-ghep_nhom**: ghép bao nhiêu người, cùng nhau làm gì và phần thưởng là gì?', dap_an: ['2-4 nguoi cung tu luyen, chia se EXP, tang Khi Van cho ca nhom', '2 nguoi PvP co thuong', '4 nguoi cung luyen dan', '2 nguoi chia se vat pham'], dung: 0 },
  { cau_hoi: '**-thach_dau** PvP: thua 1 lần mất bao nhiêu Linh Thạch?', dap_an: ['10% LT co trong nguoi (tru vu khi, bao boi)', '5% LT toan bo', '1.000 LT co dinh', '20% LT co trong nguoi'], dung: 0 },
  { cau_hoi: '**Sát Tinh** dùng để làm gì trong game?', dap_an: ['Nguyen lieu craft nghe Phi Khi Su va Luyen Khi Su', 'Nguyen lieu luyen dan', 'Mua vat pham cua hang', 'Tang cap vu khi'], dung: 0 },
  { cau_hoi: '**Huyết Mạch Thạch** yêu cầu cap tối thiểu bao nhiêu để khai thác?', dap_an: ['Cap 0 (bat ky ai deu co the)', 'Cap 15', 'Cap 20', 'Cap 10'], dung: 0 },
  { cau_hoi: '**Ngọc Gian** Hồi Xuân: nhận từ đâu — không phải mua LT hay VND?', dap_an: ['Giftcode chinh thuc tu admin/su kien', 'Hoan thanh quest hang ngay', 'Top rank tuan', 'Drop tu Boss cao cap'], dung: 0 },
  { cau_hoi: '**Ám Ma Cửu Huyền Kiếm** và **Hồng Mông Khai Thiên Kiếm**: cả hai đều là donate. Cái nào nặng hơn và nặng hơn bao nhiêu?', dap_an: ['Hong Mong (12kg) nang hon Am Ma (11kg) 1kg', 'Am Ma (11kg) nang hon', 'Bang nhau (12kg)', 'Hong Mong nang hon 3kg'], dung: 0 },
  { cau_hoi: '**Bảo Bối Âm Dương Thái Cực Bài** nặng bao nhiêu kg? Đây là bảo bối vừa ATK vừa DEF hay chỉ DEF?', dap_an: ['9kg, vua ATK (1.000) vua DEF (3.500)', '9kg, chi DEF', '6kg, vua ATK vua DEF', '9kg, vua ATK (1.500) vua DEF (3.000)'], dung: 0 },
  { cau_hoi: '**Lôi Hỏa Thiên Vân Châu** nặng bao nhiêu kg và đây là loại bảo bối gì (ATK/DEF/hỗn hợp)?', dap_an: ['2.5kg, ATK bao boi (ATK 100, kich no)', '2.5kg, DEF bao boi', '4kg, ATK bao boi', '2.5kg, hon hop ATK va DEF'], dung: 0 },
  { cau_hoi: '**Hộ Đạo Thiên Mục Kính** nặng bao nhiêu kg và hiệu ứng né là kích hoạt bao nhiêu %?', dap_an: ['4kg, ne 30% don danh', '4kg, ne 20% don danh', '6kg, ne 30% don danh', '4kg, ne 40% don danh'], dung: 0 },

  // ═══ NHÓM 18: Câu Hỏi Cực Khó — Kết Hợp Nhiều Hệ Thống ═══
  { cau_hoi: '**Pháp Tu** (EXP +12%) + gia tộc **Thái Dương** (TuVi +10%) + nghe **Ngộ Đạo Sư** (EXP +5%): tổng bonus Tu Vi/EXP là bao nhiêu %?', dap_an: ['27%', '22%', '17%', '25%'], dung: 0 },
  { cau_hoi: '**Đan Tu** (EXP +15%) + gia tộc **Huyền Linh** (TuVi +15%) + nghe **Luyện Đan Sư** (EXP +8%): tổng bonus là bao nhiêu %?', dap_an: ['38%', '30%', '35%', '23%'], dung: 0 },
  { cau_hoi: '**Ma Tu** (ATK +18%) + gia tộc **Lôi Linh** (ATK +5%) + nghe **Phi Khí Sư** (ATK +4%) + passive **Phi Khí Quần x1.30**: trong số 4 nguồn này, cái nào KHÔNG phải là bonus phần trăm flat mà là nhân hệ số?', dap_an: ['Passive Phi Khi Quan (x1.30 la nhan he so, khong phai cong them %)', 'Gia toc Loi Linh', 'Ma Tu base', 'Nghe Phi Khi Su'], dung: 0 },
  { cau_hoi: 'Player dùng **Vô Thượng Tộc** (ATK+15%, DEF+15%, HP+15%, TuVi+8%, Crit+5%) + **Thiên Phúc Chi Thuật** (TuVi+10%, Drop+20%) + **Ngộ Đạo Sư** (EXP+5%). Tổng Tu Vi bonus từ 3 nguồn này?', dap_an: ['23%', '18%', '13%', '28%'], dung: 0 },
  { cau_hoi: '**Trận Tu** (DEF+15%) + **Kim Cương Tộc** (DEF+12%) + **Linh Khí Hộ Thể** Ngọc Gian (ThuLuc+8%) + **Lân Giáp** (giam 20% ST). Đây là bộ phòng thủ mạnh nhất có thể? Bonus DEF tổng từ 2 nguồn đầu?', dap_an: ['DEF+27% (Tran Tu + Kim Cuong), them -20% ST tu Lan Giap', 'DEF+20%', 'DEF+35%', 'DEF+27%, them -15% ST'], dung: 0 },
  { cau_hoi: '**Ngộ Đạo Sư** khi thất bại **thạch_ngộ**: hậu quả là gì?', dap_an: ['Mat 20-30% Cam Ngo hien co', 'Mat Dao Tam', 'Bi Thien Kiep ngay', 'Mat LT ngau nhien'], dung: 0 },
  { cau_hoi: '**Phong Thủy Sư** lệnh **cau_phuc** tặng +7 KV cho đồng đạo. Nếu đồng đạo đang có KV=25 (Công Đức Viên Mãn trần 25 KV), KV sau khi nhận sẽ là bao nhiêu?', dap_an: ['32 KV (vuot tran, duoc phep)', '25 KV (bi giu nguyen o tran)', '30 KV (cong toi da)', '28 KV (chi cong them mot phan)'], dung: 0 },
  { cau_hoi: '**Huyết Sát Đại Phong** (300% CL, ma dao) tiêu 15% HP tối đa khi dùng. HP=10.000. CL=2.000. Pháp Tu +20%. ST gây ra và HP mất?', dap_an: ['ST: 7.200, HP mat: 1.500', 'ST: 6.000, HP mat: 1.500', 'ST: 7.200, HP mat: 2.000', 'ST: 9.000, HP mat: 1.500'], dung: 0 },
  { cau_hoi: '**Ám Vệ** lệnh **am_sat**: tỉ lệ thành công tỉ lệ thuận hay nghịch với cấp bậc và KV của nạn nhân?', dap_an: ['Nghich — cap cao, KV cao thi am sat kho hon', 'Thuan — cap cao thi am sat de hon', 'Khong lien quan', 'Chi phu thuoc vao nghe level cua Gian Te'], dung: 0 },
  { cau_hoi: '**Ám Vệ** am_sat thành công: cướp bao nhiêu % LT và cướp được tối đa bao nhiêu LT một lần?', dap_an: ['5%-45% LT mang theo, khong gioi han tren', '10%-30% LT', '5%-45% LT, toi da 100.000 LT', '10%-50% LT'], dung: 0 },
  { cau_hoi: 'Nếu một player dùng **Linh Giác** (Crit+10% PvP) + **Ám Vệ** (Crit+6%) + **Lôi Linh Tộc** (Crit+3%) + **Ma Tu** (Crit+5%): tổng Crit bonus?', dap_an: ['24%', '21%', '19%', '16%'], dung: 0 },
  { cau_hoi: 'Liên hệ **Ngộ Tính** và **Cảm Ngộ**: muốn đạt tỉ lệ ngộ đạo 55%, cần Ngộ Tính trong khoảng nào?', dap_an: ['Tien Pham (81-100)', 'Thien Pham (61-80)', 'Dia Pham (41-60)', 'Linh Pham (21-40)'], dung: 0 },
  { cau_hoi: 'Một đan có **Tu Vi base 2.000**, Phẩm rơi Thượng Phẩm (hệ số 1.45x). Người dùng là **Đan Tu** (+15% EXP), nghe **Luyện Đan Sư** (+8% EXP), Cam Ngo tổng 0%. Tổng Tu Vi thực nhận?', dap_an: ['3.393', '2.900', '3.000', '3.480'], dung: 0 },
  { cau_hoi: 'Vũ khí **Tuyết Tinh Hàn Nguyên Thương** (25% đóng băng 1 lượt) gặp địch có **Khinh Công** (15% né PvP). Xác suất bị đóng băng thực là bao nhiêu?', dap_an: ['25% x 85% = 21.25%', '25% - 15% = 10%', '25% co dinh, Kinh Cong khong chong dong bang', '25% x (1-15%) = 21.25% (dung, cung dap an A)'], dung: 0 },

  // ═══ NHÓM 19: Thêm Câu Hỏi Đến 250 ═══
  { cau_hoi: '**Căn Cơ Thiên Linh** (cao nhất) vs **Căn Cơ Địa Linh**: chênh nhau bao nhiêu % Cảm Ngộ bonus khi tu luyện?', dap_an: ['Thien Linh +25% CamNgo, Dia Linh +15%, chen 10 diem %', 'Thien Linh +20%, Dia Linh +10%, chen 10 diem %', 'Thien Linh +30%, Dia Linh +20%, chen 10 diem %', 'Thien Linh +25%, Dia Linh +20%, chen 5 diem %'], dung: 0 },
  { cau_hoi: '**Linh Căn Kim** bonus gì và **Linh Căn Mộc** bonus gì?', dap_an: ['Kim: DEF+5%, Moc: HP+5%', 'Kim: ATK+5%, Moc: DEF+5%', 'Kim: DEF+5%, Moc: EXP+5%', 'Kim: ATK+5%, Moc: HP+5%'], dung: 0 },
  { cau_hoi: '**Linh Căn Hỏa** bonus gì và **Linh Căn Thủy** bonus gì?', dap_an: ['Hoa: ATK+5%, Thuy: DEF+5%', 'Hoa: ATK+5%, Thuy: HP+5%', 'Hoa: EXP+5%, Thuy: DEF+5%', 'Hoa: ATK+8%, Thuy: DEF+8%'], dung: 0 },
  { cau_hoi: '**Linh Căn Thổ** bonus gì?', dap_an: ['HP+5%', 'DEF+5%', 'ATK+5%', 'EXP+5%'], dung: 0 },
  { cau_hoi: '**Linh Căn Lôi** bonus gì?', dap_an: ['Crit+3%', 'ATK+5%', 'EXP+5%', 'DEF+3%'], dung: 0 },
  { cau_hoi: '**Ngũ Hành Linh Căn** (Thiên): bonus ĐÚNG là gì?', dap_an: ['Tat ca 5 linh can: ATK+3%, DEF+3%, HP+3%, EXP+5%', 'ATK+5%, DEF+5%, HP+5%', 'Tang Cam Ngo +10%', 'Tat ca linh can +8% moi loai'], dung: 0 },
  { cau_hoi: 'Lệnh **-ngo_dao**: điều kiện Cảm Ngộ tối thiểu phải đạt bao nhiêu % và Đạo Tâm bao nhiêu?', dap_an: ['CamNgo >= 80%, DaoTam >= 50', 'CamNgo >= 50%, DaoTam >= 30', 'CamNgo >= 100%, DaoTam >= 80', 'CamNgo >= 70%, DaoTam >= 50'], dung: 0 },
  { cau_hoi: 'Ngộ đạo thất bại: Cảm Ngộ giảm bao nhiêu % và Đạo Tâm giảm bao nhiêu?', dap_an: ['CamNgo giam 10-30%, DaoTam giam 10', 'CamNgo giam 50%, DaoTam giam 20', 'CamNgo giam 10%, DaoTam giam 5', 'CamNgo ve 0%, DaoTam giam 30'], dung: 0 },
  { cau_hoi: '**Cap 25** (Phân Thần Sơ Kỳ): Linh Lực bao nhiêu và cần bao nhiêu EXP?', dap_an: ['Linh Luc 820.000, can 7.500.000 EXP', 'Linh Luc 600.000, can 5.500.000 EXP', 'Linh Luc 820.000, can 10.000.000 EXP', 'Linh Luc 1.000.000, can 7.500.000 EXP'], dung: 0 },
  { cau_hoi: '**Cap 35** (Đại Thừa Sơ Kỳ): Linh Lực bao nhiêu?', dap_an: ['80.000.000', '50.000.000', '120.000.000', '60.000.000'], dung: 0 },
  { cau_hoi: 'Tổng cộng có bao nhiêu gia tộc có thể rút trong game (kể cả ẩn)?', dap_an: ['14 gia toc', '10 gia toc', '12 gia toc', '16 gia toc'], dung: 0 },
  { cau_hoi: 'Tổng cộng có bao nhiêu loại Đạo Tu trong game?', dap_an: ['8 Dao Tu', '6 Dao Tu', '10 Dao Tu', '5 Dao Tu'], dung: 0 },
  { cau_hoi: 'Bí pháp **Kiếm Ý Đoạn Hồn** (Kiếm Tu passive): tăng ĐÚNG bao nhiêu % Crit và hiệu ứng phụ khi bạo kích?', dap_an: ['+6% Crit, bao kich gay them 20% ST chon lau', '+5% Crit, bao kich gay them 20%', '+6% Crit, bao kich gay them 30%', '+8% Crit, khong hieu ung phu'], dung: 0 },
  { cau_hoi: '**Đan Tu** passive Linh Đan ngoài hồi 5% HP/lượt còn có hiệu ứng gì?', dap_an: ['Hieu qua dan duoc tang 30%', 'Tang EXP khi luyen dan them 10%', 'Giam phi luy dan 20%', 'Tang Cam Ngo 5% moi luot'], dung: 0 },
  { cau_hoi: 'Bảo bối **Thái Hư Linh Ngọc Bội**: đây là bảo bối duy nhất mua được ở cap 0 chỉ có DEF. Nặng bao nhiêu kg?', dap_an: ['1.5kg', '2kg', '1kg', '2.5kg'], dung: 0 },
  { cau_hoi: '**Hồng Mông Khai Thiên Kiếm** nặng bao nhiêu kg — nặng nhất trong game?', dap_an: ['12kg', '11kg', '10kg', '15kg'], dung: 0 },
  { cau_hoi: 'Có bao nhiêu loại nguyên liệu Linh Thảo trong game và liệt kê 3 cái hiếm nhất (cap cao nhất)?', dap_an: ['7 loai: hiem nhat la Dia Nguc Huyet Lien (cap30), Thien Nhan Qua (cap25), Thien Dia Linh Can (cap20)', '5 loai: hiem nhat Thien Nhan Qua, Dia Nguc Huyet Lien, Tuyet Linh Thao', '6 loai: hiem nhat Thien Nhan Qua (cap30), Dia Nguc (cap25)', '7 loai: hiem nhat Tuyet Linh Thao (cap30)'], dung: 0 },
  { cau_hoi: '**Luyện Đan Sư** vs **Ngộ Đạo Sư** về EXP bonus: tổng EXP bonus chênh bao nhiêu và ai cao hơn?', dap_an: ['Luyen Dan (8%) cao hon Ngo Dao (5%) 3 diem %', 'Bang nhau', 'Ngo Dao cao hon 3 diem %', 'Luyen Dan cao hon 5 diem %'], dung: 0 },
  { cau_hoi: 'Nếu luyện **Thiên Đế Nguyên Đan** và rơi **Cực Phẩm** (hệ số 2.2x, tỉ lệ 7%): Tu Vi thực nhận là bao nhiêu (base 500.000)?', dap_an: ['1.100.000', '500.000', '725.000', '1.000.000'], dung: 0 },
  { cau_hoi: '**Ám Vệ** lệnh **bo_doc**: tốn gì, hiệu ứng gì, CD bao nhiêu?', dap_an: ['3 Doc Linh + 2.000 LT, tiem doc doi thu mat 5% HP/luot trong 3 luot PvP, CD 4h', '2 Doc Linh + 2.000 LT, mat 5% HP/luot, CD 4h', '3 Doc Linh + 2.000 LT, mat 10% HP/luot, CD 4h', '3 Doc Linh + 5.000 LT, mat 5% HP/luot, CD 8h'], dung: 0 },
  { cau_hoi: 'Tổng sức chứa kg mặc định (không bảo bối, không nghe) khi bắt đầu game là bao nhiêu kg?', dap_an: ['20kg', '15kg', '25kg', '10kg'], dung: 0 },
  { cau_hoi: '**Càn Khôn Hư Không Nang** (+10kg) + **Túi Da Thú** (+18kg): có thể đeo đồng thời không và tổng sức chứa thêm?', dap_an: ['Khong, chi deo duoc 1 bao boi suc chua. Can chon 1 trong 2', 'Co the deo 2 cai, tong +28kg', 'Co the deo 2 cai, nhung chi tinh cai cao hon', 'Khong, nhung Tui Da Thu duoc uu tien'], dung: 0 },
  { cau_hoi: '**Lôi Linh Tộc** bí pháp (245% CL, cd3) vs **Hỏa Linh Tộc** bí pháp (215% CL, cd2): dùng trong 6 lượt, ai gây nhiều ST hơn (giả sử CL=1.000)?', dap_an: ['Loi Linh: 245x2=490%, Hoa Linh: 215x3=645% — Hoa Linh manh hon tong', 'Loi Linh manh hon vi % cao hon', 'Bang nhau', 'Phu thuoc vao cap cua nguoi dung'], dung: 0 },
  { cau_hoi: '**Thiên Mệnh Tộc** (weight=2) vs **Vô Thượng Tộc** (weight=1): nếu pool rút gồm 2 tộc này và 12 tộc khác mỗi tộc weight=3, Vô Thượng chiếm bao nhiêu % tổng weight?', dap_an: ['~2.6% (1/38 tong weight)', '~5% (1/20)', '~1% (1/100)', '~8% (1/12)'], dung: 0 },
  { cau_hoi: '**Linh Hồn Xuất Khiếu** (thần thông) gây 50% AT, không dùng bí pháp. Nếu CL=3.000, ST gây ra?', dap_an: ['1.500', '3.000', '750', '6.000'], dung: 0 },
  { cau_hoi: 'Bảo bối **Lôi Hỏa Thiên Vân Châu** (kích nổ 20% thêm 50% ST): nếu đòn đánh base gây 4.000 ST và kích nổ xảy ra, tổng ST lượt đó?', dap_an: ['6.000', '4.000', '8.000', '5.000'], dung: 0 },
  { cau_hoi: '**Ngộ Đạo Sư** lệnh **phu_dao**: tặng đồng đạo bao nhiêu Đạo Tâm và bản thân nhận bao nhiêu điểm Nhân Quả?', dap_an: ['+5 Dao Tam cho dong dao, +2 Cong Duc (Nhan Qua) cho ban than', '+10 Dao Tam, +5 Cong Duc', '+5 Dao Tam, +5 Cong Duc', '+3 Dao Tam, +1 Cong Duc'], dung: 0 },
  { cau_hoi: 'Trong **-dovui**: người trả lời đúng trong vòng bao nhiêu giây và phần thưởng mặc định là bao nhiêu LT?', dap_an: ['30 giay, 500-2.000 LT tuy cau hoi', '60 giay, 1.000 LT', '30 giay, 1.000 LT co dinh', '15 giay, 500 LT'], dung: 0 },
];






  const LABELS = ['A', 'B', 'C', 'D'];

  // ── Xáo trộn mảng QUESTIONS ngay khi module load (Fisher-Yates) ───────────
  for (let i = QUESTIONS.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [QUESTIONS[i], QUESTIONS[j]] = [QUESTIONS[j], QUESTIONS[i]];
  }

  // ── Chọn câu hỏi ngẫu nhiên, tránh lặp gần đây (per user) ────────────────
  // REPEAT_WINDOW = 65% số câu, tối đa 150 — tức phải trả lời ~150 câu mới thấy lặp
  const REPEAT_WINDOW = Math.min(150, Math.floor(QUESTIONS.length * 0.65));

  function pickQuestion(userId) {
    const history = DO_VUI_HISTORY.get(userId) || [];
    const historySet = new Set(history);
    let candidates = [];
    for (let i = 0; i < QUESTIONS.length; i++) {
      if (!historySet.has(i)) candidates.push(i);
    }
    if (candidates.length === 0) {
      DO_VUI_HISTORY.set(userId, []);
      candidates = QUESTIONS.map((_, i) => i);
    }
    // Chọn ngẫu nhiên trong pool câu chưa hỏi gần đây
    const chosen = candidates[Math.floor(Math.random() * candidates.length)];
    const newHistory = [...history, chosen];
    if (newHistory.length > REPEAT_WINDOW) newHistory.splice(0, newHistory.length - REPEAT_WINDOW);
    DO_VUI_HISTORY.set(userId, newHistory);
    return QUESTIONS[chosen];
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function shuffleQuestion(q) {
    const idx = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [idx[i], idx[j]] = [idx[j], idx[i]];
    }
    return { dap_an: idx.map(i => q.dap_an[i]), dung: idx.indexOf(q.dung) };
  }

  function makeQuizButtons(sessionId, disabled = false, correct = -1, chosen = -1) {
    const buttons = LABELS.map((label, i) => {
      let style = ButtonStyle.Primary;
      if (disabled) {
        if (i === correct)    style = ButtonStyle.Success;
        else if (i === chosen) style = ButtonStyle.Danger;
        else                  style = ButtonStyle.Secondary;
      }
      return new ButtonBuilder()
        .setCustomId('dovui_' + sessionId + '_' + i)
        .setLabel(label)
        .setStyle(style)
        .setDisabled(disabled);
    });
    return new ActionRowBuilder().addComponents(buttons);
  }

  function getStreakBonus(streak) {
    let bonus = 0;
    let msg   = '';
    for (const tier of STREAK_BONUS) {
      if (streak >= tier.streak) { bonus = tier.bonus; msg = tier.msg; }
    }
    return { bonus, msg };
  }

  // ── Hiển thị câu hỏi tiếp theo sau khi trả lời đúng ─────────────────────────
  async function showNextQuestion(interaction, userId) {
    const currentStreak = DO_VUI_STREAK.get(userId) || 0;

    const q = pickQuestion(userId);
    const { dap_an, dung } = shuffleQuestion(q);
    const sessionId = userId + '_' + Date.now();

    const streakInfo = currentStreak >= 3
      ? `\n🔥 **Streak: ${currentStreak}** — tiếp tục để nhận bonus!`
      : (currentStreak >= 1 ? `\n${CE("tia_set","⚡")} Streak: ${currentStreak}` : '');

    const embed = new EmbedBuilder()
      .setTitle('🧠 Đố Vui Tu Tiên')
      .setColor(0x9B59B6)
      .setDescription(
        `**${q.cau_hoi}**\n\n` +
        dap_an.map((a, i) => `**${LABELS[i]}.** ${a}`).join('\n') +
        streakInfo,
      )
      .setFooter({ text: `✅ Đúng: +${REWARD_LT} LT  •  ❌ Sai: CD ${CD_SAI_MIN}p  •  ${CEu("cd_timer","⏳")} Hết hạn 60s` });

    DO_VUI_SESSIONS.set(userId, {
      correct: dung, dap_an, cau_hoi: q.cau_hoi,
      expiresAt: Date.now() + EXPIRE_MS, sessionId,
    });

    await interaction.message.edit({
      embeds: [embed],
      components: [makeQuizButtons(sessionId)],
    }).catch(() => {});

    setTimeout(async () => {
      const sess = DO_VUI_SESSIONS.get(userId);
      if (!sess || sess.sessionId !== sessionId) return;
      DO_VUI_SESSIONS.delete(userId);
      DO_VUI_STREAK.set(userId, 0);
      const cdSaiTs = Date.now() - (CD_MIN - CD_SAI_MIN) * 60 * 1000;
      await db('UPDATE players SET do_vui_cd=$1 WHERE user_id=$2', [cdSaiTs, userId]).catch(() => {});
      const expEmbed = new EmbedBuilder()
        .setTitle('🧠 Đố Vui Tu Tiên')
        .setColor(0xE74C3C)
        .setDescription(
          `**${q.cau_hoi}**\n\n` +
          dap_an.map((a, i) => `**${LABELS[i]}.** ${a}`).join('\n') +
          `\n\n⏰ **Hết giờ!** Đáp án đúng: **${LABELS[dung]}. ${dap_an[dung]}**\n${CE("cd_timer","⏳")} *Cooldown **${CD_SAI_MIN} phút***`,
        )
        .setFooter({ text: '⏰ Hết giờ tính như sai' });
      interaction.message.edit({ embeds: [expEmbed], components: [makeQuizButtons(sessionId, true, dung)] }).catch(() => {});
    }, EXPIRE_MS);
  }

  // ── Lệnh -do_vui ──────────────────────────────────────────────────────────
  reg('do_vui', ['dovui', 'quiz', 'dv'], async (msg, args) => {
    const userId = msg.author.id;

    if (DO_VUI_PROCESSING.has(userId))
      return msg.reply({ embeds: [errE('Đang xử lý câu trả lời vừa rồi, chờ xíu!')] });

    if (DO_VUI_SESSIONS.has(userId)) {
      const sess = DO_VUI_SESSIONS.get(userId);
      if (Date.now() < sess.expiresAt)
        return msg.reply({ embeds: [errE('Bạn đang có câu hỏi chưa trả lời! Hãy click chọn đáp án.')] });
      DO_VUI_SESSIONS.delete(userId);
      DO_VUI_STREAK.set(userId, 0);
    }

    const player = await getPlayer(userId, msg.author.username);
    if (!player) return msg.reply({ embeds: [errE('Dùng `-bat_dau` trước!')] });

    const cdSecs = cdRemMin(player.do_vui_cd || 0, CD_MIN);
    if (cdSecs > 0) {
      const streak = DO_VUI_STREAK.get(userId) || 0;
      const streakLine = streak >= 3
        ? `\n🔥 **Streak hiện tại: ${streak}** — giữ phong độ nhé!`
        : '';
      return msg.reply({ embeds: [errE(`${CE("cd_timer","⏳")} Hết CD ${cdTsMin(player.do_vui_cd || 0, CD_MIN)} mới được đố vui!${streakLine}`)] });
    }

    const q = pickQuestion(userId);
    const { dap_an, dung } = shuffleQuestion(q);
    const sessionId = userId + '_' + Date.now();
    const streak = DO_VUI_STREAK.get(userId) || 0;

    const streakInfo = streak >= 3
      ? `\n🔥 **Streak: ${streak}** — tiếp tục để nhận bonus!`
      : (streak >= 1 ? `\n${CE("tia_set","⚡")} Streak: ${streak}` : '');

    const embed = new EmbedBuilder()
      .setTitle('🧠 Đố Vui Tu Tiên')
      .setColor(0x9B59B6)
      .setDescription(
        `**${q.cau_hoi}**\n\n` +
        dap_an.map((a, i) => `**${LABELS[i]}.** ${a}`).join('\n') +
        streakInfo,
      )
      .setFooter({ text: `✅ Đúng: +${REWARD_LT} LT (câu tiếp theo tự hiện!)  •  ❌ Sai: CD ${CD_SAI_MIN}p  •  ${CEu("cd_timer","⏳")} Hết hạn 60s  •  Điểm: ${player.do_vui_diem || 0}` });

    const row = makeQuizButtons(sessionId);
    const sent = await msg.reply({ embeds: [embed], components: [row] });

    DO_VUI_SESSIONS.set(userId, {
      correct: dung, dap_an, cau_hoi: q.cau_hoi,
      expiresAt: Date.now() + EXPIRE_MS, sessionId,
    });

    setTimeout(async () => {
      const sess = DO_VUI_SESSIONS.get(userId);
      if (!sess || sess.sessionId !== sessionId) return;
      DO_VUI_SESSIONS.delete(userId);
      DO_VUI_STREAK.set(userId, 0);
      const cdSaiTs = Date.now() - (CD_MIN - CD_SAI_MIN) * 60 * 1000;
      await db('UPDATE players SET do_vui_cd=$1 WHERE user_id=$2', [cdSaiTs, userId]).catch(() => {});
      const expEmbed = EmbedBuilder.from(embed)
        .setColor(0xE74C3C)
        .setDescription(
          `**${q.cau_hoi}**\n\n` +
          dap_an.map((a, i) => `**${LABELS[i]}.** ${a}`).join('\n') +
          `\n\n⏰ **Hết giờ!** Đáp án đúng: **${LABELS[dung]}. ${dap_an[dung]}**\n${CE("cd_timer","⏳")} *Cooldown **${CD_SAI_MIN} phút***`,
        )
        .setFooter({ text: '⏰ Hết giờ tính như sai' });
      sent.edit({ embeds: [expEmbed], components: [makeQuizButtons(sessionId, true, dung)] }).catch(() => {});
    }, EXPIRE_MS);
  });

  // ── Lệnh -do_vui_bxh (chỉ Admin) ─────────────────────────────────────────
  reg('do_vui_bxh', ['dvbxh', 'quiz_bxh', 'dobxh'], async (msg) => {
    if (msg.author.id !== ADMIN_ID)
      return msg.reply({ embeds: [errE('❌ Chỉ Admin mới dùng được lệnh này!')] }).catch(() => {});

    let rows;
    try {
      const res = await db(
        `SELECT username, do_vui_diem, do_vui_streak_max
         FROM players
         WHERE do_vui_streak_max > 0
         ORDER BY do_vui_streak_max DESC, do_vui_diem DESC
         LIMIT 15`,
      );
      rows = res.rows;
    } catch (_) {
      return msg.reply({ embeds: [errE('Không thể tải BXH lúc này, thử lại sau!')] });
    }

    if (!rows || rows.length === 0) {
      return msg.reply({ embeds: [new EmbedBuilder()
        .setTitle('🔥 BXH Chuỗi Đố Vui Tu Tiên')
        .setColor(0x9B59B6)
        .setDescription('Chưa có ai đạt chuỗi nào cả!\nDùng `-do_vui` để bắt đầu!'),
      ] });
    }

    const MEDALS = ['🥇', '🥈', '🥉'];
    const lines = rows.map((r, i) => {
      const medal = MEDALS[i] || `**${i + 1}.**`;
      const diem  = r.do_vui_diem ? `  (${fmt(r.do_vui_diem)} câu đúng)` : '';
      return `${medal} **${r.username}** — 🔥 Chuỗi **${r.do_vui_streak_max}**${diem}`;
    });

    const embed = new EmbedBuilder()
      .setTitle('🔥 BXH Chuỗi Đố Vui Tu Tiên')
      .setColor(0xFF6B35)
      .setDescription(lines.join('\n'))
      .setFooter({ text: 'Xếp theo chuỗi đúng liên tiếp dài nhất  •  Ngoặc = tổng câu đúng' });

    return msg.reply({ embeds: [embed] });
  });

  // ── Lệnh -do_vui_reset (chỉ Admin) ────────────────────────────────────────
  // Dùng: -do_vui_reset            → reset BXH toàn server (xoá điểm + streak tất cả)
  //       -do_vui_reset @user      → reset điểm + streak của 1 user cụ thể
  //       -do_vui_reset <userId>   → reset theo Discord ID
  reg('do_vui_reset', ['dvr', 'dvbxhres', 'dovuireset'], async (msg, args) => {
    if (msg.author.id !== ADMIN_ID)
      return msg.reply({ embeds: [errE('❌ Chỉ Admin mới dùng được lệnh này!')] }).catch(() => {});

    // Nếu không có args → reset toàn server
    if (!args || args.length === 0) {
      try {
        const res = await db(
          `UPDATE players
           SET do_vui_diem = 0,
               do_vui_streak_max = 0
           WHERE do_vui_diem > 0 OR do_vui_streak_max > 0`,
        );
        const affected = res.rowCount ?? 0;
        return msg.reply({ embeds: [new EmbedBuilder()
          .setTitle('🧹 Reset BXH Đố Vui')
          .setColor(0xE74C3C)
          .setDescription(`✅ Đã reset điểm & streak của **${affected} người chơi**.\nBXH đã sạch!`)
          .setFooter({ text: `Thực hiện bởi Admin • ${new Date().toLocaleString('vi-VN')}` }),
        ] });
      } catch (e) {
        return msg.reply({ embeds: [errE(`❌ Lỗi reset BXH: ${e.message}`)] });
      }
    }

    // Có args → reset 1 user cụ thể
    // Lấy user ID từ mention hoặc raw ID
    const mention = msg.mentions.users.first();
    const targetId = mention ? mention.id : args[0].replace(/[<@!>]/g, '');

    if (!/^\d{10,20}$/.test(targetId))
      return msg.reply({ embeds: [errE('❌ ID không hợp lệ! Dùng: `-do_vui_reset @user` hoặc `-do_vui_reset <userId>`')] });

    try {
      const res = await db(
        `UPDATE players
         SET do_vui_diem = 0,
             do_vui_streak_max = 0
         WHERE user_id = $1`,
        [targetId],
      );
      if ((res.rowCount ?? 0) === 0)
        return msg.reply({ embeds: [errE('❌ Không tìm thấy người chơi với ID đó!')] });

      // Xoá in-memory streak nếu đang online
      DO_VUI_STREAK.delete(targetId);
      DO_VUI_HISTORY.delete(targetId);

      const displayName = mention ? mention.username : targetId;
      return msg.reply({ embeds: [new EmbedBuilder()
        .setTitle('🧹 Reset Đố Vui — 1 người')
        .setColor(0xE67E22)
        .setDescription(`✅ Đã reset điểm & streak của **${displayName}**.\nĐiểm: 0 | Streak max: 0`)
        .setFooter({ text: `Thực hiện bởi Admin • ${new Date().toLocaleString('vi-VN')}` }),
      ] });
    } catch (e) {
      return msg.reply({ embeds: [errE(`❌ Lỗi reset user: ${e.message}`)] });
    }
  });

  // ── Handler cho button interaction ─────────────────────────────────────────
  async function handleDoVuiButton(interaction) {
    const parts       = interaction.customId.split('_');
    const choiceIdx   = parseInt(parts[parts.length - 1], 10);
    const quizOwnerId = parts[1];
    const sessionId   = parts.slice(1, -1).join('_');

    if (interaction.user.id !== quizOwnerId) {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: '❌ Đây không phải câu hỏi của bạn!',
      }).catch(() => {});
    }

    const sess = DO_VUI_SESSIONS.get(quizOwnerId);
    if (!sess || sess.sessionId !== sessionId) {
      return interaction.reply({
        flags: MessageFlags.Ephemeral,
        content: '❌ Câu hỏi đã hết hạn hoặc đã được trả lời!',
      }).catch(() => {});
    }

    DO_VUI_SESSIONS.delete(quizOwnerId);
    DO_VUI_PROCESSING.add(quizOwnerId);

    const isCorrect = choiceIdx === sess.correct;
    let rewardLine = '';
    let newStreak  = DO_VUI_STREAK.get(quizOwnerId) || 0;

    try {
      if (isCorrect) {
        newStreak++;
        DO_VUI_STREAK.set(quizOwnerId, newStreak);

        const player = await getPlayer(quizOwnerId, interaction.user.username);

        if (!player) {
          rewardLine = '\n\n✅ **Chính xác!** *(Không tìm thấy nhân vật — phần thưởng không thể phát)*';
        } else {
          const { bonus: streakBonus, msg: streakMsg } = getStreakBonus(newStreak);

          const ltBase  = calcMaxLinhThach(player, REWARD_LT);
          const ltExtra = streakBonus > 0 ? calcMaxLinhThach(player, streakBonus) : 0;
          const ltTotal = ltBase + ltExtra;
          const newMaxStreak = Math.max(player.do_vui_streak_max || 0, newStreak);

          if (ltTotal > 0) {
            await db(
              `UPDATE players
               SET linh_thach = linh_thach + $1,
                   do_vui_diem = COALESCE(do_vui_diem, 0) + 1,
                   do_vui_streak_max = GREATEST(COALESCE(do_vui_streak_max, 0), $2)
               WHERE user_id = $3`,
              [ltTotal, newMaxStreak, quizOwnerId],
            );
            rewardLine = `\n\n✅ **Chính xác!**  ${CE('tult', '💠')} **+${fmt(ltTotal)} Linh Thạch**`;
            if (streakBonus > 0)
              rewardLine += `\n${streakMsg} Bonus **+${fmt(ltExtra)}** Linh Thạch!`;
          } else {
            await db(
              `UPDATE players
               SET do_vui_diem = COALESCE(do_vui_diem, 0) + 1,
                   do_vui_streak_max = GREATEST(COALESCE(do_vui_streak_max, 0), $1)
               WHERE user_id = $2`,
              [newMaxStreak, quizOwnerId],
            );
            rewardLine = '\n\n✅ **Chính xác!** *(Túi đầy — không nhận được Linh Thạch)*';
          }

          if (newStreak >= 3)
            rewardLine += `\n🔥 **Streak hiện tại: ${newStreak}**`;
        }
      } else {
        const cdSaiTs = Date.now() - (CD_MIN - CD_SAI_MIN) * 60 * 1000;
        DO_VUI_STREAK.set(quizOwnerId, 0);
        await db('UPDATE players SET do_vui_cd=$1 WHERE user_id=$2', [cdSaiTs, quizOwnerId]).catch(() => {});
        rewardLine = `\n\n❌ **Sai rồi!** Đáp án đúng: **${LABELS[sess.correct]}. ${sess.dap_an[sess.correct]}**\n${CE("cd_timer","⏳")} *Cooldown **${CD_SAI_MIN} phút** — trả lời đúng mới được chơi ngay!*`;
      }
    } catch (_) {
      if (!isCorrect) {
        const cdSaiTs = Date.now() - (CD_MIN - CD_SAI_MIN) * 60 * 1000;
        await db('UPDATE players SET do_vui_cd=$1 WHERE user_id=$2', [cdSaiTs, quizOwnerId]).catch(() => {});
      } else {
        rewardLine = '\n\n✅ **Chính xác!** *(Lỗi lưu phần thưởng — linh thạch sẽ cộng sau)*';
      }
    } finally {
      DO_VUI_PROCESSING.delete(quizOwnerId);
    }

    const updEmbed = new EmbedBuilder()
      .setTitle('🧠 Đố Vui Tu Tiên')
      .setColor(isCorrect ? 0x2ECC71 : 0xE74C3C)
      .setDescription(
        `**${sess.cau_hoi}**\n\n` +
        sess.dap_an.map((a, i) => `**${LABELS[i]}.** ${a}`).join('\n') +
        rewardLine,
      )
      .setFooter({ text: isCorrect ? `Bạn chọn: ${LABELS[choiceIdx]}  •  Câu tiếp theo đang tải...` : `Bạn chọn: ${LABELS[choiceIdx]}` });

    await interaction.update({
      embeds: [updEmbed],
      components: [makeQuizButtons(sessionId, true, sess.correct, choiceIdx)],
    }).catch(() => {});

    if (isCorrect) {
      setTimeout(() => showNextQuestion(interaction, quizOwnerId), 1500);
    }
  }

  module.exports = { handleDoVuiButton, DO_VUI_SESSIONS };
  