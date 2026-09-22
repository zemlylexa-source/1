const fs = require('fs');
const path = require('path');

const root = process.cwd();
const candidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  process.env.LOCALAPPDATA ? path.join(process.env.LOCALAPPDATA, 'Android', 'Sdk') : null,
  process.env.USERPROFILE ? path.join(process.env.USERPROFILE, 'AppData', 'Local', 'Android', 'Sdk') : null,
  'C:\\Android\\Sdk'
].filter(Boolean);

const sdk = candidates.find(p => fs.existsSync(path.join(p, 'platform-tools')));
if (!sdk) {
  console.error('Android SDK not found.');
  process.exit(1);
}

const androidDir = path.join(root, 'android');
const props = path.join(androidDir, 'local.properties');
fs.writeFileSync(props, `sdk.dir=${sdk.replace(/\\/g, '/')}\n`, 'utf8');

const manifest = path.join(androidDir, 'app', 'src', 'main', 'AndroidManifest.xml');
if (fs.existsSync(manifest)) {
  let xml = fs.readFileSync(manifest, 'utf8').replace(/^\uFEFF/, '');
  const permissions = [
    'android.permission.INTERNET',
    'android.permission.RECORD_AUDIO',
    'android.permission.CAMERA',
    'android.permission.MODIFY_AUDIO_SETTINGS',
    'android.permission.POST_NOTIFICATIONS'
  ];
  for (const permission of permissions) {
    if (!xml.includes(`android:name="${permission}"`)) {
      xml = xml.replace(/<application\b/, `    <uses-permission android:name="${permission}" />\n    <application`);
    }
  }
  fs.writeFileSync(manifest, xml, 'utf8');
}

console.log(`Android SDK: ${sdk}`);
console.log('Android permissions configured.');
