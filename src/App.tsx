import React, { useState } from 'react';
import { PlayerData, SectData, SectWarData } from './types/sect';
import { INITIAL_TEST_PLAYER, INITIAL_SECTS, SECT_CREATION_CONFIG } from './data/cultivationConstants';
import { SectManager } from './services/sectManager';
import { PlayerProfileBar } from './components/PlayerProfileBar';
import { SectOverview } from './components/SectOverview';
import { SectCreateModal } from './components/SectCreateModal';
import { SectPKWarZone } from './components/SectPKWarZone';
import { SectLeaderboard } from './components/SectLeaderboard';
import { DiscordCommandsModal } from './components/DiscordCommandsModal';
import { 
  Building2, 
  Sword, 
  Sparkles, 
  GitBranch, 
  Terminal, 
  Flame, 
  Shield, 
  Coins, 
  CheckCircle2, 
  AlertTriangle,
  BookOpen,
  Users
} from 'lucide-react';

export default function App() {
  const [player, setPlayer] = useState<PlayerData>(INITIAL_TEST_PLAYER);
  const [sects, setSects] = useState<SectData[]>(INITIAL_SECTS);
  const [currentWar, setCurrentWar] = useState<SectWarData | null>(null);

  // Modals state
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isWarZoneOpen, setIsWarZoneOpen] = useState(false);
  const [isDiscordCommandsOpen, setIsDiscordCommandsOpen] = useState(false);

  // Toast notification
  const [toastMessage, setToastMessage] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'info') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Find player's sect
  const mySect = sects.find(s => s.id === player.sectId) || null;

  // Handle Create Sect
  const handleConfirmCreateSect = (sectName: string, slogan: string) => {
    const result = SectManager.createSect(player, sectName, slogan, sects);
    if (!result.success || !result.data) {
      showToast(result.message, 'error');
      return;
    }

    const { newSect, updatedPlayer } = result.data;
    setSects(prev => [newSect, ...prev]);
    setPlayer(updatedPlayer);
    showToast(result.message, 'success');
  };

  // Handle Donate Spirit Stones
  const handleDonate = (amount: number) => {
    if (!mySect) return;
    const result = SectManager.donateSpiritStones(player, mySect, amount);
    if (!result.success || !result.data) {
      showToast(result.message, 'error');
      return;
    }

    const { updatedSect, updatedPlayer } = result.data;
    setSects(prev => prev.map(s => (s.id === updatedSect.id ? updatedSect : s)));
    setPlayer(updatedPlayer);
    showToast(result.message, 'success');
  };

  // Handle Upgrade Formation
  const handleUpgradeFormation = () => {
    if (!mySect || !player.sectRole) return;
    const result = SectManager.upgradeFormation(mySect, player.sectRole);
    if (!result.success || !result.data) {
      showToast(result.message, 'error');
      return;
    }

    const updatedSect = result.data;
    setSects(prev => prev.map(s => (s.id === updatedSect.id ? updatedSect : s)));
    showToast(result.message, 'success');
  };

  // Handle Declare War
  const handleDeclareWar = (targetSectId: string) => {
    if (!mySect || !player.sectRole) return;
    const targetSect = sects.find(s => s.id === targetSectId);
    if (!targetSect) return;

    const result = SectManager.declareWar(mySect, targetSect, player.sectRole);
    if (!result.success || !result.data) {
      showToast(result.message, 'error');
      return;
    }

    const { updatedAttacker, updatedDefender, war } = result.data;
    setSects(prev =>
      prev.map(s => {
        if (s.id === updatedAttacker.id) return updatedAttacker;
        if (s.id === updatedDefender.id) return updatedDefender;
        return s;
      })
    );
    setCurrentWar(war);
    showToast(result.message, 'success');
  };

  // Handle Attack Formation in Sect War
  const handleAttackFormation = () => {
    if (!mySect || !currentWar) return;
    const defenderSect = sects.find(s => s.id === currentWar.defenderSectId);
    if (!defenderSect) return;

    const result = SectManager.attackSectFormation(player, mySect, defenderSect, currentWar);
    if (!result.success || !result.data) {
      showToast(result.message, 'error');
      return;
    }

    const { updatedAttacker, updatedDefender, updatedWar, isDestroyed } = result.data;
    setSects(prev =>
      prev.map(s => {
        if (s.id === updatedAttacker.id) return updatedAttacker;
        if (s.id === updatedDefender.id) return updatedDefender;
        return s;
      })
    );
    setCurrentWar(updatedWar);

    if (isDestroyed) {
      showToast('🔥 Hộ Sơn Trận Pháp của đối thủ đã sụp đổ! Tông môn của bạn đã giành chiến thắng vang dội!', 'success');
    }
  };

  return (
    <div id="tu-tien-app" className="min-h-screen bg-[#0c1017] text-stone-200 flex flex-col font-sans selection:bg-rose-900 selection:text-rose-100">
      
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-50 animate-in fade-in slide-in-from-top-4 duration-300">
          <div className={`p-4 rounded-xl border shadow-2xl flex items-center space-x-3 text-xs max-w-md ${
            toastMessage.type === 'success'
              ? 'bg-emerald-950/90 border-emerald-600 text-emerald-100'
              : toastMessage.type === 'error'
              ? 'bg-rose-950/90 border-rose-600 text-rose-100'
              : 'bg-stone-900/90 border-cyan-700 text-stone-100'
          }`}>
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            ) : toastMessage.type === 'error' ? (
              <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            ) : (
              <Sparkles className="w-5 h-5 text-cyan-400 shrink-0" />
            )}
            <span className="leading-relaxed">{toastMessage.text}</span>
          </div>
        </div>
      )}

      {/* Header Bar */}
      <header id="main-header" className="border-b border-stone-800/80 bg-[#101520]/90 backdrop-blur-md sticky top-0 z-30 px-4 lg:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-600 to-rose-600 flex items-center justify-center shadow-lg shadow-amber-950/50 ring-1 ring-amber-400/30">
            <Building2 className="w-5 h-5 text-amber-100" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="font-semibold text-lg tracking-wide text-stone-100">Hệ Thống Tông Môn & PK</h1>
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-rose-950/80 text-rose-300 border border-rose-800/60 font-mono">
                Discord Bot Tu Tiên
              </span>
            </div>
            <p className="text-xs text-stone-400">Khai sơn lập phái • Hộ sơn trận pháp • Tông môn chiến PK</p>
          </div>
        </div>

        {/* Right Header Actions: Discord Commands & GitHub info */}
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsDiscordCommandsOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-stone-900 hover:bg-stone-800 border border-cyan-800/60 text-cyan-300 text-xs font-medium flex items-center space-x-1.5 transition-all shadow-sm"
          >
            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
            <span className="hidden sm:inline">Lệnh Discord Bot</span>
          </button>

          <div className="hidden md:flex items-center space-x-2 bg-stone-900/90 border border-stone-800 rounded-lg px-3 py-1.5 text-xs text-stone-300">
            <GitBranch className="w-3.5 h-3.5 text-emerald-400" />
            <span className="font-mono text-stone-300">Befindnd/Tu-Ti-n</span>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        
        {/* Banner: Explain New Tông Môn System */}
        <div className="rounded-xl border border-amber-800/40 bg-gradient-to-r from-amber-950/30 via-stone-900/60 to-rose-950/30 p-4 sm:p-5 shadow-lg">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start space-x-3">
              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-300 mt-0.5 sm:mt-0">
                <Flame className="w-5 h-5 text-amber-400" />
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-bold text-stone-100">
                  Hệ Thống Tông Môn Mới (Đã Sẵn Sàng PK Tông Môn Chiến)
                </h2>
                <p className="text-xs text-stone-400 mt-0.5 leading-relaxed">
                  Người chơi đạt cảnh giới tối thiểu <span className="text-cyan-300 font-semibold">【{SECT_CREATION_CONFIG.minRealmName} Kỳ】</span> và tích lũy đủ <span className="text-amber-300 font-semibold">{SECT_CREATION_CONFIG.requiredSpiritStones.toLocaleString()} Linh Thạch</span> có thể khai sơn lập phái, nâng cấp Hộ Sơn Trận Pháp, phát hịch tuyên chiến và tham gia Tông Môn PK Chiến đoạt tài nguyên!
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Player Profile & Sandbox bar */}
        <PlayerProfileBar
          player={player}
          onUpdatePlayer={setPlayer}
          onCreateSectClick={() => setIsCreateModalOpen(true)}
        />

        {/* Main Content View: Sect Overview or No-Sect Hub */}
        {mySect ? (
          <SectOverview
            sect={mySect}
            player={player}
            onDonate={handleDonate}
            onUpgradeFormation={handleUpgradeFormation}
            onOpenWarZone={() => setIsWarZoneOpen(true)}
          />
        ) : (
          <div className="rounded-2xl border border-stone-800 bg-[#121722] p-8 text-center shadow-xl space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 mx-auto">
              <Building2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-stone-100">Đạo hữu hiện là Tán Tu (Chưa vào Tông Môn)</h3>
              <p className="text-xs text-stone-400 max-w-md mx-auto mt-1 leading-relaxed">
                Đạo hữu có thể dùng Linh Thạch để tự Khai Sơn Lập Phái (Yêu cầu cảnh giới {SECT_CREATION_CONFIG.minRealmName} Kỳ) hoặc gia nhập các tông môn danh tiếng dưới đây.
              </p>
            </div>

            <div className="pt-2">
              <button
                onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-600 to-rose-600 hover:from-amber-500 hover:to-rose-500 text-white font-bold text-xs shadow-lg shadow-amber-950/60 transition-all cursor-pointer"
              >
                Khai Sơn Lập Phái Ngay
              </button>
            </div>
          </div>
        )}

        {/* Sect Leaderboard Component */}
        <SectLeaderboard sects={sects} />

      </main>

      {/* Modals */}
      <SectCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        player={player}
        onConfirmCreate={handleConfirmCreateSect}
      />

      {mySect && isWarZoneOpen && (
        <SectPKWarZone
          mySect={mySect}
          allSects={sects}
          player={player}
          currentWar={currentWar}
          onDeclareWar={handleDeclareWar}
          onAttackFormation={handleAttackFormation}
          onClose={() => setIsWarZoneOpen(false)}
        />
      )}

      <DiscordCommandsModal
        isOpen={isDiscordCommandsOpen}
        onClose={() => setIsDiscordCommandsOpen(false)}
      />

      {/* Footer */}
      <footer className="border-t border-stone-900 py-4 text-center text-xs text-stone-500 bg-[#0a0d13]">
        <span>Hệ Thống Tông Môn PK Discord Bot Tu Tiên</span> • <span>Kho lưu trữ: Befindnd/Tu-Ti-n</span>
      </footer>
    </div>
  );
}
