import { Chat, User, Message } from './types';

export const MY_ID = 'me';

export const users: Record<string, User> = {
  alexey: {
    id: 'alexey',
    phone: '+79991234567',
    name: 'Алексей',
    isOnline: true,
    isVerified: true,
    username: '@alexey_zentora',
    avatar: 'https://i.pravatar.cc/150?u=alexey',
  },
  masha: {
    id: 'masha',
    phone: '+79991234568',
    name: 'Маша',
    avatar: 'https://i.pravatar.cc/150?u=masha',
  },
  zentora: {
    id: 'zentora',
    name: 'Zentora Official',
    isVerified: true,
    isChannel: true,
    avatar: 'https://i.pravatar.cc/150?u=zentora',
  },
  family: {
    id: 'family',
    name: 'Семья',
    isGroup: true,
    avatar: 'https://i.pravatar.cc/150?u=family',
  },
  work: {
    id: 'work',
    name: 'Работа',
    isGroup: true,
    avatar: 'https://i.pravatar.cc/150?u=work',
  },
  dima: {
    id: 'dima',
    phone: '+79991234569',
    name: 'Дима',
    avatar: 'https://i.pravatar.cc/150?u=dima',
  },
  games: {
    id: 'games',
    name: 'Игры',
    isGroup: true,
    avatar: 'https://i.pravatar.cc/150?u=games',
  },
  tech: {
    id: 'tech',
    name: 'Канал о технологиях',
    isVerified: true,
    isChannel: true,
    avatar: 'https://i.pravatar.cc/150?u=tech',
  },
  me: {
    id: 'me',
    name: 'You',
  }
};

export const chatList: Chat[] = [
  {
    id: 'chat_1',
    user: users.alexey,
    lastMessage: {
      id: 'm1',
      senderId: 'alexey',
      text: 'Привет! Как дела?',
      time: '09:32',
      type: 'text',
      isRead: true,
    }
  },
  {
    id: 'chat_2',
    user: users.masha,
    unreadCount: 2,
    lastMessage: {
      id: 'm2',
      senderId: 'masha',
      text: 'Скинула фото',
      time: '08:45',
      type: 'image',
    }
  },
  {
    id: 'chat_3',
    user: users.zentora,
    unreadCount: 5,
    lastMessage: {
      id: 'm3',
      senderId: 'zentora',
      text: 'Новый обновление уже доступно! 🚀',
      time: '08:30',
      type: 'text',
    }
  },
  {
    id: 'chat_4',
    user: users.family,
    lastMessage: {
      id: 'm4',
      senderId: 'family',
      text: 'Мама: Хорошо, спасибо!',
      time: '07:12',
      type: 'text',
      isRead: true,
    }
  },
  {
    id: 'chat_5',
    user: users.work,
    unreadCount: 3,
    lastMessage: {
      id: 'm5',
      senderId: 'work',
      text: 'Иван: Встреча в 15:00',
      time: '06:58',
      type: 'text',
    }
  },
  {
    id: 'chat_6',
    user: users.dima,
    lastMessage: {
      id: 'm6',
      senderId: 'dima',
      text: 'Голосовое сообщение',
      time: 'Вчера',
      type: 'voice',
      isRead: true,
    }
  },
  {
    id: 'chat_7',
    user: users.games,
    lastMessage: {
      id: 'm7',
      senderId: MY_ID,
      text: 'Вы: Круто!',
      time: 'Вчера',
      type: 'text',
      isRead: true,
    }
  },
  {
    id: 'chat_8',
    user: users.tech,
    unreadCount: 12,
    lastMessage: {
      id: 'm8',
      senderId: 'tech',
      text: 'Интересные новости дня',
      time: 'Вчера',
      type: 'text',
    }
  }
];

export const activeChatMessages: Message[] = [
  { id: '1', senderId: 'alexey', text: 'Привет! Как дела? 🙂', time: '09:20', type: 'text' },
  { id: '2', senderId: MY_ID, text: 'Привет! Отлично, а у тебя?', time: '09:21', type: 'text', isRead: true },
  { id: '3', senderId: 'alexey', text: 'Тоже всё хорошо! Слушай, сможешь помочь?', time: '09:22', type: 'text' },
  { id: '4', senderId: 'alexey', type: 'image', mediaUrl: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&q=80&w=1200', time: '09:23' },
  { id: '5', senderId: MY_ID, text: 'Красота! 😍', time: '09:24', type: 'text', isRead: true },
  { id: '6', senderId: 'alexey', type: 'voice', duration: '0:12', waveform: [4, 4, 4, 14, 22, 26, 18, 14, 4, 4, 4, 16, 24, 28, 20, 15, 4, 4, 10, 18, 24, 16, 4, 4, 4], time: '09:27' },
  { id: '7', senderId: 'alexey', text: 'Спасибо! 👍', time: '09:28', type: 'text' },
  { id: '8', senderId: MY_ID, text: 'Не за что! Если что, пиши', time: '09:30', type: 'text', isRead: true },
];
