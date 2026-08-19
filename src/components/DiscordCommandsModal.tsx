import React, { useState } from 'react';
import { DISCORD_PREFIX_COMMANDS_CODE } from '../data/discordBotCode';
import { Terminal, Copy, Check, X, BookOpen, Code2 } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export const DiscordCommandsModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'commands' | 'code'>('commands');

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(DISCORD_PREFIX_COMMANDS_CODE);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const COMMAND_LIST = [
    {
      cmd: '-tongmon',
      desc: 'Hiển thị bảng hướng dẫn & toàn bộ danh sách lệnh quản lý tông môn.',
      role: 'Tất cả'
    },
    {
      cmd: '-tongmon tao <tên> [khẩu hiệu]',
      desc: 'Khai sơn lập phái, sáng lập Tông Môn mới. (Yêu cầu: Kim Đan Kỳ & 5,000 Linh Thạch).',
      role: 'Tán Tu (Đủ điều kiện)'
    },
    {
      cmd: '-tongmon thongtin [tên]',
      desc: 'Xem chi tiết Tông Môn: Tông Chủ, Cấp độ, Hộ Sơn Trận Pháp, Ngân Khố, Điểm PK.',
      role: 'Tất cả'
    },
    {
      cmd: '-tongmon donggop <số lượng>',
      desc: 'Đóng góp Linh Thạch từ túi đồ vào Ngân Khố để phát triển Tông Môn.',
      role: 'Thành viên Tông Môn'
    },
    {
      cmd: '-tongmon nangcap',
      desc: 'Dùng Linh Thạch trong Ngân Khố để nâng cấp Hộ Sơn Trận Pháp phòng ngự PK.',
      role: 'Tông Chủ / Phó Tông Chủ'
    },
    {
      cmd: '-tongmon tuyenchien <tên địch>',
      desc: 'Phát hịch tuyên chiến với Tông Môn khác để bắt đầu trạng thái PK Tông Môn Chiến.',
      role: 'Tông Chủ / Phó Tông Chủ'
    },
    {
      cmd: '-tongmon tapkich',
      desc: 'Đệ tử tham gia oanh kích Hộ Sơn Trận Pháp đối thủ. Phá hủy trận pháp để cướp 20% Linh Thạch & đoạt điểm PK.',
      role: 'Thành viên phe tuyên chiến'
    },
    {
      cmd: '-tongmon bxh',
      desc: 'Xem Bảng Xếp Hạng Điểm Chiến Công PK và thành tích của các thế lực tu chân.',
      role: 'Tất cả'
    }
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
      <div className="w-full max-w-3xl rounded-2xl border border-stone-800 bg-[#121722] shadow-2xl p-6 relative flex flex-col max-h-[90vh]">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-stone-400 hover:text-stone-200 p-1.5 rounded-lg hover:bg-stone-800 transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Header */}
        <div className="flex items-center space-x-3 pb-4 mb-4 border-b border-stone-800">
          <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 font-mono font-bold text-lg">
            -
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-stone-100 text-base">Bộ Lệnh Prefix: <span className="text-amber-400 font-mono">-tongmon</span></h3>
              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-950/80 border border-amber-800 text-amber-300 font-mono">Tiền tố: -</span>
            </div>
            <p className="text-xs text-stone-400">Danh sách lệnh prefix dạng tin nhắn cho Discord Bot Tu Tiên</p>
          </div>
        </div>

        {/* Tabs Switcher */}
        <div className="flex items-center space-x-2 mb-4">
          <button
            onClick={() => setActiveTab('commands')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeTab === 'commands'
                ? 'bg-amber-500/20 border border-amber-500 text-amber-300'
                : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Danh Sách Lệnh Prefix (-)</span>
          </button>
          <button
            onClick={() => setActiveTab('code')}
            className={`px-4 py-1.5 rounded-lg text-xs font-semibold flex items-center space-x-1.5 transition-all ${
              activeTab === 'code'
                ? 'bg-amber-500/20 border border-amber-500 text-amber-300'
                : 'bg-stone-900 border border-stone-800 text-stone-400 hover:text-stone-200'
            }`}
          >
            <Code2 className="w-3.5 h-3.5" />
            <span>Mã Nguồn Handler (commands/tongmon.ts)</span>
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto pr-1">
          {activeTab === 'commands' ? (
            <div className="space-y-2.5">
              {COMMAND_LIST.map((item, idx) => (
                <div key={idx} className="p-3.5 rounded-xl border border-stone-800 bg-stone-900/60 text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-amber-300 bg-stone-950 px-2.5 py-1 rounded border border-stone-800">
                      {item.cmd}
                    </span>
                    <span className="text-[10px] px-2 py-0.5 rounded bg-stone-800 text-stone-300 font-medium">
                      {item.role}
                    </span>
                  </div>
                  <p className="text-stone-400 leading-relaxed pt-1">
                    {item.desc}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="relative">
              <div className="flex justify-between items-center bg-stone-950 px-4 py-2 rounded-t-xl border border-stone-800 text-xs font-mono text-stone-400">
                <span>src/commands/tongmon.ts</span>
                <button
                  onClick={handleCopy}
                  className="flex items-center space-x-1 text-amber-400 hover:text-amber-300 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Đã sao chép!' : 'Sao chép mã'}</span>
                </button>
              </div>
              <pre className="p-4 bg-[#0a0d13] border border-t-0 border-stone-800 rounded-b-xl text-[11px] font-mono text-stone-300 overflow-x-auto max-h-[50vh] leading-relaxed">
                {DISCORD_PREFIX_COMMANDS_CODE}
              </pre>
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
