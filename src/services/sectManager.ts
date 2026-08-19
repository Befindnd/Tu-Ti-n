import {
  PlayerData,
  SectData,
  SectMemberData,
  SectWarData,
  SectRole
} from '../types/sect';
import { SECT_CREATION_CONFIG, SECT_ROLES_MAP, REALM_LIST } from '../data/cultivationConstants';

export interface ActionResult<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
}

export class SectManager {
  // Tạo Tông Môn mới
  static createSect(
    player: PlayerData,
    sectName: string,
    slogan: string,
    existingSects: SectData[]
  ): ActionResult<{ newSect: SectData; updatedPlayer: PlayerData }> {
    const trimmedName = sectName.trim();
    if (!trimmedName || trimmedName.length < 3 || trimmedName.length > 30) {
      return { success: false, message: 'Tên tông môn phải từ 3 đến 30 ký tự!' };
    }

    if (player.sectId) {
      return { success: false, message: 'Đạo hữu đã gia nhập tông môn khác, không thể lập tông môn mới!' };
    }

    // Kiểm tra cảnh giới
    if (player.realmIndex < SECT_CREATION_CONFIG.minRealmIndex) {
      return {
        success: false,
        message: `Tu vi chưa đủ! Cần đạt tối thiểu cảnh giới 【${SECT_CREATION_CONFIG.minRealmName} Kỳ】 mới có đủ uy vọng khai sơn lập phái! (Hiện tại: ${player.realm})`,
      };
    }

    // Kiểm tra linh thạch
    if (player.spiritStones < SECT_CREATION_CONFIG.requiredSpiritStones) {
      return {
        success: false,
        message: `Linh thạch không đủ! Cần tối thiểu ${SECT_CREATION_CONFIG.requiredSpiritStones.toLocaleString()} Linh Thạch để xây dựng sơn môn, thiết lập hộ sơn trận pháp! (Hiện có: ${player.spiritStones.toLocaleString()})`,
      };
    }

    // Kiểm tra tên trùng
    const isDuplicate = existingSects.some(
      s => s.name.toLowerCase() === trimmedName.toLowerCase()
    );
    if (isDuplicate) {
      return { success: false, message: `Tên tông môn "${trimmedName}" đã tồn tại trong tu chân giới!` };
    }

    const newSectId = `sect-${Date.now()}`;
    const initialTreasury = Math.floor(SECT_CREATION_CONFIG.requiredSpiritStones * 0.2); // 20% vào quỹ

    const newSect: SectData = {
      id: newSectId,
      name: trimmedName,
      leaderDiscordId: player.discordId,
      leaderName: player.name,
      level: 1,
      spiritTreasury: initialTreasury,
      formationLevel: 1,
      formationDurability: 10000,
      maxFormationDurability: 10000,
      pkPoints: 1000,
      pkRank: existingSects.length + 1,
      warsWon: 0,
      warsLost: 0,
      warStatus: 'peace',
      targetSectId: null,
      slogan: slogan.trim() || 'Khai sơn lập phái, vấn đỉnh thiên hạ!',
      maxMembers: 20,
      createdAt: Date.now(),
    };

    const updatedPlayer: PlayerData = {
      ...player,
      spiritStones: player.spiritStones - SECT_CREATION_CONFIG.requiredSpiritStones,
      sectId: newSectId,
      sectRole: 'tong_chu',
    };

    return {
      success: true,
      message: `🎉 Chúc mừng đạo hữu ${player.name} đã khai tông lập phái thành công! Tông môn 【${trimmedName}】 chính thức ra đời!`,
      data: { newSect, updatedPlayer },
    };
  }

  // Đóng góp Linh Thạch vào Tông Môn
  static donateSpiritStones(
    player: PlayerData,
    sect: SectData,
    amount: number
  ): ActionResult<{ updatedSect: SectData; updatedPlayer: PlayerData; contributionGained: number }> {
    if (amount <= 0) {
      return { success: false, message: 'Số lượng linh thạch đóng góp không hợp lệ!' };
    }

    if (player.spiritStones < amount) {
      return { success: false, message: `Đạo hữu không đủ linh thạch! (Hiện có: ${player.spiritStones.toLocaleString()})` };
    }

    const updatedPlayer: PlayerData = {
      ...player,
      spiritStones: player.spiritStones - amount,
    };

    const updatedSect: SectData = {
      ...sect,
      spiritTreasury: sect.spiritTreasury + amount,
    };

    return {
      success: true,
      message: `Đạo hữu ${player.name} đã cống hiến ${amount.toLocaleString()} Linh Thạch vào ngân khố tông môn!`,
      data: {
        updatedSect,
        updatedPlayer,
        contributionGained: amount,
      },
    };
  }

  // Nâng cấp Hộ Sơn Trận Pháp
  static upgradeFormation(
    sect: SectData,
    playerRole: SectRole
  ): ActionResult<SectData> {
    if (playerRole !== 'tong_chu' && playerRole !== 'pho_tong_chu') {
      return { success: false, message: 'Chỉ Tông Chủ hoặc Phó Tông Chủ mới có quyền nâng cấp Hộ Sơn Trận Pháp!' };
    }

    const upgradeCost = sect.formationLevel * 10000;
    if (sect.spiritTreasury < upgradeCost) {
      return {
        success: false,
        message: `Ngân khố không đủ linh thạch! Cần ${upgradeCost.toLocaleString()} Linh Thạch để nâng cấp trận pháp lên Cấp ${sect.formationLevel + 1} (Hiện có: ${sect.spiritTreasury.toLocaleString()})`,
      };
    }

    const nextLevel = sect.formationLevel + 1;
    const nextMaxDurability = nextLevel * 10000;

    const updatedSect: SectData = {
      ...sect,
      formationLevel: nextLevel,
      formationDurability: nextMaxDurability,
      maxFormationDurability: nextMaxDurability,
      spiritTreasury: sect.spiritTreasury - upgradeCost,
    };

    return {
      success: true,
      message: `⚡ Hộ Sơn Trận Pháp đã được nâng cấp lên Cấp ${nextLevel}! Độ bền phòng ngự tăng lên ${nextMaxDurability.toLocaleString()} HP!`,
      data: updatedSect,
    };
  }

  // Tuyên Chiến Tông Môn (Bắt đầu PK Tông Môn)
  static declareWar(
    attackerSect: SectData,
    defenderSect: SectData,
    playerRole: SectRole
  ): ActionResult<{ updatedAttacker: SectData; updatedDefender: SectData; war: SectWarData }> {
    if (playerRole !== 'tong_chu' && playerRole !== 'pho_tong_chu') {
      return { success: false, message: 'Chỉ Tông Chủ hoặc Phó Tông Chủ mới có quyền phát động Tuyên Chiến!' };
    }

    if (attackerSect.id === defenderSect.id) {
      return { success: false, message: 'Không thể tự tuyên chiến với tông môn của chính mình!' };
    }

    if (attackerSect.warStatus === 'at_war') {
      return { success: false, message: `Tông môn đang trong chiến tranh với thế lực khác!` };
    }

    const warCost = 2000; // Phí xuất binh
    if (attackerSect.spiritTreasury < warCost) {
      return {
        success: false,
        message: `Quỹ tông môn cần tối thiểu ${warCost.toLocaleString()} Linh Thạch làm quân lương xuất chinh!`,
      };
    }

    const warId = `war-${Date.now()}`;
    const newWar: SectWarData = {
      id: warId,
      attackerSectId: attackerSect.id,
      attackerSectName: attackerSect.name,
      defenderSectId: defenderSect.id,
      defenderSectName: defenderSect.name,
      status: 'active',
      attackerDamageDealt: 0,
      defenderDamageDealt: 0,
      plunderedStones: 0,
      pkPointsExchanged: 0,
      startedAt: Date.now(),
      logs: [
        `[${new Date().toLocaleTimeString()}] Tông môn 【${attackerSect.name}】 chính thức phát hịch tuyên chiến với 【${defenderSect.name}】! Hộ sơn đại trận khởi động!`,
      ],
    };

    const updatedAttacker: SectData = {
      ...attackerSect,
      spiritTreasury: attackerSect.spiritTreasury - warCost,
      warStatus: 'at_war',
      targetSectId: defenderSect.id,
    };

    const updatedDefender: SectData = {
      ...defenderSect,
      warStatus: 'at_war',
      targetSectId: attackerSect.id,
    };

    return {
      success: true,
      message: `⚔️ Đã phát động tuyên chiến với tông môn 【${defenderSect.name}】! Các đệ tử có thể tiến công hộ sơn đại trận!`,
      data: { updatedAttacker, updatedDefender, war: newWar },
    };
  }

  // Tấn Công Hộ Sơn Trận Pháp trong Tông Môn PK Chiến
  static attackSectFormation(
    attackerPlayer: PlayerData,
    attackerSect: SectData,
    defenderSect: SectData,
    currentWar: SectWarData
  ): ActionResult<{
    damage: number;
    updatedDefender: SectData;
    updatedAttacker: SectData;
    updatedWar: SectWarData;
    isDestroyed: boolean;
    combatLog: string;
  }> {
    // Sát thương tính theo Công Kích + Cảnh Giới của người chơi
    const baseDamage = attackerPlayer.attack * 2.5 + (attackerPlayer.realmIndex + 1) * 150;
    const crit = Math.random() > 0.7 ? 1.5 : 1.0;
    const finalDamage = Math.floor(baseDamage * crit * (0.85 + Math.random() * 0.3));

    const newDurability = Math.max(0, defenderSect.formationDurability - finalDamage);
    const isDestroyed = newDurability <= 0;

    let plundered = 0;
    let pkGained = 0;
    let logMessage = `Đạo hữu ${attackerPlayer.name} (${attackerPlayer.realm}) thi triển thần thông oanh kích Hộ Sơn Trận Pháp của 【${defenderSect.name}】, gây ${finalDamage.toLocaleString()} sát thương! ${crit > 1 ? '💥 Bạo kích!' : ''}`;

    let updatedAttacker = { ...attackerSect };
    let updatedDefender = {
      ...defenderSect,
      formationDurability: newDurability,
    };

    if (isDestroyed) {
      // Khi trận pháp bị phá hủy: Cướp 20% kho linh thạch + điểm PK
      plundered = Math.floor(defenderSect.spiritTreasury * 0.2);
      pkGained = 150 + Math.floor(defenderSect.pkPoints * 0.05);

      updatedDefender.spiritTreasury = Math.max(0, defenderSect.spiritTreasury - plundered);
      updatedDefender.formationDurability = 0;
      updatedDefender.warsLost += 1;
      updatedDefender.pkPoints = Math.max(100, defenderSect.pkPoints - pkGained);
      updatedDefender.warStatus = 'peace';
      updatedDefender.targetSectId = null;

      updatedAttacker.spiritTreasury += plundered;
      updatedAttacker.warsWon += 1;
      updatedAttacker.pkPoints += pkGained;
      updatedAttacker.warStatus = 'peace';
      updatedAttacker.targetSectId = null;

      logMessage += `\n🔥 [ĐẠI THẮNG] Hộ Sơn Trận Pháp của 【${defenderSect.name}】 đã hoàn toàn sụp đổ! 【${attackerSect.name}】 cướp được ${plundered.toLocaleString()} Linh Thạch và giành được +${pkGained} Điểm Chiến Công PK!`;
    }

    const updatedWar: SectWarData = {
      ...currentWar,
      attackerDamageDealt: currentWar.attackerDamageDealt + finalDamage,
      plunderedStones: currentWar.plunderedStones + plundered,
      pkPointsExchanged: pkGained,
      status: isDestroyed ? 'attacker_won' : 'active',
      endedAt: isDestroyed ? Date.now() : undefined,
      logs: [logMessage, ...currentWar.logs.slice(0, 15)],
    };

    return {
      success: true,
      message: logMessage,
      data: {
        damage: finalDamage,
        updatedDefender,
        updatedAttacker,
        updatedWar,
        isDestroyed,
        combatLog: logMessage,
      },
    };
  }
}
