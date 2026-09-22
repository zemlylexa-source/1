import React from 'react';

export type ThemeId = 'dark' | 'amoled' | 'emerald' | 'midnight' | 'light';

export interface ThemeConfig {
  id: ThemeId;
  name: string;
  nameEn: string;
  bgApp: string;
  bgHeader: string;
  bgChat: string;
  bgCard: string;
  border: string;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  bubbleMe: string;
  bubbleMeText: string;
  bubbleOther: string;
  bubbleOtherText: string;
  isLight?: boolean;
}

export const THEMES: Record<ThemeId, ThemeConfig> = {
  dark: {
    id: 'dark',
    name: 'Тёмная Zentora',
    nameEn: 'Zentora Dark',
    bgApp: '#0B141A',
    bgHeader: '#111B21',
    bgChat: '#0B141A',
    bgCard: '#111B21',
    border: '#202C33',
    textPrimary: '#E9EDEF',
    textSecondary: '#8696A0',
    accent: '#00A884',
    bubbleMe: '#005C4B',
    bubbleMeText: '#FFFFFF',
    bubbleOther: '#202C33',
    bubbleOtherText: '#E9EDEF'
  },
  amoled: {
    id: 'amoled',
    name: 'Глубокая ночная (AMOLED)',
    nameEn: 'Pure AMOLED',
    bgApp: '#000000',
    bgHeader: '#0A0A0A',
    bgChat: '#000000',
    bgCard: '#0E0E0E',
    border: '#1A1A1A',
    textPrimary: '#FFFFFF',
    textSecondary: '#7A7A7A',
    accent: '#00C896',
    bubbleMe: '#004D3F',
    bubbleMeText: '#FFFFFF',
    bubbleOther: '#141414',
    bubbleOtherText: '#F0F0F0'
  },
  emerald: {
    id: 'emerald',
    name: 'Изумрудный градиент',
    nameEn: 'Emerald Forest',
    bgApp: '#051912',
    bgHeader: '#0A291F',
    bgChat: '#061D15',
    bgCard: '#0A291F',
    border: '#144334',
    textPrimary: '#E1F5EE',
    textSecondary: '#78A899',
    accent: '#00D69A',
    bubbleMe: '#0D533F',
    bubbleMeText: '#FFFFFF',
    bubbleOther: '#103328',
    bubbleOtherText: '#E1F5EE'
  },
  midnight: {
    id: 'midnight',
    name: 'Полуночный синий',
    nameEn: 'Midnight Blue',
    bgApp: '#0A1120',
    bgHeader: '#131E33',
    bgChat: '#0E1729',
    bgCard: '#131E33',
    border: '#1E2E4A',
    textPrimary: '#F1F5F9',
    textSecondary: '#94A3B8',
    accent: '#38BDF8',
    bubbleMe: '#1E40AF',
    bubbleMeText: '#FFFFFF',
    bubbleOther: '#1E293B',
    bubbleOtherText: '#F1F5F9'
  },
  light: {
    id: 'light',
    name: 'Светлая тема',
    nameEn: 'Clean Light',
    bgApp: '#F0F2F5',
    bgHeader: '#FFFFFF',
    bgChat: '#EFEAE2',
    bgCard: '#FFFFFF',
    border: '#E2E8F0',
    textPrimary: '#111B21',
    textSecondary: '#667781',
    accent: '#00A884',
    bubbleMe: '#D9FDD3',
    bubbleMeText: '#111B21',
    bubbleOther: '#FFFFFF',
    bubbleOtherText: '#111B21',
    isLight: true
  }
};

export type WallpaperId = 'classic' | 'cosmos' | 'emerald' | 'minimal' | 'sunset';

export interface WallpaperConfig {
  id: WallpaperId;
  name: string;
  style: React.CSSProperties;
}

export const WALLPAPERS: Record<WallpaperId, WallpaperConfig> = {
  classic: {
    id: 'classic',
    name: 'Классический Zentora',
    style: {
      backgroundImage: 'radial-gradient(circle at center, rgba(17,27,33,0.85) 0%, rgba(11,20,26,0.95) 100%)',
      backgroundBlendMode: 'overlay'
    }
  },
  cosmos: {
    id: 'cosmos',
    name: 'Ночной космос',
    style: {
      background: 'radial-gradient(ellipse at bottom, #1b2735 0%, #090a0f 100%)'
    }
  },
  emerald: {
    id: 'emerald',
    name: 'Изумрудный сад',
    style: {
      background: 'linear-gradient(135deg, #051912 0%, #0a291f 50%, #061d15 100%)'
    }
  },
  minimal: {
    id: 'minimal',
    name: 'Минимализм',
    style: {
      background: '#0B141A'
    }
  },
  sunset: {
    id: 'sunset',
    name: 'Тёплый закат',
    style: {
      background: 'linear-gradient(180deg, #181926 0%, #2e1a2c 50%, #1a1528 100%)'
    }
  }
};

export const DICTIONARY: Record<string, Record<string, string>> = {
  chats: {
    ru: 'Чаты',
    en: 'Chats',
    es: 'Chats',
    de: 'Chats'
  },
  calls: {
    ru: 'Звонки',
    en: 'Calls',
    es: 'Llamadas',
    de: 'Anrufe'
  },
  people: {
    ru: 'Люди',
    en: 'People',
    es: 'Personas',
    de: 'Kontakte'
  },
  profile: {
    ru: 'Профиль',
    en: 'Profile',
    es: 'Perfil',
    de: 'Profil'
  },
  settings: {
    ru: 'Настройки',
    en: 'Settings',
    es: 'Ajustes',
    de: 'Einstellungen'
  },
  search: {
    ru: 'Поиск',
    en: 'Search',
    es: 'Buscar',
    de: 'Suchen'
  },
  all: {
    ru: 'Все',
    en: 'All',
    es: 'Todos',
    de: 'Alle'
  },
  personal: {
    ru: 'Личные',
    en: 'Personal',
    es: 'Privados',
    de: 'Persönlich'
  },
  groups: {
    ru: 'Группы',
    en: 'Groups',
    es: 'Grupos',
    de: 'Gruppen'
  },
  channels: {
    ru: 'Каналы',
    en: 'Channels',
    es: 'Canales',
    de: 'Kanäle'
  },
  online: {
    ru: 'в сети',
    en: 'online',
    es: 'en línea',
    de: 'online'
  },
  offline: {
    ru: 'был(а) недавно',
    en: 'last seen recently',
    es: 'últ. vez rec.',
    de: 'zuletzt gesehen'
  },
  typing: {
    ru: 'печатает...',
    en: 'typing...',
    es: 'escribiendo...',
    de: 'schreibt...'
  },
  voiceMessage: {
    ru: 'Голосовое сообщение',
    en: 'Voice message',
    es: 'Mensaje de voz',
    de: 'Sprachnachricht'
  },
  reply: {
    ru: 'Ответить',
    en: 'Reply',
    es: 'Responder',
    de: 'Antworten'
  },
  copy: {
    ru: 'Копировать',
    en: 'Copy',
    es: 'Copiar',
    de: 'Kopieren'
  },
  edit: {
    ru: 'Изменить',
    en: 'Edit',
    es: 'Editar',
    de: 'Bearbeiten'
  },
  pin: {
    ru: 'Закрепить',
    en: 'Pin',
    es: 'Fijar',
    de: 'Anheften'
  },
  unpin: {
    ru: 'Открепить',
    en: 'Unpin',
    es: 'Desfijar',
    de: 'Lösen'
  },
  delete: {
    ru: 'Удалить',
    en: 'Delete',
    es: 'Eliminar',
    de: 'Löschen'
  },
  appearance: {
    ru: 'Оформление и чаты',
    en: 'Appearance & Chats',
    es: 'Apariencia y chats',
    de: 'Erscheinungsbild'
  },
  notifications: {
    ru: 'Уведомления и звуки',
    en: 'Notifications & Sounds',
    es: 'Notificaciones y sonidos',
    de: 'Benachrichtigungen'
  },
  privacy: {
    ru: 'Конфиденциальность',
    en: 'Privacy & Security',
    es: 'Privacidad y seguridad',
    de: 'Privatsphäre'
  },
  dataStorage: {
    ru: 'Данные и память',
    en: 'Data & Storage',
    es: 'Datos y almacenamiento',
    de: 'Daten und Speicher'
  },
  language: {
    ru: 'Язык приложения',
    en: 'App Language',
    es: 'Idioma de la app',
    de: 'Sprache'
  },
  help: {
    ru: 'Помощь и поддержка',
    en: 'Help & Support',
    es: 'Ayuda y soporte',
    de: 'Hilfe & Support'
  }
};

export function getTranslation(key: string, lang: string = 'ru'): string {
  const code = (lang || 'ru').toLowerCase().slice(0, 2);
  const item = DICTIONARY[key];
  if (!item) return key;
  return item[code] || item['ru'] || item['en'] || key;
}
