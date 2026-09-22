import React, { useState, useEffect, useRef } from 'react';
import { 
  Key, Lock, ShieldAlert, MonitorSmartphone, Bell, Volume2, 
  User, Users, Megaphone, Heart, Smartphone, Laptop, QrCode, Check, RefreshCw, 
  HelpCircle, ChevronRight, MessageSquare, Mic, Video, VideoOff,
  Globe, Trash2, Edit2, Copy, CheckCircle2,
  Sparkles, Folder, Plus, ArrowUpDown, Download, CheckSquare, Square,
  Clock, Mail, UserX, Camera, VolumeX, PhoneCall, Phone
} from 'lucide-react';
import { User as UserType, Chat as ChatType } from '../types';
import { THEMES, WALLPAPERS, ThemeId, WallpaperId } from '../utils/themeAndI18n';
import { playToneSample } from '../utils/sounds';

export interface SubviewProps {
  userProfile: UserType & { email?: string; bio?: string; phone?: string };
  setUserProfile: React.Dispatch<React.SetStateAction<any>>;
  toggles: Record<string, boolean>;
  toggleSetting: (key: string) => void;
  prefs: Record<string, string>;
  cyclePref: (key: string, opts: string[]) => void;
  setPrefs?: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  showToast: (msg: string) => void;
  onTestNotification?: (type: 'message' | 'voice' | 'call') => void;
  onRequestBrowserNotification?: () => void;
  browserNotifStatus?: NotificationPermission;
  onContactSupport?: () => void;
  folders?: { id: string; name: string; chatIds?: string[] }[];
  setFolders?: React.Dispatch<React.SetStateAction<{ id: string; name: string; chatIds?: string[] }[]>>;
  chats?: ChatType[];
}

export function SettingSection({ title, footer, children }: { title?: string; footer?: string; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      {title && <h3 className="px-4 py-1.5 text-[13px] font-semibold text-[#00A884] uppercase tracking-wider">{title}</h3>}
      <div className="bg-[#111B21] border-y border-[#202C33] divide-y divide-[#202C33] overflow-hidden">
        {children}
      </div>
      {footer && <p className="px-4 py-2 text-[12px] text-[#8696A0] leading-relaxed">{footer}</p>}
    </div>
  );
}

export function SettingItem({ 
  icon, 
  label, 
  subLabel, 
  value, 
  type = 'chevron', 
  checked, 
  onChange, 
  onClick 
}: { 
  key?: React.Key;
  icon?: React.ReactNode; 
  label: string; 
  subLabel?: string; 
  value?: React.ReactNode; 
  type?: 'chevron' | 'toggle' | 'value' | 'custom'; 
  checked?: boolean; 
  onChange?: () => void; 
  onClick?: () => void;
}) {
  return (
    <div 
      className={`flex items-center justify-between px-4 py-3 min-h-[50px] transition-colors ${
        onClick ? 'cursor-pointer hover:bg-[#202C33]/60 active:bg-[#202C33]' : ''
      }`}
      onClick={onClick}
    >
      <div className="flex items-center gap-3.5 flex-1 min-w-0 pr-2">
        {icon && <div className="text-[#8696A0] flex-shrink-0">{icon}</div>}
        <div className="flex flex-col min-w-0">
          <span className="text-[#E9EDEF] text-[15px] truncate font-normal">{label}</span>
          {subLabel && <span className="text-[#8696A0] text-[12px] mt-0.5 leading-tight">{subLabel}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        {value !== undefined && (
          <span className={`text-[14px] ${['Выкл.', 'Выкл', 'Никто'].includes(String(value)) ? 'text-[#8696A0]' : 'text-[#00A884]'}`}>
            {value}
          </span>
        )}
        {type === 'chevron' && <ChevronRight className="w-5 h-5 text-[#8696A0]" />}
        {type === 'toggle' && (
          <button 
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange?.();
            }}
            className={`w-11 h-6 rounded-full transition-colors relative flex items-center px-0.5 ${
              checked ? 'bg-[#00A884]' : 'bg-[#374248]'
            }`}
          >
            <div className={`w-5 h-5 rounded-full bg-white transition-transform ${
              checked ? 'translate-x-5' : 'translate-x-0'
            }`} />
          </button>
        )}
      </div>
    </div>
  );
}

// --- 1. ACCOUNT SETTINGS VIEW ---
export function AccountSettingsView({ userProfile, setUserProfile, showToast }: SubviewProps) {
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const presetAvatars = [
    'https://i.pravatar.cc/150?u=alexey',
    'https://i.pravatar.cc/150?u=tech_guru',
    'https://i.pravatar.cc/150?u=cyber_agent',
    'https://i.pravatar.cc/150?u=nordic_star',
    'https://i.pravatar.cc/150?u=masha',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
  ];

  const promptEdit = (field: string, title: string, currentVal: string = '') => {
    const res = window.prompt(title, currentVal);
    if (res !== null && res.trim() !== '') {
      setUserProfile((prev: any) => ({ ...prev, [field]: res.trim() }));
      showToast('Данные профиля обновлены');
    }
  };

  return (
    <div className="w-full pb-8 animate-in fade-in duration-150">
      {/* Profile Overview Card */}
      <div className="bg-[#111B21] p-5 border-b border-[#202C33] flex flex-col items-center text-center">
        <div className="relative group cursor-pointer" onClick={() => setShowAvatarPicker(!showAvatarPicker)}>
          <img 
            src={userProfile.avatar} 
            alt={userProfile.name}
            className="w-24 h-24 rounded-full object-cover border-2 border-[#00A884] shadow-xl"
          />
          <div className="absolute inset-0 bg-black/40 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Edit2 className="w-6 h-6 text-white" />
          </div>
        </div>
        
        {/* Quick avatar selection */}
        {showAvatarPicker && (
          <div className="mt-4 p-3 bg-[#182229] border border-[#202C33] rounded-2xl animate-in zoom-in-95 duration-150">
            <span className="text-xs text-[#8696A0] mb-2 block font-medium">Выберите аватар или укажите ссылку:</span>
            <div className="flex gap-2 justify-center mb-3">
              {presetAvatars.map((url, idx) => (
                <img 
                  key={idx}
                  src={url}
                  onClick={() => {
                    setUserProfile((prev: any) => ({ ...prev, avatar: url }));
                    setShowAvatarPicker(false);
                    showToast('Аватар обновлён');
                  }}
                  className={`w-10 h-10 rounded-full object-cover cursor-pointer hover:scale-110 active:scale-95 transition-transform border-2 ${
                    userProfile.avatar === url ? 'border-[#00A884]' : 'border-transparent'
                  }`}
                />
              ))}
            </div>
            <button 
              onClick={() => {
                promptEdit('avatar', 'Введите ссылку на изображение (URL):', userProfile.avatar);
                setShowAvatarPicker(false);
              }}
              className="text-xs text-[#00A884] hover:underline"
            >
              Ввести свой URL картинки...
            </button>
          </div>
        )}

        <h2 className="text-xl font-semibold text-white mt-3 flex items-center gap-1.5">
          {userProfile.name}
          <CheckCircle2 className="w-4 h-4 text-[#00A884]" fill="currentColor" />
        </h2>
        <p className="text-[14px] text-[#00A884] font-mono mt-0.5">{userProfile.username}</p>
        <p className="text-[13px] text-[#8696A0] mt-1 max-w-[280px]">{userProfile.bio || 'Привет! Использую Zentora для связи'}</p>
      </div>

      <SettingSection title="Учётная запись">
        <SettingItem 
          label="Номер телефона" 
          value={userProfile.phone || '+7 999 123-45-67'} 
          subLabel="Нажмите, чтобы изменить номер"
          onClick={() => promptEdit('phone', 'Введите новый номер телефона:', userProfile.phone || '+7 999 123-45-67')} 
        />
        <SettingItem 
          label="Имя пользователя" 
          value={userProfile.username} 
          subLabel="Нажмите, чтобы изменить username"
          onClick={() => promptEdit('username', 'Введите новый username (без @):', userProfile.username?.replace('@', ''))} 
        />
        <SettingItem 
          label="Имя" 
          value={userProfile.name} 
          onClick={() => promptEdit('name', 'Введите ваше имя:', userProfile.name)} 
        />
        <SettingItem 
          label="О себе (Bio)" 
          value={userProfile.bio ? 'Заполнено' : 'Не указано'} 
          subLabel={userProfile.bio || 'Краткая информация в профиле'}
          onClick={() => promptEdit('bio', 'Введите информацию о себе:', userProfile.bio || '')} 
        />
        <SettingItem 
          label="Электронная почта" 
          value={userProfile.email || 'alexey@zentora.im'} 
          onClick={() => promptEdit('email', 'Введите email для восстановления:', userProfile.email || 'alexey@zentora.im')} 
        />
      </SettingSection>

      <SettingSection title="Действия с аккаунтом">
        <SettingItem 
          label="Удалить аккаунт" 
          subLabel="Безвозвратное удаление всех данных Zentora"
          onClick={() => {
            if (window.confirm('Вы уверены, что хотите удалить аккаунт Zentora? Все переписки будут стёрты.')) {
              localStorage.clear();
              window.location.reload();
            }
          }}
          type="value"
          value={<span className="text-red-400 font-medium text-xs">Удалить</span>}
        />
      </SettingSection>
    </div>
  );
}

// --- 2. PRIVACY SETTINGS VIEW ---
export function PrivacySettingsView({ prefs, cyclePref, toggles, toggleSetting, showToast }: SubviewProps) {
  const [blockedUsers, setBlockedUsers] = useState(['Спам-бот @promo_99', 'Рекламный канал']);

  const handleCycle = (key: string, opts: string[]) => {
    cyclePref(key, opts);
    showToast('Параметр приватности обновлён');
  };

  const unblock = (user: string) => {
    setBlockedUsers(prev => prev.filter(u => u !== user));
    showToast(`${user} разблокирован`);
  };

  return (
    <div className="w-full pb-8 animate-in fade-in duration-150">
      <SettingSection title="Кто видит мои данные" footer="Эти настройки определяют, кто может видеть ваши персональные данные в Zentora.">
        <SettingItem 
          label="Номер телефона" 
          value={prefs.phone_visibility || 'Мои контакты'} 
          onClick={() => handleCycle('phone_visibility', ['Все', 'Мои контакты', 'Никто'])} 
        />
        <SettingItem 
          label="Время захода и статус «в сети»" 
          value={prefs.last_seen || 'Все'} 
          onClick={() => handleCycle('last_seen', ['Все', 'Мои контакты', 'Никто'])} 
        />
        <SettingItem 
          label="Фотографии профиля" 
          value={prefs.profile_photos || 'Все'} 
          onClick={() => handleCycle('profile_photos', ['Все', 'Мои контакты', 'Никто'])} 
        />
        <SettingItem 
          label="Пересылка сообщений" 
          subLabel="Ссылка на профиль при пересылке"
          value={prefs.forwarded_msgs || 'Все'} 
          onClick={() => handleCycle('forwarded_msgs', ['Все', 'Мои контакты', 'Никто'])} 
        />
        <SettingItem 
          label="Кто может звонить" 
          value={prefs.calls_privacy || 'Все'} 
          onClick={() => handleCycle('calls_privacy', ['Все', 'Мои контакты', 'Никто'])} 
        />
        <SettingItem 
          label="Голосовые сообщения" 
          subLabel="Кто может отправлять мне голосовые"
          value={prefs.voice_msgs || 'Все'} 
          onClick={() => handleCycle('voice_msgs', ['Все', 'Мои контакты', 'Никто'])} 
        />
      </SettingSection>

      <SettingSection title="Автоудаление сообщений" footer="Новые сообщения в создаваемых чатах будут автоматически удаляться по истечении времени.">
        <SettingItem 
          label="Таймер автоудаления" 
          value={prefs.auto_delete || 'Выкл.'} 
          icon={<Clock className="w-5 h-5" />}
          onClick={() => handleCycle('auto_delete', ['Выкл.', '1 день', '1 неделя', '1 месяц'])} 
        />
      </SettingSection>

      <SettingSection title="Удаление аккаунта при неактивности" footer="Если вы не зайдёте в Zentora хотя бы один раз за этот период, ваш аккаунт будет очищен.">
        <SettingItem 
          label="Период неактивности" 
          value={prefs.delete_account || '18 месяцев'} 
          onClick={() => handleCycle('delete_account', ['1 месяц', '3 месяца', '6 месяцев', '1 год', '18 месяцев'])} 
        />
      </SettingSection>

      <SettingSection title="Черный список">
        {blockedUsers.length > 0 ? (
          blockedUsers.map((u, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-3 hover:bg-[#202C33]/50">
              <div className="flex items-center gap-2.5">
                <UserX className="w-4 h-4 text-red-400" />
                <span className="text-sm text-white">{u}</span>
              </div>
              <button 
                onClick={() => unblock(u)}
                className="text-xs text-[#00A884] hover:underline"
              >
                Разблокировать
              </button>
            </div>
          ))
        ) : (
          <div className="px-4 py-4 text-sm text-[#8696A0]">Нет заблокированных пользователей</div>
        )}
      </SettingSection>
    </div>
  );
}

// --- 3. SECURITY & 2FA SETTINGS VIEW ---
export function SecuritySettingsView({ toggles, toggleSetting, prefs, cyclePref, showToast }: SubviewProps) {
  const [cloudPassword, setCloudPassword] = useState('••••••••');
  const [passwordHint, setPasswordHint] = useState('Первая машина');

  return (
    <div className="w-full pb-8 animate-in fade-in duration-150">
      <div className="flex flex-col items-center py-6 px-4 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-[#00A884] mb-3">
          <ShieldAlert className="w-9 h-9" />
        </div>
        <h2 className="text-lg font-semibold text-white">Двухэтапная аутентификация (2FA)</h2>
        <p className="text-[#8696A0] text-xs max-w-[300px] mt-1">
          Дополнительный уровень защиты аккаунта: при входе с нового устройства потребуется пароль.
        </p>
      </div>

      <SettingSection title="Облачный пароль" footer="Этот пароль будет запрашиваться при входе на новом устройстве после SMS-кода.">
        <SettingItem 
          label="Двухфакторная защита" 
          type="toggle" 
          checked={toggles.two_factor ?? true} 
          onChange={() => toggleSetting('two_factor')} 
          icon={<Lock className="w-5 h-5 text-[#00A884]" />}
        />
        <SettingItem 
          label="Изменить облачный пароль" 
          value={cloudPassword} 
          onClick={() => {
            const p = window.prompt('Введите новый облачный пароль:');
            if (p) {
              setCloudPassword('••••••••');
              showToast('Облачный пароль успешно обновлен');
            }
          }}
        />
        <SettingItem 
          label="Подсказка для пароля" 
          value={passwordHint} 
          onClick={() => {
            const h = window.prompt('Введите подсказку для пароля:', passwordHint);
            if (h) {
              setPasswordHint(h);
              showToast('Подсказка сохранена');
            }
          }}
        />
      </SettingSection>

      <SettingSection title="Блокировка приложения" footer="Защитите приложение от посторонних глаз на этом устройстве.">
        <SettingItem 
          label="Код-пароль приложения" 
          type="toggle" 
          checked={toggles.passcode ?? true} 
          onChange={() => toggleSetting('passcode')} 
          icon={<Key className="w-5 h-5" />}
        />
        <SettingItem 
          label="Разблокировка по Face ID / Отпечатку" 
          type="toggle" 
          checked={toggles.biometrics ?? true} 
          onChange={() => toggleSetting('biometrics')} 
        />
        <SettingItem 
          label="Автоблокировка" 
          value={prefs.autolock || 'Через 5 минут'} 
          onClick={() => cyclePref('autolock', ['Сразу', 'Через 1 минуту', 'Через 5 минут', 'Через 1 час', 'Выкл.'])}
        />
      </SettingSection>

      <SettingSection title="Журнал безопасности">
        <SettingItem 
          label="Последний вход" 
          value="Сегодня, 10:14" 
          subLabel="Zentora Web • Chrome 128 (Linux/Mac) • Успешно"
          type="value"
        />
        <SettingItem 
          label="Подозрительные попытки" 
          value="Не обнаружено" 
          type="value"
        />
      </SettingSection>
    </div>
  );
}

// --- 4. LINKED DEVICES VIEW ---
export function LinkedDevicesSettingsView({ showToast }: SubviewProps) {
  const [sessions, setSessions] = useState([
    { id: '1', name: 'iPhone 15 Pro, iOS 18', location: 'Москва, Россия', time: '14 минут назад', icon: <Smartphone className="w-5 h-5 text-emerald-400" /> },
    { id: '2', name: 'MacBook Pro 16", macOS Sonoma', location: 'Санкт-Петербург, Россия', time: 'Вчера, 19:42', icon: <Laptop className="w-5 h-5 text-blue-400" /> }
  ]);
  const [showScanner, setShowScanner] = useState(false);

  const terminateAll = () => {
    if (window.confirm('Завершить все сеансы на других устройствах?')) {
      setSessions([]);
      showToast('Все остальные сеансы успешно завершены');
    }
  };

  const simulateConnect = () => {
    setShowScanner(false);
    const newDevice = {
      id: String(Date.now()),
      name: 'iPad Pro 11", iPadOS 17',
      location: 'Москва, Россия',
      time: 'Только что',
      icon: <Smartphone className="w-5 h-5 text-teal-400" />
    };
    setSessions(prev => [newDevice, ...prev]);
    showToast('Новое устройство успешно привязано! ✓');
  };

  return (
    <div className="w-full pb-8 animate-in fade-in duration-150">
      <div className="flex flex-col items-center py-6 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-[#00A884]/20 border border-[#00A884]/40 flex items-center justify-center text-[#00A884] mb-3 shadow-lg shadow-[#00A884]/15">
          <QrCode className="w-9 h-9" />
        </div>
        <button 
          onClick={() => setShowScanner(true)}
          className="bg-[#00A884] hover:bg-[#00b890] text-white px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 shadow-lg shadow-[#00A884]/25 active:scale-95 transition-all"
        >
          <QrCode className="w-4 h-4" />
          <span>Подключить устройство</span>
        </button>
        <p className="text-[#8696A0] text-xs max-w-[280px] mt-2.5">
          Отсканируйте QR-код на экране другого компьютера или смартфона, чтобы войти в Zentora.
        </p>
      </div>

      {showScanner && (
        <div className="mx-4 mb-4 p-5 bg-[#182229] rounded-2xl border border-[#00A884]/40 text-center animate-in zoom-in-95">
          <h4 className="text-white font-semibold text-sm mb-2">Сканер QR-кода</h4>
          <p className="text-xs text-[#8696A0] mb-4">Наведите камеру на QR-код на экране устройства</p>
          <div className="w-40 h-40 mx-auto rounded-xl border-2 border-dashed border-[#00A884] flex items-center justify-center bg-black/40 mb-4 relative overflow-hidden">
            <div className="w-full h-1 bg-[#00A884] absolute animate-bounce opacity-70"></div>
            <QrCode className="w-12 h-12 text-[#00A884]/40" />
          </div>
          <div className="flex gap-2 justify-center">
            <button 
              onClick={simulateConnect}
              className="px-4 py-2 bg-[#00A884] hover:bg-[#00b890] text-white text-xs font-semibold rounded-xl active:scale-95"
            >
              Имитировать вход по QR
            </button>
            <button 
              onClick={() => setShowScanner(false)}
              className="px-4 py-2 bg-[#202C33] text-[#8696A0] text-xs rounded-xl hover:text-white"
            >
              Отмена
            </button>
          </div>
        </div>
      )}

      <SettingSection title="Это устройство">
        <div className="flex items-center gap-3.5 px-4 py-3.5">
          <div className="w-10 h-10 rounded-xl bg-[#202C33] flex items-center justify-center text-[#00A884]">
            <MonitorSmartphone className="w-6 h-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h4 className="text-[15px] font-semibold text-white truncate">Zentora Web (Chrome 128)</h4>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-medium">В сети</span>
            </div>
            <p className="text-[12px] text-[#8696A0] mt-0.5">Текущая сессия • IP: 188.162.24.110 (Москва)</p>
          </div>
        </div>
      </SettingSection>

      <SettingSection title="Активные сеансы" footer="Вы можете в любой момент завершить сеанс на потерянном или чужом устройстве.">
        {sessions.length > 0 ? (
          sessions.map(s => (
            <div key={s.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-[#202C33]/50 transition-colors">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-xl bg-[#202C33] flex items-center justify-center">
                  {s.icon}
                </div>
                <div>
                  <h4 className="text-[15px] font-medium text-white">{s.name}</h4>
                  <p className="text-[12px] text-[#8696A0]">{s.location} • {s.time}</p>
                </div>
              </div>
              <button 
                onClick={() => {
                  setSessions(prev => prev.filter(x => x.id !== s.id));
                  showToast(`Сеанс ${s.name} завершён`);
                }}
                className="text-red-400 hover:text-red-300 p-2 text-xs"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        ) : (
          <div className="px-4 py-6 text-center text-[#8696A0] text-sm">
            Нет других активных сеансов
          </div>
        )}
      </SettingSection>

      {sessions.length > 0 && (
        <div className="px-4 mt-2">
          <button 
            onClick={terminateAll}
            className="w-full py-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 font-medium text-sm transition-colors active:scale-98"
          >
            Завершить все другие сеансы
          </button>
        </div>
      )}
    </div>
  );
}

// --- 5. APPEARANCE & CHATS SETTINGS VIEW ---
export function AppearanceSettingsView({ toggles, toggleSetting, prefs, setPrefs, showToast }: SubviewProps) {
  const currentTheme = (prefs.theme as ThemeId) || 'dark';
  const currentWallpaper = (prefs.chat_wallpaper as WallpaperId) || 'classic';
  const currentFontSize = Number(prefs.font_size || 15);

  const themeList: { id: ThemeId; name: string; desc: string; previewBg: string; previewAccent: string }[] = [
    { id: 'dark', name: 'Тёмная Zentora', desc: 'Классическая бирюзово-тёмная палитра', previewBg: '#0B141A', previewAccent: '#00A884' },
    { id: 'amoled', name: 'Глубокая ночная (AMOLED)', desc: 'Идеальный чёрный для OLED-экранов', previewBg: '#000000', previewAccent: '#00C896' },
    { id: 'emerald', name: 'Изумрудный градиент', desc: 'Насыщенные лесные тона и изумруд', previewBg: '#051912', previewAccent: '#00D69A' },
    { id: 'midnight', name: 'Полуночный синий', desc: 'Глубокий индиго и небесный акцент', previewBg: '#0A1120', previewAccent: '#38BDF8' },
    { id: 'light', name: 'Светлая тема', desc: 'Чистый белый интерфейс для яркого дня', previewBg: '#F0F2F5', previewAccent: '#00A884' }
  ];

  const wallpaperList: { id: WallpaperId; name: string; preview: string }[] = [
    { id: 'classic', name: 'Классический', preview: 'radial-gradient(circle, #182229 0%, #0B141A 100%)' },
    { id: 'cosmos', name: 'Космос', preview: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)' },
    { id: 'emerald', name: 'Изумруд', preview: 'linear-gradient(135deg, #051912 0%, #0a291f 100%)' },
    { id: 'minimal', name: 'Минимализм', preview: '#0B141A' },
    { id: 'sunset', name: 'Закат', preview: 'linear-gradient(180deg, #181926 0%, #2e1a2c 100%)' }
  ];

  const handleSelectTheme = (id: ThemeId, name: string) => {
    if (setPrefs) {
      setPrefs(prev => ({ ...prev, theme: id }));
    }
    showToast(`Тема «${name}» применена! ✓`);
  };

  const handleSelectWallpaper = (id: WallpaperId, name: string) => {
    if (setPrefs) {
      setPrefs(prev => ({ ...prev, chat_wallpaper: id }));
    }
    showToast(`Обои «${name}» установлены! ✓`);
  };

  const handleFontSizeChange = (size: number) => {
    if (setPrefs) {
      setPrefs(prev => ({ ...prev, font_size: String(size) }));
    }
  };

  return (
    <div className="w-full pb-8 animate-in fade-in duration-150">
      {/* Dynamic Live Preview Box */}
      <div 
        className="p-4 mx-4 my-3 rounded-2xl border border-white/10 shadow-inner relative overflow-hidden transition-all duration-300"
        style={{
          background: THEMES[currentTheme]?.bgCard || '#0B141A',
          borderColor: THEMES[currentTheme]?.border || '#202C33'
        }}
      >
        <span 
          className="text-[11px] font-semibold uppercase tracking-wider block mb-2"
          style={{ color: THEMES[currentTheme]?.accent || '#00A884' }}
        >
          Предпросмотр чата
        </span>
        <div className="space-y-2">
          <div 
            className={`max-w-[85%] p-2.5 shadow-sm transition-all duration-200 ${
              toggles.rounded_bubbles !== false ? 'rounded-2xl rounded-tl-sm' : 'rounded-md'
            }`}
            style={{ 
              background: THEMES[currentTheme]?.bubbleOther || '#202C33', 
              color: THEMES[currentTheme]?.bubbleOtherText || '#E9EDEF',
              fontSize: `${currentFontSize}px` 
            }}
          >
            Привет! Это живой предпросмотр того, как будут выглядеть сообщения в Zentora 💬
            <span className="text-[10px] opacity-70 ml-2 block text-right">10:45</span>
          </div>
          <div 
            className={`max-w-[85%] ml-auto p-2.5 shadow-sm transition-all duration-200 ${
              toggles.rounded_bubbles !== false ? 'rounded-2xl rounded-tr-sm' : 'rounded-md'
            }`}
            style={{ 
              background: THEMES[currentTheme]?.bubbleMe || '#005C4B', 
              color: THEMES[currentTheme]?.bubbleMeText || '#FFFFFF',
              fontSize: `${currentFontSize}px` 
            }}
          >
            Отлично! Тема, обои и размер шрифта ({currentFontSize}px) меняются мгновенно ✨
            <span className="text-[10px] opacity-70 ml-2 block text-right">10:46</span>
          </div>
        </div>
      </div>

      <SettingSection title="Цветовая тема" footer="Тема оформления применяется сразу ко всем экранам, шапке и панелям.">
        {themeList.map(t => (
          <div 
            key={t.id}
            onClick={() => handleSelectTheme(t.id, t.name)}
            className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-[#202C33]/60 active:bg-[#202C33] transition-colors"
          >
            <div className="flex items-center gap-3">
              <div 
                className="w-7 h-7 rounded-full border border-white/20 flex items-center justify-center shadow"
                style={{ background: t.previewBg }}
              >
                <div className="w-3 h-3 rounded-full" style={{ background: t.previewAccent }} />
              </div>
              <div className="flex flex-col">
                <span className="text-[15px] text-white font-medium">{t.name}</span>
                <span className="text-[12px] text-[#8696A0]">{t.desc}</span>
              </div>
            </div>
            {currentTheme === t.id && (
              <Check className="w-5 h-5 text-[#00A884]" />
            )}
          </div>
        ))}
      </SettingSection>

      <SettingSection title="Фон чата (Обои)">
        <div className="px-4 py-3">
          <div className="grid grid-cols-5 gap-2">
            {wallpaperList.map(w => (
              <div 
                key={w.id}
                onClick={() => handleSelectWallpaper(w.id, w.name)}
                className={`h-16 rounded-xl cursor-pointer border-2 transition-all p-1 flex flex-col justify-end relative overflow-hidden shadow ${
                  currentWallpaper === w.id ? 'border-[#00A884] scale-105' : 'border-transparent opacity-80 hover:opacity-100'
                }`}
                style={{ background: w.preview }}
              >
                {currentWallpaper === w.id && (
                  <div className="absolute top-1 right-1 w-4 h-4 rounded-full bg-[#00A884] flex items-center justify-center text-white">
                    <Check className="w-3 h-3" />
                  </div>
                )}
                <span className="text-[10px] text-white font-medium bg-black/60 rounded px-1 text-center truncate">
                  {w.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </SettingSection>

      <SettingSection title="Размер шрифта">
        <div className="px-4 py-3">
          <div className="flex justify-between items-center text-xs text-[#8696A0] mb-2 font-mono">
            <span>12px</span>
            <span className="text-[#00A884] font-bold text-sm">{currentFontSize}px</span>
            <span>20px</span>
          </div>
          <input 
            type="range" 
            min="12" 
            max="20" 
            value={currentFontSize}
            onChange={(e) => handleFontSizeChange(Number(e.target.value))}
            className="w-full accent-[#00A884] cursor-pointer"
          />
        </div>
      </SettingSection>

      <SettingSection title="Оформление сообщений">
        <SettingItem 
          label="Скруглять углы сообщений" 
          subLabel="Круглые облачка сообщений"
          type="toggle" 
          checked={toggles.rounded_bubbles ?? true} 
          onChange={() => toggleSetting('rounded_bubbles')} 
        />
        <SettingItem 
          label="Отправка по клавише Enter" 
          subLabel="Shift+Enter для переноса строки"
          type="toggle" 
          checked={toggles.enter_to_send ?? true} 
          onChange={() => toggleSetting('enter_to_send')} 
        />
        <SettingItem 
          label="Крупные смайлики без текста" 
          type="toggle" 
          checked={toggles.big_emojis ?? true} 
          onChange={() => toggleSetting('big_emojis')} 
        />
        <SettingItem 
          label="Анимация стикеров и эмодзи" 
          type="toggle" 
          checked={toggles.sticker_anim ?? true} 
          onChange={() => toggleSetting('sticker_anim')} 
        />
      </SettingSection>
    </div>
  );
}

// --- 6. CHAT FOLDERS VIEW ---
export function ChatFoldersSettingsView({ folders = [], setFolders, showToast }: SubviewProps) {
  const [folderList, setFolderList] = useState(folders.length > 0 ? folders : [
    { id: 'all', name: 'Все' },
    { id: 'personal', name: 'Личные' },
    { id: 'groups', name: 'Группы' },
    { id: 'channels', name: 'Каналы' }
  ]);

  const addFolder = () => {
    const name = window.prompt('Введите название новой папки:');
    if (name && name.trim()) {
      const newFolder = { id: `custom_${Date.now()}`, name: name.trim() };
      const updated = [...folderList, newFolder];
      setFolderList(updated);
      if (setFolders) setFolders(updated);
      showToast(`Папка «${name.trim()}» создана! ✓`);
    }
  };

  const removeFolder = (id: string, name: string) => {
    const updated = folderList.filter(f => f.id !== id);
    setFolderList(updated);
    if (setFolders) setFolders(updated);
    showToast(`Папка «${name}» удалена`);
  };

  return (
    <div className="w-full pb-8 animate-in fade-in duration-150">
      <div className="flex flex-col items-center py-6 px-4 text-center">
        <Folder className="w-16 h-16 text-[#F3C550] mb-3 drop-shadow-md" fill="currentColor" />
        <h2 className="text-lg font-semibold text-white">Папки с чатами</h2>
        <p className="text-[#8696A0] text-xs max-w-[280px] mt-1">
          Создавайте папки для удобной группировки переписок: работа, учеба, друзья.
        </p>
        <button 
          onClick={addFolder}
          className="mt-4 bg-[#00A884] hover:bg-[#00b890] text-white px-5 py-2.5 rounded-full font-medium text-sm flex items-center gap-2 shadow-lg shadow-[#00A884]/25 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>Создать новую папку</span>
        </button>
      </div>

      <SettingSection title="Мои папки">
        {folderList.map(f => (
          <div key={f.id} className="flex items-center justify-between px-4 py-3 hover:bg-[#202C33]/50">
            <div className="flex items-center gap-3">
              <Folder className="w-5 h-5 text-[#F3C550]" />
              <span className="text-white font-medium text-[15px]">{f.name}</span>
            </div>
            {!['all', 'personal', 'groups', 'channels'].includes(f.id) ? (
              <button 
                onClick={() => removeFolder(f.id, f.name)}
                className="text-red-400 hover:text-red-300 p-1.5"
                title="Удалить папку"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            ) : (
              <span className="text-xs text-[#8696A0]">Стандартная</span>
            )}
          </div>
        ))}
      </SettingSection>

      <SettingSection title="Рекомендованные папки">
        <SettingItem 
          label="Работа" 
          subLabel="Чаты с коллегами и проекты" 
          type="value" 
          value={
            <button 
              onClick={() => {
                const newF = { id: `work_${Date.now()}`, name: 'Работа' };
                const u = [...folderList, newF];
                setFolderList(u);
                if (setFolders) setFolders(u);
                showToast('Папка «Работа» добавлена!');
              }}
              className="px-3 py-1 bg-[#00A884]/20 text-[#00A884] hover:bg-[#00A884]/30 rounded-full text-xs font-semibold"
            >
              Добавить
            </button>
          } 
        />
        <SettingItem 
          label="Семья" 
          subLabel="Семейные чаты и родные" 
          type="value" 
          value={
            <button 
              onClick={() => {
                const newF = { id: `family_${Date.now()}`, name: 'Семья' };
                const u = [...folderList, newF];
                setFolderList(u);
                if (setFolders) setFolders(u);
                showToast('Папка «Семья» добавлена!');
              }}
              className="px-3 py-1 bg-[#00A884]/20 text-[#00A884] hover:bg-[#00A884]/30 rounded-full text-xs font-semibold"
            >
              Добавить
            </button>
          } 
        />
      </SettingSection>
    </div>
  );
}

// --- 7. AUDIO & VIDEO / SOUND & CAMERA VIEW ---
export function AudioVideoSettingsView({ toggles, toggleSetting, prefs, cyclePref, showToast }: SubviewProps) {
  const [micTesting, setMicTesting] = useState(false);
  const [micLevel, setMicLevel] = useState(0);
  const [cameraTesting, setCameraTesting] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<any>(null);

  // Audio mic test
  useEffect(() => {
    if (!micTesting) {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      setMicLevel(0);
      return;
    }

    let audioCtx: AudioContext | null = null;
    let micStream: MediaStream | null = null;

    const startMic = async () => {
      try {
        micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        audioCtx = new AudioCtx();
        const source = audioCtx.createMediaStreamSource(micStream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 64;
        source.connect(analyser);

        const dataArray = new Uint8Array(analyser.frequencyBinCount);
        const loop = () => {
          analyser.getByteFrequencyData(dataArray);
          let sum = 0;
          for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
          const avg = sum / dataArray.length;
          setMicLevel(Math.min(100, Math.round((avg / 128) * 100)));
          animRef.current = requestAnimationFrame(loop);
        };
        loop();
      } catch (err) {
        // Fallback simulation if no mic permission
        let phase = 0;
        const fallback = () => {
          phase += 0.1;
          const sim = Math.abs(Math.sin(phase) * 60 + Math.cos(phase * 2) * 20);
          setMicLevel(Math.round(sim));
          animRef.current = requestAnimationFrame(fallback);
        };
        fallback();
      }
    };

    startMic();

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
      if (micStream) micStream.getTracks().forEach(t => t.stop());
      if (audioCtx && audioCtx.state !== 'closed') audioCtx.close().catch(() => {});
    };
  }, [micTesting]);

  // Video camera test
  useEffect(() => {
    if (!cameraTesting) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      return;
    }

    const startCam = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 360 } });
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play().catch(() => {});
        }
      } catch (err) {
        showToast('Камера не обнаружена или доступ ограничен');
      }
    };

    startCam();

    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
    };
  }, [cameraTesting, showToast]);

  const ringtones = ['Zentora Classic', 'Маримба', 'Колокольчик', 'Перезвон'];
  const notifSounds = ['Классический джингл', 'Капля', 'Колокольчик'];

  return (
    <div className="w-full pb-8 animate-in fade-in duration-150">
      {/* Microphone Test Section */}
      <SettingSection title="Микрофон" footer="Говорите в микрофон, чтобы проверить уровень громкости записи.">
        <SettingItem 
          label="Устройство записи" 
          value={prefs.mic_device || 'Микрофон по умолчанию'} 
          onClick={() => cyclePref('mic_device', ['Встроенный микрофон', 'Гарнитура', 'USB Микрофон'])}
        />
        <div className="px-4 py-3">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-[#8696A0]">Чувствительность микрофона:</span>
            <button 
              onClick={() => setMicTesting(!micTesting)}
              className={`text-xs px-3 py-1 rounded-full font-medium transition-all ${
                micTesting ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#00A884] text-white hover:bg-[#00b890]'
              }`}
            >
              {micTesting ? 'Остановить проверку' : 'Начать проверку микрофона'}
            </button>
          </div>
          <div className="w-full bg-[#202C33] h-3 rounded-full overflow-hidden flex items-center p-0.5 border border-white/5">
            <div 
              className="h-full bg-gradient-to-r from-emerald-500 via-teal-400 to-yellow-400 rounded-full transition-all duration-75"
              style={{ width: `${micLevel}%` }}
            />
          </div>
        </div>
      </SettingSection>

      {/* Camera Test Section */}
      <SettingSection title="Камера" footer="Проверьте работу веб-камеры и видимость перед звонком.">
        <SettingItem 
          label="Устройство видео" 
          value={prefs.camera_device || 'Фронтальная камера'} 
          onClick={() => cyclePref('camera_device', ['Фронтальная камера', 'Задняя камера', 'Внешняя USB WebCam'])}
        />
        <div className="px-4 py-3">
          <button 
            onClick={() => setCameraTesting(!cameraTesting)}
            className={`w-full py-2.5 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-all ${
              cameraTesting ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-[#202C33] hover:bg-[#2A3942] text-white'
            }`}
          >
            <Camera className="w-4 h-4 text-[#00A884]" />
            <span>{cameraTesting ? 'Выключить предпросмотр камеры' : 'Включить тест камеры'}</span>
          </button>

          {cameraTesting && (
            <div className="mt-3 relative w-full h-48 bg-black rounded-2xl overflow-hidden border-2 border-[#00A884]/60 shadow-lg">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="w-full h-full object-cover scale-x-[-1]"
              />
              <div className="absolute bottom-2 left-2 bg-black/60 px-2.5 py-1 rounded-full text-[11px] text-white flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span>Тест активен (HD 720p)</span>
              </div>
            </div>
          )}
        </div>
      </SettingSection>

      {/* Sounds and Ringtones */}
      <SettingSection title="Мелодии и сигналы">
        <SettingItem 
          label="Мелодия звонка" 
          value={prefs.ringtone || 'Zentora Classic'} 
          onClick={() => {
            cyclePref('ringtone', ringtones);
            playToneSample('classic');
            showToast('Мелодия изменена');
          }}
        />
        <SettingItem 
          label="Звук уведомления" 
          value={prefs.notif_sound || 'Классический джингл'} 
          onClick={() => {
            cyclePref('notif_sound', notifSounds);
            playToneSample('chime');
            showToast('Звук уведомления изменён');
          }}
        />
        <SettingItem 
          label="Приём звонков на этом устройстве" 
          type="toggle" 
          checked={toggles.calls_device ?? true} 
          onChange={() => toggleSetting('calls_device')} 
        />
      </SettingSection>
    </div>
  );
}

// --- 8. NOTIFICATIONS & SOUNDS VIEW ---
export function NotificationsSettingsView({ 
  toggles, 
  toggleSetting, 
  showToast, 
  onTestNotification,
  onRequestBrowserNotification,
  browserNotifStatus
}: SubviewProps) {
  return (
    <div className="w-full pb-8 animate-in fade-in duration-150">
      {/* Interactive Notification Tester Card */}
      <div className="m-4 p-4 rounded-2xl bg-gradient-to-br from-[#182229] to-[#111B21] border border-[#00A884]/40 shadow-xl">
        <div className="flex items-center gap-2 mb-1.5">
          <Sparkles className="w-5 h-5 text-[#00A884]" />
          <h3 className="font-semibold text-white text-[15px]">Проверка уведомлений</h3>
        </div>
        <p className="text-xs text-[#8696A0] mb-3.5 leading-relaxed">
          Нажмите любую кнопку ниже, чтобы проверить, как приходят уведомления и звонки со звуком:
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {/* Test Message */}
          <button 
            onClick={() => onTestNotification?.('message')}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#202C33] hover:bg-[#2A3942] active:scale-95 text-white text-xs font-medium border border-white/5 transition-all shadow"
          >
            <MessageSquare className="w-4 h-4 text-emerald-400" />
            <span>Сообщение</span>
          </button>

          {/* Test Voice */}
          <button 
            onClick={() => onTestNotification?.('voice')}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#202C33] hover:bg-[#2A3942] active:scale-95 text-white text-xs font-medium border border-white/5 transition-all shadow"
          >
            <Mic className="w-4 h-4 text-teal-400" />
            <span>Голосовое</span>
          </button>

          {/* Test Call */}
          <button 
            onClick={() => onTestNotification?.('call')}
            className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-[#00A884]/20 hover:bg-[#00A884]/30 active:scale-95 text-emerald-300 text-xs font-medium border border-emerald-500/30 transition-all shadow"
          >
            <Phone className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>Звонок</span>
          </button>
        </div>

        {/* Browser Permission Request */}
        <div className="mt-3.5 pt-3 border-t border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Globe className="w-4 h-4 text-[#8696A0]" />
            <span className="text-xs text-[#8696A0]">Системные уведомления браузера:</span>
          </div>
          <button 
            onClick={onRequestBrowserNotification}
            className={`text-xs px-2.5 py-1 rounded-full font-medium transition-all ${
              browserNotifStatus === 'granted'
                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-[#00A884] text-white hover:bg-[#00b890]'
            }`}
          >
            {browserNotifStatus === 'granted' ? 'Разрешены ✓' : 'Разрешить доступ'}
          </button>
        </div>
      </div>

      <SettingSection title="Уведомления из чатов">
        <SettingItem 
          label="Личные чаты" 
          subLabel="Включено со звуком" 
          type="toggle" 
          checked={toggles.private_chats ?? true} 
          onChange={() => toggleSetting('private_chats')} 
          icon={<User className="w-5 h-5" />} 
        />
        <SettingItem 
          label="Группы" 
          subLabel="Включено" 
          type="toggle" 
          checked={toggles.groups ?? true} 
          onChange={() => toggleSetting('groups')} 
          icon={<Users className="w-5 h-5" />} 
        />
        <SettingItem 
          label="Каналы" 
          subLabel="Включено" 
          type="toggle" 
          checked={toggles.channels ?? true} 
          onChange={() => toggleSetting('channels')} 
          icon={<Megaphone className="w-5 h-5" />} 
        />
        <SettingItem 
          label="Реакции" 
          subLabel="Голоса в опросах и смайлики" 
          type="toggle" 
          checked={toggles.reactions ?? true} 
          onChange={() => toggleSetting('reactions')} 
          icon={<Heart className="w-5 h-5" />} 
        />
      </SettingSection>

      <SettingSection title="Звуки и баннеры">
        <SettingItem 
          label="Звуки входящих сообщений" 
          type="toggle" 
          checked={toggles.sound ?? true} 
          onChange={() => toggleSetting('sound')} 
          icon={<Volume2 className="w-5 h-5 text-[#00A884]" />} 
        />
        <SettingItem 
          label="Всплывающие пуш-баннеры" 
          subLabel="Показывать сверху при новом сообщении" 
          type="toggle" 
          checked={toggles.desktop_notif ?? true} 
          onChange={() => toggleSetting('desktop_notif')} 
          icon={<Bell className="w-5 h-5 text-[#00A884]" />} 
        />
        <SettingItem 
          label="Вибрация" 
          type="toggle" 
          checked={toggles.vibration ?? true} 
          onChange={() => toggleSetting('vibration')} 
        />
        <SettingItem 
          label="Текст в уведомлении" 
          subLabel="Показывать предпросмотр сообщения" 
          type="toggle" 
          checked={toggles.preview_text ?? true} 
          onChange={() => toggleSetting('preview_text')} 
        />
      </SettingSection>

      <SettingSection title="Счётчик непрочитанных">
        <SettingItem 
          label="Считать сообщения вместо чатов" 
          type="toggle" 
          checked={toggles.count_msgs ?? true} 
          onChange={() => toggleSetting('count_msgs')} 
        />
        <SettingItem 
          label="Учитывать чаты без звука" 
          type="toggle" 
          checked={toggles.include_muted ?? true} 
          onChange={() => toggleSetting('include_muted')} 
        />
      </SettingSection>
    </div>
  );
}

// --- 9. DATA & STORAGE VIEW ---
export function DataStorageSettingsView({ toggles, toggleSetting, showToast }: SubviewProps) {
  const [cacheSize, setCacheSize] = useState('48.6 МБ');
  const [clearing, setClearing] = useState(false);
  const [sentStats, setSentStats] = useState('14.8 МБ');
  const [recvStats, setRecvStats] = useState('89.2 МБ');

  const handleClearCache = () => {
    setClearing(true);
    setTimeout(() => {
      setCacheSize('0 КБ');
      setClearing(false);
      showToast('Кэш успешно очищен! Освобождено 48.6 МБ ✓');
    }, 600);
  };

  const handleResetStats = () => {
    setSentStats('0 КБ');
    setRecvStats('0 КБ');
    showToast('Сетевая статистика сброшена');
  };

  return (
    <div className="w-full pb-8 animate-in fade-in duration-150">
      <SettingSection title="Память устройства" footer="Очистка кэша освободит память, не удаляя важные файлы из переписки.">
        <SettingItem 
          label="Кэш медиа и миниатюр" 
          value={cacheSize} 
          type="value"
        />
        <div className="p-4 bg-[#111B21]">
          <button 
            disabled={clearing || cacheSize === '0 КБ'}
            onClick={handleClearCache}
            className="w-full py-2.5 rounded-xl bg-[#00A884] hover:bg-[#00b890] disabled:opacity-50 text-white font-medium text-xs transition-all active:scale-95 shadow"
          >
            {clearing ? 'Очистка кэша...' : (cacheSize === '0 КБ' ? 'Кэш чист' : 'Очистить кэш')}
          </button>
        </div>
      </SettingSection>

      <SettingSection title="Автозагрузка медиафайлов">
        <SettingItem 
          label="Фото в личных чатах" 
          type="toggle" 
          checked={toggles.auto_photo_private ?? true} 
          onChange={() => toggleSetting('auto_photo_private')} 
        />
        <SettingItem 
          label="Фото в группах и каналах" 
          type="toggle" 
          checked={toggles.auto_photo_groups ?? true} 
          onChange={() => toggleSetting('auto_photo_groups')} 
        />
        <SettingItem 
          label="Видео (до 10 МБ)" 
          type="toggle" 
          checked={toggles.auto_video ?? false} 
          onChange={() => toggleSetting('auto_video')} 
        />
        <SettingItem 
          label="Голосовые сообщения" 
          subLabel="Автоматически загружать аудио"
          type="toggle" 
          checked={toggles.auto_voice ?? true} 
          onChange={() => toggleSetting('auto_voice')} 
        />
      </SettingSection>

      <SettingSection title="Использование сети">
        <SettingItem 
          label="Отправлено данных" 
          value={sentStats} 
          type="value"
        />
        <SettingItem 
          label="Получено данных" 
          value={recvStats} 
          type="value"
        />
        <div className="p-4 bg-[#111B21]">
          <button 
            onClick={handleResetStats}
            className="w-full py-2 rounded-xl bg-[#202C33] hover:bg-[#2A3942] text-[#8696A0] hover:text-white text-xs font-medium transition-colors"
          >
            Сбросить статистику
          </button>
        </div>
      </SettingSection>
    </div>
  );
}

// --- 10. LANGUAGE SETTINGS VIEW ---
export function LanguageSettingsView({ prefs, setPrefs, showToast }: SubviewProps) {
  const currentLang = prefs.language || 'ru';
  
  const languages = [
    { code: 'ru', name: 'Русский', native: 'Русский' },
    { code: 'en', name: 'English', native: 'English' },
    { code: 'es', name: 'Spanish', native: 'Español' },
    { code: 'de', name: 'German', native: 'Deutsch' },
    { code: 'uk', name: 'Ukrainian', native: 'Українська' },
    { code: 'uz', name: 'Uzbek', native: "O'zbek tili" },
    { code: 'kk', name: 'Kazakh', native: 'Қазақ тілі' },
    { code: 'tr', name: 'Turkish', native: 'Türkçe' }
  ];

  const handleSelectLanguage = (code: string, name: string) => {
    if (setPrefs) {
      setPrefs(prev => ({ ...prev, language: code }));
    }
    showToast(`Язык переключён на ${name}`);
  };

  return (
    <div className="w-full pb-8 animate-in fade-in duration-150">
      <SettingSection title="Язык интерфейса" footer="Язык изменится сразу на всех вкладках, в поиске и меню.">
        {languages.map(l => (
          <SettingItem 
            key={l.code}
            label={l.name}
            subLabel={l.native}
            type="value"
            value={currentLang === l.code ? <Check className="w-5 h-5 text-[#00A884]" /> : null}
            onClick={() => handleSelectLanguage(l.code, l.name)}
          />
        ))}
      </SettingSection>

      <SettingSection title="Перевод сообщений">
        <SettingItem 
          label="Показывать кнопку «Перевести»" 
          type="toggle" 
          checked={true} 
          onChange={() => showToast('Кнопка перевода активна')}
        />
      </SettingSection>
    </div>
  );
}

// --- 11. ADVANCED SETTINGS VIEW ---
export function AdvancedSettingsView({ toggles, toggleSetting, showToast }: SubviewProps) {
  const [checkingUpdate, setCheckingUpdate] = useState(false);

  const checkUpdate = () => {
    setCheckingUpdate(true);
    setTimeout(() => {
      setCheckingUpdate(false);
      showToast('У вас установлена самая свежая версия Zentora 3.4.2 ✓');
    }, 800);
  };

  return (
    <div className="w-full pb-8 animate-in fade-in duration-150">
      <SettingSection title="Производительность">
        <SettingItem 
          label="Аппаратное кодирование видео" 
          subLabel="Использовать GPU при видеозвонках"
          type="toggle" 
          checked={toggles.hw_video ?? false} 
          onChange={() => toggleSetting('hw_video')} 
        />
        <SettingItem 
          label="Проверка орфографии" 
          type="toggle" 
          checked={toggles.spellcheck ?? true} 
          onChange={() => toggleSetting('spellcheck')} 
        />
      </SettingSection>

      <SettingSection title="Обновления и сборки">
        <SettingItem 
          label="Автоматически загружать обновления" 
          type="toggle" 
          checked={toggles.auto_update ?? true} 
          onChange={() => toggleSetting('auto_update')} 
        />
        <SettingItem 
          label="Участвовать в бета-тестировании" 
          subLabel="Ранний доступ к новым функциям"
          type="toggle" 
          checked={toggles.beta ?? false} 
          onChange={() => toggleSetting('beta')} 
        />
        <div className="p-4 bg-[#111B21]">
          <button 
            disabled={checkingUpdate}
            onClick={checkUpdate}
            className="w-full py-2.5 rounded-xl bg-[#202C33] hover:bg-[#2A3942] text-white text-xs font-medium flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <RefreshCw className={`w-4 h-4 text-[#00A884] ${checkingUpdate ? 'animate-spin' : ''}`} />
            <span>{checkingUpdate ? 'Проверка обновлений...' : 'Проверить наличие обновлений'}</span>
          </button>
        </div>
      </SettingSection>
    </div>
  );
}

// --- 12. HELP & SUPPORT VIEW ---
export function HelpSettingsView({ showToast, onContactSupport }: SubviewProps) {
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  const faqs = [
    { q: 'Как работают голосовые сообщения?', a: 'Нажмите или удерживайте иконку микрофона внизу чата. Волна отображает громкость вашей речи в реальном времени, а при паузах переходит в точки. Записанное сообщение можно прослушать на скоростях 1x, 1.5x или 2x.' },
    { q: 'Как включить уведомления?', a: 'В разделе «Уведомления и звуки» нажмите кнопку «Разрешить доступ». При входящих сообщениях и звонках сверху экрана будет появляться пуш-баннер со звуком.' },
    { q: 'Как поменять тему и фон чата?', a: 'Перейдите в раздел «Оформление и чаты», где можно выбрать одну из 5 цветовых тем (включая AMOLED и изумрудную) и настроить обои чатов.' },
    { q: 'Как работают папки с чатами?', a: 'В разделе «Папки с чатами» нажмите «Создать новую папку», чтобы сгруппировать нужные контакты или каналы.' }
  ];

  return (
    <div className="w-full pb-8 animate-in fade-in duration-150">
      <div className="flex flex-col items-center py-6 px-4 text-center">
        <div className="w-16 h-16 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-500 mb-3">
          <HelpCircle className="w-9 h-9" />
        </div>
        <h2 className="text-lg font-semibold text-white">Помощь и поддержка Zentora</h2>
        <p className="text-[#8696A0] text-xs max-w-[280px] mt-1">
          Мы всегда на связи, чтобы помочь вам разобраться с любыми вопросами.
        </p>
      </div>

      <SettingSection title="Служба заботы">
        <div 
          onClick={onContactSupport}
          className="flex items-center gap-3.5 px-4 py-3.5 cursor-pointer hover:bg-[#202C33] active:bg-[#2A3942] transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-[#00A884] flex items-center justify-center text-white shadow-md">
            <MessageSquare className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <h4 className="text-[15px] font-semibold text-white">Задать вопрос поддержке</h4>
            <p className="text-[12px] text-[#8696A0]">Чат с официальным оператором поддержки Zentora</p>
          </div>
          <ChevronRight className="w-5 h-5 text-[#8696A0]" />
        </div>
      </SettingSection>

      <SettingSection title="Часто задаваемые вопросы (FAQ)">
        {faqs.map((f, i) => (
          <div key={i} className="px-4 py-3 cursor-pointer hover:bg-[#202C33]/40 transition-colors" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
            <div className="flex items-center justify-between">
              <span className="text-[14px] font-medium text-[#E9EDEF]">{f.q}</span>
              <ChevronRight className={`w-4 h-4 text-[#8696A0] transition-transform ${openFaq === i ? 'rotate-90' : ''}`} />
            </div>
            {openFaq === i && (
              <p className="text-[13px] text-[#8696A0] mt-2 pt-2 border-t border-white/5 leading-relaxed animate-in fade-in duration-100">
                {f.a}
              </p>
            )}
          </div>
        ))}
      </SettingSection>

      <SettingSection title="Правовая информация">
        <SettingItem label="Политика конфиденциальности" onClick={() => showToast('Открытие политики конфиденциальности')} />
        <SettingItem label="Условия использования" onClick={() => showToast('Открытие условий использования')} />
      </SettingSection>

      <div className="text-center text-[#8696A0] text-xs py-4">
        <p className="font-semibold text-white/70">Zentora Messenger</p>
        <p className="mt-0.5">Версия 3.4.2 • Сборка 9481 (Production)</p>
      </div>
    </div>
  );
}

// --- 13. QR CODE PROFILE MODAL ---
export function ProfileQRModal({ userProfile, showToast }: SubviewProps) {
  return (
    <div className="w-full pb-8 flex flex-col items-center py-6 px-4 animate-in fade-in duration-150">
      <div className="bg-white p-6 rounded-3xl shadow-2xl flex flex-col items-center text-center max-w-[280px] w-full text-black">
        <div className="relative mb-3">
          <img 
            src={userProfile.avatar} 
            alt={userProfile.name}
            className="w-16 h-16 rounded-full object-cover border-2 border-[#00A884] shadow-md"
          />
        </div>
        <h3 className="font-bold text-lg text-gray-900">{userProfile.name}</h3>
        <p className="text-xs text-[#00A884] font-semibold mb-4 font-mono">{userProfile.username}</p>

        {/* QR Code Canvas Representation */}
        <div className="w-48 h-48 bg-gray-100 rounded-2xl p-3 border border-gray-300 flex items-center justify-center relative">
          <div className="grid grid-cols-6 gap-1.5 w-full h-full p-2">
            {Array.from({ length: 36 }).map((_, i) => (
              <div 
                key={i} 
                className={`rounded-sm ${
                  (i % 2 === 0 && i % 3 !== 0) || i === 0 || i === 5 || i === 30 || i === 35 
                    ? 'bg-black' 
                    : 'bg-transparent'
                }`}
              />
            ))}
          </div>
          <div className="absolute w-8 h-8 rounded-full bg-[#00A884] flex items-center justify-center text-white shadow">
            <QrCode className="w-4 h-4" />
          </div>
        </div>

        <p className="text-[11px] text-gray-500 mt-4">
          Наведите камеру смартфона, чтобы открыть чат с {userProfile.name}
        </p>
      </div>

      <div className="flex gap-3 mt-6">
        <button 
          onClick={() => {
            navigator.clipboard?.writeText?.(`https://zentora.im/${userProfile.username?.replace('@', '')}`);
            showToast('Ссылка на профиль скопирована!');
          }}
          className="px-5 py-2.5 rounded-full bg-[#202C33] hover:bg-[#2A3942] text-white text-xs font-medium flex items-center gap-1.5 transition-all shadow"
        >
          <Copy className="w-4 h-4 text-[#00A884]" />
          <span>Скопировать ссылку</span>
        </button>
      </div>
    </div>
  );
}
