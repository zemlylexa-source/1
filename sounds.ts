export const createAudioContext = () => {
  const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
  return new AudioContext();
};

export const playSendSound = () => {
  try {
    const ctx = createAudioContext();
    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc1.connect(gain);
    osc2.connect(gain);
    gain.connect(ctx.destination);
    
    osc1.type = 'sine';
    osc2.type = 'sine';
    
    osc1.frequency.setValueAtTime(600, ctx.currentTime);
    osc1.frequency.exponentialRampToValueAtTime(800, ctx.currentTime + 0.1);
    
    osc2.frequency.setValueAtTime(800, ctx.currentTime + 0.1);
    osc2.frequency.exponentialRampToValueAtTime(1200, ctx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.2);
    
    osc1.start(ctx.currentTime);
    osc1.stop(ctx.currentTime + 0.1);
    
    osc2.start(ctx.currentTime + 0.1);
    osc2.stop(ctx.currentTime + 0.2);
  } catch (e) {
    console.error("Audio error", e);
  }
};

export const playReceiveSound = () => {
  try {
    const ctx = createAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1000, ctx.currentTime + 0.15);
    
    gain.gain.setValueAtTime(0, ctx.currentTime);
    gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + 0.05);
    gain.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.25);
    
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.25);
  } catch (e) {
    console.error("Audio error", e);
  }
};

let ringtoneOscillators: OscillatorNode[] = [];
let ringtoneContext: AudioContext | null = null;
let ringtoneInterval: any = null;

export const startRingtone = (isIncoming: boolean) => {
  stopRingtone();
  try {
    ringtoneContext = createAudioContext();
    
    const playRing = () => {
      if (!ringtoneContext) return;
      const osc1 = ringtoneContext.createOscillator();
      const osc2 = ringtoneContext.createOscillator();
      const gain = ringtoneContext.createGain();
      
      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(ringtoneContext.destination);
      
      osc1.type = 'sine';
      osc2.type = 'sine';
      
      // Different tones for incoming (EU ring) vs outgoing (US ring)
      osc1.frequency.value = isIncoming ? 425 : 440;
      osc2.frequency.value = isIncoming ? 425 : 480;
      
      gain.gain.setValueAtTime(0, ringtoneContext.currentTime);
      gain.gain.linearRampToValueAtTime(0.2, ringtoneContext.currentTime + 0.1);
      gain.gain.setValueAtTime(0.2, ringtoneContext.currentTime + (isIncoming ? 1.0 : 2.0));
      gain.gain.linearRampToValueAtTime(0, ringtoneContext.currentTime + (isIncoming ? 1.1 : 2.1));
      
      osc1.start(ringtoneContext.currentTime);
      osc2.start(ringtoneContext.currentTime);
      osc1.stop(ringtoneContext.currentTime + (isIncoming ? 1.1 : 2.1));
      osc2.stop(ringtoneContext.currentTime + (isIncoming ? 1.1 : 2.1));
      
      ringtoneOscillators.push(osc1, osc2);
    };
    
    playRing();
    ringtoneInterval = setInterval(playRing, isIncoming ? 3000 : 4000);
  } catch(e) {
    console.error("Audio error", e);
  }
};

export const stopRingtone = () => {
  try {
    if (ringtoneInterval) clearInterval(ringtoneInterval);
    ringtoneOscillators.forEach(osc => {
      try { osc.stop(); } catch(e) {}
    });
    ringtoneOscillators = [];
    if (ringtoneContext) {
      ringtoneContext.close();
      ringtoneContext = null;
    }
  } catch (e) {
    console.error("Audio error", e);
  }
};

export const playToneSample = (type: 'classic' | 'bell' | 'chime' | 'marimba' | 'echo') => {
  try {
    const ctx = createAudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'bell') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1046, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
      osc.start();
      osc.stop(ctx.currentTime + 0.6);
    } else if (type === 'chime') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15);
      gain.gain.setValueAtTime(0.25, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } else if (type === 'marimba') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, ctx.currentTime);
      gain.gain.setValueAtTime(0.4, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    } else {
      // Classic Zentora
      osc.type = 'sine';
      osc.frequency.setValueAtTime(425, ctx.currentTime);
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
      osc.start();
      osc.stop(ctx.currentTime + 0.5);
    }
  } catch (e) {
    console.error('Audio preview error', e);
  }
};
