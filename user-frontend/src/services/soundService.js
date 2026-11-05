/**
 * SentinelAI High-Tech Security Danger Siren & Emergency Alert Service
 * Synthesizes clean, high-pitched emergency danger sirens and alert beeps via Web Audio API.
 * Free of low-frequency dark distortion.
 */

let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
  return audioCtx;
}

/**
 * Plays a high-pitched security danger alert or emergency siren.
 * @param {'danger_siren' | 'emergency_beep' | 'cyber_alert' | 'gentle_chime'} soundType 
 * @param {number} volume - Volume multiplier between 0.0 and 1.0 (default 0.75)
 */
export function playAlertSound(soundType = 'danger_siren', volume = 0.75) {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), now);
    masterGain.connect(ctx.destination);

    if (soundType === 'danger_siren' || soundType === 'critical_alarm') {
      // Authentic High-Pitched Emergency Security Siren (Alternating 950 Hz <-> 1350 Hz Siren Burst)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

      // 4-step rapid high-pitched siren pulses
      osc1.frequency.setValueAtTime(950, now);
      osc1.frequency.setValueAtTime(1350, now + 0.10);
      osc1.frequency.setValueAtTime(950, now + 0.20);
      osc1.frequency.setValueAtTime(1350, now + 0.30);

      osc2.frequency.setValueAtTime(1900, now);
      osc2.frequency.setValueAtTime(2700, now + 0.10);
      osc2.frequency.setValueAtTime(1900, now + 0.20);
      osc2.frequency.setValueAtTime(2700, now + 0.30);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.02);
      gain.gain.setValueAtTime(0.4, now + 0.38);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.48);

      osc1.connect(gain);
      osc2.connect(gain);
      gain.connect(masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);

    } else if (soundType === 'emergency_beep') {
      // High-Frequency Triple Alarm Beep (BEEP-BEEP-BEEP)
      [0, 0.12, 0.24].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1174.66 + idx * 100, now + delay); // High D6 tone

        gain.gain.setValueAtTime(0.01, now + delay);
        gain.gain.linearRampToValueAtTime(0.45, now + delay + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);

        osc.connect(gain);
        gain.connect(masterGain);

        osc.start(now + delay);
        osc.stop(now + delay + 0.09);
      });

    } else if (soundType === 'gentle_chime') {
      // Bright Soft Security Chime (E5 -> A5)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, now);
      osc.frequency.setValueAtTime(880.00, now + 0.09);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.4);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.42);

    } else {
      // 'cyber_alert': Modern Clean High-Tech Siren Stinger (950 Hz -> 1400 Hz)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.12);
      osc.frequency.setValueAtTime(950, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(1400, now + 0.28);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.4, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(gain);
      gain.connect(masterGain);

      osc.start(now);
      osc.stop(now + 0.36);
    }
  } catch (err) {
    console.warn('Web Audio alert sound playback suppressed:', err);
  }
}
