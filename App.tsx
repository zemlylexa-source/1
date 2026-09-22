import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, LockKeyhole, MessageCircle, Phone, UserRound, Sparkles, ArrowRight, Loader2 } from 'lucide-react';
import ZentoraApp from './components/ZentoraApp';
import './index.css';

const API = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
const api = (path: string) => `${API}${path}`;

type AuthUser = { username: string; display_name: string; phone?: string; email?: string; bio?: string; avatar_letter?: string; avatar_color?: string; is_admin?: boolean };

async function request(path: string, body?: Record<string, unknown>) {
  const res = await fetch(api(path), {
    method: body ? 'POST' : 'GET',
    credentials: 'include',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: any = {};
  try { data = await res.json(); } catch {}
  return { res, data };
}

function AuthScreen({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showRepeat, setShowRepeat] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const clearMessages = () => { setError(''); setSuccess(''); };
  const switchMode = (next: 'login' | 'register') => { setMode(next); clearMessages(); setPassword(''); setRepeatPassword(''); };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); clearMessages();
    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
    if (!cleanUsername) return setError('Введите username');
    if (mode === 'register' && cleanUsername.length < 3) return setError('Username должен содержать минимум 3 символа');
    if (!password) return setError('Введите пароль');
    if (mode === 'register' && password.length < 6) return setError('Пароль должен содержать минимум 6 символов');
    if (mode === 'register' && password !== repeatPassword) return setError('Пароли не совпадают');
    setLoading(true);
    try {
      const { res, data } = await request(mode === 'login' ? '/api/login' : '/api/register', mode === 'login'
        ? { username: cleanUsername, password }
        : { username: cleanUsername, password, phone: phone.trim(), display_name: displayName.trim() || cleanUsername });
      if (!res.ok || !data.ok) throw new Error(data.error || 'Не удалось выполнить запрос');
      const me = await request('/api/me');
      const user = me.data?.user || { username: cleanUsername, display_name: displayName || cleanUsername };
      localStorage.setItem('zentora_authenticated', '1');
      localStorage.setItem('zentora_real_mode', '1');
      localStorage.removeItem('zentora_chats');
      localStorage.removeItem('zentora_messages');
      localStorage.setItem('zentora_server_user', JSON.stringify(user));
      setSuccess(mode === 'login' ? 'Вход выполнен ✓' : 'Аккаунт создан ✓');
      setTimeout(() => onAuthenticated(user), 250);
    } catch (err: any) {
      setError(err?.message === 'Failed to fetch' ? 'Сервер Zentora не запущен. Запусти START_ZENTORA.cmd и повтори.' : (err?.message || 'Ошибка соединения с сервером'));
    } finally { setLoading(false); }
  };

  return (
    <div className="auth-screen">
      <div className="auth-glow auth-glow-one" /><div className="auth-glow auth-glow-two" />
      <div className="auth-card">
        <div className="auth-brand">
          <div className="auth-logo"><MessageCircle size={30} strokeWidth={2.5} /></div>
          <div><div className="auth-title">ZENTORA</div><div className="auth-subtitle">общайся с реальными людьми</div></div>
        </div>
        <div className="auth-tabs">
          <button className={mode === 'login' ? 'active' : ''} onClick={() => switchMode('login')}>Войти</button>
          <button className={mode === 'register' ? 'active' : ''} onClick={() => switchMode('register')}>Регистрация</button>
        </div>
        <div className="auth-heading">{mode === 'login' ? 'С возвращением 👋' : 'Создай аккаунт'}</div>
        <div className="auth-caption">{mode === 'login' ? 'Введи данные своего аккаунта Zentora' : 'Твой настоящий аккаунт для общения без ботов'}</div>
        <form onSubmit={submit} className="auth-form">
          {mode === 'register' && <label className="auth-field"><UserRound size={19}/><input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Имя" autoComplete="name" /></label>}
          <label className="auth-field"><span className="at">@</span><input value={username} onChange={e => setUsername(e.target.value)} placeholder="username" autoCapitalize="none" autoComplete="username" /></label>
          {mode === 'register' && <label className="auth-field"><Phone size={19}/><input value={phone} onChange={e => setPhone(e.target.value)} placeholder="Номер телефона (необязательно)" inputMode="tel" autoComplete="tel" /></label>}
          <label className="auth-field"><LockKeyhole size={19}/><input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? 'text' : 'password'} placeholder="Пароль" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={19}/> : <Eye size={19}/>}</button></label>
          {mode === 'register' && <label className="auth-field"><LockKeyhole size={19}/><input value={repeatPassword} onChange={e => setRepeatPassword(e.target.value)} type={showRepeat ? 'text' : 'password'} placeholder="Повтори пароль" autoComplete="new-password" /><button type="button" onClick={() => setShowRepeat(!showRepeat)}>{showRepeat ? <EyeOff size={19}/> : <Eye size={19}/>}</button></label>}
          {mode === 'register' && <div className="auth-hint"><Sparkles size={15}/> Пароль минимум 6 символов</div>}
          {error && <div className="auth-error">{error}</div>}
          {success && <div className="auth-success">{success}</div>}
          <button className="auth-submit" disabled={loading}>{loading ? <Loader2 className="spin" size={20}/> : <ArrowRight size={20}/>} {mode === 'login' ? 'Войти в Zentora' : 'Создать аккаунт'}</button>
        </form>
        <div className="auth-footer">Только реальные зарегистрированные пользователи</div>
      </div>
    </div>
  );
}

export default function App() {
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<AuthUser | null>(null);
  useEffect(() => {
    request('/api/me').then(({ res, data }) => {
      if (res.ok && data.ok) {
        if (localStorage.getItem('zentora_real_mode') !== '1') { localStorage.removeItem('zentora_chats'); localStorage.removeItem('zentora_messages'); }
        localStorage.setItem('zentora_real_mode', '1');
        setUser(data.user); localStorage.setItem('zentora_authenticated', '1'); localStorage.setItem('zentora_server_user', JSON.stringify(data.user));
      }
      else { localStorage.removeItem('zentora_authenticated'); }
    }).catch(() => {}).finally(() => setChecking(false));
  }, []);
  if (checking) return <div className="auth-loading"><Loader2 className="spin" size={30}/><span>Подключение к Zentora…</span></div>;
  if (!user) return <AuthScreen onAuthenticated={setUser} />;
  return <ZentoraApp />;
}
