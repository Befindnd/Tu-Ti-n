import React from 'react';
import { PlayerData, RealmLevel } from '../types/sect';
import { REALM_LIST } from '../data/cultivationConstants';
import { User, Sparkles, Coins, Zap, Shield, Sword } from 'lucide-react';

interface Props {
  player: PlayerData;
  onUpdatePlayer: (updated: PlayerData) => void;
  onCreateSectClick: () => void;
}

export const PlayerProfileBar: React.FC<Props> = ({
  player,
  onUpdatePlayer,
  onCreateSectClick,
}) => {
  const handleRealmChange = (newRealm: RealmLevel, newIndex: number) => {
    const realmInfo = REALM_LIST[newIndex];
    onUpdatePlayer({
      ...player,
      realm: newRealm,
      realmIndex: newIndex,
      attack: realmInfo.baseAtk,
      defense: realmInfo.baseDef,
      health: realmInfo.baseHp,
      maxHealth: realmInfo.baseHp,
    });
  };

  const handleAddStones = (amount: number) => {
    onUpdatePlayer({
      ...player,
      spiritStones: Math.max(0, player.spiritStones + amount),
    });
  };

  return (
    <div id="player-profile-bar" className="rounded-xl border border-stone-800 bg-[#131924] p-4 shadow-lg mb-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        {/* Left: Player Profile */}
        <div className="flex items-center space-x-3.5">
          <div className="w-11 h-11 rounded-xl bg-gradient-to-tr from-cyan-600 to-indigo-600 p-0.5 flex items-center justify-center shadow-md shadow-cyan-950/60">
            <div className="w-full h-full bg-[#10141d] rounded-[10px] flex items-center justify-center">
              <User className="w-5 h-5 text-cyan-300" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-stone-100 text-base">{player.name}</h3>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-cyan-950 border border-cyan-800 text-cyan-300 font-mono">
                {player.realm} (Tầng {player.realmLevel})
              </span>
              {player.sectRole && (
                <span className="text-[11px] px-2 py-0.5 rounded-full bg-amber-950 border border-amber-800 text-amber-300 font-medium">
                  {player.sectRole === 'tong_chu' ? 'Tông Chủ' : 'Thành Viên'}
                </span>
              )}
            </div>
            <div className="flex items-center space-x-4 text-xs text-stone-400 mt-1">
              <span className="flex items-center text-amber-400 font-mono">
                <Coins className="w-3.5 h-3.5 mr-1" />
                {player.spiritStones.toLocaleString()} Linh Thạch
              </span>
              <span className="flex items-center text-rose-400 font-mono">
                <Sword className="w-3.5 h-3.5 mr-1" />
                {player.attack.toLocaleString()} Công
              </span>
              <span className="flex items-center text-blue-400 font-mono">
                <Shield className="w-3.5 h-3.5 mr-1" />
                {player.defense.toLocaleString()} Thủ
              </span>
            </div>
          </div>
        </div>

        {/* Middle & Right: Simulator Controls & Create Sect Button */}
        <div className="flex flex-wrap items-center gap-2.5 w-full md:w-auto justify-end">
          {/* Quick Realm Switcher */}
          <div className="flex items-center space-x-1.5 bg-stone-900/90 border border-stone-800 rounded-lg px-2.5 py-1 text-xs">
            <span className="text-stone-400 text-[11px]">Đổi Cảnh Giới:</span>
            <select
              value={player.realmIndex}
              onChange={e => {
                const idx = parseInt(e.target.value);
                handleRealmChange(REALM_LIST[idx].name, idx);
              }}
              className="bg-stone-950 text-cyan-300 border border-stone-700 rounded px-2 py-0.5 text-xs focus:outline-none"
            >
              {REALM_LIST.map((r, i) => (
                <option key={r.name} value={i}>
                  {r.name} Kỳ (Lv.{i})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Stones */}
          <div className="flex items-center space-x-1">
            <button
              onClick={() => handleAddStones(5000)}
              className="px-2.5 py-1 rounded bg-amber-950/60 hover:bg-amber-900/80 border border-amber-800 text-amber-300 text-xs font-mono transition-colors"
              title="Thêm 5000 Linh Thạch để thử tạo tông môn"
            >
              +5k Đá
            </button>
            <button
              onClick={() => handleAddStones(20000)}
              className="px-2.5 py-1 rounded bg-amber-950/60 hover:bg-amber-900/80 border border-amber-800 text-amber-300 text-xs font-mono transition-colors"
              title="Thêm 20k Linh Thạch"
            >
              +20k Đá
            </button>
          </div>

          {/* Action Button: Create Sect */}
          {!player.sectId ? (
            <button
              onClick={onCreateSectClick}
              className="px-4 py-2 rounded-lg bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white text-xs font-semibold shadow-md shadow-amber-950/50 flex items-center space-x-1.5 transition-all"
            >
              <Sparkles className="w-4 h-4" />
              <span>Khai Tông Lập Phái</span>
            </button>
          ) : (
            <span className="text-xs px-3 py-1.5 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-300 font-medium">
              Đã gia nhập Tông Môn
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
