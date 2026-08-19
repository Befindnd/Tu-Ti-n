import React, { useState } from 'react';
import { SectData, PlayerData, SectRole } from '../types/sect';
import { SECT_ROLES_MAP } from '../data/cultivationConstants';
import { 
  Building2, 
  Shield, 
  Coins, 
  Sword, 
  Users, 
  Trophy, 
  ArrowUpCircle, 
  Send, 
  Sparkles,
  Zap,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

interface Props {
  sect: SectData;
  player: PlayerData;
  onDonate: (amount: number) => void;
  onUpgradeFormation: () => void;
  onOpenWarZone: () => void;
}

export const SectOverview: React.FC<Props> = ({
  sect,
  player,
  onDonate,
  onUpgradeFormation,
  onOpenWarZone,
}) => {
  const [donateAmount, setDonateAmount] = useState<number>(1000);
  const isLeaderOrOfficer = player.sectRole === 'tong_chu' || player.sectRole === 'pho_tong_chu';
  const formationPercent = Math.min(100, Math.round((sect.formationDurability / sect.maxFormationDurability) * 100));
  const upgradeCost = sect.formationLevel * 10000;
  const canUpgradeFormation = sect.spiritTreasury >= upgradeCost;

  return (
    <div id="sect-overview-container" className="space-y-6">
      {/* Top Banner: Sect Name & Status */}
      <div className="rounded-2xl border border-stone-800 bg-gradient-to-b from-[#151c28] to-[#10151f] p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-5 border-b border-stone-800/80">
          <div className="flex items-center space-x-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-amber-600 via-rose-600 to-indigo-600 p-0.5 shadow-lg shadow-amber-950/60">
              <div className="w-full h-full bg-[#10141d] rounded-[14px] flex items-center justify-center">
                <Building2 className="w-7 h-7 text-amber-400" />
              </div>
            </div>
            <div>
              <div className="flex items-center space-x-2.5">
                <h2 className="text-2xl font-bold text-stone-100">{sect.name}</h2>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-800 text-amber-300 font-bold font-mono">
                  Cấp {sect.level}
                </span>
                <span className={`text-xs px-2.5 py-0.5 rounded-full border font-medium ${
                  sect.warStatus === 'at_war' 
                    ? 'bg-rose-950/90 border-rose-700 text-rose-300 animate-pulse' 
                    : 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                }`}>
                  {sect.warStatus === 'at_war' ? '⚔️ Đang Chiến Tranh' : '🕊️ Hòa Bình'}
                </span>
              </div>
              <p className="text-xs text-stone-400 mt-1 font-serif italic">"{sect.slogan}"</p>
            </div>
          </div>

          {/* PK War Zone Button */}
          <button
            onClick={onOpenWarZone}
            className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-xs shadow-lg shadow-rose-950/70 flex items-center space-x-2 transition-all active:scale-95 cursor-pointer"
          >
            <Sword className="w-4 h-4" />
            <span>Khu Vực Tuyên Chiến & PK Tông Môn</span>
          </button>
        </div>

        {/* 4 Stats Cards Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 pt-5">
          {/* Card 1: Treasury */}
          <div className="rounded-xl border border-stone-800/80 bg-stone-900/50 p-4">
            <span className="text-xs text-stone-400 flex items-center gap-1.5 mb-1">
              <Coins className="w-3.5 h-3.5 text-amber-400" /> Ngân Khố Tông Môn
            </span>
            <div className="text-lg font-bold text-amber-300 font-mono">
              {sect.spiritTreasury.toLocaleString()} <span className="text-xs font-normal text-amber-400/80">Linh Thạch</span>
            </div>
            <span className="text-[11px] text-stone-500 mt-1 block">Dùng nâng cấp trận pháp & chi phí PK</span>
          </div>

          {/* Card 2: Hộ Sơn Trận Pháp */}
          <div className="rounded-xl border border-stone-800/80 bg-stone-900/50 p-4">
            <div className="flex items-center justify-between text-xs text-stone-400 mb-1">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-cyan-400" /> Hộ Sơn Trận Pháp
              </span>
              <span className="text-[11px] text-cyan-300 font-mono">Cấp {sect.formationLevel}</span>
            </div>
            <div className="text-lg font-bold text-cyan-300 font-mono">
              {sect.formationDurability.toLocaleString()} <span className="text-xs font-normal text-stone-400">/ {sect.maxFormationDurability.toLocaleString()}</span>
            </div>
            <div className="w-full h-1.5 bg-stone-950 rounded-full mt-2 overflow-hidden border border-stone-800">
              <div 
                className="h-full bg-gradient-to-r from-cyan-500 to-teal-400 transition-all duration-300"
                style={{ width: `${formationPercent}%` }}
              />
            </div>
          </div>

          {/* Card 3: PK Points */}
          <div className="rounded-xl border border-stone-800/80 bg-stone-900/50 p-4">
            <span className="text-xs text-stone-400 flex items-center gap-1.5 mb-1">
              <Trophy className="w-3.5 h-3.5 text-rose-400" /> Điểm Chiến Công (PK)
            </span>
            <div className="text-lg font-bold text-rose-300 font-mono">
              {sect.pkPoints.toLocaleString()} <span className="text-xs font-normal text-stone-400">Điểm</span>
            </div>
            <div className="flex items-center space-x-2 text-[11px] text-stone-400 mt-1 font-mono">
              <span className="text-emerald-400">Thắng: {sect.warsWon}</span>
              <span>•</span>
              <span className="text-rose-400">Thua: {sect.warsLost}</span>
            </div>
          </div>

          {/* Card 4: Leader & Members */}
          <div className="rounded-xl border border-stone-800/80 bg-stone-900/50 p-4">
            <span className="text-xs text-stone-400 flex items-center gap-1.5 mb-1">
              <Users className="w-3.5 h-3.5 text-indigo-400" /> Tông Chủ & Thành Viên
            </span>
            <div className="text-sm font-bold text-stone-200 truncate">
              {sect.leaderName}
            </div>
            <span className="text-[11px] text-stone-400 mt-1 block">
              Quy mô: <span className="text-cyan-300 font-mono font-medium">1 / {sect.maxMembers}</span> Đệ tử
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Controls: Donation & Formation Upgrade */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Box 1: Donate Spirit Stones */}
        <div className="rounded-xl border border-stone-800 bg-[#121722] p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
            <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
              <Coins className="w-4 h-4 text-amber-400" />
              Đóng Góp Ngân Khố Tông Môn
            </h3>
            <span className="text-xs text-stone-400 font-mono">
              Túi bạn: <span className="text-amber-400 font-bold">{player.spiritStones.toLocaleString()}</span> Đá
            </span>
          </div>
          
          <p className="text-xs text-stone-400 leading-relaxed">
            Đóng góp linh thạch giúp củng cố quỹ tông môn, cung cấp kinh phí nâng cấp Hộ Sơn Trận Pháp và thưởng chiến công khi tham gia PK Tông Môn Chiến.
          </p>

          <div className="flex items-center space-x-2">
            {[500, 1000, 2000, 5000].map(amt => (
              <button
                key={amt}
                onClick={() => setDonateAmount(amt)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  donateAmount === amt
                    ? 'bg-amber-500/20 border border-amber-500 text-amber-300 font-bold'
                    : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
                }`}
              >
                +{amt}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-3 pt-1">
            <input
              type="number"
              value={donateAmount}
              onChange={e => setDonateAmount(Math.max(1, parseInt(e.target.value) || 0))}
              min={1}
              max={player.spiritStones}
              className="flex-1 px-3 py-2 rounded-lg bg-stone-950 border border-stone-700 text-stone-100 text-sm font-mono focus:outline-none focus:border-amber-500"
            />
            <button
              onClick={() => onDonate(donateAmount)}
              disabled={player.spiritStones < donateAmount || donateAmount <= 0}
              className={`px-5 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition-all ${
                player.spiritStones >= donateAmount && donateAmount > 0
                  ? 'bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-stone-950 cursor-pointer shadow-md'
                  : 'bg-stone-800 text-stone-500 cursor-not-allowed'
              }`}
            >
              <Send className="w-3.5 h-3.5" />
              <span>Cống Hiến</span>
            </button>
          </div>
        </div>

        {/* Box 2: Formation Upgrade */}
        <div className="rounded-xl border border-stone-800 bg-[#121722] p-5 shadow-lg space-y-4">
          <div className="flex items-center justify-between border-b border-stone-800/80 pb-3">
            <h3 className="text-sm font-bold text-stone-100 flex items-center gap-2">
              <Shield className="w-4 h-4 text-cyan-400" />
              Nâng Cấp Hộ Sơn Trận Pháp
            </h3>
            <span className="text-xs text-stone-400 font-mono">
              Cấp Hiện Tại: <span className="text-cyan-300 font-bold">{sect.formationLevel}</span>
            </span>
          </div>

          <p className="text-xs text-stone-400 leading-relaxed">
            Hộ Sơn Trận Pháp bảo vệ ngân khố tông môn khỏi các đợt tập kích PK từ đối thủ. Khi trận pháp vỡ, đối phương sẽ cướp được 20% ngân khố!
          </p>

          <div className="p-3 rounded-lg bg-stone-900/70 border border-stone-800/80 text-xs space-y-1.5">
            <div className="flex justify-between">
              <span className="text-stone-400">Độ bền tối đa cấp tiếp theo:</span>
              <span className="text-cyan-300 font-mono font-bold">{((sect.formationLevel + 1) * 10000).toLocaleString()} HP</span>
            </div>
            <div className="flex justify-between">
              <span className="text-stone-400">Chi phí nâng cấp (Trích quỹ):</span>
              <span className={`font-mono font-bold ${canUpgradeFormation ? 'text-amber-300' : 'text-rose-400'}`}>
                {upgradeCost.toLocaleString()} Linh Thạch
              </span>
            </div>
          </div>

          <div className="flex items-center justify-end pt-1">
            <button
              onClick={onUpgradeFormation}
              disabled={!isLeaderOrOfficer || !canUpgradeFormation}
              className={`w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center space-x-2 transition-all ${
                isLeaderOrOfficer && canUpgradeFormation
                  ? 'bg-gradient-to-r from-cyan-600 to-teal-600 hover:from-cyan-500 hover:to-teal-500 text-white shadow-md shadow-cyan-950/50 cursor-pointer'
                  : 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700/50'
              }`}
            >
              <ArrowUpCircle className="w-4 h-4" />
              <span>
                {!isLeaderOrOfficer
                  ? 'Chỉ Tông Chủ / Phó Tông Chủ'
                  : !canUpgradeFormation
                  ? 'Ngân khố không đủ linh thạch'
                  : `Nâng Cấp Trận Pháp Lên Cấp ${sect.formationLevel + 1}`}
              </span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
