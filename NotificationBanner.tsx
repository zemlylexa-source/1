import React, { useEffect } from 'react';
import { Phone, PhoneOff, Video, MessageSquare, Mic, X, Volume2 } from 'lucide-react';
import { ZentoraNotification } from '../types';

interface NotificationBannerProps {
  notification: ZentoraNotification | null;
  onOpen: (notif: ZentoraNotification) => void;
  onAcceptCall: (notif: ZentoraNotification) => void;
  onDeclineCall: (notif: ZentoraNotification) => void;
  onClose: () => void;
}

export function NotificationBanner({
  notification,
  onOpen,
  onAcceptCall,
  onDeclineCall,
  onClose
}: NotificationBannerProps) {
  useEffect(() => {
    if (!notification) return;

    // Auto-dismiss text and voice messages after 6.5 seconds
    if (notification.type !== 'call') {
      const timer = setTimeout(() => {
        onClose();
      }, 6500);
      return () => clearTimeout(timer);
    }
  }, [notification, onClose]);

  if (!notification) return null;

  const isCall = notification.type === 'call';
  const isVoice = notification.type === 'voice';

  return (
    <div className="absolute top-3 inset-x-3 sm:inset-x-6 z-[300] max-w-[440px] mx-auto select-none pointer-events-auto animate-in slide-in-from-top-4 fade-in duration-300">
      <div 
        onClick={() => {
          if (!isCall) {
            onOpen(notification);
          }
        }}
        className={`bg-[#182229]/95 backdrop-blur-xl border ${
          isCall ? 'border-emerald-500/50 shadow-[0_12px_35px_rgba(0,168,132,0.35)]' : 'border-[#2A3942] shadow-[0_10px_30px_rgba(0,0,0,0.6)]'
        } rounded-2xl p-3 sm:p-3.5 text-white flex items-center gap-3.5 cursor-pointer hover:bg-[#202C33]/95 transition-all`}
      >
        {/* Avatar with status indicator */}
        <div className="relative flex-shrink-0">
          <img 
            src={notification.sender.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(notification.sender.name)}&background=202C33&color=E9EDEF`} 
            alt={notification.sender.name}
            className={`w-12 h-12 rounded-full object-cover border-2 ${
              isCall ? 'border-[#00A884] animate-pulse' : 'border-[#202C33]'
            }`}
          />
          <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] shadow ${
            isCall ? 'bg-[#00A884]' : isVoice ? 'bg-[#00A884]' : 'bg-[#00A884]'
          }`}>
            {isCall ? (
              notification.isVideoCall ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />
            ) : isVoice ? (
              <Mic className="w-3 h-3" />
            ) : (
              <MessageSquare className="w-3 h-3" />
            )}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-1">
          <div className="flex items-center justify-between gap-1 mb-0.5">
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="font-semibold text-[15px] text-[#E9EDEF] truncate">
                {notification.sender.name}
              </span>
              <span className="text-[10px] bg-[#202C33] text-[#8696A0] px-1.5 py-0.2 rounded font-medium">
                Zentora
              </span>
            </div>
            <span className="text-[11px] text-[#8696A0] font-mono flex-shrink-0">
              {notification.time}
            </span>
          </div>

          {isCall ? (
            <div className="flex items-center gap-1.5 text-emerald-400 text-[13px] font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping"></span>
              <span>{notification.isVideoCall ? 'Входящий видеозвонок...' : 'Входящий аудиозвонок...'}</span>
            </div>
          ) : isVoice ? (
            <div className="flex items-center gap-2 text-[#00A884] text-[13px] font-medium">
              <div className="flex items-center gap-0.5 h-3">
                <span className="w-0.5 h-2 bg-[#00A884] animate-pulse"></span>
                <span className="w-0.5 h-3 bg-[#00A884] animate-pulse delay-75"></span>
                <span className="w-0.5 h-1.5 bg-[#00A884] animate-pulse delay-150"></span>
                <span className="w-0.5 h-2.5 bg-[#00A884] animate-pulse delay-100"></span>
              </div>
              <span className="text-[#E9EDEF]">
                Голосовое сообщение ({notification.voiceDuration || '0:12'})
              </span>
            </div>
          ) : (
            <p className="text-[13px] text-[#8696A0] truncate leading-tight">
              {notification.preview}
            </p>
          )}
        </div>

        {/* Action Controls */}
        {isCall ? (
          <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
            {/* Decline Call */}
            <button 
              onClick={() => onDeclineCall(notification)}
              title="Отклонить звонок"
              className="w-10 h-10 rounded-full bg-red-500/20 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/40 flex items-center justify-center transition-all active:scale-90"
            >
              <PhoneOff className="w-5 h-5" />
            </button>
            {/* Accept Call */}
            <button 
              onClick={() => onAcceptCall(notification)}
              title="Принять звонок"
              className="w-10 h-10 rounded-full bg-[#00A884] hover:bg-[#00b890] text-white flex items-center justify-center transition-all active:scale-90 shadow-lg shadow-[#00A884]/30 animate-pulse"
            >
              <Phone className="w-5 h-5 fill-white" />
            </button>
          </div>
        ) : (
          <button 
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            title="Закрыть"
            className="p-1.5 text-[#8696A0] hover:text-[#E9EDEF] rounded-full hover:bg-white/5 transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
