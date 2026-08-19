import React, { useState } from 'react';
import { PlayerData, SectData } from '../types/sect';
import { SECT_CREATION_CONFIG } from '../data/cultivationConstants';
import { Sparkles, Shield, Coins, X, AlertTriangle, CheckCircle2, Flame } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  player: PlayerData;
  onConfirmCreate: (sectName: string, slogan: string) => void;
}

export const SectCreateModal: React.FC<Props> = ({
  isOpen,
  onClose,
  player,
  onConfirmCreate,
}) => {
  const [name, setName] = useState('');
  const [slogan, setSlogan] = useState('');
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isRealmEnough = player.realmIndex >= SECT_CREATION_CONFIG.minRealmIndex;
  const isStonesEnough = player.spiritStones >= SECT_CREATION_CONFIG.requiredSpiritStones;
  const canCreate = isRealmEnough && isStonesEnough;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError('Vui lòng nhập tên Tông Môn!');
      return;
    }
    if (name.trim().length < 3 || name.trim().length > 30) {
      setError('Tên Tông Môn phải từ 3 đến 30 ký tự!');
      return;
    }
    if (!canCreate) {
      setError('Đạo hữu chưa thỏa mãn đủ điều kiện khai tông lập phái!');
      return;
    }

    onConfirmCreate(name.trim(), slogan.trim());
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-2xl border border-stone-800 bg-[#121722] p-6 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-200 p-1 rounded-lg hover:bg-stone-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 mb-5">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-600 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-950/60 ring-1 ring-amber-400/40">
            <Flame className="w-5 h-5 text-amber-100" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-stone-100">Khai Tông Lập Phái</h2>
            <p className="text-xs text-stone-400">Sáng lập Tông Môn mới, chiêu mộ đệ tử & sẵn sàng PK Tông Môn Chiến</p>
          </div>
        </div>

        {/* Requirements Checklist */}
        <div className="mb-5 p-4 rounded-xl border border-stone-800/80 bg-stone-900/60 space-y-2.5">
          <h4 className="text-xs font-semibold text-stone-300 uppercase tracking-wider">
            Điều Kiện Khai Sơn Lập Phái:
          </h4>
          
          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              {isRealmEnough ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="text-stone-300">
                Cảnh giới tối thiểu: <span className="font-semibold text-cyan-300">【{SECT_CREATION_CONFIG.minRealmName} Kỳ】</span>
              </span>
            </div>
            <span className={`font-mono ${isRealmEnough ? 'text-emerald-400 font-medium' : 'text-rose-400'}`}>
              {player.realm} ({isRealmEnough ? 'Đạt' : 'Chưa đạt'})
            </span>
          </div>

          <div className="flex items-center justify-between text-xs">
            <div className="flex items-center space-x-2">
              {isStonesEnough ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span className="text-stone-300">
                Chi phí lập phái: <span className="font-semibold text-amber-300">{SECT_CREATION_CONFIG.requiredSpiritStones.toLocaleString()} Linh Thạch</span>
              </span>
            </div>
            <span className={`font-mono ${isStonesEnough ? 'text-emerald-400 font-medium' : 'text-rose-400'}`}>
              {player.spiritStones.toLocaleString()} ({isStonesEnough ? 'Đủ' : 'Thiếu'})
            </span>
          </div>

          <p className="text-[11px] text-stone-400 pt-1 border-t border-stone-800/60">
            * 20% Linh Thạch sẽ tự động chuyển vào Ngân Khố Tông Môn ban đầu. Hộ Sơn Trận Pháp sẽ được kích hoạt ở Cấp 1 (10,000 HP).
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-rose-950/50 border border-rose-800/80 text-rose-300 text-xs flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Creation Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">
              Tên Tông Môn <span className="text-rose-400">*</span>
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Ví dụ: Vạn Kiếm Tông, Tiêu Dao Cốc, Ma Hoàng Điện..."
              className="w-full px-3.5 py-2.5 rounded-lg bg-stone-950 border border-stone-700 text-stone-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-stone-600"
              maxLength={30}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-300 mb-1">
              Tông Quy / Khẩu Hiệu Tông Môn
            </label>
            <textarea
              value={slogan}
              onChange={e => setSlogan(e.target.value)}
              placeholder="Nhập tôn chỉ hoặc khẩu hiệu của tông môn..."
              rows={2}
              className="w-full px-3.5 py-2 rounded-lg bg-stone-950 border border-stone-700 text-stone-100 text-sm focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all placeholder:text-stone-600 resize-none"
              maxLength={100}
            />
          </div>

          <div className="flex items-center justify-end space-x-3 pt-3 border-t border-stone-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg bg-stone-800 hover:bg-stone-700 text-stone-300 text-xs font-medium transition-colors"
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              disabled={!canCreate}
              className={`px-5 py-2 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
                canCreate
                  ? 'bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white shadow-lg shadow-amber-950/50 cursor-pointer'
                  : 'bg-stone-800 text-stone-500 cursor-not-allowed border border-stone-700/50'
              }`}
            >
              <Sparkles className="w-4 h-4" />
              <span>Xác Nhận Khai Tông</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
