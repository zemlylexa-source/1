ZENTORA — SQLite + realtime

1. Put zentora.py, requirements.txt and START_ZENTORA.cmd in one folder.
2. Run START_ZENTORA.cmd.
3. The server creates zentora.db automatically.
4. Accounts, profiles, friends, servers, channel messages and DMs survive restarts.
5. .zentora_secret is created automatically and keeps Flask sessions stable between restarts.
6. Realtime chat/calls continue to use Socket.IO/WebRTC.

For a public production deployment, use HTTPS and a TURN server for WebRTC.
For very large installations, migrate the persistent storage from the current SQLite snapshot store to PostgreSQL/Redis.
