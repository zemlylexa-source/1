import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Camera, SquarePen, Search, Plus, Check, CheckCheck, 
  Phone, MoreVertical, Paperclip, Smile, Mic, Send,
  ChevronLeft, ChevronRight, Settings, Users, MessageSquare, Image as ImageIcon,
  User, Bookmark, Volume2, VolumeX, Lock, Database, Palette, Globe,
  BadgeCheck, X, PhoneCall, Video, Video as VideoIcon, VideoOff, CameraOff, SwitchCamera, RotateCcw, FlipHorizontal,
  MicOff, MapPin, Play, Pause, Navigation,
  Megaphone, Key, Folder, MonitorSmartphone, HelpCircle, ShieldAlert, CheckCircle2,
  Pin, CheckSquare, BellOff, Trash2, Reply, Copy, Forward, Edit2, CornerUpLeft, CornerUpRight,
  ArrowUpDown, Download, Heart, UserPlus, Mail, UserX, Square, Bell, Clock, RefreshCw, Wifi, QrCode
} from 'lucide-react';
import EmojiPicker from 'emoji-picker-react';
import { chatList, activeChatMessages, users, MY_ID } from '../data';
import type { Chat as ChatType, Message as MessageObjType, User as UserType, ZentoraNotification } from '../types';
import { playSendSound, playReceiveSound, startRingtone, stopRingtone } from '../utils/sounds';
import { NotificationBanner } from './NotificationBanner';
import { requestNotificationPermission, showSystemNotification, generateVoiceWaveform } from '../utils/notifications';
import {
  AccountSettingsView,
  PrivacySettingsView,
  SecuritySettingsView,
  LinkedDevicesSettingsView,
  AppearanceSettingsView,
  ChatFoldersSettingsView,
  AudioVideoSettingsView,
  NotificationsSettingsView,
  DataStorageSettingsView,
  LanguageSettingsView,
  AdvancedSettingsView,
  HelpSettingsView,
  ProfileQRModal
} from './SettingsSubviews';
import { THEMES, WALLPAPERS, ThemeId, WallpaperId, getTranslation, ThemeConfig } from '../utils/themeAndI18n';
import { initVoip, dialVoip, getCurrentCall, setCurrentCall, endVoip } from '../utils/voip';

export type MenuOption = {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
};

export type ContextMenuState = {
  x: number;
  y: number;
  options: MenuOption[];
} | null;

export default function ZentoraApp() {
  const [currentView, setCurrentView] = useState<'list' | 'chat' | 'profile' | 'sidebar' | 'calls' | 'people' | 'settings' | 'create'>('list');
  const [activeChat, setActiveChat] = useState<ChatType | null>(null);
  
  const defaultToggles: Record<string, boolean> = {
    'passcode': true, 'suggest_contacts': true, 'all_accounts': true,
    'desktop_notif': true, 'taskbar_anim': true, 'sound': true,
    'private_chats': true, 'groups': true, 'channels': true, 'reactions': true,
    'contact_joined': true, 'pinned_msg': true, 'calls_device': true,
    'include_muted': true, 'count_msgs': true, 'win_notif': true, 'focus_mode': false,
    'tags': false, 'calls_devices': true, 'ask_path': false, 'auto_private': true,
    'auto_groups': true, 'auto_channels': true, 'hw_video': false, 'spellcheck': true,
    'auto_update': true, 'beta': false, 'two_factor': true, 'biometrics': true,
    'rounded_bubbles': true, 'enter_to_send': true, 'big_emojis': true, 'sticker_anim': true,
    'vibration': true, 'preview_text': true
  };

  const defaultPrefs: Record<string, string> = {
    'phone_visibility': 'Мои контакты', 'last_seen': 'Все', 'profile_photos': 'Все',
    'forwarded_msgs': 'Все', 'calls_privacy': 'Все', 'voice_msgs': 'Все', 'auto_delete': 'Выкл.',
    'delete_account': '18 месяцев', 'theme': 'dark', 'chat_wallpaper': 'classic',
    'font_size': '15', 'language': 'ru', 'autolock': 'Через 5 минут',
    'ringtone': 'Zentora Classic', 'notif_sound': 'Классический джингл'
  };

  const [folders, setFolders] = useState<{ id: string; name: string; chatIds?: string[] }[]>(() => {
    try {
      const saved = localStorage.getItem('zentora_folders');
      return saved ? JSON.parse(saved) : [
        { id: 'all', name: 'Все' },
        { id: 'personal', name: 'Личные' },
        { id: 'groups', name: 'Группы' },
        { id: 'channels', name: 'Каналы' }
      ];
    } catch {
      return [
        { id: 'all', name: 'Все' },
        { id: 'personal', name: 'Личные' },
        { id: 'groups', name: 'Группы' },
        { id: 'channels', name: 'Каналы' }
      ];
    }
  });

  useEffect(() => {
    localStorage.setItem('zentora_folders', JSON.stringify(folders));
  }, [folders]);

  const savedMessagesChat: ChatType = {
    id: 'saved_messages',
    user: { id: 'saved_messages', name: 'Избранное', username: '@saved', isOnline: true, isSavedMessages: true, isVerified: true, avatar: 'https://ui-avatars.com/api/?name=%E2%98%85&background=5865f2&color=fff' },
    isPinned: true
  };
  const savedWelcome: MessageObjType = {
    id: 'saved_welcome', senderId: 'system', type: 'text', time: 'сейчас', isRead: true,
    text: 'Добро пожаловать в Zentora! 👋\nЭто ваше Избранное. Здесь можно сохранять важные сообщения и проверять, как работает чат.'
  };

  const [chats, setChats] = useState<ChatType[]>(() => {
    try {
      const saved = localStorage.getItem('zentora_chats');
      const parsed: ChatType[] = saved ? JSON.parse(saved) : [];
      const withoutOldFavorite = parsed.filter(c => c.id !== 'saved_messages');
      return [savedMessagesChat, ...withoutOldFavorite];
    } catch {
      return [savedMessagesChat];
    }
  });
  
  const [messagesByChat, setMessagesByChat] = useState<Record<string, MessageObjType[]>>(() => {
    try {
      const saved = localStorage.getItem('zentora_messages');
      const parsed = saved ? JSON.parse(saved) : {};
      if (!parsed.saved_messages || parsed.saved_messages.length === 0) parsed.saved_messages = [savedWelcome];
      return parsed;
    } catch {
      return { saved_messages: [savedWelcome] };
    }
  });

  useEffect(() => { localStorage.setItem('zentora_chats', JSON.stringify(chats)); }, [chats]);
  useEffect(() => { localStorage.setItem('zentora_messages', JSON.stringify(messagesByChat)); }, [messagesByChat]);
  
  const [toast, setToast] = useState<string | null>(null);
  const [activeCall, setActiveCall] = useState<{user: UserType, isVideo: boolean, isIncoming: boolean, status: 'ringing' | 'connected'} | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);

  // --- NOTIFICATION BANNER & SYSTEM PERMISSIONS ---
  const [activeNotification, setActiveNotification] = useState<ZentoraNotification | null>(null);
  const [browserNotifStatus, setBrowserNotifStatus] = useState<NotificationPermission>(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      return Notification.permission;
    }
    return 'default';
  });

  // --- APP-WIDE SETTINGS STATE ---
  const [toggles, setToggles] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('zentora_toggles');
      if (saved) {
        const parsed = JSON.parse(saved);
        return {
          ...defaultToggles,
          ...parsed,
          sound: parsed.sound !== undefined ? parsed.sound : true,
          desktop_notif: parsed.desktop_notif !== undefined ? parsed.desktop_notif : true,
          calls_device: parsed.calls_device !== undefined ? parsed.calls_device : true
        };
      }
      return defaultToggles;
    } catch {
      return defaultToggles;
    }
  });

  const [prefs, setPrefs] = useState<Record<string, string>>(() => {
    try {
      const saved = localStorage.getItem('zentora_prefs');
      return saved ? { ...defaultPrefs, ...JSON.parse(saved) } : defaultPrefs;
    } catch {
      return defaultPrefs;
    }
  });

  const [userProfile, setUserProfile] = useState<UserType & { email?: string; phone?: string; bio?: string }>(() => {
    try {
      const saved = localStorage.getItem('zentora_profile');
      const serverUser = JSON.parse(localStorage.getItem('zentora_server_user') || 'null');
      if (serverUser) return { id: serverUser.username, name: serverUser.display_name || serverUser.username, username: '@' + serverUser.username, phone: serverUser.phone || '', email: serverUser.email || '', bio: serverUser.bio || '', isOnline: true, avatar: '' };
      return saved ? { ...users.alexey, ...JSON.parse(saved) } : { id: 'me', name: 'Пользователь', username: '@user', isOnline: true };
    } catch { return { id: 'me', name: 'Пользователь', username: '@user', isOnline: true }; }
  });

  useEffect(() => { localStorage.setItem('zentora_toggles', JSON.stringify(toggles)); }, [toggles]);
  useEffect(() => { localStorage.setItem('zentora_prefs', JSON.stringify(prefs)); }, [prefs]);
  useEffect(() => { localStorage.setItem('zentora_profile', JSON.stringify(userProfile)); }, [userProfile]);

  // Real server-backed friends and direct messages. Favorites stays local.
  useEffect(() => {
    let cancelled = false;
    const loadFriends = async () => {
      try {
        const res = await fetch('/api/friends', { credentials: 'include' });
        if (!res.ok) return;
        const list = await res.json();
        if (cancelled || !Array.isArray(list)) return;
        const serverChats: ChatType[] = list.map((f: any) => ({
          id: `chat_${f.username}`,
          user: {
            id: f.username,
            name: f.display_name || f.username,
            username: '@' + f.username,
            isOnline: f.status === 'online',
            avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(f.display_name || f.username)}&background=5865f2&color=fff`
          }
        }));
        setChats(prev => {
          const favorite = prev.find(c => c.id === 'saved_messages') || savedMessagesChat;
          const localSpecial = prev.filter(c => c.id !== 'saved_messages' && !c.id.startsWith('chat_'));
          const merged = [...serverChats, ...localSpecial];
          const seen = new Set<string>();
          return [favorite, ...merged.filter(c => !seen.has(c.id) && seen.add(c.id))];
        });
      } catch (e) {
        console.warn('Zentora friends load failed', e);
      }
    };
    void loadFriends();
    return () => { cancelled = true; };
  }, [userProfile.id]);

  useEffect(() => {
    if (!activeChat || activeChat.id === 'saved_messages' || activeChat.user.isGroup || activeChat.user.isChannel) return;
    const username = (activeChat.user.username || activeChat.user.id || '').replace(/^@/, '');
    if (!username) return;
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch(`/api/dm_messages/${encodeURIComponent(username)}`, { credentials: 'include' });
        if (!res.ok) return;
        const list = await res.json();
        if (cancelled || !Array.isArray(list)) return;
        const mapped: MessageObjType[] = list.map((m: any) => ({
          id: String(m.id),
          senderId: m.author === userProfile.id ? 'me' : m.author,
          type: 'text',
          text: m.content,
          time: m.time,
          isRead: true
        }));
        setMessagesByChat(prev => ({ ...prev, [activeChat.id]: mapped }));
        const last = mapped[mapped.length - 1];
        if (last) setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, lastMessage: last } : c));
      } catch (e) {
        console.warn('Zentora messages load failed', e);
      }
    };
    void load();
    const timer = window.setInterval(load, 1500);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [activeChat?.id, activeChat?.user?.id, userProfile.id]);

  const toggleSetting = (key: string) => setToggles(prev => ({ ...prev, [key]: !prev[key] }));
  const cyclePref = (key: string, options: string[]) => {
    setPrefs(prev => {
      const current = prev[key] || options[0];
      const nextIndex = (options.indexOf(current) + 1) % options.length;
      return { ...prev, [key]: options[nextIndex] };
    });
  };

  const handleRequestBrowserPermission = async () => {
    const perm = await requestNotificationPermission();
    setBrowserNotifStatus(perm);
    if (perm === 'granted') {
      showToast('Системные уведомления браузера включены! ✓');
      showSystemNotification('Zentora', 'Уведомления успешно подключены и активны!');
    } else {
      showToast('Доступ к системным уведомлениям отклонён в браузере');
    }
  };

  const showContextMenu = (e: React.MouseEvent, options: MenuOption[]) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, options });
  };

  const closeContextMenu = () => setContextMenu(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2500);
  };

  const navigateToChat = (chat: ChatType) => {
    setChats(prev => prev.map(c => c.id === chat.id ? { ...c, unreadCount: undefined } : c));
    setActiveChat(chat);
    setCurrentView('chat');
  };

  const navigateTo = (view: 'list' | 'chat' | 'profile' | 'sidebar' | 'calls' | 'people' | 'settings' | 'create') => {
    setCurrentView(view);
  };

  const startNewChat = (user: UserType) => {
    const existingChat = chats.find(c => c.user.id === user.id);
    if (existingChat) {
      navigateToChat(existingChat);
    } else {
      const newChat: ChatType = {
        id: `chat_${Date.now()}`,
        user: user,
      };
      setChats([newChat, ...chats]);
      navigateToChat(newChat);
    }
  };

  const handleContactSupport = () => {
    const supportUser: UserType = {
      id: 'zentora_support',
      name: 'Служба заботы Zentora',
      avatar: 'https://ui-avatars.com/api/?name=Zentora+Support&background=00A884&color=fff',
      isVerified: true,
      isOnline: true
    };
    startNewChat(supportUser);
    showToast('Чат с поддержкой Zentora открыт');
  };

  const handleCreateEntity = (chat: ChatType) => {
    setChats([chat, ...chats]);
    navigateToChat(chat);
    showToast(`${chat.user.isGroup ? 'Группа' : 'Канал'} успешно создан!`);
  };

  // Central incoming communication trigger: Handles messages, voice messages, and calls
  const triggerIncomingCommunication = ({
    type,
    sender,
    text,
    duration,
    isVideo = false
  }: {
    type: 'message' | 'voice' | 'call';
    sender: UserType;
    text?: string;
    duration?: string;
    isVideo?: boolean;
  }) => {
    // Check if calls enabled
    if (type === 'call' && toggles.calls_device === false) return;

    let targetChat = chats.find(c => c.user.id === sender.id);
    const chatId = targetChat ? targetChat.id : `chat_${sender.id}`;
    
    if (!targetChat) {
      targetChat = {
        id: chatId,
        user: sender
      };
      setChats(prev => [targetChat!, ...prev]);
    }

    const nowTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (type === 'call') {
      if (toggles.sound !== false) {
        startRingtone(true);
      }
      setActiveCall({
        user: sender,
        isVideo,
        isIncoming: true,
        status: 'ringing'
      });
      setActiveNotification({
        id: `notif_${Date.now()}`,
        type: 'call',
        sender,
        chatId,
        title: sender.name,
        preview: isVideo ? 'Входящий видеозвонок...' : 'Входящий аудиозвонок...',
        isVideoCall: isVideo,
        time: 'сейчас'
      });
      if (toggles.desktop_notif !== false) {
        showSystemNotification(
          sender.name,
          isVideo ? '📹 Входящий видеозвонок в Zentora...' : '📞 Входящий аудиозвонок в Zentora...',
          sender.avatar
        );
      }
      return;
    }

    let newMsg: MessageObjType;
    if (type === 'voice') {
      const voiceDur = duration || '0:14';
      newMsg = {
        id: Date.now().toString(),
        senderId: sender.id,
        type: 'voice',
        duration: voiceDur,
        waveform: generateVoiceWaveform(25),
        time: nowTime,
        isRead: false
      };
    } else {
      newMsg = {
        id: Date.now().toString(),
        senderId: sender.id,
        type: 'text',
        text: text || 'Привет! Как дела?',
        time: nowTime,
        isRead: false
      };
    }

    // Append to chat messages
    setMessagesByChat(prev => ({
      ...prev,
      [chatId]: [...(prev[chatId] || []), newMsg]
    }));

    // Update last message & unread badge
    const isViewingThisChat = currentView === 'chat' && activeChat?.id === chatId;
    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        return {
          ...c,
          lastMessage: newMsg,
          unreadCount: isViewingThisChat ? undefined : (c.unreadCount || 0) + 1
        };
      }
      return c;
    }));

    // Play chime sound
    if (toggles.sound !== false) {
      playReceiveSound();
    }

    // Trigger in-app notification banner
    const preview = type === 'voice' ? `🎤 Голосовое сообщение (${newMsg.duration})` : newMsg.text || '';
    setActiveNotification({
      id: `notif_${Date.now()}`,
      type,
      sender,
      chatId,
      title: sender.name,
      preview,
      voiceDuration: newMsg.duration,
      time: 'сейчас'
    });

    // Native browser push notification
    if (toggles.desktop_notif !== false) {
      showSystemNotification(
        sender.name,
        preview,
        sender.avatar
      );
    }
  };

  const handleTestNotification = (_type: 'message' | 'voice' | 'call') => {
    showToast('Тестовые сообщения отключены: здесь только реальные аккаунты.');
  };

  const handleSendMessage = async (messageData: Partial<MessageObjType>) => {
    if (!activeChat) return;

    // Favorites is intentionally local and has no call buttons.
    if (activeChat.id === 'saved_messages' || !activeChat.user.username) {
      const newMessage: MessageObjType = {
        id: Date.now().toString(),
        senderId: 'me',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'text',
        isRead: true,
        ...messageData
      } as MessageObjType;
      setMessagesByChat(prev => ({ ...prev, [activeChat.id]: [...(prev[activeChat.id] || []), newMessage] }));
      setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, lastMessage: newMessage } : c));
      if (toggles.sound !== false) playSendSound();
      return;
    }

    const to = activeChat.user.username.replace(/^@/, '');
    const content = (messageData.text || '').trim();
    if (!content) return;

    try {
      const res = await fetch('/api/send_dm', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to, content })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.ok) {
        showToast(data.error || 'Не удалось отправить сообщение');
        return;
      }
      const m = data.message || { id: Date.now().toString(), content, time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) };
      const newMessage: MessageObjType = {
        id: String(m.id), senderId: 'me', type: 'text', text: m.content, time: m.time, isRead: true
      };
      setMessagesByChat(prev => ({ ...prev, [activeChat.id]: [...(prev[activeChat.id] || []).filter(x => x.id !== newMessage.id), newMessage] }));
      setChats(prev => prev.map(c => c.id === activeChat.id ? { ...c, lastMessage: newMessage } : c));
      if (toggles.sound !== false) playSendSound();
    } catch (e) {
      showToast('Нет соединения с сервером Zentora');
    }
  };

  const handleUpdateMessage = (chatId: string, messageId: string, updates: Partial<MessageObjType>) => {
    setMessagesByChat(prev => {
      const chatMsgs = prev[chatId] || [];
      const updatedMsgs = chatMsgs.map(m => m.id === messageId ? { ...m, ...updates, isEdited: updates.text !== undefined ? true : m.isEdited } : m);
      return { ...prev, [chatId]: updatedMsgs };
    });
    
    setChats(prev => prev.map(c => {
      if (c.id === chatId && c.lastMessage?.id === messageId) {
        return { ...c, lastMessage: { ...c.lastMessage, ...updates } };
      }
      return c;
    }));
  };

  const handleDeleteChat = (chatId: string) => {
    setChats(prev => prev.filter(c => c.id !== chatId));
    if (activeChat?.id === chatId) {
      setCurrentView('list');
      setActiveChat(null);
    }
    showToast('Чат удален');
  };

  const handleTogglePinChat = (chatId: string) => {
    setChats(prev => {
      const updated = prev.map(c => c.id === chatId ? { ...c, isPinned: !c.isPinned } : c);
      return updated.sort((a, b) => {
        if (a.isPinned === b.isPinned) return 0;
        return a.isPinned ? -1 : 1;
      });
    });
  };

  const handleToggleReadChat = (chatId: string) => {
    setChats(prev => prev.map(c => {
      if (c.id === chatId) {
        if (c.unreadCount && c.unreadCount > 0) {
          return { ...c, unreadCount: 0 };
        } else {
          return { ...c, unreadCount: 1 };
        }
      }
      return c;
    }));
  };

  const handleToggleMuteChat = (chatId: string) => {
    setChats(prev => prev.map(c => c.id === chatId ? { ...c, isMuted: !c.isMuted } : c));
  };

  const handleDeleteMessage = (chatId: string, messageId: string) => {
    const chatMessages = messagesByChat[chatId] || [];
    const filtered = chatMessages.filter(m => m.id !== messageId);
    
    setMessagesByChat(prev => ({ ...prev, [chatId]: filtered }));
    
    setChats(prevChats => prevChats.map(c => {
      if (c.id === chatId) {
        return { ...c, lastMessage: filtered.length > 0 ? filtered[filtered.length - 1] : undefined };
      }
      return c;
    }));
    
    showToast('Сообщение удалено');
  };

  const currentTheme = THEMES[prefs?.theme as ThemeId] || THEMES.dark;

  useEffect(() => {
    const peer = initVoip(userProfile.id, (incomingCall) => {
      const incomingUser = chats.find(c => `zentora-${c.user.id}` === incomingCall.peer)?.user || users.alexey;
      setCurrentCall(incomingCall);
      setActiveCall({ user: incomingUser, isVideo: false, isIncoming: true, status: 'ringing' });
      if (toggles.sound !== false) startRingtone(true);
    });
    return () => {
      // Keep the Peer connection alive while the app is mounted.
      void peer;
    };
  }, [userProfile.id]);


  return (
    <div className="flex justify-center bg-black w-full h-[100dvh] overflow-hidden text-[#E9EDEF] font-sans selection:bg-[#00C896]/30">
      <div 
        className="zentora-phone-shell overflow-hidden relative shadow-2xl border-4 flex flex-col transition-colors duration-200"
        style={{
          backgroundColor: currentTheme.bgApp,
          color: currentTheme.textPrimary,
          borderColor: currentTheme.border
        }}
      >
        {currentView === 'list' && (
          <ChatList 
            chats={chats} 
            onChatClick={navigateToChat} 
            onMenuClick={() => navigateTo('sidebar')} 
            onCreateClick={() => navigateTo('create')} 
            showContextMenu={showContextMenu} 
            showToast={showToast} 
            onDeleteChat={handleDeleteChat} 
            onTogglePin={handleTogglePinChat} 
            onToggleRead={handleToggleReadChat} 
            onToggleMute={handleToggleMuteChat}
            onTestNotification={handleTestNotification}
            folders={folders}
            theme={currentTheme}
            language={prefs?.language}
          />
        )}
        {currentView === 'chat' && activeChat && (
          <ChatRoom 
            chat={activeChat} 
            messages={messagesByChat[activeChat.id] || []} 
            onBack={() => navigateTo('list')} 
            onSendMessage={handleSendMessage} 
            onCall={(isVideo) => {
              if (toggles.sound !== false) startRingtone(false);
              setActiveCall({ user: activeChat.user, isVideo, isIncoming: false, status: 'ringing' });
            }}
            onMoreClick={() => navigateTo('settings')}
            onProfileClick={() => navigateTo('profile')}
            showToast={showToast}
            showContextMenu={showContextMenu}
            onDeleteMessage={(msgId) => handleDeleteMessage(activeChat.id, msgId)}
            onUpdateMessage={(msgId, updates) => handleUpdateMessage(activeChat.id, msgId, updates)}
            toggles={toggles}
            prefs={prefs}
          />
        )}
        {currentView === 'profile' && <Profile onBack={() => navigateTo('list')} onSettingsClick={() => navigateTo('settings')} userProfile={userProfile} />}
        {currentView === 'sidebar' && (
          <Sidebar 
            onClose={() => navigateTo('list')} 
            onProfileClick={() => navigateTo('profile')} 
            userProfile={userProfile}
            onMenuClick={(menu) => {
              if (menu === 'Звонки') navigateTo('calls');
              else if (menu === 'Настройки') navigateTo('settings');
              else if (menu === 'Избранное') {
                const favorite = chats.find(c => c.id === 'saved_messages');
                if (favorite) navigateToChat(favorite);
              }
              else { navigateTo('list'); showToast(`Открываем: ${menu}`); }
            }} 
          />
        )}
        {currentView === 'calls' && (
          <CallsList 
            chats={chats} 
            onCallClick={(user, isVideo) => {
              if (toggles.sound !== false) startRingtone(false);
              setActiveCall({ user, isVideo, isIncoming: false, status: 'ringing' });
            }} 
          />
        )}
        {currentView === 'people' && <PeopleList onUserClick={startNewChat} onCreateClick={() => navigateTo('create')} />}
        {currentView === 'settings' && (
          <SettingsView 
            onBack={() => navigateTo('list')} 
            showToast={showToast} 
            toggles={toggles} 
            toggleSetting={toggleSetting} 
            prefs={prefs} 
            cyclePref={cyclePref} 
            setPrefs={setPrefs}
            userProfile={userProfile} 
            setUserProfile={setUserProfile} 
            onTestNotification={handleTestNotification}
            onRequestBrowserNotification={handleRequestBrowserPermission}
            browserNotifStatus={browserNotifStatus}
            onContactSupport={handleContactSupport}
            folders={folders}
            setFolders={setFolders}
            chats={chats}
          />
        )}
        {currentView === 'create' && <CreateEntityView onBack={() => navigateTo('list')} onCreate={handleCreateEntity} />}
        
        {['list', 'profile', 'calls', 'people'].includes(currentView) && (
           <BottomNav currentView={currentView} onNavigate={navigateTo} language={prefs?.language} theme={currentTheme} />
        )}

        {/* Context Menu Overlay */}
        {contextMenu && <ContextMenu x={contextMenu.x} y={contextMenu.y} options={contextMenu.options} onClose={closeContextMenu} />}
        
        {/* In-App Notification Banner */}
        <NotificationBanner 
          notification={activeNotification}
          onOpen={(notif) => {
            setActiveNotification(null);
            const targetChat = chats.find(c => c.id === notif.chatId || c.user.id === notif.sender.id);
            if (targetChat) {
              navigateToChat(targetChat);
            }
          }}
          onAcceptCall={(notif) => {
            setActiveNotification(null);
            stopRingtone();
            setActiveCall({
              user: notif.sender,
              isVideo: notif.isVideoCall || false,
              isIncoming: true,
              status: 'connected'
            });
          }}
          onDeclineCall={() => {
            setActiveNotification(null);
            stopRingtone();
            if (activeCall?.isIncoming && activeCall.status === 'ringing') {
              setActiveCall(null);
            }
            showToast('Звонок отклонён');
          }}
          onClose={() => {
            if (activeNotification?.type === 'call') {
              stopRingtone();
              if (activeCall?.isIncoming && activeCall.status === 'ringing') {
                setActiveCall(null);
              }
            }
            setActiveNotification(null);
          }}
        />

        {/* Call Screen Overlay */}
        {activeCall && (
          <CallScreen 
            user={activeCall.user} 
            userProfile={userProfile}
            isVideo={activeCall.isVideo} 
            isIncoming={activeCall.isIncoming}
            status={activeCall.status}
            onEnd={() => {
              stopRingtone();
              setActiveCall(null);
              setActiveNotification(null);
            }} 
            onAccept={() => {
              stopRingtone();
              setActiveCall({ ...activeCall, status: 'connected' });
              setActiveNotification(null);
            }}
          />
        )}
        
        {/* Toast */}
        {toast && (
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 bg-[#202C33] text-white px-4 py-2 rounded-full text-sm shadow-xl z-[100] animate-in fade-in slide-in-from-bottom-4 text-center max-w-[80%] break-words border border-[#2A3942]">
            {toast}
          </div>
        )}
      </div>
    </div>
  );
}

function ChatList({ 
  chats, 
  onChatClick, 
  onMenuClick, 
  onCreateClick, 
  showContextMenu, 
  showToast, 
  onDeleteChat, 
  onTogglePin, 
  onToggleRead, 
  onToggleMute,
  onTestNotification,
  folders,
  theme,
  language
}: { 
  chats: ChatType[], 
  onChatClick: (c: ChatType) => void, 
  onMenuClick: () => void, 
  onCreateClick: () => void, 
  showContextMenu: (e: React.MouseEvent, options: MenuOption[]) => void, 
  showToast: (msg: string) => void, 
  onDeleteChat: (id: string) => void, 
  onTogglePin: (id: string) => void, 
  onToggleRead: (id: string) => void, 
  onToggleMute: (id: string) => void,
  onTestNotification?: (type: 'message' | 'voice' | 'call') => void,
  folders?: { id: string; name: string; chatIds?: string[] }[],
  theme?: ThemeConfig,
  language?: string
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<string>('all');

  const folderTabs = (folders && folders.length > 0) ? folders : [
    { id: 'all', name: getTranslation('all', language) },
    { id: 'personal', name: getTranslation('personal', language) },
    { id: 'groups', name: getTranslation('groups', language) },
    { id: 'channels', name: getTranslation('channels', language) }
  ];

  const filteredChats = chats.filter(c => {
    const searchMatch = c.user.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                        c.lastMessage?.text?.toLowerCase().includes(searchQuery.toLowerCase());
    if (!searchMatch) return false;
    if (activeFilter === 'all') return true;
    if (activeFilter === 'personal') return !c.user.isGroup && !c.user.isChannel;
    if (activeFilter === 'groups') return c.user.isGroup;
    if (activeFilter === 'channels') return c.user.isChannel;
    const customFolder = folders?.find(f => f.id === activeFilter);
    if (customFolder) {
      if (customFolder.chatIds && customFolder.chatIds.length > 0) {
        return customFolder.chatIds.includes(c.id);
      }
      return true;
    }
    return true;
  });

  return (
    <div className="flex-1 flex flex-col pt-10 pb-[68px]">
      <div className="px-4 pb-2 flex items-center justify-between" style={{ backgroundColor: theme?.bgHeader }}>
        <div className="flex items-center gap-3">
          <button 
            onClick={onMenuClick} 
            className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg active:scale-95 transition-transform"
            style={{ backgroundColor: theme?.accent || '#00C896' }}
          >
            Z
          </button>
          <h1 className="text-xl font-semibold">Zentora</h1>
        </div>
        <div className="flex items-center gap-3.5 text-white">
          <button 
            onClick={() => {
              const types: Array<'message' | 'voice' | 'call'> = ['message', 'voice', 'call'];
              const chosen = types[Math.floor(Math.random() * types.length)];
              onTestNotification?.(chosen);
            }} 
            title="Проверить уведомление (новое сообщение, голосовое или звонок)"
            className="p-1 rounded-full text-[#00A884] hover:bg-[#202C33] active:scale-90 transition-all relative"
          >
            <Bell className="w-5 h-5" strokeWidth={2} />
            <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-[#00A884] animate-ping"></span>
          </button>
          <Camera className="w-6 h-6" strokeWidth={1.5} />
          <SquarePen className="w-6 h-6" strokeWidth={1.5} onClick={onCreateClick} />
        </div>
      </div>

      <div className="px-4 py-2">
        <div className="bg-[#202C33] h-10 rounded-xl flex items-center px-3 text-[#8696A0]">
          <Search className="w-5 h-5 mr-2" />
          <input 
            type="text" 
            placeholder={getTranslation('search', language)} 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="bg-transparent border-none outline-none flex-1 text-[#E9EDEF] placeholder-[#8696A0]" 
          />
        </div>
      </div>

      <div className="px-4 py-2 flex items-center gap-2 overflow-x-auto no-scrollbar text-[15px]">
        {folderTabs.map(f => (
          <FilterButton 
            key={f.id} 
            label={f.name} 
            active={activeFilter === f.id} 
            onClick={() => setActiveFilter(f.id)}
            activeColor={theme?.accent}
          />
        ))}
        <button onClick={onCreateClick} className="text-[#8696A0] ml-auto active:scale-95 transition-transform bg-[#202C33]/50 p-1.5 rounded-full hover:bg-[#202C33]"><Plus className="w-5 h-5" /></button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar mt-2">
        {filteredChats.map((chat) => (
          <div 
            key={chat.id} 
            onClick={() => onChatClick(chat)} 
            onContextMenu={(e) => {
              showContextMenu(e, [
                { label: chat.isPinned ? 'Открепить' : 'Закрепить', icon: <Pin className="w-[18px] h-[18px]" strokeWidth={1.75} />, onClick: () => onTogglePin(chat.id) },
                { label: (chat.unreadCount && chat.unreadCount > 0) ? 'Отметить прочитанным' : 'Отметить непрочитанным', icon: <CheckSquare className="w-[18px] h-[18px]" strokeWidth={1.75} />, onClick: () => onToggleRead(chat.id) },
                { label: chat.isMuted ? 'Включить звук' : 'Без звука', icon: <BellOff className="w-[18px] h-[18px]" strokeWidth={1.75} />, onClick: () => onToggleMute(chat.id) },
                { label: 'Удалить чат', icon: <Trash2 className="w-[18px] h-[18px]" strokeWidth={1.75} />, onClick: () => onDeleteChat(chat.id), danger: true },
              ]);
            }}
            className={`flex items-center px-4 py-3 hover:bg-[#202C33] cursor-pointer transition-colors active:bg-[#2A3942] ${chat.isPinned ? 'bg-[#111B21]/50' : ''}`}
          >
            <div className="relative">
              <img src={chat.user.avatar || `https://ui-avatars.com/api/?name=${chat.user.name}&background=random`} alt={chat.user.name} className="w-12 h-12 rounded-full object-cover bg-gray-800" />
              {chat.user.isOnline && <div className="absolute bottom-0 right-0 w-3.5 h-3.5 bg-[#00A884] border-2 border-[#0B141A] rounded-full"></div>}
            </div>
            
            <div className="ml-3 flex-1 overflow-hidden">
              <div className="flex justify-between items-baseline">
                <div className="flex items-center gap-1 truncate">
                  <h3 className="font-medium text-[16px] text-[#E9EDEF] truncate">{chat.user.name}</h3>
                  {chat.user.isVerified && <BadgeCheck className="w-4 h-4 text-[#1D9BF0] flex-shrink-0" fill="currentColor" stroke="white" />}
                  {chat.isMuted && <BellOff className="w-3.5 h-3.5 text-[#8696A0] flex-shrink-0 ml-1" />}
                </div>
                <span className={`text-xs ml-2 flex-shrink-0 ${chat.unreadCount ? 'text-[#00A884]' : 'text-[#8696A0]'}`}>
                  {chat.lastMessage?.time}
                </span>
              </div>
              
              <div className="flex justify-between items-center mt-0.5">
                <p className="text-[14px] text-[#8696A0] truncate flex items-center gap-1">
                  {chat.lastMessage?.type === 'image' && <ImageIcon className="w-4 h-4" />}
                  {chat.lastMessage?.type === 'voice' && <Mic className="w-4 h-4 text-[#00A884]" />}
                  {chat.lastMessage?.type === 'location' && <MapPin className="w-4 h-4" />}
                  {chat.lastMessage?.type === 'system' && <span className="text-[#00A884]">✨</span>}
                  <span className="truncate">{chat.lastMessage?.text || (chat.user.isGroup ? 'Нет сообщений' : 'Начать чат')}</span>
                </p>
                <div className="flex items-center gap-1.5 ml-2 flex-shrink-0">
                  {chat.isPinned && <Pin className="w-[14px] h-[14px] text-[#8696A0] rotate-45" fill="currentColor" />}
                  {chat.unreadCount ? (
                    <div className="bg-[#00A884] text-white text-[11px] font-bold px-1.5 min-w-[20px] h-[20px] rounded-full flex items-center justify-center">
                      {chat.unreadCount}
                    </div>
                  ) : (
                    chat.lastMessage?.senderId === MY_ID && (
                      chat.lastMessage.isRead ? <CheckCheck className="w-4 h-4 text-[#34B7F1]" /> : <Check className="w-4 h-4 text-[#8696A0]" />
                    )
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
        {filteredChats.length === 0 && (
          <div className="text-center text-[#8696A0] mt-10">Ничего не найдено</div>
        )}
      </div>
    </div>
  );
}

function FilterButton({ label, active, onClick, activeColor }: { label: string, active: boolean, onClick: () => void, activeColor?: string, key?: React.Key }) {
  return (
    <button 
      onClick={onClick}
      style={active && activeColor ? { backgroundColor: activeColor, color: '#ffffff' } : undefined}
      className={`px-4 py-1.5 rounded-full whitespace-nowrap font-medium transition-all ${active ? (activeColor ? '' : 'bg-[#005C4B] text-[#E9EDEF]') : 'text-[#8696A0] bg-[#202C33]/50 hover:bg-[#202C33]'}`}
    >
      {label}
    </button>
  );
}

// --- SETTINGS HELPER COMPONENTS ---
function ToggleSwitch({ checked, onChange }: { checked: boolean, onChange?: () => void }) {
  return (
    <div onClick={(e) => { e.stopPropagation(); onChange?.(); }} className={`w-[36px] h-[20px] rounded-full relative cursor-pointer transition-colors ${checked ? 'bg-[#00A884]' : 'bg-[#374045]'}`}>
      <div className={`absolute top-[2px] bg-white w-[16px] h-[16px] rounded-full transition-transform duration-200 ${checked ? 'translate-x-[18px]' : 'translate-x-[2px]'}`}></div>
    </div>
  );
}

function SettingSection({ title, children, footer }: { title?: string, children: React.ReactNode, footer?: string }) {
  return (
    <div className="mb-4 w-full">
      {title && <h3 className="text-[#00A884] text-[13px] font-medium px-4 mb-2 tracking-wide">{title}</h3>}
      <div className="bg-[#111B21] rounded-xl overflow-hidden border border-[#202C33] shadow-sm">
        {children}
      </div>
      {footer && <p className="text-[#8696A0] text-[13px] px-4 mt-2 leading-relaxed">{footer}</p>}
    </div>
  );
}

function SettingItem({ label, subLabel, value, type = 'chevron', onClick, checked, onChange, icon }: { label: string, subLabel?: React.ReactNode, value?: string | number | React.ReactNode, type?: 'chevron' | 'toggle' | 'value' | 'icon', onClick?: () => void, checked?: boolean, onChange?: () => void, icon?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between p-3.5 border-b border-[#202C33] last:border-none cursor-pointer hover:bg-[#202C33]/50 transition-colors" onClick={onClick || (type === 'toggle' ? onChange : undefined)}>
      <div className="flex items-center gap-3">
        {icon && <div className="text-[#8696A0]">{icon}</div>}
        <div className="flex flex-col">
          <span className="text-[#E9EDEF] text-[15px]">{label}</span>
          {subLabel && <span className="text-[#8696A0] text-[13px] mt-0.5">{subLabel}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {value !== undefined && <span className={`text-[15px] ${['Выкл.', 'Выкл'].includes(String(value)) ? 'text-[#8696A0]' : 'text-[#00A884]'}`}>{value}</span>}
        {type === 'chevron' && <ChevronRight className="w-5 h-5 text-[#8696A0]" />}
        {type === 'toggle' && <ToggleSwitch checked={checked || false} onChange={onChange} />}
      </div>
    </div>
  );
}

// --- NEW ENHANCED SETTINGS VIEW ---
function SettingsView({ 
  onBack, 
  showToast, 
  toggles, 
  toggleSetting, 
  prefs, 
  cyclePref, 
  setPrefs,
  userProfile, 
  setUserProfile,
  onTestNotification,
  onRequestBrowserNotification,
  browserNotifStatus,
  onContactSupport,
  folders,
  setFolders,
  chats
}: any) {
  const [activeSetting, setActiveSetting] = useState<string | null>(null);

  const editProfile = (field: string, promptText: string) => {
    const current = userProfile[field] || '';
    const val = window.prompt(promptText, current);
    if (val !== null && val.trim() !== '') {
      setUserProfile((prev: any) => ({ ...prev, [field]: val.trim() }));
      showToast('Сохранено');
    }
  };

  const subviewProps = {
    userProfile,
    setUserProfile,
    toggles,
    toggleSetting,
    prefs,
    cyclePref,
    setPrefs,
    showToast,
    onTestNotification,
    onRequestBrowserNotification,
    browserNotifStatus,
    onContactSupport,
    folders,
    setFolders,
    chats
  };

  const renderActiveSettingContent = () => {
    switch (activeSetting) {
      case 'Аккаунт':
        return <AccountSettingsView {...subviewProps} />;
      case 'Конфиденциальность':
        return <PrivacySettingsView {...subviewProps} />;
      case 'Безопасность (2FA)':
        return <SecuritySettingsView {...subviewProps} />;
      case 'Связанные устройства':
        return <LinkedDevicesSettingsView {...subviewProps} />;
      case 'Оформление и чаты':
        return <AppearanceSettingsView {...subviewProps} />;
      case 'Папки с чатами':
        return <ChatFoldersSettingsView {...subviewProps} />;
      case 'Звук и камера':
        return <AudioVideoSettingsView {...subviewProps} />;
      case 'Уведомления и звуки':
        return <NotificationsSettingsView {...subviewProps} />;
      case 'Данные и память':
        return <DataStorageSettingsView {...subviewProps} />;
      case 'Язык приложения':
        return <LanguageSettingsView {...subviewProps} />;
      case 'Продвинутые настройки':
        return <AdvancedSettingsView {...subviewProps} />;
      case 'Помощь и поддержка':
        return <HelpSettingsView {...subviewProps} />;
      case 'QR-код профиля':
        return <ProfileQRModal {...subviewProps} />;
      default:
        return (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center mt-10">
             <Settings className="w-16 h-16 text-[#8696A0] mb-4 opacity-50" />
             <h2 className="text-lg text-[#E9EDEF] mb-2">Раздел «{activeSetting}»</h2>
             <p className="text-sm text-[#8696A0] max-w-[280px]">
               В этом разделе настройки синхронизируются или в разработке.
             </p>
          </div>
        );
    }
  };

  const getLanguageLabel = () => {
    const code = prefs?.language || 'ru';
    if (code === 'en') return 'English';
    if (code === 'es') return 'Español';
    if (code === 'de') return 'Deutsch';
    if (code === 'uk') return 'Українська';
    if (code === 'uz') return "O'zbek";
    if (code === 'kk') return 'Қазақ';
    if (code === 'tr') return 'Türkçe';
    return 'Русский';
  };

  const getThemeLabel = () => {
    const th = prefs?.theme;
    if (th === 'amoled') return 'AMOLED';
    if (th === 'emerald') return 'Изумруд';
    if (th === 'midnight') return 'Синий';
    if (th === 'light') return 'Светлая';
    return 'Тёмная';
  };

  if (activeSetting) {
    return (
      <div className="flex-1 flex flex-col bg-[#0B141A] z-10 absolute inset-0 pt-10 pb-0 animate-in slide-in-from-right-4 duration-200">
        <div className="flex justify-between items-center px-4 pb-4 border-b border-[#202C33]">
          <button onClick={() => setActiveSetting(null)} className="text-[#E9EDEF] active:opacity-70 transition-opacity flex items-center gap-1">
            <ChevronLeft className="w-7 h-7" strokeWidth={2} />
            <span className="text-[17px] text-[#34B7F1]">Назад</span>
          </button>
          <h1 className="text-xl font-semibold">{activeSetting}</h1>
          <div className="w-[70px]"></div>
        </div>
        <div className="flex-1 overflow-y-auto no-scrollbar pt-2 bg-[#0B141A]">
          {renderActiveSettingContent()}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col bg-[#0B141A] z-10 absolute inset-0 pt-10 pb-0">
      <div className="flex justify-between items-center px-4 pb-4">
        <button onClick={onBack} className="text-[#E9EDEF] active:opacity-70 transition-opacity">
          <ChevronLeft className="w-7 h-7" strokeWidth={2} />
        </button>
        <h1 className="text-xl font-semibold">Настройки</h1>
        <div className="w-7"></div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar pb-6 px-4 space-y-5">
        {/* Profile Card */}
        <div className="bg-[#111B21] rounded-2xl p-4 border border-[#202C33] flex items-center gap-4 shadow-sm relative overflow-hidden group">
           <img 
              src={userProfile.avatar} 
              className="w-16 h-16 rounded-full object-cover border border-[#202C33] cursor-pointer" 
              onClick={() => editProfile('avatar', 'Введите URL новой аватарки:')}
              alt="Avatar"
           />
           <div className="flex-1 cursor-pointer" onClick={() => editProfile('name', 'Введите ваше имя:')}>
              <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                {userProfile.name} <Edit2 className="w-3 h-3 text-[#8696A0] opacity-0 group-hover:opacity-100 transition-opacity" />
              </h2>
              <p className="text-[14px] text-[#00A884]" onClick={(e) => { e.stopPropagation(); editProfile('username', 'Введите ваш username (без @):'); }}>
                {userProfile.username}
              </p>
              <p className="text-[14px] text-[#8696A0] mt-0.5">{userProfile.phone || '+7 999 123-45-67'}</p>
           </div>
           <button 
             className="w-10 h-10 rounded-full bg-[#202C33] flex items-center justify-center cursor-pointer hover:bg-[#2A3942] transition-colors" 
             onClick={() => setActiveSetting('QR-код профиля')}
             title="Показать QR-код профиля"
           >
              <QrCode className="w-5 h-5 text-white" />
           </button>
        </div>

        {/* Block 1: Account & Privacy */}
        <div className="bg-[#111B21] rounded-2xl border border-[#202C33] overflow-hidden shadow-sm">
           <SettingRow icon={<Key className="w-5 h-5" />} color="bg-blue-500" label="Аккаунт" onClick={() => setActiveSetting('Аккаунт')} />
           <SettingRow icon={<Lock className="w-5 h-5" />} color="bg-cyan-500" label="Конфиденциальность" onClick={() => setActiveSetting('Конфиденциальность')} />
           <SettingRow icon={<ShieldAlert className="w-5 h-5" />} color="bg-green-600" label="Безопасность (2FA)" onClick={() => setActiveSetting('Безопасность (2FA)')} />
           <SettingRow icon={<MonitorSmartphone className="w-5 h-5" />} color="bg-orange-500" label="Связанные устройства" badge="2" isLast onClick={() => setActiveSetting('Связанные устройства')} />
        </div>

        {/* Block 2: Chat & Organization */}
        <div className="bg-[#111B21] rounded-2xl border border-[#202C33] overflow-hidden shadow-sm">
           <SettingRow icon={<Palette className="w-5 h-5" />} color="bg-pink-500" label="Оформление и чаты" value={getThemeLabel()} onClick={() => setActiveSetting('Оформление и чаты')} />
           <SettingRow icon={<Folder className="w-5 h-5" />} color="bg-indigo-500" label="Папки с чатами" value={folders ? `${folders.length} папок` : undefined} onClick={() => setActiveSetting('Папки с чатами')} />
           <SettingRow icon={<PhoneCall className="w-5 h-5" />} color="bg-teal-500" label="Звук и камера" onClick={() => setActiveSetting('Звук и камера')} />
           <SettingRow icon={<Volume2 className="w-5 h-5" />} color="bg-red-500" label="Уведомления и звуки" isLast onClick={() => setActiveSetting('Уведомления и звуки')} />
        </div>

        {/* Block 3: Data & Storage */}
        <div className="bg-[#111B21] rounded-2xl border border-[#202C33] overflow-hidden shadow-sm">
           <SettingRow icon={<Database className="w-5 h-5" />} color="bg-emerald-500" label="Данные и память" onClick={() => setActiveSetting('Данные и память')} />
           <SettingRow icon={<Globe className="w-5 h-5" />} color="bg-purple-500" label="Язык приложения" value={getLanguageLabel()} onClick={() => setActiveSetting('Язык приложения')} />
           <SettingRow icon={<Settings className="w-5 h-5" />} color="bg-gray-500" label="Продвинутые настройки" isLast onClick={() => setActiveSetting('Продвинутые настройки')} />
        </div>
        
        {/* Block 4: Help */}
        <div className="bg-[#111B21] rounded-2xl border border-[#202C33] overflow-hidden shadow-sm">
           <SettingRow icon={<HelpCircle className="w-5 h-5" />} color="bg-yellow-500" label="Помощь и поддержка" isLast onClick={() => setActiveSetting('Помощь и поддержка')} />
        </div>

        {/* Logout */}
        <div className="bg-[#111B21] rounded-2xl p-4 border border-[#202C33] shadow-sm">
           <div className="text-[#F15C5C] font-medium py-1 text-center cursor-pointer active:opacity-70 transition-opacity" onClick={() => { showToast('Вы вышли из аккаунта (демо)'); onBack(); }}>
              Выйти из аккаунта
           </div>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ icon, color, label, value, badge, isLast, onClick }: { icon: React.ReactNode, color: string, label: string, value?: string, badge?: string, isLast?: boolean, onClick: () => void }) {
  return (
    <div className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-[#202C33] transition-colors active:bg-[#2A3942]`} onClick={onClick}>
       <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-white ${color} shadow-sm`}>
          {icon}
       </div>
       <div className={`flex-1 flex justify-between items-center py-1 ${!isLast ? 'border-b border-[#202C33]' : ''}`}>
          <span className="text-[16px] font-medium text-[#E9EDEF]">{label}</span>
          <div className="flex items-center gap-2">
            {value && <span className="text-[#8696A0] text-[15px]">{value}</span>}
            {badge && (
               <div className="bg-[#00A884] text-white text-xs font-bold px-1.5 h-5 min-w-[20px] rounded-full flex items-center justify-center">
                  {badge}
               </div>
            )}
            <ChevronRight className="w-5 h-5 text-[#8696A0]" />
          </div>
       </div>
    </div>
  );
}

// --- NEW CREATE ENTITY VIEW (Chats/Channels) ---
function CreateEntityView({ onBack, onCreate }: { onBack: () => void, onCreate: (chat: ChatType) => void }) {
  const [type, setType] = useState<'group' | 'channel'>('group');
  const [name, setName] = useState('');
  const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

  const allUsers: UserType[] = []; // Real-account mode: never show demo/AI users

  const toggleUser = (id: string) => {
    const newSet = new Set(selectedUsers);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedUsers(newSet);
  };

  const handleCreate = () => {
    if (!name.trim()) return;
    
    const newChat: ChatType = {
      id: `chat_${Date.now()}`,
      user: {
        id: `entity_${Date.now()}`,
        name: name.trim(),
        isGroup: type === 'group',
        isChannel: type === 'channel',
        avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=200`
      },
      lastMessage: {
        id: Date.now().toString(),
        senderId: 'system',
        text: type === 'group' ? 'Группа создана' : 'Канал создан',
        time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        type: 'system'
      }
    };
    onCreate(newChat);
  };

  return (
    <div className="flex-1 flex flex-col bg-[#0B141A] z-20 absolute inset-0 pt-10 animate-in slide-in-from-right-full duration-300">
      <div className="flex justify-between items-center px-4 pb-4 border-b border-[#202C33]">
        <button onClick={onBack} className="text-[#E9EDEF] active:opacity-70 transition-opacity">
          <ChevronLeft className="w-7 h-7" strokeWidth={2} />
        </button>
        <div className="flex-1 flex justify-center">
           <div className="bg-[#202C33] rounded-full p-1 flex w-48 relative">
              <div className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-[#00A884] rounded-full transition-transform duration-300 ${type === 'channel' ? 'translate-x-[100%]' : ''}`}></div>
              <button onClick={() => setType('group')} className={`flex-1 py-1 text-sm font-medium z-10 transition-colors ${type === 'group' ? 'text-white' : 'text-[#8696A0]'}`}>Группа</button>
              <button onClick={() => setType('channel')} className={`flex-1 py-1 text-sm font-medium z-10 transition-colors ${type === 'channel' ? 'text-white' : 'text-[#8696A0]'}`}>Канал</button>
           </div>
        </div>
        <button 
           onClick={handleCreate}
           disabled={!name.trim()}
           className={`font-semibold text-lg transition-colors ${name.trim() ? 'text-[#00A884]' : 'text-[#202C33]'}`}
        >
          Готово
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
        {/* Top section: Avatar and Name */}
        <div className="p-6 flex flex-col items-center border-b border-[#202C33] bg-[#111B21]">
           <div className="w-24 h-24 rounded-full bg-[#202C33] flex flex-col items-center justify-center text-[#8696A0] mb-5 border-2 border-dashed border-[#374045] cursor-pointer hover:bg-[#2A3942] transition-colors relative overflow-hidden group">
              <Camera className="w-8 h-8 mb-1" />
              <span className="text-[10px] uppercase font-bold tracking-wider">Фото</span>
           </div>
           
           <input 
              type="text" 
              placeholder={`Название ${type === 'group' ? 'группы' : 'канала'}...`}
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-transparent border-b-2 border-[#00A884] outline-none text-center text-xl text-white pb-2 placeholder-[#8696A0]"
              autoFocus
           />
           <p className="text-xs text-[#8696A0] mt-3 text-center">
              {type === 'group' ? 'Участники смогут отправлять сообщения.' : 'Только администраторы смогут публиковать записи.'}
           </p>
        </div>

        {/* User Selection */}
        <div className="flex-1 bg-[#0B141A]">
           <div className="px-4 py-3 bg-[#111B21]/50 border-b border-[#202C33]">
              <h3 className="text-[#00A884] text-sm font-semibold uppercase tracking-wider">
                 Добавить участников {selectedUsers.size > 0 && `(${selectedUsers.size})`}
              </h3>
           </div>
           <div className="py-2">
              {allUsers.map(u => (
                 <div key={u.id} onClick={() => toggleUser(u.id)} className="flex items-center px-4 py-3 hover:bg-[#202C33] cursor-pointer active:bg-[#2A3942] transition-colors">
                    <div className="relative">
                       <img src={u.avatar} className="w-12 h-12 rounded-full object-cover" />
                       {selectedUsers.has(u.id) && (
                          <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-[#00A884] rounded-full border-2 border-[#0B141A] flex items-center justify-center animate-in zoom-in">
                             <Check className="w-3 h-3 text-white" strokeWidth={3} />
                          </div>
                       )}
                    </div>
                    <div className="ml-4 flex-1">
                       <h3 className="text-[16px] text-[#E9EDEF] font-medium">{u.name}</h3>
                       <p className="text-[14px] text-[#8696A0]">{u.isOnline ? 'В сети' : 'Был(а) недавно'}</p>
                    </div>
                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedUsers.has(u.id) ? 'bg-[#00A884] border-[#00A884]' : 'border-[#8696A0]'}`}>
                       {selectedUsers.has(u.id) && <Check className="w-4 h-4 text-white" />}
                    </div>
                 </div>
              ))}
           </div>
        </div>
      </div>
      
      {/* Floating Action Button */}
      {name.trim() && (
         <button onClick={handleCreate} className="absolute bottom-8 right-6 w-14 h-14 bg-[#00C896] hover:bg-[#00A884] rounded-full shadow-lg shadow-[#00A884]/40 flex items-center justify-center text-white animate-in zoom-in z-30 transition-transform active:scale-95">
            <Check className="w-7 h-7" strokeWidth={2.5} />
         </button>
      )}
    </div>
  );
}

// --- Modified PeopleList for Group/Channel creation ---
function PeopleList({ onUserClick, onCreateClick }: { onUserClick: (u: UserType) => void, onCreateClick: () => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');

  const search = async () => {
    if (!query.trim()) return;
    setBusy(true); setStatus('');
    try {
      const res = await fetch(`/api/search_users?q=${encodeURIComponent(query.trim())}`, { credentials: 'include' });
      const data = await res.json();
      setResults(Array.isArray(data) ? data : []);
      if (!data?.length) setStatus('Пользователь не найден');
    } catch { setStatus('Нет соединения с сервером'); }
    finally { setBusy(false); }
  };

  const loadRequests = async () => {
    try {
      const res = await fetch('/api/friend_requests', { credentials: 'include' });
      const data = await res.json();
      setRequests(Array.isArray(data) ? data : []);
    } catch {}
  };

  useEffect(() => { void loadRequests(); }, []);

  const addFriend = async (username: string) => {
    setBusy(true); setStatus('');
    try {
      const res = await fetch('/api/send_friend_request', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: username })
      });
      const data = await res.json();
      setStatus(data.ok ? 'Заявка отправлена ✓' : (data.error || 'Не удалось отправить заявку'));
    } catch { setStatus('Нет соединения с сервером'); }
    finally { setBusy(false); }
  };

  const accept = async (username: string) => {
    try {
      const res = await fetch('/api/accept_friend_request', {
        method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username })
      });
      const data = await res.json();
      if (data.ok) {
        const r = requests.find(x => x.username === username);
        if (r) onUserClick({ id: username, name: r.display_name || username, username: '@' + username, isOnline: true, avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(r.display_name || username)}&background=5865f2&color=fff` });
        setRequests(prev => prev.filter(x => x.username !== username));
        setStatus('Друг добавлен ✓');
      }
    } catch { setStatus('Нет соединения с сервером'); }
  };

  return (
    <div className="flex-1 flex flex-col pt-10 pb-[68px]">
      <div className="px-4 pb-3 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Контакты</h1>
        <Search className="w-6 h-6 text-white" />
      </div>
      <div className="px-4 pb-3 flex gap-2">
        <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void search(); }} placeholder="@username или номер" className="flex-1 bg-[#202C33] rounded-xl px-4 py-3 outline-none text-white" />
        <button onClick={() => void search()} disabled={busy} className="px-4 rounded-xl bg-[#00A884] text-white font-medium">Найти</button>
      </div>
      {status && <div className="px-4 pb-2 text-sm text-[#8696A0]">{status}</div>}
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <div className="py-2 border-b border-[#202C33]">
          <div className="px-4 py-3 flex items-center gap-4 hover:bg-[#202C33] cursor-pointer text-[#00A884]" onClick={onCreateClick}>
            <div className="w-10 h-10 rounded-full bg-[#00A884]/10 flex items-center justify-center"><Users className="w-5 h-5" /></div>
            <span className="font-medium">Создать группу / канал</span>
          </div>
        </div>

        {requests.length > 0 && <div className="pt-3">
          <h3 className="px-4 py-2 text-xs font-semibold text-[#8696A0] uppercase">Заявки в друзья</h3>
          {requests.map(r => <div key={r.username} className="flex items-center px-4 py-3 gap-3">
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(r.display_name || r.username)}&background=5865f2&color=fff`} className="w-10 h-10 rounded-full" />
            <div className="flex-1"><div className="font-medium">{r.display_name}</div><div className="text-xs text-[#8696A0]">@{r.username}</div></div>
            <button onClick={() => void accept(r.username)} className="px-3 py-2 rounded-lg bg-[#00A884] text-white text-sm">Принять</button>
          </div>)}
        </div>}

        <div className="pt-3">
          <h3 className="px-4 py-2 text-xs font-semibold text-[#8696A0] uppercase">Результат поиска</h3>
          {results.map(r => <div key={r.username} className="flex items-center px-4 py-3 gap-3 hover:bg-[#202C33]">
            <img src={`https://ui-avatars.com/api/?name=${encodeURIComponent(r.display_name || r.username)}&background=5865f2&color=fff`} className="w-10 h-10 rounded-full" />
            <div className="flex-1 cursor-pointer" onClick={() => onUserClick({ id: r.username, name: r.display_name || r.username, username: '@' + r.username, isOnline: r.status === 'online', avatar: `https://ui-avatars.com/api/?name=${encodeURIComponent(r.display_name || r.username)}&background=5865f2&color=fff` })}>
              <div className="font-medium">{r.display_name || r.username}</div><div className="text-xs text-[#8696A0]">@{r.username}</div>
            </div>
            {!r.is_friend && <button onClick={() => void addFriend(r.username)} className="px-3 py-2 rounded-lg bg-[#00A884] text-white text-sm">Добавить</button>}
          </div>)}
          {!results.length && <div className="px-4 py-8 text-center text-[#8696A0]">Найди друга по @username или номеру телефона</div>}
        </div>
      </div>
    </div>
  );
}

// --- Voice waveform & audio helpers ---
function compressWaveform(samples: number[], targetCount = 26): number[] {
  if (!samples || samples.length === 0) {
    return Array(targetCount).fill(3);
  }
  if (samples.length <= targetCount) {
    const res = [...samples];
    while (res.length < targetCount) {
      res.unshift(3);
    }
    return res;
  }
  const result: number[] = [];
  const step = samples.length / targetCount;
  for (let i = 0; i < targetCount; i++) {
    const start = Math.floor(i * step);
    const end = Math.floor((i + 1) * step);
    let peak = 3;
    for (let j = start; j < end && j < samples.length; j++) {
      if (samples[j] > peak) peak = samples[j];
    }
    result.push(peak);
  }
  return result;
}

function formatVoiceDuration(totalSecs: number): string {
  const m = Math.floor(totalSecs / 60);
  const s = totalSecs % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- Chat Room Component ---
function ChatRoom({ 
  chat, 
  messages, 
  onBack, 
  onSendMessage, 
  onCall, 
  onMoreClick, 
  onProfileClick, 
  showToast, 
  showContextMenu, 
  onDeleteMessage, 
  onUpdateMessage, 
  toggles = {},
  prefs = {}
}: { 
  chat: ChatType, 
  messages: MessageObjType[], 
  onBack: () => void, 
  onSendMessage: (data: Partial<MessageObjType>) => void, 
  onCall: (isVideo: boolean) => void, 
  onMoreClick: () => void, 
  onProfileClick: () => void, 
  showToast: (msg: string) => void, 
  showContextMenu: (e: React.MouseEvent, options: MenuOption[]) => void, 
  onDeleteMessage: (id: string) => void, 
  onUpdateMessage: (id: string, updates: Partial<MessageObjType>) => void, 
  toggles?: Record<string, boolean>,
  prefs?: Record<string, string>
}) {
  const currentTheme = THEMES[prefs?.theme as ThemeId] || THEMES.dark;
  const currentWallpaper = WALLPAPERS[prefs?.chat_wallpaper as WallpaperId] || WALLPAPERS.classic;
  const fontSize = Number(prefs?.font_size || 15);
  const roundedBubbles = toggles?.rounded_bubbles !== false;
  const [inputText, setInputText] = useState('');
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttachment, setShowAttachment] = useState(false);
  const [replyingTo, setReplyingTo] = useState<MessageObjType | null>(null);
  const [editingMessage, setEditingMessage] = useState<MessageObjType | null>(null);
  
  // Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [currentWaveform, setCurrentWaveform] = useState<number[]>(Array(24).fill(3));
  const recordDurationRef = useRef<number>(0);
  const fullWaveformRef = useRef<number[]>([]);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<BlobPart[]>([]);
  const recordInterval = useRef<any>(null);
  const sampleIntervalRef = useRef<any>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const pressStartTimeRef = useRef<number>(0);
  const isHoldingMicRef = useRef<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
  }, [messages]);

  useEffect(() => {
    return () => {
      if (recordInterval.current) clearInterval(recordInterval.current);
      if (sampleIntervalRef.current) clearInterval(sampleIntervalRef.current);
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const handleSendText = () => {
    if (inputText.trim()) {
      if (editingMessage) {
        onUpdateMessage(editingMessage.id, { text: inputText.trim() });
        setEditingMessage(null);
      } else {
        onSendMessage({ type: 'text', text: inputText.trim(), replyToMessage: replyingTo || undefined });
        setReplyingTo(null);
      }
      setInputText('');
      setShowEmoji(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') handleSendText();
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const url = URL.createObjectURL(file);
      onSendMessage({ type: 'image', mediaUrl: url, text: 'Фото' });
      setShowAttachment(false);
    }
  };

  const shareLocation = () => {
    if ('geolocation' in navigator) {
      showToast('Получение геопозиции...');
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          onSendMessage({ 
            type: 'location', 
            location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            text: '📍 Геопозиция' 
          });
          setShowAttachment(false);
        },
        (err) => showToast('Ошибка доступа к геопозиции. Разрешите доступ в браузере.')
      );
    } else {
      showToast('Геолокация не поддерживается');
    }
  };

  const startRecording = async () => {
    if (isRecording) return;
    
    // Reset state & start counting seconds
    recordDurationRef.current = 0;
    setRecordDuration(0);
    fullWaveformRef.current = [];
    setCurrentWaveform(Array(24).fill(3));
    audioChunksRef.current = [];

    if (recordInterval.current) clearInterval(recordInterval.current);
    recordInterval.current = setInterval(() => {
      recordDurationRef.current += 1;
      setRecordDuration(recordDurationRef.current);
    }, 1000);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      const audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') {
        await audioCtx.resume();
      }
      audioCtxRef.current = audioCtx;

      const analyser = audioCtx.createAnalyser();
      analyser.fftSize = 64;
      analyser.smoothingTimeConstant = 0.3;
      analyserRef.current = analyser;

      const source = audioCtx.createMediaStreamSource(stream);
      source.connect(analyser);

      let mimeType = 'audio/webm';
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        mimeType = MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      }
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.start(100);
      setIsRecording(true);

      // Read audio frequency and volume data
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      if (sampleIntervalRef.current) clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = setInterval(() => {
        analyser.getByteFrequencyData(dataArray);
        let sum = 0;
        let count = 0;
        for (let i = 1; i < Math.min(dataArray.length, 24); i++) {
          sum += dataArray[i];
          count++;
        }
        const avg = count > 0 ? sum / count : 0;

        // When user speaks: bars move & surge with loudness (8px to 28px)
        // When user is silent: flat dot (3px) forming "......"
        let height = 3;
        if (avg > 9) {
          const norm = Math.min(1, (avg - 9) / 45);
          height = Math.round(8 + norm * 18 + (Math.random() * 4 - 2));
          height = Math.max(8, Math.min(28, height));
        } else {
          height = 3; // flat dot
        }

        fullWaveformRef.current.push(height);
        setCurrentWaveform(prev => [...prev.slice(1), height]);
      }, 75);

    } catch (err) {
      console.warn('Microphone error or permission denied, using simulated audio waveform:', err);
      showToast('Запись включена (тестовый режим аудио)');
      setIsRecording(true);

      // Simulation mode with speaking waves and silence
      let tick = 0;
      if (sampleIntervalRef.current) clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = setInterval(() => {
        tick++;
        const cycle = tick % 45;
        const isSpeaking = cycle > 10 && cycle < 32;
        let height = 3;
        if (isSpeaking) {
          height = Math.round(10 + Math.sin(tick * 0.4) * 8 + Math.random() * 8);
          height = Math.max(8, Math.min(28, height));
        } else {
          height = 3; // silence dot "......"
        }
        fullWaveformRef.current.push(height);
        setCurrentWaveform(prev => [...prev.slice(1), height]);
      }, 75);
    }
  };

  const stopAndSendRecording = () => {
    if (!isRecording) return;

    if (recordInterval.current) {
      clearInterval(recordInterval.current);
      recordInterval.current = null;
    }
    if (sampleIntervalRef.current) {
      clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }

    const durationSecs = Math.max(1, recordDurationRef.current);
    const formatted = formatVoiceDuration(durationSecs);
    const waveformData = compressWaveform(fullWaveformRef.current, 26);

    const cleanupAudioTracks = () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
        streamRef.current = null;
      }
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
        audioCtxRef.current = null;
      }
      setIsRecording(false);
    };

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const audioUrl = URL.createObjectURL(audioBlob);
        
        onSendMessage({
          type: 'voice',
          audioUrl,
          duration: formatted,
          waveform: waveformData,
          text: 'Голосовое сообщение'
        });
        playSendSound();
        cleanupAudioTracks();
      };
      mediaRecorderRef.current.stop();
    } else {
      // Simulated or instant fallback
      onSendMessage({
        type: 'voice',
        duration: formatted,
        waveform: waveformData,
        text: 'Голосовое сообщение'
      });
      playSendSound();
      cleanupAudioTracks();
    }
  };

  const cancelRecording = () => {
    if (recordInterval.current) {
      clearInterval(recordInterval.current);
      recordInterval.current = null;
    }
    if (sampleIntervalRef.current) {
      clearInterval(sampleIntervalRef.current);
      sampleIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }
    setIsRecording(false);
    setRecordDuration(0);
    recordDurationRef.current = 0;
    showToast('Запись отменена');
  };

  const handleMicMouseDown = () => {
    pressStartTimeRef.current = Date.now();
    isHoldingMicRef.current = true;
    startRecording();
  };

  const handleMicMouseUp = () => {
    if (isHoldingMicRef.current) {
      isHoldingMicRef.current = false;
      const elapsed = Date.now() - pressStartTimeRef.current;
      if (elapsed > 400) {
        stopAndSendRecording();
      }
    }
  };

  return (
    <div className="flex-1 flex flex-col z-10 absolute inset-0" style={{ backgroundColor: currentTheme.bgApp }}>
      <div className="h-[60px] pt-7 pb-2 px-2 flex items-center justify-between shadow-md z-20" style={{ backgroundColor: currentTheme.bgHeader }}>
        <div className="flex items-center">
          <button onClick={onBack} className="p-2 text-[#E9EDEF]">
            <ChevronLeft className="w-6 h-6" strokeWidth={2} />
          </button>
          <div className="flex items-center gap-3 cursor-pointer" onClick={onProfileClick}>
             <div className="relative">
                <img src={chat.user.avatar || `https://ui-avatars.com/api/?name=${chat.user.name}`} className="w-10 h-10 rounded-full object-cover bg-gray-800" />
                {chat.user.isOnline && <div className="absolute bottom-0 right-0 w-3 h-3 bg-[#00A884] border-2 border-[#111B21] rounded-full"></div>}
             </div>
             <div>
                <div className="flex items-center gap-1">
                  <h2 className="font-semibold text-[#E9EDEF]">{chat.user.name}</h2>
                  {chat.user.isVerified && <BadgeCheck className="w-4 h-4 text-[#1D9BF0]" fill="currentColor" stroke="white" />}
                </div>
                <p className="text-[12px] text-[#00A884]">{chat.user.isOnline ? 'в сети' : 'был(а) недавно'}</p>
             </div>
          </div>
        </div>
        <div className="flex items-center gap-4 text-[#E9EDEF] pr-2">
          {!chat.user.isChannel && !chat.user.isSavedMessages && <Video className="w-5 h-5 cursor-pointer active:text-[#00A884]" strokeWidth={1.5} onClick={() => onCall(true)} />}
          {!chat.user.isChannel && !chat.user.isSavedMessages && <Phone className="w-5 h-5 cursor-pointer active:text-[#00A884]" strokeWidth={1.5} onClick={() => onCall(false)} />}
          <MoreVertical className="w-5 h-5 cursor-pointer active:text-[#00A884]" strokeWidth={1.5} onClick={onMoreClick} />
        </div>
      </div>

      {toggles?.pinned_msg !== false && messages.some(m => m.isPinned) && (
        <div className="bg-[#111B21]/95 backdrop-blur-sm px-4 py-2 flex items-center justify-between cursor-pointer z-10 shadow-sm relative border-b border-[#202C33]/50">
          <div className="w-1 h-9 bg-[#00A884] rounded-full absolute left-4"></div>
          <div className="flex-1 overflow-hidden pl-3">
            <h4 className="text-[#00A884] text-[13px] font-medium flex items-center gap-1">
              Закрепленное сообщение
            </h4>
            <p className="text-[#E9EDEF] text-[13px] truncate">
              {messages.filter(m => m.isPinned).pop()?.text || 'Медиа сообщение'}
            </p>
          </div>
          <button 
            className="p-1.5 hover:bg-[#202C33] rounded-full text-[#8696A0] ml-2"
            onClick={(e) => {
              e.stopPropagation();
              const pinnedMsgId = messages.filter(m => m.isPinned).pop()?.id;
              if (pinnedMsgId) onUpdateMessage(pinnedMsgId, { isPinned: false });
            }}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div 
        className="flex-1 overflow-y-auto px-4 py-4 space-y-4 no-scrollbar relative" 
        style={{
          backgroundColor: currentTheme.bgChat,
          ...currentWallpaper.style
        }} 
        onClick={() => { setShowEmoji(false); setShowAttachment(false); }}
      >
         <div className="flex justify-center my-4">
            <span className="bg-[#182229] text-[#8696A0] text-xs px-3 py-1 rounded-full shadow-sm">Сегодня</span>
         </div>
         
         {messages.length === 0 && (
           <div className="text-center text-[#8696A0] mt-10">Нет сообщений</div>
         )}
         
         {messages.map((msg) => (
            <MessageBubble 
              key={msg.id} 
              msg={msg} 
              showContextMenu={showContextMenu} 
              showToast={showToast} 
              onDelete={() => onDeleteMessage(msg.id)}
              onReply={() => setReplyingTo(msg)}
              onEdit={() => { setEditingMessage(msg); setInputText(msg.text || ''); }}
              onForward={() => showToast('Пересылка пока недоступна (выберите чат)')}
              onPin={() => onUpdateMessage(msg.id, { isPinned: !msg.isPinned })}
              theme={currentTheme}
              fontSize={fontSize}
              roundedBubbles={roundedBubbles}
            />
         ))}
         <div ref={messagesEndRef} />
      </div>

      {showEmoji && (
        <div className="absolute bottom-[60px] left-0 w-full z-30 shadow-2xl">
           <EmojiPicker theme={'dark' as any} width="100%" height={300} onEmojiClick={(emoji) => setInputText(prev => prev + emoji.emoji)} />
        </div>
      )}

      {showAttachment && (
        <div className="absolute bottom-[65px] right-[55px] bg-[#202C33] rounded-2xl p-4 shadow-2xl z-30 flex gap-6 animate-in slide-in-from-bottom-2 border border-[#2A3942]">
           <button onClick={() => fileInputRef.current?.click()} className="flex flex-col items-center gap-2 text-white active:scale-95 transition-transform">
              <div className="w-12 h-12 rounded-full bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <ImageIcon className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium">Галерея</span>
           </button>
           <button onClick={shareLocation} className="flex flex-col items-center gap-2 text-white active:scale-95 transition-transform">
              <div className="w-12 h-12 rounded-full bg-green-500 flex items-center justify-center shadow-lg shadow-green-500/20">
                <MapPin className="w-6 h-6" />
              </div>
              <span className="text-xs font-medium">Локация</span>
           </button>
        </div>
      )}

      <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileUpload} />

      {(replyingTo || editingMessage) && (
        <div className="bg-[#111B21] px-4 py-2 border-t border-[#202C33] flex items-center gap-3 relative z-40">
          <div className="w-1 h-10 bg-[#00A884] rounded-full"></div>
          <div className="flex-1 overflow-hidden">
            <h4 className="text-[#00A884] text-[13px] font-medium">
              {editingMessage ? 'Редактирование' : 'Ответ на сообщение'}
            </h4>
            <p className="text-[#8696A0] text-[13px] truncate">
              {(editingMessage || replyingTo)?.text || 'Фото'}
            </p>
          </div>
          <button 
            onClick={() => {
              setReplyingTo(null);
              setEditingMessage(null);
              setInputText('');
            }} 
            className="p-2 text-[#8696A0] hover:bg-[#202C33] rounded-full"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="bg-[#111B21] px-2 py-2 pb-5 flex items-end gap-1.5 relative z-40 border-t border-[#202C33]">
         {isRecording ? (
           /* Dedicated Voice Recording Bar */
           <div className="flex-1 bg-[#202C33] rounded-3xl flex items-center justify-between px-3.5 py-1.5 min-h-[46px] border border-red-500/25 shadow-inner animate-in fade-in duration-150">
              {/* Left: Pulsing red indicator & Seconds counter (0:01, 0:02...) */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <div className="relative flex items-center justify-center">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-ping absolute opacity-75"></span>
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 relative shadow-[0_0_8px_rgba(239,68,68,0.9)]"></span>
                </div>
                <span className="font-mono text-[14px] font-semibold text-red-400 tracking-wider">
                  {formatVoiceDuration(recordDuration)}
                </span>
              </div>

              {/* Center: Live Waveform Visualizer ("эта штука") */}
              {/* When speaking: bars fluctuate and surge with voice volume! */}
              {/* When silent: small rounded dots aligned horizontally, forming "......" */}
              <div className="flex-1 flex items-center justify-center gap-[3px] px-2 h-7 overflow-hidden mx-1.5" title="Индикатор голоса">
                {currentWaveform.map((val, idx) => (
                  val <= 4 ? (
                    /* Silence: dot "......" */
                    <div 
                      key={idx} 
                      className="w-1.5 h-1.5 rounded-full bg-[#8696A0]/70 flex-shrink-0 transition-all duration-75" 
                    />
                  ) : (
                    /* Speaking: dynamic moving bar */
                    <div 
                      key={idx} 
                      className="w-1 rounded-full bg-[#00A884] flex-shrink-0 transition-all duration-75"
                      style={{ 
                        height: `${val}px`,
                        boxShadow: '0 0 5px rgba(0, 168, 132, 0.45)'
                      }} 
                    />
                  )
                ))}
              </div>

              {/* Right: Trash / Cancel button */}
              <button 
                onClick={cancelRecording}
                title="Отменить запись"
                className="p-1.5 text-[#8696A0] hover:text-red-400 active:scale-90 transition-all flex items-center gap-1"
              >
                <Trash2 className="w-4 h-4" />
                <span className="text-xs hidden sm:inline text-[#8696A0]">Отмена</span>
              </button>
           </div>
         ) : (
           /* Standard Text & Attachment Input */
           <div className="flex-1 bg-[#202C33] rounded-3xl flex items-center px-1 py-1 min-h-[44px]">
              <button className={`p-2 transition-colors ${showEmoji ? 'text-[#00A884]' : 'text-[#8696A0]'}`} onClick={() => { setShowEmoji(!showEmoji); setShowAttachment(false); }}>
                <Smile className="w-6 h-6" strokeWidth={1.5} />
              </button>
              <input 
                 type="text" 
                 placeholder={chat.user.isChannel ? "Опубликовать..." : "Сообщение..."}
                 value={inputText}
                 onChange={(e) => setInputText(e.target.value)}
                 onKeyDown={handleKeyDown}
                 spellCheck={toggles?.spellcheck ?? true}
                 className="flex-1 bg-transparent outline-none border-none text-[#E9EDEF] px-1 py-2 text-[15px]" 
              />
              <button className={`p-2 transition-colors ${showAttachment ? 'text-[#00A884]' : 'text-[#8696A0]'}`} onClick={() => { setShowAttachment(!showAttachment); setShowEmoji(false); }}>
                <Paperclip className="w-5 h-5" style={{transform: 'rotate(-45deg)'}} strokeWidth={1.5} />
              </button>
              <button className="p-2 text-[#8696A0] active:text-[#00A884]" onClick={() => fileInputRef.current?.click()}>
                <Camera className="w-5 h-5" strokeWidth={1.5} />
              </button>
           </div>
         )}
         
         {isRecording ? (
            /* Send Voice Recording button */
            <button 
              onClick={stopAndSendRecording} 
              title="Отправить голосовое сообщение"
              className="w-[44px] h-[44px] rounded-full bg-[#00A884] flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 shadow-lg shadow-[#00A884]/30 hover:bg-[#00b890]"
            >
              <Send className="w-5 h-5 text-white ml-0.5" strokeWidth={2} />
            </button>
         ) : inputText.trim() ? (
            /* Send Text button */
            <button onClick={handleSendText} className="w-[44px] h-[44px] rounded-full bg-[#00A884] flex items-center justify-center flex-shrink-0 transition-transform active:scale-95 shadow-lg shadow-[#00A884]/20">
              <Send className="w-5 h-5 text-white ml-0.5" strokeWidth={2} />
            </button>
         ) : (
            /* Microphone button (Click or Hold to record) */
            <button 
               onMouseDown={handleMicMouseDown}
               onMouseUp={handleMicMouseUp}
               onTouchStart={handleMicMouseDown}
               onTouchEnd={handleMicMouseUp}
               title="Нажмите для записи голосового сообщения"
               className="w-[44px] h-[44px] rounded-full bg-[#00A884] flex items-center justify-center flex-shrink-0 transition-all active:scale-90 active:bg-green-600 shadow-lg shadow-[#00A884]/20"
            >
              <Mic className="w-5 h-5 text-white" strokeWidth={1.5} />
            </button>
         )}
      </div>
    </div>
  );
}

// --- Voice Message Player Component ---
function VoiceMessagePlayer({ msg, isMe }: { msg: MessageObjType; isMe: boolean }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackSeconds, setPlaybackSeconds] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<any>(null);
  const synthCtxRef = useRef<AudioContext | null>(null);

  // Total seconds parsed from msg.duration (e.g. "0:12" => 12)
  const totalSeconds = useMemo(() => {
    if (!msg.duration) return 12;
    const parts = msg.duration.split(':').map(Number);
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return (parts[0] * 60) + parts[1];
    }
    return 12;
  }, [msg.duration]);

  // Waveform data (peaks for speech, flat 3 for silence dots)
  const waveform = useMemo(() => {
    if (msg.waveform && msg.waveform.length > 0) {
      return msg.waveform;
    }
    // Authentic fallback with speech bursts and silence dots "......"
    return [3, 3, 3, 14, 22, 26, 18, 12, 3, 3, 3, 16, 24, 28, 22, 16, 3, 3, 3, 12, 20, 24, 18, 3, 3, 3];
  }, [msg.waveform]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      if (synthCtxRef.current && synthCtxRef.current.state !== 'closed') {
        synthCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  const playSyntheticAudio = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      synthCtxRef.current = ctx;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, ctx.currentTime);
      gain.gain.setValueAtTime(0.04, ctx.currentTime);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      setTimeout(() => {
        try {
          osc.stop();
          ctx.close();
        } catch {}
      }, (totalSeconds - playbackSeconds) * 1000);
    } catch {}
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      // Pause
      if (audioRef.current) {
        audioRef.current.pause();
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (synthCtxRef.current && synthCtxRef.current.state !== 'closed') {
        synthCtxRef.current.close().catch(() => {});
      }
      setIsPlaying(false);
    } else {
      // Start Playback
      setIsPlaying(true);
      if (msg.audioUrl) {
        if (!audioRef.current) {
          const audio = new Audio(msg.audioUrl);
          audioRef.current = audio;
          audio.playbackRate = playbackSpeed;
          audio.ontimeupdate = () => {
            setPlaybackSeconds(Math.floor(audio.currentTime));
          };
          audio.onended = () => {
            setIsPlaying(false);
            setPlaybackSeconds(0);
          };
        }
        audioRef.current.playbackRate = playbackSpeed;
        if (playbackSeconds >= totalSeconds) {
          audioRef.current.currentTime = 0;
          setPlaybackSeconds(0);
        }
        audioRef.current.play().catch(() => {});
      } else {
        playSyntheticAudio();
      }

      // Count seconds during playback: 0:00 -> 0:01 -> 0:02...
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setPlaybackSeconds(prev => {
          const next = prev + 1;
          if (next >= totalSeconds) {
            clearInterval(timerRef.current);
            setIsPlaying(false);
            return 0;
          }
          return next;
        });
      }, 1000 / playbackSpeed);
    }
  };

  const handleSeek = (idx: number) => {
    const targetSec = Math.round((idx / waveform.length) * totalSeconds);
    setPlaybackSeconds(targetSec);
    if (audioRef.current) {
      audioRef.current.currentTime = targetSec;
    }
  };

  const handleCycleSpeed = (e: React.MouseEvent) => {
    e.stopPropagation();
    const speeds = [1, 1.5, 2];
    const nextSpeed = speeds[(speeds.indexOf(playbackSpeed) + 1) % speeds.length];
    setPlaybackSpeed(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const progress = totalSeconds > 0 ? playbackSeconds / totalSeconds : 0;

  return (
    <div className="voice-message-player flex items-center gap-3 py-1.5">
      {/* Play / Pause button */}
      <button 
        onClick={handleTogglePlay} 
        title={isPlaying ? "Пауза" : "Воспроизвести"}
        className="w-10 h-10 rounded-full bg-[#00A884] flex items-center justify-center flex-shrink-0 active:scale-95 transition-transform shadow-md hover:bg-[#00b890]"
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 text-white fill-white" />
        ) : (
          <Play className="w-5 h-5 text-white fill-white ml-0.5" />
        )}
      </button>

      <div className="flex-1 flex flex-col justify-center gap-1.5">
        {/* Waveform with speech bars & silence dots "......" */}
        <div className="voice-waveform flex items-center gap-[3px] h-7 overflow-hidden cursor-pointer" title="Нажмите для перемотки">
          {waveform.map((val, idx) => {
            const barProgress = idx / waveform.length;
            const isPlayed = barProgress <= progress;
            const isDot = val <= 4;
            
            return isDot ? (
              /* Silence dot "......" */
              <div 
                key={idx}
                onClick={() => handleSeek(idx)}
                className={`w-1.5 h-1.5 rounded-full transition-colors flex-shrink-0 ${
                  isPlayed 
                    ? 'bg-[#00A884]' 
                    : (isMe ? 'bg-white/40' : 'bg-[#8696A0]/60')
                }`}
              />
            ) : (
              /* Speech bar */
              <div 
                key={idx}
                onClick={() => handleSeek(idx)}
                className={`voice-waveform-bar w-1 rounded-full flex-shrink-0 ${
                  isPlayed 
                    ? 'bg-[#00A884]' 
                    : (isMe ? 'bg-white/40' : 'bg-[#8696A0]/60')
                }`}
                style={{ height: `${val}px` }}
              />
            );
          })}
        </div>

        {/* Counter and speed toggle */}
        <div className="flex items-center justify-between text-[11px] font-mono font-medium">
          <span className={isMe ? 'text-[#E9EDEF]/80' : 'text-[#8696A0]'}>
            {isPlaying 
              ? `${formatVoiceDuration(playbackSeconds)} / ${msg.duration || formatVoiceDuration(totalSeconds)}`
              : (msg.duration || formatVoiceDuration(totalSeconds))
            }
          </span>
          <button 
            onClick={handleCycleSpeed}
            title="Скорость воспроизведения"
            className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold transition-colors ${
              playbackSpeed > 1 
                ? 'bg-[#00A884] text-white' 
                : 'bg-black/20 text-[#8696A0] hover:text-white'
            }`}
          >
            {playbackSpeed}x
          </button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ 
  msg, 
  showContextMenu, 
  showToast, 
  onDelete, 
  onReply, 
  onEdit, 
  onForward, 
  onPin,
  theme,
  fontSize = 15,
  roundedBubbles = true
}: { 
  msg: MessageObjType, 
  showContextMenu: (e: React.MouseEvent, options: MenuOption[]) => void, 
  showToast: (msg: string) => void, 
  onDelete: () => void, 
  onReply: () => void, 
  onEdit: () => void, 
  onForward: () => void, 
  onPin: () => void, 
  theme?: ThemeConfig,
  fontSize?: number,
  roundedBubbles?: boolean,
  key?: React.Key 
}) {
  const isMe = msg.senderId === MY_ID;

  if (msg.type === 'system') {
    return (
       <div className="flex justify-center my-3">
          <span className="bg-[#182229] border border-[#2A3942] text-[#8696A0] text-[13px] px-3 py-1.5 rounded-xl shadow-sm text-center">
             {msg.text}
          </span>
       </div>
    );
  }

  const bubbleBg = isMe ? (theme?.bubbleMe || '#005C4B') : (theme?.bubbleOther || '#202C33');
  const bubbleTextColor = isMe ? (theme?.bubbleMeText || '#FFFFFF') : (theme?.bubbleOtherText || '#E9EDEF');
  const roundedClass = roundedBubbles ? (isMe ? 'rounded-2xl rounded-tr-sm' : 'rounded-2xl rounded-tl-sm') : 'rounded-md';

  return (
    <div className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
        <div 
          onContextMenu={(e) => {
            const options: MenuOption[] = [
              { label: 'Ответить', icon: <CornerUpLeft className="w-[18px] h-[18px]" strokeWidth={1.75} />, onClick: onReply },
              { label: 'Копировать', icon: <Copy className="w-[18px] h-[18px]" strokeWidth={1.75} />, onClick: () => { if (msg.text) { navigator.clipboard.writeText(msg.text); } showToast('Скопировано'); } },
              { label: 'Переслать', icon: <CornerUpRight className="w-[18px] h-[18px]" strokeWidth={1.75} />, onClick: onForward },
              { label: msg.isPinned ? 'Открепить' : 'Закрепить', icon: <Pin className="w-[18px] h-[18px]" strokeWidth={1.75} />, onClick: onPin }
            ];
            if (isMe && (msg.type === 'text' || msg.type === 'image')) {
              options.push({ label: 'Изменить', icon: <Edit2 className="w-[18px] h-[18px]" strokeWidth={1.75} />, onClick: onEdit });
            }
            options.push({ label: 'Удалить', icon: <Trash2 className="w-[18px] h-[18px]" strokeWidth={1.75} />, onClick: onDelete, danger: true });
            
            showContextMenu(e, options);
          }}
          className={`relative max-w-[85%] px-3 py-1.5 flex flex-col shadow-sm ${roundedClass}`}
          style={{
            backgroundColor: bubbleBg,
            color: bubbleTextColor
          }}
        >
          
          {msg.replyToMessage && (
            <div className={`mb-1 pl-2 border-l-2 ${isMe ? 'border-[#8696A0] bg-[#025042]' : 'border-[#00A884] bg-[#111B21]'} rounded-r-md py-1 pr-2`}>
              <p className={`text-[12px] font-medium ${isMe ? 'text-white' : 'text-[#00A884]'}`}>
                {msg.replyToMessage.senderId === MY_ID ? 'Вы' : users[msg.replyToMessage.senderId]?.name || 'Контакт'}
              </p>
              <p className="text-[12px] text-[#E9EDEF]/70 truncate">{msg.replyToMessage.text || 'Фото'}</p>
            </div>
          )}
          {msg.type === 'image' && (
              <div className="mb-1 mt-1 -mx-1">
                <img src={msg.mediaUrl} className="rounded-xl max-w-full max-h-[250px] object-cover" />
              </div>
          )}
          
          {msg.type === 'voice' && (
              <VoiceMessagePlayer msg={msg} isMe={isMe} />
          )}

          {msg.type === 'location' && msg.location && (
              <div className="py-2">
                <a href={`https://maps.google.com/?q=${msg.location.lat},${msg.location.lng}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 bg-black/20 hover:bg-black/30 transition-colors p-2 rounded-lg border border-white/5">
                  <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                    <Navigation className="w-5 h-5 text-red-500" />
                  </div>
                  <div className="flex flex-col">
                    <span className="font-medium text-[15px] text-white underline">Моя геопозиция</span>
                    <span className="text-xs text-[#8696A0]">Google Maps</span>
                  </div>
                </a>
              </div>
          )}

          {msg.type === 'text' && (
            <span className="leading-relaxed break-words" style={{ fontSize: `${fontSize}px` }}>{msg.text}</span>
          )}
          
          <div className={`flex items-center gap-1 self-end mt-0.5 ${['image', 'location'].includes(msg.type) ? 'absolute bottom-2 right-2 bg-black/50 px-1.5 rounded-full backdrop-blur-sm' : ''}`}>
              {msg.isEdited && <span className={`text-[11px] font-medium mr-0.5 ${['image', 'location'].includes(msg.type) ? 'text-white/80' : 'text-[#8696A0]'}`}>изменено</span>}
              <span className={`text-[11px] font-medium ${['image', 'location'].includes(msg.type) ? 'text-white' : 'text-[#8696A0]'}`}>{msg.time}</span>
              {isMe && (
                msg.isRead ? <CheckCheck className={`w-3.5 h-3.5 ${['image', 'location'].includes(msg.type) ? 'text-white' : 'text-[#34B7F1]'}`} /> : <Check className={`w-3.5 h-3.5 ${['image', 'location'].includes(msg.type) ? 'text-white' : 'text-[#8696A0]'}`} />
              )}
          </div>
        </div>
    </div>
  );
}

function ContextMenu({ x, y, options, onClose }: { x: number, y: number, options: MenuOption[], onClose: () => void }) {
  useEffect(() => {
    const handleClick = () => onClose();
    const timer = setTimeout(() => {
      window.addEventListener('click', handleClick);
      window.addEventListener('contextmenu', handleClick);
    }, 10);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('click', handleClick);
      window.removeEventListener('contextmenu', handleClick);
    };
  }, [onClose]);

  const menuWidth = 220;
  const menuHeight = options.length * 40 + 16;
  const adjustedX = x + menuWidth > window.innerWidth ? x - menuWidth : x;
  const adjustedY = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  return (
    <div 
      className="fixed bg-[#1C242D] shadow-[0_4px_24px_rgba(0,0,0,0.5)] rounded-xl py-1.5 px-1.5 z-[999] min-w-[210px] animate-in fade-in zoom-in-95 duration-100 border border-[#2B3643]"
      style={{ top: adjustedY, left: adjustedX }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
    >
      {options.map((opt, i) => (
        <button 
          key={i} 
          className={`w-full text-left px-3 py-2 rounded-md flex items-center gap-3.5 hover:bg-[#283441] transition-colors ${opt.danger ? 'text-[#F15C5C]' : 'text-white'}`}
          onClick={(e) => { e.stopPropagation(); opt.onClick(); onClose(); }}
        >
          {opt.icon && <span className={opt.danger ? 'text-[#F15C5C]' : 'text-[#8696A0]'}>{opt.icon}</span>}
          <span className="text-[14px] font-medium leading-relaxed">{opt.label}</span>
        </button>
      ))}
    </div>
  );
}

function Profile({ onBack, onSettingsClick, userProfile = users.alexey }: { onBack: () => void, onSettingsClick: () => void, userProfile?: any }) {
  const me = userProfile; 
  return (
    <div className="flex-1 flex flex-col bg-[#0B141A] z-10 absolute inset-0 pt-10 pb-[68px]">
      <div className="flex items-center justify-between px-2 pb-4">
        <div className="flex items-center">
          <button onClick={onBack} className="p-2 text-[#E9EDEF]">
            <ChevronLeft className="w-6 h-6" strokeWidth={2} />
          </button>
          <h1 className="text-xl font-semibold ml-2">Профиль</h1>
        </div>
        <button className="p-2 text-[#E9EDEF]" onClick={onSettingsClick}>
          <Settings className="w-6 h-6" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar pb-10">
        <div className="flex flex-col items-center pt-4 pb-6">
          <div className="relative">
            <img src={me.avatar} className="w-28 h-28 rounded-full border-2 border-[#1F2C34] shadow-[0_0_20px_rgba(52,183,241,0.2)] object-cover" />
            <button className="absolute bottom-0 right-0 w-8 h-8 bg-[#202C33] border-2 border-[#0B141A] rounded-full flex items-center justify-center text-white shadow-lg" onClick={onSettingsClick}>
              <Camera className="w-4 h-4" />
            </button>
          </div>
          <div className="flex items-center gap-1 mt-4">
            <h2 className="text-2xl font-semibold">{me.name}</h2>
            {me.isVerified && <BadgeCheck className="w-5 h-5 text-[#1D9BF0]" fill="currentColor" stroke="white" />}
          </div>
          <p className="text-[#8696A0] text-[15px]">{me.username}</p>
          <div className="flex items-center gap-1.5 mt-1">
             <div className="w-2 h-2 rounded-full bg-[#00A884]"></div>
             <span className="text-[#00A884] text-sm">В сети</span>
          </div>
          <button onClick={onSettingsClick} className="mt-5 w-[85%] bg-[#202C33] hover:bg-[#2A3942] transition-colors py-3 rounded-xl font-medium text-[15px] active:scale-95 shadow-sm">
            Редактировать профиль
          </button>
        </div>
        <div className="px-4 space-y-5">
           <div className="flex items-start gap-4" onClick={onSettingsClick}>
              <Phone className="w-6 h-6 text-[#8696A0] mt-1" strokeWidth={1.5} />
              <div className="flex-1 border-b border-[#202C33] pb-3">
                 <p className="text-[15px]">Телефон</p>
                 <p className="text-[#E9EDEF] font-medium">+7 999 123-45-67</p>
              </div>
           </div>
           <div className="flex items-start gap-4" onClick={onSettingsClick}>
              <span className="text-[#8696A0] text-xl font-bold mt-0.5">@</span>
              <div className="flex-1 border-b border-[#202C33] pb-3 flex justify-between items-center cursor-pointer group">
                 <div>
                    <p className="text-[15px]">Username</p>
                    <p className="text-[#E9EDEF] font-medium">{me.username}</p>
                 </div>
                 <SquarePen className="w-5 h-5 text-[#8696A0] group-hover:text-white transition-colors" />
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

function Sidebar({ onClose, onProfileClick, onMenuClick, userProfile = users.alexey }: { onClose: () => void, onProfileClick: () => void, onMenuClick: (m: string) => void, userProfile?: any }) {
  const me = userProfile;
  return (
    <div className="absolute inset-0 z-50 flex">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose}></div>
      <div className="w-[85%] max-w-[320px] bg-[#111B21] h-full flex flex-col pt-12 animate-in slide-in-from-left-full duration-200 shadow-2xl">
        <div className="px-5 pb-6 border-b border-[#202C33]">
           <div className="flex justify-between items-start">
             <img src={me.avatar} className="w-16 h-16 rounded-full border-2 border-[#1F2C34] object-cover shadow-sm" />
             <button onClick={onClose} className="p-2 -mr-2 text-[#8696A0] active:text-white transition-colors"><MoreVertical className="w-6 h-6" /></button>
           </div>
           <div className="mt-3" onClick={() => { onClose(); onProfileClick(); }}>
             <div className="flex items-center gap-1 cursor-pointer">
               <h2 className="text-lg font-semibold">{me.name}</h2>
               {me.isVerified && <BadgeCheck className="w-4 h-4 text-[#1D9BF0]" fill="currentColor" stroke="white" />}
             </div>
             <p className="text-[#8696A0] text-sm">{me.username}</p>
             <div className="flex items-center gap-1 mt-1">
               <div className="w-1.5 h-1.5 rounded-full bg-[#00A884]"></div>
               <span className="text-[#00A884] text-[13px] font-medium">В сети</span>
             </div>
           </div>
        </div>
        <div className="flex-1 overflow-y-auto py-3 space-y-1">
           <SidebarItem icon={<User className="w-5 h-5" />} label="Профиль" onClick={() => { onClose(); onProfileClick(); }} />
           <SidebarItem icon={<Bookmark className="w-5 h-5" />} label="Избранное" onClick={() => onMenuClick('Избранное')} />
           <SidebarItem icon={<Volume2 className="w-5 h-5" />} label="Каналы" onClick={() => onMenuClick('Каналы')} />
           <SidebarItem icon={<Users className="w-5 h-5" />} label="Группы" onClick={() => onMenuClick('Группы')} />
           <SidebarItem icon={<Phone className="w-5 h-5" />} label="Звонки" onClick={() => onMenuClick('Звонки')} />
           <SidebarItem icon={<Settings className="w-5 h-5" />} label="Настройки" onClick={() => { onClose(); onMenuClick('Настройки'); }} />
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ icon, label, onClick }: { icon: React.ReactNode, label: string, onClick?: () => void }) {
  return (
    <div onClick={onClick} className="flex items-center gap-4 px-5 py-3 hover:bg-[#202C33] cursor-pointer text-[#E9EDEF] transition-colors active:bg-[#2A3942]">
      <div className="text-[#8696A0]">{icon}</div>
      <span className="font-medium text-[15px]">{label}</span>
    </div>
  );
}

function BottomNav({ currentView, onNavigate, language, theme }: { currentView: string, onNavigate: (v: any) => void, language?: string, theme?: ThemeConfig }) {
  const accent = theme?.accent || '#00A884';
  return (
    <div 
      className="absolute bottom-0 w-full h-[68px] border-t flex justify-around items-center px-2 pb-2 pt-1 z-30 shadow-[0_-5px_20px_rgba(0,0,0,0.2)] transition-colors duration-200"
      style={{
        backgroundColor: theme?.bgApp || '#0B141A',
        borderColor: theme?.border || '#202C33'
      }}
    >
      <NavItem icon={<MessageSquare className="w-6 h-6" />} label={getTranslation('chats', language)} active={currentView === 'list'} onClick={() => onNavigate('list')} badge="3" accent={accent} />
      <NavItem icon={<Phone className="w-6 h-6" />} label={getTranslation('calls', language)} active={currentView === 'calls'} onClick={() => onNavigate('calls')} accent={accent} />
      <NavItem icon={<Users className="w-6 h-6" />} label={getTranslation('people', language)} active={currentView === 'people'} onClick={() => onNavigate('people')} accent={accent} />
      <NavItem icon={<Settings className="w-6 h-6" />} label={getTranslation('settings', language)} active={['profile', 'settings'].includes(currentView)} onClick={() => onNavigate('settings')} accent={accent} />
    </div>
  );
}

function NavItem({ icon, label, active, onClick, badge, accent = '#00A884' }: { icon: React.ReactNode, label: string, active: boolean, onClick?: () => void, badge?: string, accent?: string }) {
  return (
    <button 
      onClick={onClick} 
      className={`flex flex-col items-center justify-center w-16 relative transition-colors ${active ? '' : 'text-[#8696A0] hover:text-[#E9EDEF]'}`}
      style={active ? { color: accent } : undefined}
    >
      <div className="relative">
         {icon}
         {badge && (
            <div 
              className="absolute -top-1.5 -right-2 text-white text-[10px] font-bold px-1.5 min-w-[18px] h-[18px] rounded-full flex items-center justify-center shadow-sm"
              style={{ backgroundColor: accent }}
            >
               {badge}
            </div>
         )}
      </div>
      <span className="text-[11px] font-medium mt-1">{label}</span>
    </button>
  );
}

function CallsList({ chats, onCallClick }: { chats: ChatType[], onCallClick: (u: UserType, v: boolean) => void }) {
  const recentChats = chats.filter(c => !c.user.isChannel && !c.user.isGroup).slice(0, 5);
  return (
    <div className="flex-1 flex flex-col pt-10 pb-[68px]">
      <div className="px-4 pb-4 flex items-center justify-between">
        <h1 className="text-xl font-semibold">Звонки</h1>
        <div className="flex gap-4 text-white">
          <PhoneCall className="w-6 h-6" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto no-scrollbar">
        <h2 className="px-4 py-2 text-sm text-[#8696A0] font-medium uppercase tracking-wider">Недавние</h2>
        {recentChats.map((chat, i) => (
          <div key={chat.id} className="flex items-center px-4 py-3 hover:bg-[#202C33] cursor-pointer active:bg-[#2A3942] transition-colors" onClick={() => onCallClick(chat.user, false)}>
            <img src={chat.user.avatar || `https://ui-avatars.com/api/?name=${chat.user.name}&background=random`} className="w-12 h-12 rounded-full object-cover bg-gray-800 border border-[#202C33]" />
            <div className="ml-3 flex-1">
              <h3 className="font-medium text-[16px] text-[#E9EDEF]">{chat.user.name}</h3>
              <p className="text-[14px] text-[#8696A0] flex items-center gap-1">
                {i % 2 === 0 ? <span className="text-[#00A884]">Входящий</span> : <span>Исходящий</span>}
                <span>•</span>
                Вчера, 12:30
              </p>
            </div>
            <div className="flex gap-4 text-[#00A884]">
              <Phone className="w-5 h-5 cursor-pointer active:scale-90 transition-transform" onClick={(e) => { e.stopPropagation(); onCallClick(chat.user, false); }} />
              <VideoIcon className="w-5 h-5 cursor-pointer active:scale-90 transition-transform" onClick={(e) => { e.stopPropagation(); onCallClick(chat.user, true); }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function CallScreen({ 
  user, 
  userProfile = users.alexey,
  isVideo, 
  isIncoming, 
  status, 
  onEnd, 
  onAccept 
}: { 
  user: UserType, 
  userProfile?: any,
  isVideo: boolean, 
  isIncoming: boolean, 
  status: 'ringing' | 'connected', 
  onEnd: () => void, 
  onAccept: () => void 
}) {
  const [duration, setDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaker, setIsSpeaker] = useState(false);
  const [isMyCameraOn, setIsMyCameraOn] = useState(true);
  const [facingMode, setFacingMode] = useState<'user' | 'environment'>('user');
  const [isSwapped, setIsSwapped] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isPartnerCameraOn, setIsPartnerCameraOn] = useState(true);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const partnerCanvasRef = useRef<HTMLCanvasElement>(null);
  const voipStartedRef = useRef(false);
  
  useEffect(() => {
    if (status === 'connected') {
      const i = setInterval(() => setDuration(d => d + 1), 1000);
      return () => clearInterval(i);
    }
  }, [status]);

  useEffect(() => {
    if (status === 'ringing') {
      startRingtone(isIncoming);
      if (!isIncoming) {
        return () => stopRingtone();
      }
    } else {
      stopRingtone();
    }
    return () => stopRingtone();
  }, [status, isIncoming, onAccept]);

  // Real internet audio call via WebRTC/PeerJS.
  // Outgoing calls dial while the screen says "Звонок..." and switch to
  // connected as soon as the other device sends its real media stream.
  useEffect(() => {
    let cancelled = false;

    const connectVoip = async () => {
      if (voipStartedRef.current || !navigator?.mediaDevices?.getUserMedia) return;

      try {
        voipStartedRef.current = true;
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
          video: false,
        });
        if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

        streamRef.current = stream;
        setLocalStream(stream);
        stream.getAudioTracks().forEach(t => { t.enabled = !isMuted; });

        const finishWithRemote = (remote: MediaStream) => {
          if (remoteAudioRef.current) {
            remoteAudioRef.current.srcObject = remote;
            remoteAudioRef.current.play().catch(() => {});
          }
          if (!isIncoming && status === 'ringing') onAccept();
        };

        const existingCall = getCurrentCall();
        if (isIncoming && existingCall) {
          existingCall.answer(stream);
          existingCall.on('stream', finishWithRemote);
          existingCall.on('close', handleEnd);
        } else if (!isIncoming) {
          const call = dialVoip(user.id, stream);
          setCurrentCall(call);
          call.on('stream', finishWithRemote);
          call.on('close', handleEnd);
          call.on('error', (err) => {
            console.warn('Zentora VoIP call error:', err);
          });
        }
      } catch (err) {
        voipStartedRef.current = false;
        console.warn('Zentora VoIP microphone/call failed:', err);
      }
    };

    // Outgoing: dial immediately. Incoming: answer after the user accepts.
    if ((!isIncoming && status === 'ringing') || (isIncoming && status === 'connected')) {
      void connectVoip();
    }
    return () => { cancelled = true; };
  }, [status, isIncoming, user.id, onAccept]);

  // User's camera capture
  useEffect(() => {
    let isCancelled = false;

    if (isVideo && status === 'connected' && isMyCameraOn) {
      const startCamera = async () => {
        try {
          if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
          }

          if (!navigator?.mediaDevices?.getUserMedia) {
            throw new Error("getUserMedia not supported");
          }

          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facingMode,
              width: { ideal: 1280 },
              height: { ideal: 720 },
            },
            audio: true
          });

          if (isCancelled) {
            stream.getTracks().forEach(t => t.stop());
            return;
          }

          streamRef.current = stream;
          setLocalStream(stream);
          setCameraError(null);

          stream.getAudioTracks().forEach(t => {
            t.enabled = !isMuted;
          });
        } catch (err: any) {
          console.warn("Camera access failed / denied:", err);
          if (!isCancelled) {
            setCameraError(err.name === 'NotAllowedError' ? 'Доступ к камере отклонен' : 'Камера недоступна');
          }
        }
      };

      startCamera();
    } else if (!isMyCameraOn && streamRef.current) {
      streamRef.current.getVideoTracks().forEach(t => { t.enabled = false; });
    }

    return () => {
      isCancelled = true;
    };
  }, [isVideo, status, isMyCameraOn, facingMode]);

  // Bind stream to video element
  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = isMyCameraOn ? localStream : null;
    }
  }, [localStream, isSwapped, isMyCameraOn]);

  // Partner camera animated video stream
  useEffect(() => {
    if (!isVideo || status !== 'connected') return;

    const canvas = partnerCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationId: number;
    const startTime = Date.now();

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.src = user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.name)}&background=202C33&color=E9EDEF&size=256`;

    const render = () => {
      const elapsed = (Date.now() - startTime) / 1000;
      const w = canvas.width = canvas.parentElement?.clientWidth || 400;
      const h = canvas.height = canvas.parentElement?.clientHeight || 700;

      // Realistic dark webcam ambient gradient with subtle breathing light
      const grad = ctx.createRadialGradient(
        w / 2 + Math.sin(elapsed * 0.7) * 40,
        h / 2 + Math.cos(elapsed * 0.5) * 40,
        60,
        w / 2,
        h / 2,
        Math.max(w, h) * 0.75
      );
      grad.addColorStop(0, '#1b2a32');
      grad.addColorStop(0.4, '#111b21');
      grad.addColorStop(1, '#090e12');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      // Subtle video scanlines for authentic camera look
      ctx.fillStyle = 'rgba(255, 255, 255, 0.015)';
      for (let y = 0; y < h; y += 4) {
        ctx.fillRect(0, y, w, 1);
      }

      if (isPartnerCameraOn) {
        const size = Math.min(w * 0.42, 190);
        const breathScale = 1 + Math.sin(elapsed * 1.4) * 0.025;
        const currentSize = size * breathScale;
        const x = w / 2 - currentSize / 2;
        const y = h / 2 - currentSize / 2 - 25;

        // Dynamic pulsing glow
        ctx.beginPath();
        ctx.arc(w / 2, y + currentSize / 2, currentSize / 2 + 12, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 168, 132, 0.18)';
        ctx.fill();

        ctx.save();
        ctx.beginPath();
        ctx.arc(w / 2, y + currentSize / 2, currentSize / 2, 0, Math.PI * 2);
        ctx.clip();
        if (img.complete && img.naturalWidth > 0) {
          ctx.drawImage(img, x, y, currentSize, currentSize);
        } else {
          ctx.fillStyle = '#202C33';
          ctx.fillRect(x, y, currentSize, currentSize);
          ctx.fillStyle = '#E9EDEF';
          ctx.font = 'bold 36px sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(user.name.slice(0, 1), w / 2, y + currentSize / 2);
        }
        ctx.restore();

        // Border ring
        ctx.beginPath();
        ctx.arc(w / 2, y + currentSize / 2, currentSize / 2, 0, Math.PI * 2);
        ctx.strokeStyle = '#00A884';
        ctx.lineWidth = 3;
        ctx.stroke();
      }

      animationId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationId);
    };
  }, [isVideo, status, user, isPartnerCameraOn, isSwapped]);

  const handleEnd = () => {
    stopRingtone();
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setLocalStream(null);
    voipStartedRef.current = false;
    endVoip();
    onEnd();
  };

  const handleToggleMyCamera = () => {
    if (streamRef.current) {
      const next = !isMyCameraOn;
      streamRef.current.getVideoTracks().forEach(track => {
        track.enabled = next;
      });
      setIsMyCameraOn(next);
    } else {
      setIsMyCameraOn(!isMyCameraOn);
    }
  };

  const handleFlipCamera = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  const handleToggleMute = () => {
    if (streamRef.current) {
      const next = !isMuted;
      streamRef.current.getAudioTracks().forEach(track => {
        track.enabled = !next;
      });
      setIsMuted(next);
    } else {
      setIsMuted(!isMuted);
    }
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  // Render Partner View
  const renderPartnerView = (isPiP = false) => (
    <div className={`relative w-full h-full overflow-hidden bg-[#0C1317] flex items-center justify-center select-none ${isPiP ? 'rounded-2xl' : ''}`}>
      <canvas ref={partnerCanvasRef} className="absolute inset-0 w-full h-full object-cover" />
      
      {!isPartnerCameraOn && (
        <div className="absolute inset-0 bg-[#0B141A]/90 backdrop-blur-md flex flex-col items-center justify-center p-4 z-10 text-center">
          <img src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=random`} className="w-20 h-20 rounded-full border-2 border-[#202C33] mb-3 object-cover shadow-lg" />
          <div className="flex items-center gap-1.5 text-[#8696A0] text-xs font-medium bg-[#202C33]/70 px-3 py-1 rounded-full">
            <VideoOff className="w-3.5 h-3.5 text-red-400" />
            <span>Собеседник отключил видео</span>
          </div>
        </div>
      )}

      {/* Partner overlay tags */}
      <div className={`absolute left-3 top-3 z-10 flex flex-col gap-1 pointer-events-none ${isPiP ? 'scale-90 origin-top-left' : ''}`}>
        <div className="flex items-center gap-1.5 bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-full border border-white/10 shadow">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
          <span className="text-white text-xs font-medium tracking-wide truncate max-w-[120px]">{user.name}</span>
          {!isPiP && (
            <span className="text-[10px] text-emerald-300/90 font-mono ml-0.5">HD</span>
          )}
        </div>

        {!isPiP && (
          <div className="flex items-center gap-1.5 bg-black/40 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/5 w-max">
            <span className="text-[11px] text-[#8696A0]">Говорит</span>
            <div className="flex items-end gap-0.5 h-2.5">
              <span className="w-0.5 h-2 bg-emerald-400 animate-pulse"></span>
              <span className="w-0.5 h-3 bg-emerald-400 animate-pulse delay-75"></span>
              <span className="w-0.5 h-1.5 bg-emerald-400 animate-pulse delay-150"></span>
            </div>
          </div>
        )}
      </div>

      {isPiP && (
        <div className="absolute inset-x-0 bottom-1 flex justify-center pointer-events-none">
          <span className="text-[10px] bg-black/60 text-white/80 px-2 py-0.5 rounded-full backdrop-blur-sm">Нажмите для смены</span>
        </div>
      )}
    </div>
  );

  // Render My Camera View
  const renderMyCameraView = (isPiP = false) => (
    <div className={`relative w-full h-full overflow-hidden bg-[#111B21] flex items-center justify-center select-none ${isPiP ? 'rounded-2xl' : ''}`}>
      {isMyCameraOn && !cameraError ? (
        <video 
          ref={localVideoRef}
          autoPlay 
          playsInline 
          muted 
          className={`absolute inset-0 w-full h-full object-cover ${facingMode === 'user' ? 'scale-x-[-1]' : ''}`}
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-[#182229] to-[#0B141A] flex flex-col items-center justify-center p-3 text-center z-10">
          <img 
            src={userProfile?.avatar || users.alexey.avatar} 
            className={`${isPiP ? 'w-12 h-12' : 'w-24 h-24'} rounded-full border-2 border-[#00A884]/40 object-cover mb-2 shadow-lg`} 
          />
          <div className="flex items-center gap-1 text-[#8696A0] text-[11px] bg-[#202C33]/80 px-2.5 py-0.5 rounded-full">
            <CameraOff className="w-3 h-3 text-red-400" />
            <span>{cameraError ? 'Камера недоступна' : 'Камера выкл'}</span>
          </div>
        </div>
      )}

      {/* Label Badge */}
      <div className={`absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 bg-black/55 backdrop-blur-md px-2 py-0.5 rounded-full border border-white/10 ${isPiP ? 'scale-90 origin-top-left' : ''}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${isMyCameraOn ? 'bg-[#00A884]' : 'bg-red-400'}`}></span>
        <span className="text-white text-[11px] font-medium">Вы (Моя камера)</span>
      </div>

      {/* Flip camera shortcut on PiP */}
      {isMyCameraOn && (
        <button 
          onClick={handleFlipCamera}
          title="Сменить камеру"
          className="absolute right-2 top-2 z-20 w-6 h-6 rounded-full bg-black/60 backdrop-blur-md flex items-center justify-center text-white/90 hover:bg-black/80 active:scale-90 transition-transform"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}

      {isPiP && (
        <div className="absolute inset-x-0 bottom-1 flex justify-center pointer-events-none">
          <span className="text-[10px] bg-black/60 text-white/80 px-2 py-0.5 rounded-full backdrop-blur-sm">Нажмите для смены</span>
        </div>
      )}
    </div>
  );

  return (
    <div className="absolute inset-0 z-[100] bg-[#111B21] flex flex-col items-center animate-in fade-in zoom-in-95 duration-200 overflow-hidden select-none">
      <audio ref={remoteAudioRef} autoPlay playsInline className="hidden" />
      {/* Video Call Mode */}
      {isVideo && status === 'connected' ? (
        <div className="absolute inset-0 w-full h-full flex flex-col">
          {/* Main Fullscreen Video View */}
          <div className="relative w-full h-full">
            {isSwapped ? renderMyCameraView(false) : renderPartnerView(false)}
          </div>

          {/* Floating Picture-in-Picture (PiP) Window */}
          <div 
            onClick={() => setIsSwapped(!isSwapped)}
            title="Нажмите, чтобы поменять вид местами"
            className="absolute top-16 right-4 z-30 w-32 h-44 sm:w-36 sm:h-48 rounded-2xl overflow-hidden shadow-2xl border-2 border-[#00A884]/80 backdrop-blur-md bg-[#111B21] transition-transform duration-200 hover:scale-105 active:scale-95 cursor-pointer ring-4 ring-black/30"
          >
            {isSwapped ? renderPartnerView(true) : renderMyCameraView(true)}
          </div>

          {/* Top Bar with End-to-End Encryption Badge & Duration */}
          <div className="absolute top-0 inset-x-0 pt-10 pb-4 px-5 z-20 flex items-center justify-between bg-gradient-to-b from-black/80 via-black/40 to-transparent">
            <button onClick={handleEnd} className="p-2 -ml-2 text-white/90 hover:text-white active:scale-90 transition-transform">
              <ChevronLeft className="w-7 h-7" />
            </button>
            <div className="flex flex-col items-center">
              <div className="flex items-center gap-1.5 text-white/90">
                <Lock className="w-3.5 h-3.5 text-[#00A884]" />
                <span className="text-sm font-semibold tracking-wide drop-shadow">{user.name}</span>
              </div>
              <span className="text-xs text-white/80 font-mono font-medium drop-shadow mt-0.5">
                {formatTime(duration)}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => setIsPartnerCameraOn(!isPartnerCameraOn)}
                title="Тест: отключить/включить камеру собеседника"
                className="p-2 text-white/70 hover:text-white active:scale-90"
              >
                <MoreVertical className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      ) : (
        /* Audio Call or Ringing State */
        <>
          <div className="w-full pt-12 pb-4 flex justify-between px-6 z-10">
            <ChevronLeft className="w-7 h-7 text-white cursor-pointer active:scale-90" onClick={handleEnd} />
            <div className="flex items-center gap-1.5 text-[#8696A0] text-xs">
              <Lock className="w-3.5 h-3.5 text-[#00A884]" />
              <span>Zentora Call</span>
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center pt-6 w-full z-10">
            <div className="relative mb-6">
              <div className="absolute inset-0 bg-[#00A884] rounded-full blur-2xl opacity-25 animate-pulse"></div>
              <img 
                src={user.avatar || `https://ui-avatars.com/api/?name=${user.name}&background=random`} 
                className="w-32 h-32 rounded-full border-4 border-[#202C33] object-cover relative z-10 shadow-2xl" 
              />
            </div>
            <h2 className="text-3xl font-semibold text-white mb-2 text-shadow-sm drop-shadow-md">{user.name}</h2>
            <p className="text-lg font-medium tracking-wide text-[#8696A0]">
              {status === 'ringing' 
                ? (isIncoming ? (isVideo ? 'Входящий видеозвонок...' : 'Входящий аудиозвонок...') : (isVideo ? 'Видеозвонок...' : 'Звонок...'))
                : formatTime(duration)
              }
            </p>
          </div>
        </>
      )}

      {/* Bottom Action Controls */}
      <div className={`w-full z-30 flex justify-center pb-8 pt-4 px-4 ${isVideo && status === 'connected' ? 'absolute bottom-2 inset-x-0' : 'bg-[#182229] rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.5)]'}`}>
        {status === 'ringing' && isIncoming ? (
          <div className="flex items-center gap-12">
            <button 
              onClick={handleEnd} 
              className="w-16 h-16 rounded-full bg-red-500 flex items-center justify-center text-white shadow-[0_0_20px_rgba(239,68,68,0.4)] active:scale-95 transition-transform"
            >
              <Phone className="w-7 h-7 rotate-[135deg]" fill="currentColor" />
            </button>
            <button 
              onClick={onAccept} 
              className="w-16 h-16 rounded-full bg-[#00A884] flex items-center justify-center text-white shadow-[0_0_20px_rgba(0,168,132,0.4)] active:scale-95 transition-transform animate-pulse"
            >
              {isVideo ? <VideoIcon className="w-7 h-7" /> : <Phone className="w-7 h-7" fill="currentColor" />}
            </button>
          </div>
        ) : (
          <div className="flex items-center justify-center gap-3 sm:gap-4 bg-[#182229]/90 backdrop-blur-xl border border-white/10 px-5 py-3.5 rounded-3xl shadow-2xl">
            {/* Speaker Button */}
            <button 
              onClick={() => setIsSpeaker(!isSpeaker)} 
              title={isSpeaker ? 'Выключить громкую связь' : 'Включить громкую связь'}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border border-white/5 active:scale-95 ${isSpeaker ? 'bg-white text-black' : 'bg-[#202C33] text-white hover:bg-[#2A3942]'}`}
            >
              <Volume2 className="w-5 h-5" />
            </button>

            {/* My Camera Toggle Button */}
            {isVideo && status === 'connected' && (
              <button 
                onClick={handleToggleMyCamera}
                title={isMyCameraOn ? 'Выключить мою камеру' : 'Включить мою камеру'}
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border border-white/5 active:scale-95 ${isMyCameraOn ? 'bg-[#00A884] text-white shadow-[0_0_12px_rgba(0,168,132,0.4)]' : 'bg-red-500/20 border-red-500 text-red-400'}`}
              >
                {isMyCameraOn ? <VideoIcon className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
              </button>
            )}

            {/* Flip Camera Button */}
            {isVideo && status === 'connected' && (
              <button 
                onClick={handleFlipCamera}
                title="Сменить камеру (фронтальная/задняя)"
                className="w-12 h-12 rounded-full bg-[#202C33] text-white flex items-center justify-center transition-all border border-white/5 hover:bg-[#2A3942] active:rotate-180"
              >
                <SwitchCamera className="w-5 h-5" />
              </button>
            )}

            {/* Swap Screens Button */}
            {isVideo && status === 'connected' && (
              <button 
                onClick={() => setIsSwapped(!isSwapped)}
                title="Поменять экраны местами (Моя камера / Собеседник)"
                className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border border-white/5 active:scale-95 ${isSwapped ? 'bg-[#00A884] text-white shadow-[0_0_12px_rgba(0,168,132,0.4)]' : 'bg-[#202C33] text-white hover:bg-[#2A3942]'}`}
              >
                <FlipHorizontal className="w-5 h-5" />
              </button>
            )}

            {/* Mic Mute Button */}
            <button 
              onClick={handleToggleMute}
              title={isMuted ? 'Включить микрофон' : 'Отключить микрофон'}
              className={`w-12 h-12 rounded-full flex items-center justify-center transition-all border border-white/5 active:scale-95 ${isMuted ? 'bg-red-500 text-white shadow-[0_0_12px_rgba(239,68,68,0.4)]' : 'bg-[#202C33] text-white hover:bg-[#2A3942]'}`}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </button>

            {/* End Call Button */}
            <button 
              onClick={handleEnd} 
              title="Завершить звонок"
              className="w-12 h-12 rounded-full bg-[#F15C5C] flex items-center justify-center text-white shadow-[0_0_15px_rgba(241,92,92,0.5)] hover:bg-red-600 active:scale-95 transition-all ml-1"
            >
              <Phone className="w-5 h-5 rotate-[135deg]" fill="currentColor" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
