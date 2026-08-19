import React from 'react';
import { SectData } from '../types/sect';
import { Trophy, Shield, Coins, Medal, Flame } from 'lucide-react';

interface Props {
  sects: SectData[];
}

export const SectLeaderboard: React.FC<Props> = ({ sects }) => {
  // Sort by PK Points descending
  const sortedSects = [...sects].sort((a, b) => b.pkPoints - a.pkPoints);

  return (
    <div id="sect-leaderboard" className="rounded-2xl border border-stone-800 bg-[#121722] p-5 sm:p-6 shadow-xl">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-stone-800/80">
        <div className="flex items-center space-x-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
            <Trophy className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-stone-100 text-base">Bảng Xếp Hạng Thế Lực Tông Môn</h3>
            <p className="text-xs text-stone-400">Xếp hạng theo Điểm Chiến Công PK & Thành Tích Chiến Tranh</p>
          </div>
        </div>
        <span className="text-xs px-3 py-1 rounded-full bg-stone-900 border border-stone-800 text-stone-400 font-mono">
          {sects.length} Thế Lực
        </span>
      </div>

      <div className="space-y-2.5">
        {sortedSects.map((sect, index) => {
          const rank = index + 1;
          const isTop1 = rank === 1;
          const isTop2 = rank === 2;
          const isTop3 = rank === 3;

          return (
            <div
              key={sect.id}
              className={`p-3.5 rounded-xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 transition-all ${
                isTop1
                  ? 'bg-amber-950/20 border-amber-500/40 text-amber-200 shadow-md shadow-amber-950/30'
                  : isTop2
                  ? 'bg-stone-900/80 border-slate-700/60 text-stone-200'
                  : isTop3
                  ? 'bg-stone-900/60 border-amber-900/40 text-stone-300'
                  : 'bg-stone-900/30 border-stone-800/60 text-stone-400'
              }`}
            >
              {/* Left: Rank & Name */}
              <div className="flex items-center space-x-3.5">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-mono font-bold text-xs ${
                  isTop1 ? 'bg-gradient-to-br from-amber-400 to-amber-600 text-stone-950 shadow-md' :
                  isTop2 ? 'bg-slate-300 text-stone-950' :
                  isTop3 ? 'bg-amber-700 text-white' :
                  'bg-stone-800 text-stone-400'
                }`}>
                  {rank}
                </div>

                <div>
                  <div className="flex items-center space-x-2">
                    <h4 className="font-bold text-sm text-stone-100">{sect.name}</h4>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-stone-950 border border-stone-800 text-amber-300 font-mono">
                      Cấp {sect.level}
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5">
                    Tông Chủ: <span className="text-stone-300 font-medium">{sect.leaderName}</span>
                  </p>
                </div>
              </div>

              {/* Right: Stats (PK, Formation, Win/Loss) */}
              <div className="flex items-center space-x-6 text-xs font-mono w-full sm:w-auto justify-between sm:justify-end border-t sm:border-t-0 pt-2 sm:pt-0 border-stone-800">
                <div className="text-right">
                  <span className="text-[10px] text-stone-500 block">Điểm PK:</span>
                  <span className="text-rose-400 font-bold text-sm">{sect.pkPoints.toLocaleString()}</span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-stone-500 block">Thành Tích PK:</span>
                  <span>
                    <span className="text-emerald-400">{sect.warsWon}T</span> - <span className="text-rose-400">{sect.warsLost}B</span>
                  </span>
                </div>

                <div className="text-right">
                  <span className="text-[10px] text-stone-500 block">Ngân Khố:</span>
                  <span className="text-amber-300">{sect.spiritTreasury.toLocaleString()} Đá</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
