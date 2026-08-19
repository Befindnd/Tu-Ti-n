export type RealmLevel = 
  | 'Phàm Nhân'
  | 'Luyện Khí'
  | 'Trúc Cơ'
  | 'Kim Đan'
  | 'Nguyên Anh'
  | 'Hóa Thần'
  | 'Luyện Hư'
  | 'Hợp Thể'
  | 'Đại Thừa'
  | 'Độ Kiếp';

export type SectRole = 
  | 'tong_chu'      // Tông Chủ
  | 'pho_tong_chu'  // Phó Tông Chủ
  | 'truong_lao'    // Trưởng Lão
  | 'chap_su'       // Chấp Sự
  | 'noi_mon'       // Đệ Tử Nội Môn
  | 'ngoai_mon';    // Đệ Tử Ngoại Môn

export interface PlayerData {
  id: string;
  discordId: string;
  name: string;
  realm: RealmLevel;
  realmIndex: number;
  realmLevel: number;
  experience: number;
  spiritStones: number;
  health: number;
  maxHealth: number;
  mana: number;
  maxMana: number;
  attack: number;
  defense: number;
  isAlive: boolean;
  sectId: string | null;
  sectRole: SectRole | null;
}

export interface SectData {
  id: string;
  name: string;
  leaderDiscordId: string;
  leaderName: string;
  level: number;
  spiritTreasury: number; // Linh thạch trong kho tông môn
  formationLevel: number; // Cấp Hộ Sơn Trận Pháp (1 - 10)
  formationDurability: number; // Độ bền trận pháp hiện tại
  maxFormationDurability: number; // Độ bền tối đa
  pkPoints: number; // Điểm chiến công / Điểm PK thế lực
  pkRank: number;
  warsWon: number;
  warsLost: number;
  warStatus: 'peace' | 'at_war' | 'cooldown';
  targetSectId: string | null;
  warEndTime?: number;
  slogan: string;
  maxMembers: number;
  createdAt: number;
}

export interface SectMemberData {
  id: string;
  discordId: string;
  name: string;
  realm: RealmLevel;
  realmLevel: number;
  role: SectRole;
  contribution: number; // Điểm cống hiến
  warPoints: number;    // Điểm chiến công PK cá nhân
  attack: number;
  defense: number;
  joinedAt: number;
}

export interface SectWarData {
  id: string;
  attackerSectId: string;
  attackerSectName: string;
  defenderSectId: string;
  defenderSectName: string;
  status: 'active' | 'attacker_won' | 'defender_won' | 'draw';
  attackerDamageDealt: number;
  defenderDamageDealt: number;
  plunderedStones: number;
  pkPointsExchanged: number;
  startedAt: number;
  endedAt?: number;
  logs: string[];
}

export interface SectCreationRequirement {
  minRealmIndex: number; // Ví dụ: 2 = Trúc Cơ hoặc 3 = Kim Đan
  minRealmName: RealmLevel;
  requiredSpiritStones: number;
  minHealth: number;
}
