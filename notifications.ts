import { Message, User, ZentoraNotification } from '../types';
import { playReceiveSound } from './sounds';

// Request notification permission from browser
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser');
    return 'denied';
  }
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (err) {
    console.error('Error requesting notification permission:', err);
    return 'denied';
  }
}

// Display native browser notification if granted
export function showSystemNotification(title: string, body: string, icon?: string) {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  
  if (Notification.permission === 'granted') {
    try {
      new Notification(title, {
        body,
        icon: icon || 'https://ui-avatars.com/api/?name=Zentora&background=00A884&color=fff',
        badge: 'https://ui-avatars.com/api/?name=Z&background=00A884&color=fff',
        silent: true // sound is handled by our Web Audio API chime
      });
    } catch (e) {
      console.warn('System notification error:', e);
    }
  }
}

// Generate realistic voice message waveforms
export function generateVoiceWaveform(length = 25): number[] {
  const bars: number[] = [];
  let isSpeaking = false;
  let speechCountdown = 0;

  for (let i = 0; i < length; i++) {
    if (speechCountdown <= 0) {
      isSpeaking = Math.random() > 0.35;
      speechCountdown = Math.floor(Math.random() * 4) + 2;
    }
    speechCountdown--;

    if (isSpeaking) {
      bars.push(Math.floor(Math.random() * 22) + 8);
    } else {
      bars.push(4); // Dots / silence
    }
  }
  return bars;
}

// Voice synthesizer simulation sound for incoming voice message playback
export function playSynthesizedVoiceAudio(durationSec = 5, onEnd?: () => void) {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    const ctx = new AudioContext();
    const now = ctx.currentTime;

    // Create pleasant speech-like formant synthesizer
    const osc = ctx.createOscillator();
    const bandpass = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'sawtooth';
    bandpass.type = 'bandpass';
    bandpass.frequency.setValueAtTime(450, now);
    bandpass.Q.setValueAtTime(3, now);

    osc.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);

    // Vocal melody contour
    osc.frequency.setValueAtTime(140, now);
    for (let t = 0; t < durationSec; t += 0.25) {
      const freq = 120 + Math.sin(t * 3) * 35 + (Math.random() * 20);
      osc.frequency.linearRampToValueAtTime(freq, now + t);
      bandpass.frequency.linearRampToValueAtTime(300 + Math.sin(t * 2) * 500, now + t);
    }

    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.1);
    gain.gain.setValueAtTime(0.08, now + durationSec - 0.2);
    gain.gain.linearRampToValueAtTime(0, now + durationSec);

    osc.start(now);
    osc.stop(now + durationSec);

    setTimeout(() => {
      ctx.close();
      onEnd?.();
    }, durationSec * 1000);
  } catch (e) {
    console.error('Synthesizer audio error', e);
    onEnd?.();
  }
}
