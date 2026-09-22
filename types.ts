export interface User {
  id: string;
  name: string;
  avatar?: string;
  isVerified?: boolean;
  isOnline?: boolean;
  username?: string;
  phone?: string;
  isChannel?: boolean;
  isGroup?: boolean;
  isSavedMessages?: boolean;
}

export type MessageType = 'text' | 'image' | 'voice' | 'system' | 'location';

export interface Message {
  id: string;
  senderId: string;
  text?: string;
  time: string;
  isRead?: boolean;
  type: MessageType;
  mediaUrl?: string;
  audioUrl?: string;
  duration?: string;
  waveform?: number[];
  location?: { lat: number; lng: number };
  replyToMessage?: Message;
  isEdited?: boolean;
  isPinned?: boolean;
}

export interface Chat {
  id: string;
  user: User;
  lastMessage?: Message;
  unreadCount?: number;
  isTyping?: boolean;
  isPinned?: boolean;
  isMuted?: boolean;
}

export interface ZentoraNotification {
  id: string;
  type: 'message' | 'voice' | 'call';
  sender: User;
  chatId: string;
  title: string;
  preview: string;
  voiceDuration?: string;
  isVideoCall?: boolean;
  time: string;
}

