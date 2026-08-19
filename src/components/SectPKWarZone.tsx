import React, { useState } from 'react';
import { SectData, PlayerData, SectWarData } from '../types/sect';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sword, 
  Shield, 
  Flame, 
  Skull, 
  Trophy, 
  Coins, 
  Zap, 
  AlertTriangle, 
  CheckCircle2, 
  X,
  History,
  Target
} from 'lucide-react';

interface Props {
  mySect: SectData;
  allSects: SectData[];
  player: PlayerData;
  currentWar: SectWarData | null;
  onDeclareWar: (targetSectId: string) => void;
  onAttackFormation: () => void;
  onClose: () => void;
}

export const SectPKWarZone: React.FC<Props> = ({
  mySect,
  allSects,
  player,
  currentWar,
  onDeclareWar,
  onAttackFormation,
  onClose,
}) => {
  const [selectedTargetId, setSelectedTargetId] = useState<string>('');
  const enemySects = allSects.filter(s => s.id !== mySect.id);
  const activeEnemy = currentWar ? allSects.find(s => s.id === currentWar.defenderSectId) : null;

  const isLeader = player.sectRole === 'tong_chu' || player.sectRole === 'pho_tong_chu';
  const warCost = 2000;
  const canDeclare = isLeader && mySect.spiritTreasury >= warCost && mySect.warStatus !== 'at_war';

  const enemyFormationPercent = activeEnemy
    ? Math.min(100, Math.round((activeEnemy.formationDurability / activeEnemy.maxFormationDurability) * 100))
    : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md overflow-y-auto">
      <div className="w-full max-w-4xl rounded-2xl border border-rose-900/60 bg-[#121620] shadow-2xl p-6 relative overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-200 p-1.5 rounded-lg hover:bg-stone-800 transition-colors z-20"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Top Header */}
        <div className="flex items-center space-x-3.5 pb-4 mb-5 border-b border-stone-800">
          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-rose-600 via-red-600 to-amber-600 flex items-center justify-center shadow-lg shadow-rose-950/60">
            <Sword className="w-6 h-6 text-white" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-xl font-bold text-stone-100">Chiến Trường PK Tông Môn</h2>
              <span className="text-xs px-2.5 py-0.5 rounded-full bg-rose-950 border border-rose-800 text-rose-300 font-mono font-bold">
                TÔNG MÔN CHIẾN
              </span>
            </div>
            <p className="text-xs text-stone-400">Tuyên chiến thế lực, công phá Hộ Sơn Trận Pháp, cướp linh thạch và đoạt điểm chiến công</p>
          </div>
        </div>

        {/* War Arena View */}
        {currentWar && activeEnemy && currentWar.status === 'active' ? (
          <div className="space-y-6">
            
            {/* Duel Banner: Attacker vs Defender */}
            <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-center bg-gradient-to-r from-cyan-950/50 via-stone-900/80 to-rose-950/50 p-5 rounded-2xl border border-stone-800 shadow-inner">
              
              {/* Left: Our Sect */}
              <div className="md:col-span-5 text-left space-y-2">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300">PHE TIẾN CÔNG</span>
                  <span className="text-xs text-stone-400">Cấp {mySect.level}</span>
                </div>
                <h3 className="text-xl font-bold text-cyan-300">{mySect.name}</h3>
                <div className="text-xs text-stone-300 space-y-1">
                  <div>Tông Chủ: <span className="font-semibold text-stone-100">{mySect.leaderName}</span></div>
                  <div>Điểm PK: <span className="font-mono text-cyan-400 font-bold">{mySect.pkPoints}</span></div>
                  <div>Sát thương đã gây: <span className="font-mono text-emerald-400 font-bold">{currentWar.attackerDamageDealt.toLocaleString()}</span></div>
                </div>
              </div>

              {/* Center: VS Badge */}
              <div className="md:col-span-1 flex flex-col items-center justify-center my-2 md:my-0">
                <div className="w-10 h-10 rounded-full bg-rose-600/20 border-2 border-rose-500 flex items-center justify-center text-rose-400 font-black text-xs shadow-lg animate-pulse">
                  VS
                </div>
              </div>

              {/* Right: Enemy Sect */}
              <div className="md:col-span-5 text-right space-y-2">
                <div className="flex items-center justify-end space-x-2">
                  <span className="text-xs text-stone-400">Cấp {activeEnemy.level}</span>
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-rose-950 border border-rose-800 text-rose-300">PHE PHÒNG THỦ</span>
                </div>
                <h3 className="text-xl font-bold text-rose-400">{activeEnemy.name}</h3>
                <div className="text-xs text-stone-300 space-y-1">
                  <div>Tông Chủ: <span className="font-semibold text-stone-100">{activeEnemy.leaderName}</span></div>
                  <div>Ngân Khố Mục Tiêu: <span className="font-mono text-amber-300 font-bold">{activeEnemy.spiritTreasury.toLocaleString()} Đá</span></div>
                  <div>Điểm PK: <span className="font-mono text-rose-400 font-bold">{activeEnemy.pkPoints}</span></div>
                </div>
              </div>

            </div>

            {/* Enemy Formation Health Bar */}
            <div className="rounded-xl border border-stone-800 bg-stone-900/80 p-5 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-stone-200 flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-rose-400" />
                  Hộ Sơn Trận Pháp của 【{activeEnemy.name}】 (Cấp {activeEnemy.formationLevel})
                </span>
                <span className="font-mono font-bold text-rose-300">
                  {activeEnemy.formationDurability.toLocaleString()} / {activeEnemy.maxFormationDurability.toLocaleString()} HP ({enemyFormationPercent}%)
                </span>
              </div>

              <div className="w-full h-4 bg-stone-950 rounded-full overflow-hidden border border-stone-800 p-0.5">
                <motion.div
                  className="h-full bg-gradient-to-r from-rose-600 via-red-500 to-amber-500 rounded-full"
                  style={{ width: `${enemyFormationPercent}%` }}
                />
              </div>

              <p className="text-[11px] text-stone-400 text-center">
                Mỗi đợt công kích sẽ bào mòn độ bền trận pháp dựa trên Lực Công Kích ({player.attack}) & Cảnh Giới ({player.realm}) của bạn!
              </p>
            </div>

            {/* Combat Action Trigger */}
            <div className="flex items-center justify-center pt-2">
              <button
                id="btn-attack-formation"
                onClick={onAttackFormation}
                className="px-8 py-3.5 rounded-xl bg-gradient-to-r from-rose-600 via-red-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white font-bold text-sm shadow-xl shadow-rose-950/80 flex items-center space-x-2.5 active:scale-95 transition-all cursor-pointer animate-pulse"
              >
                <Flame className="w-5 h-5" />
                <span>Oanh Kích Hộ Sơn Trận Pháp!</span>
              </button>
            </div>

            {/* War Battle Logs */}
            <div className="rounded-xl border border-stone-800 bg-[#0d1017] p-4 text-xs font-mono space-y-1.5 max-h-40 overflow-y-auto">
              <div className="text-stone-400 text-[11px] font-sans font-semibold mb-2 flex items-center gap-1 border-b border-stone-800 pb-1">
                <History className="w-3.5 h-3.5 text-cyan-400" />
                Nhật Ký Giao Tranh
              </div>
              {currentWar.logs.map((log, index) => (
                <div key={index} className="text-stone-300 leading-relaxed">
                  {log}
                </div>
              ))}
            </div>

          </div>
        ) : (
          /* Declaration & Target Selection View */
          <div className="space-y-6">
            <div className="p-4 rounded-xl bg-rose-950/30 border border-rose-800/40 text-xs text-stone-300 leading-relaxed">
              <h4 className="font-bold text-rose-300 mb-1 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4" />
                Quy Tắc Tuyên Chiến & PK Tông Môn:
              </h4>
              <ul className="list-disc list-inside space-y-1 text-stone-400 text-[11px]">
                <li>Chỉ <span className="text-stone-200 font-semibold">Tông Chủ</span> hoặc <span className="text-stone-200 font-semibold">Phó Tông Chủ</span> mới có quyền phát hịch tuyên chiến.</li>
                <li>Chi phí xuất chinh: <span className="text-amber-300 font-mono font-bold">2,000 Linh Thạch</span> trích từ Ngân Khố Tông Môn.</li>
                <li>Khi công phá hoàn toàn Hộ Sơn Trận Pháp của đối phương, phe thắng cướp được <span className="text-emerald-400 font-bold">20% Quỹ Linh Thạch</span> và đoạt điểm PK BXH!</li>
              </ul>
            </div>

            {/* List of enemy sects available for war */}
            <div className="space-y-3">
              <h4 className="text-xs font-semibold text-stone-300 uppercase tracking-wider flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-400" />
                Danh Sách Tông Môn Tu Chân Giới:
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                {enemySects.map(s => {
                  const isSelected = selectedTargetId === s.id;
                  return (
                    <div
                      key={s.id}
                      onClick={() => setSelectedTargetId(s.id)}
                      className={`p-4 rounded-xl border transition-all cursor-pointer flex flex-col justify-between ${
                        isSelected
                          ? 'bg-rose-950/40 border-rose-500 shadow-md shadow-rose-950/50 ring-1 ring-rose-500/50'
                          : 'bg-stone-900/60 border-stone-800 hover:border-stone-700 hover:bg-stone-900'
                      }`}
                    >
                      <div>
                        <div className="flex items-center justify-between">
                          <h5 className="font-bold text-stone-100 text-sm">{s.name}</h5>
                          <span className="text-[11px] px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-amber-300 font-mono">
                            Cấp {s.level}
                          </span>
                        </div>
                        <p className="text-[11px] text-stone-400 mt-1 font-serif italic line-clamp-1">
                          "{s.slogan}"
                        </p>
                      </div>

                      <div className="grid grid-cols-2 gap-2 text-[11px] font-mono mt-3 pt-2.5 border-t border-stone-800/80 text-stone-300">
                        <div>
                          <span className="text-stone-500 block text-[10px]">Ngân Khố:</span>
                          <span className="text-amber-400 font-bold">{s.spiritTreasury.toLocaleString()} Đá</span>
                        </div>
                        <div>
                          <span className="text-stone-500 block text-[10px]">Điểm PK:</span>
                          <span className="text-rose-400 font-bold">{s.pkPoints}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-3 border-t border-stone-800">
              <div className="text-xs text-stone-400">
                Ngân Khố Tông Môn: <span className="text-amber-400 font-mono font-bold">{mySect.spiritTreasury.toLocaleString()}</span> / 2,000 Đá cần
              </div>

              <button
                onClick={() => {
                  if (selectedTargetId) onDeclareWar(selectedTargetId);
                }}
                disabled={!selectedTargetId || !canDeclare}
                className={`px-6 py-2.5 rounded-xl text-xs font-bold flex items-center space-x-2 transition-all ${
                  selectedTargetId && canDeclare
                    ? 'bg-gradient-to-r from-rose-600 to-amber-600 hover:from-rose-500 hover:to-amber-500 text-white shadow-lg shadow-rose-950/60 cursor-pointer'
                    : 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700/50'
                }`}
              >
                <Flame className="w-4 h-4" />
                <span>
                  {!isLeader
                    ? 'Chỉ Tông Chủ được Tuyên Chiến'
                    : mySect.spiritTreasury < warCost
                    ? 'Không đủ 2,000 Đá xuất chinh'
                    : 'Phát Hịch Tuyên Chiến'}
                </span>
              </button>
            </div>

          </div>
        )}

      </div>
    </div>
  );
};
