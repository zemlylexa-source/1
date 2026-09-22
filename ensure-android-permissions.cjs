const fs = require('fs');
const path = require('path');

const manifest = path.join(process.cwd(), 'android', 'app', 'src', 'main', 'AndroidManifest.xml');
if (!fs.existsSync(manifest)) {
  console.error('AndroidManifest.xml not found:', manifest);
  process.exit(1);
}

let xml = fs.readFileSync(manifest, 'utf8').replace(/^\uFEFF/, '');
const permissions = [
  'android.permission.INTERNET',
  'android.permission.RECORD_AUDIO',
  'android.permission.CAMERA',
  'android.permission.MODIFY_AUDIO_SETTINGS',
  'android.permission.POST_NOTIFICATIONS'
];

for (const permission of permissions) {
  const line = `    <uses-permission android:name="${permission}" />`;
  if (!xml.includes(`android:name="${permission}"`)) {
    xml = xml.replace(/<application\b/, `${line}\n    <application`);
  }
}
fs.writeFileSync(manifest, xml, 'utf8');
console.log('Android permissions checked.');
