ZENTORA ANDROID - FINAL
Uses installed Java 21. No JDK download.
No Gradle/AGP rewriting.
Removed the broken PowerShell permission patcher.
Removed native push initialization from app startup.
Build result: Zentora.apk in the project folder.


ZENTORA MOBILE V8:
- Full-screen phone-first layout on Android.
- Stable voice-message bubbles/waveforms.
- Real microphone-based internet audio calling uses WebRTC through PeerJS signaling. Both devices need internet and different Zentora user IDs.
- Phone/SMS buttons use the Android phone/SMS composer via tel:/sms: links.
- The APK builder does not download JDK.
- BUILD_ANDROID.cmd automatically detects Android SDK and configures AndroidManifest permissions.
