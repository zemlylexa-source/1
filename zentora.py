import hashlib
import secrets
import json
import sqlite3
import threading
import os
from datetime import datetime
from flask import Flask, render_template_string, request, jsonify, session, redirect, send_from_directory
from flask_socketio import SocketIO, emit, join_room

app = Flask(__name__)
# Секрет сохраняется между перезапусками, поэтому авторизация не ломается из-за
# случайной смены ключа сессии при каждом запуске.
SECRET_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '.zentora_secret')
if os.path.exists(SECRET_PATH):
    with open(SECRET_PATH, 'r', encoding='utf-8') as _f:
        _secret = _f.read().strip()
else:
    _secret = secrets.token_urlsafe(48)
    with open(SECRET_PATH, 'w', encoding='utf-8') as _f:
        _f.write(_secret)
app.secret_key = _secret
socketio = SocketIO(app, cors_allowed_origins='*', async_mode='threading')
connected_users = {}  # username -> number of active Socket.IO connections

@app.after_request
def add_cors_headers(response):
    origin = request.headers.get('Origin')
    if origin in {'http://localhost:3000', 'http://127.0.0.1:3000', 'capacitor://localhost', 'http://localhost'}:
        response.headers['Access-Control-Allow-Origin'] = origin
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type'
        response.headers['Access-Control-Allow-Methods'] = 'GET,POST,PUT,DELETE,OPTIONS'
        response.headers['Vary'] = 'Origin'
    return response

@app.route('/api/<path:_cors_path>', methods=['OPTIONS'])
def cors_preflight(_cors_path):
    return ('', 204)

# ---------- Хранилища данных ----------
users = {}          # username -> {password, profile, friends, friend_requests, servers, blocked_users, is_admin, banned}
messages = {}       # key f"{server_id}_{channel_id}" -> list
servers = {}        # server_id -> {id, name, icon, owner, channels, members}
dm_messages = {}    # key f"{user1}_{user2}" (sorted) -> list
next_server_id = 1
next_channel_id = 1

# ---------- Постоянное SQLite-хранилище ----------
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'zentora.db')
db_lock = threading.RLock()

def init_db():
    with sqlite3.connect(DB_PATH, timeout=30) as db:
        db.execute('PRAGMA journal_mode=WAL')
        db.execute('PRAGMA synchronous=NORMAL')
        db.execute('PRAGMA busy_timeout=30000')
        db.execute('''CREATE TABLE IF NOT EXISTS app_state (
            id INTEGER PRIMARY KEY CHECK (id = 1),
            users TEXT NOT NULL,
            messages TEXT NOT NULL,
            servers TEXT NOT NULL,
            dm_messages TEXT NOT NULL,
            next_server_id INTEGER NOT NULL,
            next_channel_id INTEGER NOT NULL,
            updated_at TEXT NOT NULL
        )''')
        db.commit()

def load_state():
    global users, messages, servers, dm_messages, next_server_id, next_channel_id
    init_db()
    with db_lock, sqlite3.connect(DB_PATH, timeout=30) as db:
        db.execute('PRAGMA busy_timeout=30000')
        row = db.execute('SELECT users, messages, servers, dm_messages, next_server_id, next_channel_id FROM app_state WHERE id=1').fetchone()
        if not row:
            return False
        users = json.loads(row[0])
        messages = json.loads(row[1])
        servers = json.loads(row[2])
        dm_messages = json.loads(row[3])
        next_server_id = int(row[4])
        next_channel_id = int(row[5])
        return True

def persist_state():
    with db_lock, sqlite3.connect(DB_PATH, timeout=30) as db:
        db.execute('PRAGMA busy_timeout=30000')
        db.execute('''INSERT INTO app_state
            (id, users, messages, servers, dm_messages, next_server_id, next_channel_id, updated_at)
            VALUES (1, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
              users=excluded.users,
              messages=excluded.messages,
              servers=excluded.servers,
              dm_messages=excluded.dm_messages,
              next_server_id=excluded.next_server_id,
              next_channel_id=excluded.next_channel_id,
              updated_at=excluded.updated_at''',
            (json.dumps(users, ensure_ascii=False, separators=(',', ':')),
             json.dumps(messages, ensure_ascii=False, separators=(',', ':')),
             json.dumps(servers, ensure_ascii=False, separators=(',', ':')),
             json.dumps(dm_messages, ensure_ascii=False, separators=(',', ':')),
             next_server_id, next_channel_id,
             datetime.now().isoformat(timespec='seconds')))
        db.commit()

def hash_password(pwd):
    return hashlib.sha256(pwd.encode()).hexdigest()

def generate_id():
    return str(secrets.randbelow(10**8))

def add_system_message(server_id, channel_id, text):
    return

def get_dm_key(u1, u2):
    return '_'.join(sorted([u1, u2]))

def create_default_server(username):
    global next_server_id, next_channel_id
    sid = f"server_{next_server_id}"
    next_server_id += 1
    cid = f"channel_{next_channel_id}"
    next_channel_id += 1
    servers[sid] = {
        'id': sid,
        'name': f"Сервер {username}",
        'icon': '🏠',
        'owner': username,
        'channels': [{'id': cid, 'name': 'general'}],
        'members': [username]
    }
    users[username]['servers'].append(sid)
    messages[f"{sid}_{cid}"] = []
    add_system_message(sid, cid, f"Добро пожаловать, {username}!")

# Загружаем постоянные данные. Если база пустая — создаём первого администратора.
load_state()

# Создаём админа по умолчанию
if not users:
    users['admin'] = {
        'password': hash_password('123123'),
        'profile': {
            'display_name': 'Administrator',
            'avatar_letter': 'A',
            'avatar_color': '#f23f42',
            'status': 'online',
            'bio': 'Главный администратор',
            'email': 'admin@example.com'
        },
        'friends': [],
        'friend_requests': [],
        'servers': [],
        'is_admin': True,
        'banned': False,
        'blocked_users': []
    }
    create_default_server('admin')
    persist_state()

# ---------- HTML ШАБЛОН (полный, с анимациями, голосом, админкой) ----------
HTML_TEMPLATE = """
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Discord Pro — Админка | Голос | Анимации</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
    <script src="https://cdn.socket.io/4.8.1/socket.io.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        :root {
            --bg-primary: #1e1f22;
            --bg-secondary: #2b2d31;
            --bg-tertiary: #313338;
            --bg-hover: #3c3f45;
            --text-primary: #dbdee1;
            --text-secondary: #949ba4;
            --accent: #5865f2;
            --accent-hover: #4752c4;
            --danger: #f23f42;
            --success: #23a55a;
            --border: #1e1f22;
            --shadow: 0 8px 20px rgba(0,0,0,0.3);
            --transition: all 0.2s cubic-bezier(0.2, 0.9, 0.4, 1.1);
        }
        body.light {
            --bg-primary: #f2f3f5;
            --bg-secondary: #e3e5e8;
            --bg-tertiary: #ffffff;
            --bg-hover: #d9dde2;
            --text-primary: #2e3338;
            --text-secondary: #5e6672;
            --border: #d4d7dc;
            --shadow: 0 8px 20px rgba(0,0,0,0.1);
        }
        body {
            font-family: 'Segoe UI', 'Helvetica Neue', sans-serif;
            background: var(--bg-primary);
            color: var(--text-primary);
            height: 100vh;
            overflow: hidden;
            transition: var(--transition);
        }
        @keyframes fadeSlideUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(88,101,242,0.7); }
            70% { transform: scale(1.02); box-shadow: 0 0 0 10px rgba(88,101,242,0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(88,101,242,0); }
        }
        .message, .toast, .modal-card, .channel, .dm-entry, .server-icon {
            animation: fadeSlideUp 0.25s ease;
        }
        .server-icon:hover, .channel:hover, .dm-entry:hover, button:hover {
            transform: scale(1.02);
            transition: var(--transition);
        }
        .ringing { animation: pulse 1s infinite; }
        .auth-container {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            background: linear-gradient(135deg, #1e1f22 0%, #2b2d31 100%);
        }
        .auth-box {
            background: var(--bg-tertiary);
            border-radius: 28px;
            padding: 40px;
            width: 440px;
            box-shadow: var(--shadow);
            backdrop-filter: blur(2px);
        }
        .auth-box h2 { margin-bottom: 28px; text-align: center; font-size: 28px; font-weight: 700; }
        .auth-box input {
            width: 100%;
            padding: 14px 18px;
            margin: 12px 0;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            color: var(--text-primary);
            border-radius: 18px;
            font-size: 16px;
            transition: var(--transition);
        }
        .auth-box input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px rgba(88,101,242,0.2); }
        .auth-box button {
            width: 100%;
            padding: 14px;
            background: var(--accent);
            border: none;
            color: white;
            border-radius: 18px;
            cursor: pointer;
            font-weight: bold;
            font-size: 16px;
            margin-top: 16px;
            transition: var(--transition);
        }
        .auth-box button:hover { background: var(--accent-hover); transform: scale(0.98); }
        .auth-switch { text-align: center; margin-top: 24px; color: var(--accent); cursor: pointer; font-weight: 500; }
        .error { color: var(--danger); font-size: 13px; margin-top: 6px; }
        .hidden { display: none; }
        .app { display: flex; height: 100vh; }
        .servers-bar {
            width: 80px;
            background: var(--bg-primary);
            display: flex;
            flex-direction: column;
            align-items: center;
            padding: 16px 0;
            gap: 12px;
            overflow-y: auto;
        }
        .server-icon {
            width: 52px;
            height: 52px;
            background: var(--bg-secondary);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 26px;
            cursor: pointer;
            transition: var(--transition);
        }
        .server-icon:hover, .server-icon.active { border-radius: 18px; background: var(--accent); transform: scale(1.05); }
        .add-server { background: var(--bg-secondary); color: var(--success); }
        .channels-panel {
            width: 270px;
            background: var(--bg-secondary);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
        }
        .channels-list { flex: 1; overflow-y: auto; padding: 12px; }
        .category {
            font-size: 12px;
            font-weight: 600;
            color: var(--text-secondary);
            padding: 12px 8px 6px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            letter-spacing: 0.5px;
        }
        .channel, .dm-entry {
            padding: 8px 10px;
            margin: 2px 0;
            border-radius: 12px;
            cursor: pointer;
            display: flex;
            align-items: center;
            gap: 10px;
            color: var(--text-secondary);
            transition: var(--transition);
        }
        .channel:hover, .dm-entry:hover, .channel.active { background: var(--bg-hover); color: var(--text-primary); }
        .user-footer {
            padding: 12px;
            background: #232428;
            display: flex;
            align-items: center;
            gap: 12px;
            cursor: pointer;
            border-top: 1px solid var(--border);
            transition: var(--transition);
        }
        .user-footer:hover { background: var(--bg-hover); }
        .user-avatar-small {
            width: 40px;
            height: 40px;
            background: var(--accent);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 18px;
        }
        .chat-area { flex: 1; display: flex; flex-direction: column; background: var(--bg-tertiary); }
        .chat-header {
            padding: 14px 20px;
            border-bottom: 1px solid var(--border);
            display: flex;
            justify-content: space-between;
            align-items: center;
            background: var(--bg-secondary);
        }
        .chat-messages { flex: 1; overflow-y: auto; padding: 20px; display: flex; flex-direction: column; gap: 16px; }
        .message { display: flex; align-items: flex-start; gap: 14px; }
        .message-avatar { width: 44px; height: 44px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 18px; }
        .message-content { flex: 1; }
        .message-author { font-weight: 600; color: var(--text-primary); }
        .message-time { font-size: 11px; color: var(--text-secondary); margin-left: 10px; }
        .message-text { margin-top: 6px; line-height: 1.4; word-break: break-word; }
        .message-actions { opacity: 0; transition: 0.1s; margin-left: 12px; }
        .message:hover .message-actions { opacity: 1; }
        .message-actions i { cursor: pointer; margin-left: 8px; color: var(--text-secondary); transition: var(--transition); }
        .message-actions i:hover { color: var(--text-primary); transform: scale(1.1); }
        .message-input-area {
            padding: 16px 20px;
            background: var(--bg-secondary);
            margin: 12px;
            border-radius: 28px;
            display: flex;
            gap: 12px;
        }
        .message-input-area input {
            flex: 1;
            background: var(--bg-primary);
            border: none;
            color: var(--text-primary);
            padding: 12px 18px;
            border-radius: 28px;
            font-size: 15px;
            transition: var(--transition);
        }
        .message-input-area input:focus { outline: none; box-shadow: 0 0 0 2px var(--accent); }
        .message-input-area button {
            background: var(--accent);
            border: none;
            color: white;
            padding: 0 20px;
            border-radius: 28px;
            cursor: pointer;
            transition: var(--transition);
        }
        .message-input-area button:hover { background: var(--accent-hover); transform: scale(0.96); }
        .online-panel {
            width: 260px;
            background: var(--bg-secondary);
            padding: 20px;
            overflow-y: auto;
        }
        .online-header { font-weight: bold; margin-bottom: 16px; font-size: 14px; letter-spacing: 0.5px; }
        .online-friend {
            display: flex;
            align-items: center;
            gap: 12px;
            padding: 10px 0;
            border-bottom: 1px solid var(--border);
            transition: var(--transition);
        }
        .online-friend:hover { background: var(--bg-hover); border-radius: 12px; padding-left: 8px; }
        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.8);
            justify-content: center;
            align-items: center;
            z-index: 1000;
            backdrop-filter: blur(4px);
        }
        .modal-card {
            background: var(--bg-tertiary);
            border-radius: 28px;
            width: 500px;
            max-width: 90%;
            padding: 28px;
            box-shadow: var(--shadow);
        }
        .modal-card input, .modal-card select, .modal-card textarea {
            width: 100%;
            padding: 12px;
            margin: 12px 0;
            background: var(--bg-primary);
            border: 1px solid var(--border);
            color: var(--text-primary);
            border-radius: 18px;
            transition: var(--transition);
        }
        .modal-card button {
            margin-top: 16px;
            background: var(--accent);
            border: none;
            padding: 12px;
            color: white;
            border-radius: 18px;
            cursor: pointer;
            width: 100%;
            font-weight: bold;
            transition: var(--transition);
        }
        .modal-card button:hover { background: var(--accent-hover); transform: scale(0.98); }
        .close-modal { float: right; cursor: pointer; font-size: 28px; line-height: 1; transition: var(--transition); }
        .close-modal:hover { color: var(--danger); transform: scale(1.1); }
        .toast {
            position: fixed;
            bottom: 30px;
            right: 30px;
            background: var(--bg-secondary);
            color: var(--text-primary);
            padding: 14px 24px;
            border-radius: 40px;
            z-index: 1100;
            border-left: 5px solid var(--accent);
            box-shadow: var(--shadow);
            font-weight: 500;
        }
        .call-overlay { display:none; position:fixed; inset:0; background:rgba(0,0,0,.88); z-index:2000; align-items:center; justify-content:center; padding:24px; }
        .call-card { width:min(1000px,96vw); background:var(--bg-tertiary); border-radius:24px; padding:20px; box-shadow:var(--shadow); }
        .video-grid { display:grid; grid-template-columns:2fr 1fr; gap:14px; }
        .video-grid video { width:100%; aspect-ratio:16/9; object-fit:cover; background:#111; border-radius:18px; }
        .call-controls { display:flex; gap:10px; justify-content:center; margin-top:14px; }
        .call-controls button { border:0; border-radius:14px; padding:12px 18px; background:var(--accent); color:#fff; cursor:pointer; }
        .call-controls .hangup { background:var(--danger); }
        .request-item { display:flex; align-items:center; gap:10px; padding:10px 0; border-bottom:1px solid var(--border); }
        .request-item button { width:auto; margin:0; padding:8px 12px; }
        .admin-container { padding: 30px; height: 100vh; overflow-y: auto; }
        .admin-card {
            background: var(--bg-tertiary);
            border-radius: 28px;
            padding: 24px;
            margin-bottom: 24px;
            box-shadow: var(--shadow);
        }
        .admin-table { width: 100%; border-collapse: collapse; }
        .admin-table th, .admin-table td { padding: 12px; text-align: left; border-bottom: 1px solid var(--border); }
        .admin-btn {
            background: var(--accent);
            border: none;
            color: white;
            padding: 6px 12px;
            border-radius: 12px;
            cursor: pointer;
            margin: 3px;
            transition: var(--transition);
        }
        .admin-btn:hover { transform: scale(0.96); }
        .admin-btn.danger { background: var(--danger); }
        .admin-btn.success { background: var(--success); }
        i, button { cursor: pointer; }
        #incoming-call-actions button, #hangup-call { border:none; color:white; padding:12px 22px; border-radius:18px; font-weight:700; }
    </style>
</head>
<body>
    {% if not logged_in %}
    <div class="auth-container">
        <div class="auth-box">
            <h2 id="auth-title">Вход в аккаунт</h2>
            <div id="login-fields">
                <input type="text" id="login-username" placeholder="Имя пользователя">
                <input type="password" id="login-password" placeholder="Пароль">
                <div id="login-error" class="error"></div>
                <button id="do-login">Войти</button>
            </div>
            <div id="register-fields" class="hidden">
                <input type="text" id="reg-username" placeholder="Имя пользователя">
                <input type="password" id="reg-password" placeholder="Пароль">
                <input type="password" id="reg-confirm" placeholder="Подтвердите пароль">
                <input type="tel" id="reg-phone" placeholder="Номер телефона (необязательно)">
                <div id="reg-error" class="error"></div>
                <button id="do-register">Зарегистрироваться</button>
            </div>
            <div class="auth-switch" id="switch-to-reg">Нет аккаунта? Создать</div>
            <div class="auth-switch hidden" id="switch-to-login">Уже есть аккаунт? Войти</div>
        </div>
    </div>
    {% else %}
        {% if admin_view %}
        <!-- АДМИН ПАНЕЛЬ -->
        <div class="admin-container">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h1><i class="fas fa-shield-alt"></i> Админ панель</h1>
                <div>
                    <button class="admin-btn" onclick="location.href='/'">← На главную</button>
                    <button class="admin-btn" id="logout-btn">Выйти</button>
                </div>
            </div>
            <div class="admin-card">
                <h3>Статистика</h3>
                <p>Всего пользователей: <strong id="total-users">0</strong></p>
                <p>Всего серверов: <strong id="total-servers">0</strong></p>
                <p>Всего сообщений: <strong id="total-messages">0</strong></p>
            </div>
            <div class="admin-card">
                <h3>Пользователи</h3>
                <table class="admin-table" id="users-table">
                    <thead><tr><th>Имя</th><th>Роль</th><th>Статус</th><th>Действия</th></tr></thead>
                    <tbody></tbody>
                </table>
            </div>
            <div class="admin-card">
                <h3>Сервера и каналы</h3>
                <div id="servers-list"></div>
            </div>
            <div class="admin-card">
                <h3>Поиск и управление сообщениями</h3>
                <input type="text" id="admin-search-msg" placeholder="Поиск по сообщениям" style="width: 100%; padding: 12px; border-radius: 18px;">
                <div id="admin-messages-results"></div>
            </div>
        </div>
        <script>
            async function loadAdminStats() {
                const res = await fetch('/api/admin/stats');
                const stats = await res.json();
                document.getElementById('total-users').innerText = stats.total_users;
                document.getElementById('total-servers').innerText = stats.total_servers;
                document.getElementById('total-messages').innerText = stats.total_messages;
            }
            async function loadUsers() {
                const res = await fetch('/api/admin/users');
                const users = await res.json();
                const tbody = document.querySelector('#users-table tbody');
                tbody.innerHTML = '';
                users.forEach(u => {
                    const row = tbody.insertRow();
                    row.insertCell(0).innerText = u.username;
                    row.insertCell(1).innerHTML = u.is_admin ? '<span style="color:var(--accent)">Админ</span>' : 'Пользователь';
                    row.insertCell(2).innerHTML = u.banned ? '<span style="color:var(--danger)">Заблокирован</span>' : 'Активен';
                    const actions = row.insertCell(3);
                    if (!u.is_admin) {
                        const makeAdminBtn = document.createElement('button');
                        makeAdminBtn.innerText = 'Назначить админом';
                        makeAdminBtn.className = 'admin-btn';
                        makeAdminBtn.onclick = () => fetch('/api/admin/set_admin', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username: u.username, is_admin: true})}).then(() => loadUsers());
                        actions.appendChild(makeAdminBtn);
                    } else if (u.username !== '{{ current_user.username }}') {
                        const removeAdminBtn = document.createElement('button');
                        removeAdminBtn.innerText = 'Снять админа';
                        removeAdminBtn.className = 'admin-btn';
                        removeAdminBtn.onclick = () => fetch('/api/admin/set_admin', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username: u.username, is_admin: false})}).then(() => loadUsers());
                        actions.appendChild(removeAdminBtn);
                    }
                    const banBtn = document.createElement('button');
                    banBtn.innerText = u.banned ? 'Разблокировать' : 'Заблокировать';
                    banBtn.className = 'admin-btn danger';
                    banBtn.onclick = () => fetch('/api/admin/ban_user', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username: u.username, ban: !u.banned})}).then(() => loadUsers());
                    actions.appendChild(banBtn);
                    const deleteUserBtn = document.createElement('button');
                    deleteUserBtn.innerText = 'Удалить';
                    deleteUserBtn.className = 'admin-btn danger';
                    deleteUserBtn.onclick = () => { if(confirm('Удалить пользователя?')) fetch('/api/admin/delete_user', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username: u.username})}).then(() => loadUsers()); };
                    actions.appendChild(deleteUserBtn);
                });
            }
            async function loadServersAdmin() {
                const res = await fetch('/api/admin/servers');
                const servers = await res.json();
                const container = document.getElementById('servers-list');
                container.innerHTML = '';
                servers.forEach(s => {
                    const div = document.createElement('div');
                    div.style.marginBottom = '16px';
                    div.innerHTML = `<strong>${s.icon} ${s.name}</strong> (Владелец: ${s.owner})<br>Каналы: ${s.channels.map(c => c.name).join(', ')}`;
                    container.appendChild(div);
                });
            }
            async function searchMessages() {
                const query = document.getElementById('admin-search-msg').value;
                if (query.length < 2) return;
                const res = await fetch(`/api/admin/search_messages?q=${encodeURIComponent(query)}`);
                const msgs = await res.json();
                const container = document.getElementById('admin-messages-results');
                container.innerHTML = '';
                msgs.forEach(msg => {
                    const div = document.createElement('div');
                    div.style.borderBottom = '1px solid var(--border)';
                    div.style.padding = '12px';
                    div.innerHTML = `<b>${msg.author}</b> [${msg.time}]: ${msg.content}<br><small>Сервер: ${msg.server_name}, канал: #${msg.channel_name}</small>
                                    <button class="admin-btn danger" onclick="deleteMessageAdmin('${msg.id}')">Удалить</button>`;
                    container.appendChild(div);
                });
            }
            window.deleteMessageAdmin = async (msgId) => {
                await fetch('/api/admin/delete_message', {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({message_id: msgId})});
                searchMessages();
            };
            document.getElementById('admin-search-msg').addEventListener('input', searchMessages);
            document.getElementById('logout-btn').onclick = () => { fetch('/api/logout').then(() => location.reload()); };
            loadAdminStats(); loadUsers(); loadServersAdmin();
        </script>
        {% else %}
        <!-- ОСНОВНОЙ ИНТЕРФЕЙС -->
        <div class="app">
            <div class="servers-bar" id="servers-bar"></div>
            <div class="channels-panel">
                <div class="channels-list" id="channels-list"></div>
                <div class="user-footer" id="user-footer">
                    <div class="user-avatar-small" style="background: {{ current_user.profile.avatar_color }};">{{ current_user.profile.avatar_letter }}</div>
                    <div style="flex:1">
                        <div id="footer-name">{{ current_user.profile.display_name }}</div>
                        <div class="user-status" id="footer-status">{{ current_user.profile.status_str }}</div>
                    </div>
                    <i class="fas fa-cog"></i>
                    {% if current_user.is_admin %}<i class="fas fa-shield-alt" id="admin-panel-btn" style="margin-left: 8px;"></i>{% endif %}
                </div>
            </div>
            <div class="chat-area">
                <div class="chat-header">
                    <span id="chat-title"># general</span>
                    <div>
                        <i class="fas fa-video" id="voice-call-btn" style="margin-right: 20px;"></i>
                        <i class="fas fa-ellipsis-v" id="three-dots-btn"></i>
                    </div>
                </div>
                <div class="chat-messages" id="chat-messages"></div>
                <div class="message-input-area">
                    <input type="text" id="message-input" placeholder="Написать сообщение...">
                    <button id="send-msg"><i class="fas fa-paper-plane"></i></button>
                </div>
            </div>
            <div class="online-panel">
                <div class="online-header">В сети — <span id="online-count">0</span></div>
                <div id="online-list"></div>
            </div>
        </div>

        <!-- Модальные окна -->
        <div id="profile-modal" class="modal"><div class="modal-card"><span class="close-modal">&times;</span><h2>Профиль</h2><div id="profile-avatar" style="width:80px;height:80px;background:{{ current_user.profile.avatar_color }};border-radius:50%;margin:0 auto;display:flex;align-items:center;justify-content:center;font-size:32px;">{{ current_user.profile.avatar_letter }}</div><label>Имя</label><input id="profile-name" value="{{ current_user.profile.display_name }}"><label>Статус</label><select id="profile-status"><option value="online">🟢 Онлайн</option><option value="dnd">🔴 Не беспокоить</option><option value="idle">🌙 Не активен</option><option value="offline">⚫ Невидимка</option></select><label>Цвет аватара</label><input type="color" id="profile-avatar-color" value="{{ current_user.profile.avatar_color }}"><label>Буква</label><input id="profile-avatar-letter" maxlength="1" value="{{ current_user.profile.avatar_letter }}"><label>О себе</label><textarea id="profile-bio" rows="3">{{ current_user.profile.bio or '' }}</textarea><button id="save-profile">Сохранить</button></div></div>
        <div id="add-friend-modal" class="modal"><div class="modal-card"><span class="close-modal">&times;</span><h3>Добавить пользователя</h3><input id="friend-username" placeholder="@username или номер телефона"><div id="friend-error" class="error"></div><button id="send-friend-req">Отправить заявку</button><div id="friend-requests" style="margin-top:18px"></div></div></div>
        <div id="create-server-modal" class="modal"><div class="modal-card"><span class="close-modal">&times;</span><h3>Создать сервер</h3><input id="server-name" placeholder="Название"><input id="server-icon" placeholder="Иконка эмодзи" value="🏠"><button id="create-server-btn">Создать</button></div></div>
        <div id="create-channel-modal" class="modal"><div class="modal-card"><span class="close-modal">&times;</span><h3>Создать канал</h3><input id="channel-name" placeholder="Название"><button id="create-channel-btn">Создать</button></div></div>
        <div id="three-dots-menu" class="modal"><div class="modal-card" style="width: 320px;"><span class="close-modal">&times;</span><h3>Действия</h3><button id="block-user-btn">🚫 Заблокировать пользователя</button><button id="clear-chat-btn">🗑️ Очистить чат</button><button id="toggle-theme-btn">🌓 Сменить тему</button><button id="channel-settings-btn">⚙️ Настройки канала</button></div></div>
        <div id="channel-settings-modal" class="modal"><div class="modal-card"><span class="close-modal">&times;</span><h3>Настройки канала</h3><button id="rename-channel-btn">✏️ Переименовать канал</button><button id="delete-channel-btn" style="background: var(--danger);">❌ Удалить канал</button></div></div>
        <div id="call-overlay" class="call-overlay">
          <div class="call-card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px"><h2 id="call-title">Видеозвонок</h2><span id="call-status">Подключение...</span></div>
            <div class="video-grid"><video id="remote-video" autoplay playsinline></video><video id="local-video" autoplay muted playsinline></video></div>
            <div class="call-controls"><button id="toggle-camera">📹 Камера</button><button id="toggle-mic">🎙️ Микрофон</button><button id="end-call" class="hangup">Завершить</button></div>
          </div>
        </div>

        <script>
            let currentServer = null, currentChannel = null, currentDMUser = null;
            let currentUser = {{ current_user|tojson }};
            const socket = io({transports:['websocket','polling']});
            let pc = null, localStream = null, pendingOffer = null, pendingCaller = null, activeCallUser = null;
            const rtcConfig = {iceServers:[
                {urls:'stun:stun.l.google.com:19302'},
                {urls:'stun:stun.cloudflare.com:3478'}
            ]};

            function showCallOverlay(title, status='Подключение...') {
                document.getElementById('call-overlay').style.display='flex';
                document.getElementById('call-title').innerText=title;
                document.getElementById('call-status').innerText=status;
            }
            function closeCallUI() {
                document.getElementById('call-overlay').style.display='none';
                document.getElementById('remote-video').srcObject=null;
                document.getElementById('local-video').srcObject=null;
            }
            function stopLocalStream(){
                if(localStream){localStream.getTracks().forEach(t=>t.stop()); localStream=null;}
            }
            async function getVideoStream(){
                if(!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) throw new Error('Камера недоступна: нужен HTTPS или localhost');
                return await navigator.mediaDevices.getUserMedia({video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}},audio:true});
            }
            function cleanupCall(sendHangup=true){
                if(sendHangup && activeCallUser) socket.emit('call_hangup',{to:activeCallUser});
                if(pc){pc.close();pc=null;}
                stopLocalStream();
                closeCallUI();
                pendingOffer=null; pendingCaller=null; activeCallUser=null;
            }
            async function createPeer(target){
                pc=new RTCPeerConnection(rtcConfig);
                pc.onicecandidate=e=>{if(e.candidate) socket.emit('call_ice',{to:target,candidate:e.candidate});};
                pc.ontrack=e=>{document.getElementById('remote-video').srcObject=e.streams[0]; document.getElementById('call-status').innerText='Соединение установлено';};
                pc.onconnectionstatechange=()=>{
                    if(pc && ['failed','disconnected','closed'].includes(pc.connectionState)) document.getElementById('call-status').innerText='Соединение прервано';
                };
                localStream.getTracks().forEach(t=>pc.addTrack(t,localStream));
            }
            async function startCall(targetUsername){
                if(!targetUsername || targetUsername===currentUser.username) return;
                try{
                    localStream=await getVideoStream();
                    activeCallUser=targetUsername;
                    showCallOverlay('Видеозвонок с @'+targetUsername,'Вызов...');
                    document.getElementById('local-video').srcObject=localStream;
                    await createPeer(targetUsername);
                    const offer=await pc.createOffer();
                    await pc.setLocalDescription(offer);
                    socket.emit('call_offer',{to:targetUsername,offer:offer});
                }catch(e){cleanupCall(false);showToast('❌ Не удалось включить камеру/микрофон',true);}
            }
            async function acceptIncomingCall(){
                if(!pendingOffer || !pendingCaller) return;
                try{
                    localStream=await getVideoStream();
                    document.getElementById('local-video').srcObject=localStream;
                    document.getElementById('call-status').innerText='Подключение...';
                    await createPeer(pendingCaller);
                    await pc.setRemoteDescription(new RTCSessionDescription(pendingOffer));
                    const answer=await pc.createAnswer();
                    await pc.setLocalDescription(answer);
                    socket.emit('call_answer',{to:pendingCaller,answer:answer});
                    pendingOffer=null;
                }catch(e){socket.emit('call_reject',{to:pendingCaller});cleanupCall(false);showToast('❌ Нет доступа к камере или микрофону',true);}
            }
            socket.on('connect',()=>socket.emit('presence_online'));
            socket.on('presence_update',()=>loadOnlineFriends());
            socket.on('friends_updated',()=>{loadChannelsAndDMs();loadOnlineFriends();});
            socket.on('friend_request',data=>showToast('👤 Новая заявка в друзья от @'+data.from));
            socket.on('new_dm',msg=>{
                if(currentDMUser && (msg.author===currentDMUser || msg.author===currentUser.username)) appendMessage(msg);
                loadChannelsAndDMs();
            });
            socket.on('new_message',msg=>{
                if(currentServer===msg.server_id && currentChannel===msg.channel_id) appendMessage(msg);
            });
            socket.on('call_offer',data=>{
                if(activeCallUser){socket.emit('call_reject',{to:data.from});return;}
                pendingOffer=data.offer; pendingCaller=data.from; activeCallUser=data.from;
                showCallOverlay('Входящий видеозвонок от @'+data.from,'Входящий звонок');
                document.getElementById('call-status').innerText='Нажмите «Принять» в интерфейсе звонка';
                const controls=document.querySelector('.call-controls');
                if(controls && !document.getElementById('accept-incoming')){
                    const b=document.createElement('button'); b.id='accept-incoming'; b.innerText='Принять'; b.onclick=acceptIncomingCall; controls.insertBefore(b,controls.firstChild);
                }
            });
            socket.on('call_answer',async data=>{if(pc) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));});
            socket.on('call_ice',async data=>{if(pc && data.candidate){try{await pc.addIceCandidate(new RTCIceCandidate(data.candidate));}catch(e){}}});
            socket.on('call_rejected',data=>{showToast('📵 @'+data.from+' отклонил звонок');cleanupCall(false);});
            socket.on('call_hangup',()=>{showToast('📴 Звонок завершён');cleanupCall(false);});

            async function loadServers(){
                const res = await fetch('/api/servers');
                const list = await res.json();
                const bar = document.getElementById('servers-bar');
                bar.innerHTML = '';
                list.forEach(s => {
                    const div = document.createElement('div');
                    div.className = `server-icon ${currentServer === s.id ? 'active' : ''}`;
                    div.innerText = s.icon || '🏠';
                    div.onclick = () => { currentServer = s.id; currentDMUser = null; loadServers(); loadChannelsAndDMs(); };
                    bar.appendChild(div);
                });
                const addDiv = document.createElement('div');
                addDiv.className = 'server-icon add-server';
                addDiv.innerHTML = '<i class="fas fa-plus"></i>';
                addDiv.onclick = () => document.getElementById('create-server-modal').style.display = 'flex';
                bar.appendChild(addDiv);
            }

            async function loadChannelsAndDMs(){
                if(!currentServer) return;
                const res = await fetch(`/api/servers/${currentServer}/channels`);
                const channels = await res.json();
                const friendsRes = await fetch('/api/friends');
                const friends = await friendsRes.json();
                const container = document.getElementById('channels-list');
                container.innerHTML = '';
                const cat = document.createElement('div');
                cat.className = 'category';
                cat.innerHTML = '<span>ТЕКСТОВЫЕ КАНАЛЫ</span><i class="fas fa-plus add-channel" id="add-channel-btn"></i>';
                container.appendChild(cat);
                channels.forEach(ch => {
                    const div = document.createElement('div');
                    div.className = `channel ${currentChannel === ch.id ? 'active' : ''}`;
                    div.innerHTML = `<span class="hash">#</span> ${ch.name}`;
                    div.onclick = () => { currentChannel = ch.id; currentDMUser = null; socket.emit('join_channel', {server_id: currentServer, channel_id: currentChannel}); document.getElementById('chat-title').innerHTML = `# ${ch.name}`; loadMessages(); loadChannelsAndDMs(); };
                    container.appendChild(div);
                });
                const dmCat = document.createElement('div');
                dmCat.className = 'category';
                dmCat.innerHTML = '<span>ЛИЧНЫЕ СООБЩЕНИЯ</span><i class="fas fa-user-plus add-channel" id="add-friend-icon"></i>';
                container.appendChild(dmCat);
                friends.forEach(f => {
                    const div = document.createElement('div');
                    div.className = 'dm-entry';
                    div.innerHTML = `<div class="user-avatar-small" style="background:${f.avatar_color};">${f.avatar_letter}</div> ${f.display_name}`;
                    div.onclick = () => { currentDMUser = f.username; currentChannel = null; document.getElementById('chat-title').innerHTML = `@ ${f.display_name}`; loadMessagesDM(f.username); loadChannelsAndDMs(); };
                    container.appendChild(div);
                });
                document.getElementById('add-channel-btn')?.addEventListener('click', () => document.getElementById('create-channel-modal').style.display = 'flex');
                document.getElementById('add-friend-icon')?.addEventListener('click', () => document.getElementById('add-friend-modal').style.display = 'flex');
            }

            async function loadMessages(){
                if(!currentServer || !currentChannel) return;
                const res = await fetch(`/api/messages/${currentServer}/${currentChannel}`);
                const msgs = await res.json();
                renderMessages(msgs);
            }
            async function loadMessagesDM(username){
                const res = await fetch(`/api/dm_messages/${username}`);
                const msgs = await res.json();
                renderMessages(msgs);
            }
            function renderMessages(msgs){
                const container = document.getElementById('chat-messages');
                container.innerHTML = '';
                msgs.forEach(msg => {
                    if(msg.author === 'system'){
                        const div = document.createElement('div');
                        div.style.textAlign = 'center';
                        div.style.fontSize = '12px';
                        div.style.color = 'var(--text-secondary)';
                        div.style.margin = '8px 0';
                        div.innerText = msg.content;
                        container.appendChild(div);
                        return;
                    }
                    const div = document.createElement('div');
                    div.className = 'message';
                    div.dataset.id = msg.id;
                    div.innerHTML = `
                        <div class="message-avatar" style="background:${msg.avatar_color};">${msg.avatar_letter}</div>
                        <div class="message-content">
                            <div><span class="message-author">${escapeHtml(msg.display_name)}</span><span class="message-time">${msg.time}</span></div>
                            <div class="message-text">${escapeHtml(msg.content)}</div>
                        </div>
                        <div class="message-actions">
                            ${(msg.author === currentUser.username || currentUser.is_admin) ? `<i class="fas fa-edit edit-msg" data-id="${msg.id}"></i><i class="fas fa-trash delete-msg" data-id="${msg.id}"></i>` : ''}
                        </div>
                    `;
                    container.appendChild(div);
                });
                document.querySelectorAll('.edit-msg').forEach(el => el.onclick = () => editMessage(el.dataset.id));
                document.querySelectorAll('.delete-msg').forEach(el => el.onclick = () => deleteMessage(el.dataset.id));
                container.scrollTop = container.scrollHeight;
            }
            function appendMessage(msg){
                const container=document.getElementById('chat-messages');
                if(msg.author==='system') return;
                const div=document.createElement('div'); div.className='message'; div.dataset.id=msg.id;
                div.innerHTML=`<div class="message-avatar" style="background:${msg.avatar_color};">${escapeHtml(msg.avatar_letter)}</div><div class="message-content"><div><span class="message-author">${escapeHtml(msg.display_name)}</span><span class="message-time">${escapeHtml(msg.time)}</span></div><div class="message-text">${escapeHtml(msg.content)}</div></div>`;
                container.appendChild(div); container.scrollTop=container.scrollHeight;
            }

            async function sendMessage(){
                const input = document.getElementById('message-input');
                const content = input.value.trim();
                if(!content) return;
                let url, body;
                if(currentChannel && currentServer){
                    url = '/api/send';
                    body = { server_id: currentServer, channel_id: currentChannel, content };
                } else if(currentDMUser){
                    url = '/api/send_dm';
                    body = { to: currentDMUser, content };
                } else return;
                const res = await fetch(url, { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body) });
                if(res.ok){ input.value = ''; } else showToast('Ошибка отправки', true);
            }
            async function editMessage(id){
                const newContent = prompt('Редактировать сообщение:');
                if(!newContent) return;
                await fetch('/api/edit_message', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ message_id: id, content: newContent }) });
                if(currentChannel) loadMessages();
                else loadMessagesDM(currentDMUser);
            }
            async function deleteMessage(id){
                if(!confirm('Удалить сообщение?')) return;
                await fetch('/api/delete_message', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ message_id: id }) });
                if(currentChannel) loadMessages();
                else loadMessagesDM(currentDMUser);
            }

            async function loadOnlineFriends(){
                const res = await fetch('/api/online_friends');
                const online = await res.json();
                document.getElementById('online-count').innerText = online.length;
                const container = document.getElementById('online-list');
                container.innerHTML = '';
                online.forEach(f => {
                    const div = document.createElement('div');
                    div.className = 'online-friend';
                    div.innerHTML = `<div class="user-avatar-small" style="background:${f.avatar_color};">${f.avatar_letter}</div><div>${f.display_name}</div>`;
                    container.appendChild(div);
                });
            }

            document.getElementById('voice-call-btn').title='Видеозвонок';
            document.getElementById('voice-call-btn').className='fas fa-video';
            document.getElementById('voice-call-btn').onclick = () => { if(currentDMUser) startCall(currentDMUser); else showToast('Выберите друга в разделе ЛИЧНЫЕ СООБЩЕНИЯ для звонка', true); };
            document.getElementById('end-call').onclick=()=>cleanupCall(true);
            document.getElementById('toggle-camera').onclick=()=>{const t=localStream?.getVideoTracks()[0]; if(t)t.enabled=!t.enabled;};
            document.getElementById('toggle-mic').onclick=()=>{const t=localStream?.getAudioTracks()[0]; if(t)t.enabled=!t.enabled;};
            document.getElementById('three-dots-btn').onclick = () => document.getElementById('three-dots-menu').style.display = 'flex';
            document.querySelectorAll('.close-modal').forEach(el => { el.onclick = function(){ this.closest('.modal').style.display = 'none'; }; });
            document.getElementById('block-user-btn').onclick = async () => {
                const username = prompt('Имя пользователя для блокировки:');
                if(username){
                    await fetch('/api/block_user', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ blocked: username }) });
                    showToast(`🔒 Заблокирован ${username}`);
                }
                document.getElementById('three-dots-menu').style.display = 'none';
            };
            document.getElementById('clear-chat-btn').onclick = async () => {
                if(confirm('Очистить все сообщения в этом чате?')){
                    if(currentChannel){
                        await fetch('/api/clear_chat', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ server_id: currentServer, channel_id: currentChannel }) });
                        loadMessages();
                    } else if(currentDMUser){
                        await fetch('/api/clear_dm', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ with: currentDMUser }) });
                        loadMessagesDM(currentDMUser);
                    }
                }
                document.getElementById('three-dots-menu').style.display = 'none';
            };
            document.getElementById('toggle-theme-btn').onclick = () => {
                document.body.classList.toggle('light');
                localStorage.setItem('theme', document.body.classList.contains('light') ? 'light' : 'dark');
                document.getElementById('three-dots-menu').style.display = 'none';
            };
            document.getElementById('channel-settings-btn').onclick = () => {
                if(currentChannel) document.getElementById('channel-settings-modal').style.display = 'flex';
                else showToast('Выберите канал', true);
                document.getElementById('three-dots-menu').style.display = 'none';
            };
            document.getElementById('rename-channel-btn').onclick = async () => {
                const newName = prompt('Новое имя канала:');
                if(newName){
                    await fetch('/api/rename_channel', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ server_id: currentServer, channel_id: currentChannel, new_name: newName }) });
                    loadChannelsAndDMs();
                }
                document.getElementById('channel-settings-modal').style.display = 'none';
            };
            document.getElementById('delete-channel-btn').onclick = async () => {
                if(confirm('Удалить канал?')){
                    await fetch('/api/delete_channel', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ server_id: currentServer, channel_id: currentChannel }) });
                    location.reload();
                }
            };
            document.getElementById('user-footer').onclick = () => document.getElementById('profile-modal').style.display = 'flex';
            document.getElementById('save-profile').onclick = async () => {
                const data = {
                    display_name: document.getElementById('profile-name').value,
                    status: document.getElementById('profile-status').value,
                    avatar_color: document.getElementById('profile-avatar-color').value,
                    avatar_letter: document.getElementById('profile-avatar-letter').value,
                    bio: document.getElementById('profile-bio').value
                };
                await fetch('/api/update_profile', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(data) });
                showToast('Профиль обновлён');
                location.reload();
            };
            async function loadFriendRequests(){
                const box=document.getElementById('friend-requests'); if(!box)return;
                const res=await fetch('/api/friend_requests'); const reqs=await res.json();
                box.innerHTML=reqs.length?'<b>Входящие заявки</b>':'';
                reqs.forEach(r=>{
                    const row=document.createElement('div'); row.className='request-item';
                    row.innerHTML=`<div style="flex:1"><b>${escapeHtml(r.display_name)}</b><br><small>@${escapeHtml(r.username)}</small></div>`;
                    const yes=document.createElement('button'); yes.innerText='Принять'; yes.onclick=async()=>{await fetch('/api/accept_friend_request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:r.username})});loadFriendRequests();loadChannelsAndDMs();};
                    const no=document.createElement('button'); no.innerText='Отклонить'; no.onclick=async()=>{await fetch('/api/reject_friend_request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:r.username})});loadFriendRequests();};
                    row.append(yes,no);box.appendChild(row);
                });
            }
            document.getElementById('send-friend-req').onclick=async()=>{
                const query=document.getElementById('friend-username').value.trim(); if(!query)return;
                const res=await fetch('/api/send_friend_request',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({to:query})});
                const data=await res.json();
                if(data.ok){showToast('Заявка отправлена реальному пользователю');document.getElementById('friend-username').value='';loadFriendRequests();}
                else document.getElementById('friend-error').innerText=data.error;
            };
            document.getElementById('toggle-camera').onclick=()=>{const t=localStream?.getVideoTracks()[0];if(t){t.enabled=!t.enabled;document.getElementById('toggle-camera').innerText=t.enabled?'📹 Камера':'🚫 Камера';}};
            document.getElementById('toggle-mic').onclick=()=>{const t=localStream?.getAudioTracks()[0];if(t){t.enabled=!t.enabled;document.getElementById('toggle-mic').innerText=t.enabled?'🎙️ Микрофон':'🔇 Микрофон';}};
            document.getElementById('create-server-btn').onclick = async () => {
                const name = document.getElementById('server-name').value.trim();
                const icon = document.getElementById('server-icon').value.trim() || '🏠';
                if(!name) return;
                await fetch('/api/create_server', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ name, icon }) });
                location.reload();
            };
            document.getElementById('create-channel-btn').onclick = async () => {
                const name = document.getElementById('channel-name').value.trim();
                if(!name || !currentServer) return;
                await fetch('/api/create_channel', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({ server_id: currentServer, channel_name: name }) });
                document.getElementById('create-channel-modal').style.display = 'none';
                loadChannelsAndDMs();
            };
            document.getElementById('send-msg').onclick = sendMessage;
            document.getElementById('message-input').onkeypress = e => { if(e.key === 'Enter') sendMessage(); };
            if(localStorage.getItem('theme') === 'light') document.body.classList.add('light');
            {% if current_user.is_admin %}
            document.getElementById('admin-panel-btn').onclick = () => { location.href = '/admin'; };
            {% endif %}
            async function init(){
                await loadServers();
                const srvRes = await fetch('/api/servers');
                const srv = await srvRes.json();
                if(srv.length > 0 && !currentServer){
                    currentServer = srv[0].id;
                    const chRes = await fetch(`/api/servers/${currentServer}/channels`);
                    const chs = await chRes.json();
                    if(chs.length > 0) currentChannel = chs[0].id;
                    if(currentChannel) socket.emit('join_channel', {server_id: currentServer, channel_id: currentChannel});
                    loadChannelsAndDMs();
                    loadMessages();
                }
                loadOnlineFriends();
                setInterval(loadOnlineFriends, 5000);
                loadFriendRequests();
            }
            init();
            function escapeHtml(str){ const div = document.createElement('div'); div.textContent = str; return div.innerHTML; }
        </script>
        {% endif %}
    {% endif %}
    <script>
        {% if not logged_in %}
        const loginDiv = document.getElementById('login-fields'), regDiv = document.getElementById('register-fields');
        const switchToReg = document.getElementById('switch-to-reg'), switchToLogin = document.getElementById('switch-to-login');
        switchToReg.onclick = () => {
            loginDiv.classList.add('hidden');
            regDiv.classList.remove('hidden');
            switchToReg.classList.add('hidden');
            switchToLogin.classList.remove('hidden');
            document.getElementById('auth-title').innerText = 'Регистрация';
        };
        switchToLogin.onclick = () => {
            regDiv.classList.add('hidden');
            loginDiv.classList.remove('hidden');
            switchToLogin.classList.add('hidden');
            switchToReg.classList.remove('hidden');
            document.getElementById('auth-title').innerText = 'Вход';
        };
        document.getElementById('do-login').onclick = async () => {
            const username = document.getElementById('login-username').value;
            const password = document.getElementById('login-password').value;
            const res = await fetch('/api/login', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username, password, phone: document.getElementById('reg-phone')?.value.trim() || ''}) });
            const data = await res.json();
            if(data.ok) location.reload();
            else document.getElementById('login-error').innerText = data.error;
        };
        document.getElementById('do-register').onclick = async () => {
            const username = document.getElementById('reg-username').value;
            const password = document.getElementById('reg-password').value;
            const confirm = document.getElementById('reg-confirm').value;
            if(password !== confirm){
                document.getElementById('reg-error').innerText = 'Пароли не совпадают';
                return;
            }
            const res = await fetch('/api/register', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({username, password, phone: document.getElementById('reg-phone')?.value.trim() || ''}) });
            const data = await res.json();
            if(data.ok) location.reload();
            else document.getElementById('reg-error').innerText = data.error;
        };
        {% endif %}
    </script>
</body>
</html>
"""

# Сохраняем изменения после успешных запросов. Это делает аккаунты, сообщения,
# друзей, серверы и настройки постоянными после перезапуска процесса.
@app.after_request
def persist_after_request(response):
    if request.method in ('POST', 'PUT', 'PATCH', 'DELETE') and response.status_code < 400:
        try:
            persist_state()
        except Exception as exc:
            app.logger.exception('SQLite persistence error: %s', exc)
    return response

# ---------- API МАРШРУТЫ ----------
@app.route('/api/health')
def health():
    return jsonify({'ok': True, 'service': 'zentora', 'users': len(users)})

@app.route('/')
def index():
    web_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'mobile', 'dist'))
    if os.path.isdir(web_root) and os.path.isfile(os.path.join(web_root, 'index.html')):
        return send_from_directory(web_root, 'index.html')
    logged_in = 'username' in session
    if not logged_in:
        return render_template_string(HTML_TEMPLATE, logged_in=False, admin_view=False, current_user=None)
    username = session['username']
    user = users.get(username)
    if not user:
        session.clear()
        return redirect('/')
    profile = user['profile']
    status_map = {'online': '🟢 Онлайн', 'dnd': '🔴 Не беспокоить', 'idle': '🌙 Не активен', 'offline': '⚫ Невидимка'}
    profile['status_str'] = status_map.get(profile.get('status', 'online'), '🟢 Онлайн')
    current_user_obj = {
        'username': username,
        'profile': profile,
        'is_admin': user.get('is_admin', False)
    }
    return render_template_string(HTML_TEMPLATE, logged_in=True, admin_view=False, current_user=current_user_obj)

@app.route('/admin')
def admin_panel():
    if 'username' not in session:
        return redirect('/')
    user = users.get(session['username'])
    if not user or not user.get('is_admin'):
        return "Доступ запрещён", 403
    profile = user['profile']
    status_map = {'online': '🟢 Онлайн', 'dnd': '🔴 Не беспокоить', 'idle': '🌙 Не активен', 'offline': '⚫ Невидимка'}
    profile['status_str'] = status_map.get(profile.get('status', 'online'), '🟢 Онлайн')
    current_user_obj = {
        'username': session['username'],
        'profile': profile,
        'is_admin': True
    }
    return render_template_string(HTML_TEMPLATE, logged_in=True, admin_view=True, current_user=current_user_obj)

@app.route('/api/register', methods=['POST'])
def register():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip().lstrip('@').lower()
    password = data.get('password') or ''
    phone = (data.get('phone') or '').strip()
    display_name = (data.get('display_name') or username).strip()

    if not username:
        return jsonify({'ok': False, 'error': 'Введите имя пользователя'})
    if len(username) < 3:
        return jsonify({'ok': False, 'error': 'Имя пользователя должно содержать минимум 3 символа'})
    if len(username) > 32:
        return jsonify({'ok': False, 'error': 'Имя пользователя слишком длинное'})
    if not all(ch.isalnum() or ch == '_' for ch in username):
        return jsonify({'ok': False, 'error': 'В username разрешены только буквы, цифры и _'})
    if len(password) < 6:
        return jsonify({'ok': False, 'error': 'Пароль должен содержать минимум 6 символов'})
    if len(password) > 128:
        return jsonify({'ok': False, 'error': 'Пароль слишком длинный'})
    if username in users:
        return jsonify({'ok': False, 'error': 'Этот username уже занят'})
    if phone:
        normalized_phone = ''.join(ch for ch in phone if ch.isdigit() or ch == '+')
        for existing in users.values():
            if existing.get('profile', {}).get('phone') == normalized_phone:
                return jsonify({'ok': False, 'error': 'Этот номер телефона уже зарегистрирован'})
        phone = normalized_phone

    is_admin = len(users) == 0
    users[username] = {
        'password': hash_password(password),
        'profile': {
            'display_name': display_name or username,
            'avatar_letter': (display_name or username)[0].upper(),
            'avatar_color': '#5865f2',
            'status': 'online',
            'bio': '',
            'email': f'{username}@example.com',
            'phone': phone
        },
        'friends': [],
        'friend_requests': [],
        'servers': [],
        'is_admin': is_admin,
        'banned': False,
        'blocked_users': []
    }
    create_default_server(username)
    session['username'] = username
    persist_state()
    return jsonify({'ok': True, 'user': {'username': username, 'display_name': users[username]['profile']['display_name']}})

@app.route('/api/login', methods=['POST'])
def login():
    data = request.get_json(silent=True) or {}
    username = (data.get('username') or '').strip().lstrip('@').lower()
    password = data.get('password') or ''
    if not username:
        return jsonify({'ok': False, 'error': 'Введите username'})
    if not password:
        return jsonify({'ok': False, 'error': 'Введите пароль'})
    if username not in users:
        return jsonify({'ok': False, 'error': 'Пользователь с таким username не найден'})
    if users[username]['password'] != hash_password(password):
        return jsonify({'ok': False, 'error': 'Неверный пароль'})
    if users[username].get('banned', False):
        return jsonify({'ok': False, 'error': 'Этот аккаунт заблокирован'})
    session['username'] = username
    users[username].setdefault('profile', {})['status'] = 'online'
    persist_state()
    return jsonify({'ok': True, 'user': {'username': username, 'display_name': users[username]['profile'].get('display_name', username)}})

@app.route('/api/me')
def current_session_user():
    if 'username' not in session or session['username'] not in users:
        return jsonify({'ok': False, 'error': 'Не авторизован'}), 401
    username = session['username']
    user = users[username]
    profile = user.get('profile', {})
    return jsonify({
        'ok': True,
        'user': {
            'username': username,
            'display_name': profile.get('display_name', username),
            'phone': profile.get('phone', ''),
            'email': profile.get('email', ''),
            'bio': profile.get('bio', ''),
            'avatar_letter': profile.get('avatar_letter', username[:1].upper()),
            'avatar_color': profile.get('avatar_color', '#5865f2'),
            'is_admin': bool(user.get('is_admin', False))
        }
    })

@app.route('/api/logout')
def logout():
    session.clear()
    return jsonify({'ok': True})

@app.route('/api/servers')
def get_servers():
    if 'username' not in session:
        return jsonify([]), 401
    username = session['username']
    user_servers = users[username].get('servers', [])
    result = []
    for sid in user_servers:
        if sid in servers:
            result.append({'id': sid, 'name': servers[sid]['name'], 'icon': servers[sid]['icon']})
    return jsonify(result)

@app.route('/api/servers/<server_id>/channels')
def get_channels(server_id):
    if server_id not in servers:
        return jsonify([]), 404
    return jsonify(servers[server_id].get('channels', []))

@app.route('/api/messages/<server_id>/<channel_id>')
def get_messages(server_id, channel_id):
    key = f"{server_id}_{channel_id}"
    return jsonify(messages.get(key, []))

@app.route('/api/send', methods=['POST'])
def send_message():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    username = session['username']
    if users[username].get('banned', False):
        return jsonify({'error': 'Banned'}), 403
    data = request.json
    server_id = data.get('server_id')
    channel_id = data.get('channel_id')
    content = data.get('content')
    if not server_id or not channel_id or not content:
        return jsonify({'error': 'Invalid'}), 400
    key = f"{server_id}_{channel_id}"
    if key not in messages:
        messages[key] = []
    profile = users[username]['profile']
    msg_id = generate_id()
    messages[key].append({
        'id': msg_id,
        'server_id': server_id,
        'channel_id': channel_id,
        'author': username,
        'display_name': profile['display_name'],
        'avatar_letter': profile['avatar_letter'],
        'avatar_color': profile['avatar_color'],
        'content': content,
        'time': datetime.now().strftime('%H:%M'),
        'editable': True
    })
    socketio.emit('new_message', messages[key][-1], room=f'channel:{server_id}:{channel_id}')
    return jsonify({'ok': True})

@app.route('/api/edit_message', methods=['POST'])
def edit_message():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    msg_id = data.get('message_id')
    new_content = data.get('content')
    for key, msgs in messages.items():
        for msg in msgs:
            if msg['id'] == msg_id and msg['author'] == session['username']:
                msg['content'] = new_content
                return jsonify({'ok': True})
    for key, msgs in dm_messages.items():
        for msg in msgs:
            if msg['id'] == msg_id and msg['author'] == session['username']:
                msg['content'] = new_content
                return jsonify({'ok': True})
    return jsonify({'error': 'Not found'}), 404

@app.route('/api/delete_message', methods=['POST'])
def delete_message():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    msg_id = data.get('message_id')
    is_admin = users[session['username']].get('is_admin', False)
    for key, msgs in messages.items():
        for i, msg in enumerate(msgs):
            if msg['id'] == msg_id and (msg['author'] == session['username'] or is_admin):
                del msgs[i]
                return jsonify({'ok': True})
    for key, msgs in dm_messages.items():
        for i, msg in enumerate(msgs):
            if msg['id'] == msg_id and (msg['author'] == session['username'] or is_admin):
                del msgs[i]
                return jsonify({'ok': True})
    return jsonify({'error': 'Not found'}), 404

@app.route('/api/dm_messages/<with_user>')
def get_dm_messages(with_user):
    if 'username' not in session:
        return jsonify([]), 401
    username = session['username']
    key = get_dm_key(username, with_user)
    return jsonify(dm_messages.get(key, []))

@app.route('/api/send_dm', methods=['POST'])
def send_dm():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    username = session['username']
    if users[username].get('banned', False):
        return jsonify({'error': 'Banned'}), 403
    data = request.json
    to_user = data.get('to')
    content = data.get('content')
    if not to_user or not content:
        return jsonify({'error': 'Invalid'}), 400
    if to_user not in users:
        return jsonify({'error': 'User not found'}), 404
    key = get_dm_key(username, to_user)
    if key not in dm_messages:
        dm_messages[key] = []
    profile = users[username]['profile']
    msg_id = generate_id()
    message = {
        'id': msg_id,
        'author': username,
        'display_name': profile['display_name'],
        'avatar_letter': profile['avatar_letter'],
        'avatar_color': profile['avatar_color'],
        'content': content,
        'time': datetime.now().strftime('%H:%M'),
        'editable': True
    }
    dm_messages[key].append(message)
    socketio.emit('new_dm', message, room='user:'+username)
    socketio.emit('new_dm', message, room='user:'+to_user)
    return jsonify({'ok': True, 'message': message})

@app.route('/api/clear_dm', methods=['POST'])
def clear_dm():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    with_user = data.get('with')
    if not with_user:
        return jsonify({'error': 'Invalid'}), 400
    key = get_dm_key(session['username'], with_user)
    if key in dm_messages:
        dm_messages[key] = []
        dm_messages[key].append({
            'id': generate_id(),
            'author': 'system',
            'display_name': 'System',
            'avatar_letter': 'S',
            'avatar_color': '#747f8d',
            'content': 'Чат очищен',
            'time': datetime.now().strftime('%H:%M'),
            'editable': False
        })
    return jsonify({'ok': True})

@app.route('/api/search_users')
def search_users():
    if 'username' not in session:
        return jsonify([]), 401
    q = (request.args.get('q') or '').strip().lstrip('@').lower()
    if not q:
        return jsonify([])
    result = []
    for uname, udata in users.items():
        if uname == session['username']:
            continue
        profile = udata.get('profile', {})
        if q in uname.lower() or q in str(profile.get('phone', '')).lower() or q in str(profile.get('display_name', '')).lower():
            result.append({
                'username': uname,
                'display_name': profile.get('display_name', uname),
                'phone': profile.get('phone', ''),
                'status': profile.get('status', 'offline'),
                'is_friend': uname in users[session['username']].get('friends', [])
            })
    return jsonify(result[:20])

@app.route('/api/friends')
def get_friends():
    if 'username' not in session:
        return jsonify([]), 401
    username = session['username']
    friend_names = users[username].get('friends', [])
    result = []
    for fname in friend_names:
        if fname in users:
            prof = users[fname]['profile']
            result.append({
                'username': fname,
                'display_name': prof['display_name'],
                'avatar_letter': prof['avatar_letter'],
                'avatar_color': prof['avatar_color'],
                'status': prof.get('status', 'offline')
            })
    return jsonify(result)

@app.route('/api/online_friends')
def online_friends():
    if 'username' not in session:
        return jsonify([]), 401
    username = session['username']
    friend_names = users[username].get('friends', [])
    online = []
    for fname in friend_names:
        if fname in users and connected_users.get(fname, 0) > 0 and users[fname]['profile'].get('status') != 'offline' and not users[fname].get('banned'):
            prof = users[fname]['profile']
            online.append({
                'display_name': prof['display_name'],
                'avatar_letter': prof['avatar_letter'],
                'avatar_color': prof['avatar_color']
            })
    return jsonify(online)

@app.route('/api/send_friend_request', methods=['POST'])
def send_friend_request():
    if 'username' not in session:
        return jsonify({'ok': False, 'error': 'Не авторизован'}), 401
    from_user = session['username']
    query = (request.json or {}).get('to', '').strip()
    if not query or query.lstrip('@') == from_user:
        return jsonify({'ok': False, 'error': 'Некорректный пользователь'})
    normalized = query.lstrip('@')
    to_user = normalized if normalized in users else None
    if not to_user:
        qphone = ''.join(ch for ch in query if ch.isdigit() or ch == '+')
        for uname, udata in users.items():
            if udata.get('profile', {}).get('phone') == qphone:
                to_user=uname; break
    if not to_user:
        return jsonify({'ok': False, 'error': 'Пользователь не найден по нику или номеру'})
    if to_user in users[from_user]['friends']:
        return jsonify({'ok': False, 'error': 'Уже в друзьях'})
    reqs = users[to_user].setdefault('friend_requests', [])
    if from_user in reqs: return jsonify({'ok': False, 'error': 'Заявка уже отправлена'})
    reqs.append(from_user)
    socketio.emit('friend_request', {'from': from_user}, room='user:'+to_user)
    return jsonify({'ok': True})

@app.route('/api/friend_requests')
def friend_requests():
    if 'username' not in session: return jsonify([]), 401
    result=[]
    for uname in users[session['username']].get('friend_requests', []):
        if uname in users:
            p=users[uname]['profile']; result.append({'username':uname,'display_name':p['display_name'],'avatar_letter':p['avatar_letter'],'avatar_color':p['avatar_color']})
    return jsonify(result)

@app.route('/api/accept_friend_request', methods=['POST'])
def accept_friend_request():
    if 'username' not in session: return jsonify({'ok':False,'error':'Не авторизован'}),401
    me=session['username']; other=request.json.get('username')
    req=users[me].setdefault('friend_requests',[])
    if other not in req or other not in users: return jsonify({'ok':False,'error':'Заявка не найдена'}),404
    req.remove(other)
    if other not in users[me]['friends']: users[me]['friends'].append(other)
    if me not in users[other]['friends']: users[other]['friends'].append(me)
    socketio.emit('friends_updated', {'username':me}, room='user:'+me)
    socketio.emit('friends_updated', {'username':other}, room='user:'+other)
    return jsonify({'ok':True})

@app.route('/api/reject_friend_request', methods=['POST'])
def reject_friend_request():
    if 'username' not in session: return jsonify({'ok':False,'error':'Не авторизован'}),401
    other=request.json.get('username'); req=users[session['username']].setdefault('friend_requests',[])
    if other in req: req.remove(other)
    return jsonify({'ok':True})

@app.route('/api/update_profile', methods=['POST'])
def update_profile():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    profile = users[session['username']]['profile']
    profile['display_name'] = data.get('display_name', profile['display_name'])
    profile['status'] = data.get('status', profile['status'])
    profile['avatar_color'] = data.get('avatar_color', profile['avatar_color'])
    profile['avatar_letter'] = data.get('avatar_letter', profile['avatar_letter'])
    profile['bio'] = data.get('bio', profile.get('bio', ''))
    return jsonify({'ok': True})

@app.route('/api/create_server', methods=['POST'])
def create_server():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    name = data.get('name')
    icon = data.get('icon', '🏠')
    if not name:
        return jsonify({'error': 'Name required'}), 400
    global next_server_id, next_channel_id
    server_id = f"server_{next_server_id}"
    next_server_id += 1
    channel_id = f"channel_{next_channel_id}"
    next_channel_id += 1
    servers[server_id] = {
        'id': server_id,
        'name': name,
        'icon': icon,
        'owner': session['username'],
        'channels': [{'id': channel_id, 'name': 'general'}],
        'members': [session['username']]
    }
    users[session['username']]['servers'].append(server_id)
    messages[f"{server_id}_{channel_id}"] = []
    add_system_message(server_id, channel_id, f"Сервер {name} создан")
    return jsonify({'ok': True})

@app.route('/api/create_channel', methods=['POST'])
def create_channel():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    server_id = data.get('server_id')
    channel_name = data.get('channel_name')
    if not server_id or not channel_name or server_id not in servers:
        return jsonify({'error': 'Invalid'}), 400
    global next_channel_id
    new_id = f"channel_{next_channel_id}"
    next_channel_id += 1
    servers[server_id]['channels'].append({'id': new_id, 'name': channel_name})
    messages[f"{server_id}_{new_id}"] = []
    add_system_message(server_id, new_id, f"Канал #{channel_name} создан")
    return jsonify({'ok': True})

@app.route('/api/rename_channel', methods=['POST'])
def rename_channel():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    server_id = data.get('server_id')
    channel_id = data.get('channel_id')
    new_name = data.get('new_name')
    if not server_id or not channel_id or not new_name:
        return jsonify({'error': 'Invalid'}), 400
    if server_id not in servers:
        return jsonify({'error': 'Server not found'}), 404
    for ch in servers[server_id]['channels']:
        if ch['id'] == channel_id:
            ch['name'] = new_name
            return jsonify({'ok': True})
    return jsonify({'error': 'Channel not found'}), 404

@app.route('/api/delete_channel', methods=['POST'])
def delete_channel():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    server_id = data.get('server_id')
    channel_id = data.get('channel_id')
    if not server_id or not channel_id:
        return jsonify({'error': 'Invalid'}), 400
    if server_id not in servers:
        return jsonify({'error': 'Server not found'}), 404
    channels = servers[server_id]['channels']
    for i, ch in enumerate(channels):
        if ch['id'] == channel_id:
            del channels[i]
            key = f"{server_id}_{channel_id}"
            if key in messages:
                del messages[key]
            return jsonify({'ok': True})
    return jsonify({'error': 'Channel not found'}), 404

@app.route('/api/clear_chat', methods=['POST'])
def clear_chat():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    server_id = data.get('server_id')
    channel_id = data.get('channel_id')
    if not server_id or not channel_id:
        return jsonify({'error': 'Invalid'}), 400
    key = f"{server_id}_{channel_id}"
    if key in messages:
        messages[key] = []
        add_system_message(server_id, channel_id, "Чат очищен")
    return jsonify({'ok': True})

@app.route('/api/block_user', methods=['POST'])
def block_user():
    if 'username' not in session:
        return jsonify({'error': 'Unauthorized'}), 401
    data = request.json
    blocked = data.get('blocked')
    if not blocked or blocked == session['username']:
        return jsonify({'error': 'Invalid'}), 400
    if blocked not in users:
        return jsonify({'error': 'User not found'}), 404
    user_blocked = users[session['username']].setdefault('blocked_users', [])
    if blocked not in user_blocked:
        user_blocked.append(blocked)
    return jsonify({'ok': True})

@socketio.on('connect')
def socket_connect():
    username=session.get('username')
    if not username or username not in users or users[username].get('banned'): return False
    connected_users[username]=connected_users.get(username,0)+1
    join_room('user:'+username)
    socketio.emit('presence_update', {'username':username,'online':True})

@socketio.on('disconnect')
def socket_disconnect():
    username=session.get('username')
    if username in connected_users:
        connected_users[username]-=1
        if connected_users[username]<=0:
            connected_users.pop(username,None)
            socketio.emit('presence_update', {'username':username,'online':False})

@socketio.on('presence_online')
def presence_online():
    username=session.get('username')
    if username: join_room('user:'+username)

@socketio.on('join_channel')
def socket_join_channel(data):
    username=session.get('username')
    sid=data.get('server_id'); cid=data.get('channel_id')
    if username and sid in servers and cid and any(c['id']==cid for c in servers[sid].get('channels',[])):
        join_room(f'channel:{sid}:{cid}')

@socketio.on('call_offer')
def call_offer(data):
    username=session.get('username'); target=data.get('to')
    if username and target in users and target!=username:
        socketio.emit('call_offer', {'from':username,'offer':data.get('offer')}, room='user:'+target)

@socketio.on('call_answer')
def call_answer(data):
    username=session.get('username'); target=data.get('to')
    if username and target in users:
        socketio.emit('call_answer', {'from':username,'answer':data.get('answer')}, room='user:'+target)

@socketio.on('call_ice')
def call_ice(data):
    username=session.get('username'); target=data.get('to')
    if username and target in users:
        socketio.emit('call_ice', {'from':username,'candidate':data.get('candidate')}, room='user:'+target)

@socketio.on('call_reject')
def call_reject(data):
    username=session.get('username'); target=data.get('to')
    if username and target in users:
        socketio.emit('call_rejected', {'from':username}, room='user:'+target)

@socketio.on('call_hangup')
def call_hangup(data):
    username=session.get('username'); target=data.get('to')
    if username and target in users:
        socketio.emit('call_hangup', {'from':username}, room='user:'+target)

# ---------- Админские API ----------
@app.route('/api/admin/stats')
def admin_stats():
    if 'username' not in session or not users[session['username']].get('is_admin'):
        return jsonify({'error': 'Forbidden'}), 403
    total_msgs = sum(len(msgs) for msgs in messages.values()) + sum(len(msgs) for msgs in dm_messages.values())
    return jsonify({
        'total_users': len(users),
        'total_servers': len(servers),
        'total_messages': total_msgs
    })

@app.route('/api/admin/users')
def admin_users():
    if 'username' not in session or not users[session['username']].get('is_admin'):
        return jsonify([]), 403
    user_list = []
    for uname, udata in users.items():
        user_list.append({
            'username': uname,
            'is_admin': udata.get('is_admin', False),
            'banned': udata.get('banned', False)
        })
    return jsonify(user_list)

@app.route('/api/admin/set_admin', methods=['POST'])
def admin_set_admin():
    if 'username' not in session or not users[session['username']].get('is_admin'):
        return jsonify({'error': 'Forbidden'}), 403
    data = request.json
    target = data.get('username')
    is_admin = data.get('is_admin', False)
    if target not in users:
        return jsonify({'error': 'User not found'}), 404
    users[target]['is_admin'] = is_admin
    return jsonify({'ok': True})

@app.route('/api/admin/ban_user', methods=['POST'])
def admin_ban_user():
    if 'username' not in session or not users[session['username']].get('is_admin'):
        return jsonify({'error': 'Forbidden'}), 403
    data = request.json
    target = data.get('username')
    ban = data.get('ban', True)
    if target not in users:
        return jsonify({'error': 'User not found'}), 404
    users[target]['banned'] = ban
    return jsonify({'ok': True})

@app.route('/api/admin/delete_user', methods=['POST'])
def admin_delete_user():
    if 'username' not in session or not users[session['username']].get('is_admin'):
        return jsonify({'error': 'Forbidden'}), 403
    data = request.json
    target = data.get('username')
    if target == session['username']:
        return jsonify({'error': 'Нельзя удалить самого себя'}), 400
    if target not in users:
        return jsonify({'error': 'Not found'}), 404
    del users[target]
    return jsonify({'ok': True})

@app.route('/api/admin/servers')
def admin_servers():
    if 'username' not in session or not users[session['username']].get('is_admin'):
        return jsonify([]), 403
    srv_list = []
    for sid, srv in servers.items():
        srv_list.append({
            'id': sid,
            'name': srv['name'],
            'icon': srv['icon'],
            'owner': srv['owner'],
            'channels': srv.get('channels', [])
        })
    return jsonify(srv_list)

@app.route('/api/admin/search_messages')
def admin_search_messages():
    if 'username' not in session or not users[session['username']].get('is_admin'):
        return jsonify([]), 403
    query = request.args.get('q', '').lower()
    results = []
    for key, msgs in messages.items():
        parts = key.split('_')
        if len(parts) != 2:
            continue
        server_id, channel_id = parts[0], parts[1]
        server = servers.get(server_id, {})
        channel = next((c for c in server.get('channels', []) if c['id'] == channel_id), None)
        for msg in msgs:
            if query in msg['content'].lower():
                results.append({
                    'id': msg['id'],
                    'author': msg['display_name'],
                    'content': msg['content'],
                    'time': msg['time'],
                    'server_name': server.get('name', 'Unknown'),
                    'channel_name': channel['name'] if channel else 'Unknown'
                })
    for key, msgs in dm_messages.items():
        for msg in msgs:
            if query in msg['content'].lower():
                results.append({
                    'id': msg['id'],
                    'author': msg['display_name'],
                    'content': msg['content'],
                    'time': msg['time'],
                    'server_name': 'Личные сообщения',
                    'channel_name': key.replace('_', ' ↔ ')
                })
    return jsonify(results[:50])

@app.route('/api/admin/delete_message', methods=['POST'])
def admin_delete_message_route():
    if 'username' not in session or not users[session['username']].get('is_admin'):
        return jsonify({'error': 'Forbidden'}), 403
    data = request.json
    msg_id = data.get('message_id')
    for key, msgs in messages.items():
        for i, msg in enumerate(msgs):
            if msg['id'] == msg_id:
                del msgs[i]
                return jsonify({'ok': True})
    for key, msgs in dm_messages.items():
        for i, msg in enumerate(msgs):
            if msg['id'] == msg_id:
                del msgs[i]
                return jsonify({'ok': True})
    return jsonify({'error': 'Not found'}), 404

@app.route('/<path:path>')
def spa_fallback(path):
    # Serve Vite assets and let React handle client-side routes.
    web_root = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'mobile', 'dist'))
    requested = os.path.join(web_root, path)
    if os.path.isfile(requested):
        return send_from_directory(web_root, path)
    if os.path.isfile(os.path.join(web_root, 'index.html')):
        return send_from_directory(web_root, 'index.html')
    return jsonify({'error': 'Not found'}), 404

if __name__ == '__main__':
    port = int(os.environ.get('PORT', '5000'))
    socketio.run(app, host='0.0.0.0', port=port, debug=False, allow_unsafe_werkzeug=True)