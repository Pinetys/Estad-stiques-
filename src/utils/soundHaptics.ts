// Web Audio API and Tactile Haptics helper for rapid basketball scoring

let audioCtx: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

export const playSound = (type: 'score' | 'three' | 'foul' | 'buzzer' | 'click' | 'sub', enabled = true) => {
  if (!enabled) return;
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    if (type === 'click') {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.05);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05);
      osc.start(now);
      osc.stop(now + 0.05);
    } else if (type === 'score') {
      // Swish/ding pleasant chord
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(523.25, now); // C5
      osc.frequency.setValueAtTime(659.25, now + 0.08); // E5
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35);
      osc.start(now);
      osc.stop(now + 0.35);
    } else if (type === 'three') {
      // High energetic triple chord
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, now); // D5
      osc.frequency.setValueAtTime(880, now + 0.09); // A5
      osc.frequency.setValueAtTime(1174.66, now + 0.18); // D6
      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc.start(now);
      osc.stop(now + 0.5);
    } else if (type === 'foul') {
      // Referee whistle simulation: dual frequency tone
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(2200, now);
      osc.frequency.exponentialRampToValueAtTime(2600, now + 0.06);
      osc.frequency.exponentialRampToValueAtTime(2400, now + 0.2);
      gain.gain.setValueAtTime(0.15, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc.start(now);
      osc.stop(now + 0.25);
    } else if (type === 'buzzer') {
      // Arena buzzer
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 1.1);
      osc.start(now);
      osc.stop(now + 1.1);
    } else if (type === 'sub') {
      // Substitution chime
      osc.type = 'sine';
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.setValueAtTime(554.37, now + 0.1);
      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.start(now);
      osc.stop(now + 0.3);
    }
  } catch {
    // Ignore audio autoplay restrictions
  }
};

export const triggerHaptic = (
  type: 'light' | 'medium' | 'heavy' | 'warning' | 'basket' | 'three' | 'foul' | 'undo' | 'bonus' = 'light',
  enabled = true
) => {
  if (!enabled || typeof window === 'undefined' || !navigator.vibrate) return;
  try {
    if (type === 'light') {
      navigator.vibrate(15);
    } else if (type === 'medium') {
      navigator.vibrate(30);
    } else if (type === 'heavy') {
      navigator.vibrate([40, 30, 40]);
    } else if (type === 'warning') {
      navigator.vibrate([60, 50, 100]);
    } else if (type === 'basket') {
      navigator.vibrate([28, 25, 45]);
    } else if (type === 'three') {
      navigator.vibrate([35, 25, 35, 25, 65]);
    } else if (type === 'foul') {
      navigator.vibrate([60, 40, 80]);
    } else if (type === 'undo') {
      navigator.vibrate(90);
    } else if (type === 'bonus') {
      navigator.vibrate([40, 30, 40, 30, 70]);
    }
  } catch {
    // Haptics not available
  }
};
