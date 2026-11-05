/**
 * SentinelAI SOC Admin Futuristic Cyber/Hacking Alarm & Sound Service
 * Exclusive to SOC Admin Dashboard (admin-frontend).
 * Synthesizes electronic sweeps, high-frequency digital pulses, and rhythmic alert bursts.
 * Includes complete node tracking, volume control, mute handling, and overlap prevention.
 */

let audioCtx = null;
let activeAudioNodes = [];
let activeTimeouts = [];

let currentVolume = 0.6;
let isMutedState = false;
let currentSoundProfile = 'biohazard_alarm';

// Active HTML5 Audio element (for file-based profiles like biohazard_alarm)
let activeAudioElement = null;

// Initialize stored preferences from localStorage
try {
  const storedVol = localStorage.getItem('sentinel_soc_volume');
  if (storedVol !== null) {
    const parsed = parseFloat(storedVol);
    if (!isNaN(parsed) && parsed >= 0 && parsed <= 1) {
      currentVolume = parsed;
    }
  }

  const storedMute = localStorage.getItem('sentinel_soc_muted');
  if (storedMute !== null) {
    isMutedState = storedMute === 'true';
  }

  const storedProfile = localStorage.getItem('sentinel_soc_sound_profile');
  if (storedProfile) {
    currentSoundProfile = storedProfile;
  }
} catch {
  // Ignore localStorage restrictions
}

function getAudioContext() {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === 'suspended') {
      audioCtx.resume().catch(() => {});
    }
  } catch (err) {
    console.warn('AudioContext initialization notice:', err);
  }
  return audioCtx;
}

/**
 * Returns whether SOC alert sound is currently muted.
 */
export function isAudioMuted() {
  return isMutedState;
}

/**
 * Toggles SOC audio mute state and persists preference.
 */
export function toggleAudioMute() {
  isMutedState = !isMutedState;
  try {
    localStorage.setItem('sentinel_soc_muted', String(isMutedState));
  } catch {
    // Ignore localStorage restrictions
  }
  if (isMutedState) {
    stopAlertSound();
  }
  return isMutedState;
}

/**
 * Gets current SOC audio volume level (0.0 to 1.0).
 */
export function getVolume() {
  return currentVolume;
}

/**
 * Sets SOC audio volume level (0.0 to 1.0) and persists preference.
 */
export function setVolume(vol) {
  const parsed = typeof vol === 'number' ? vol : parseFloat(vol);
  if (!isNaN(parsed)) {
    currentVolume = Math.max(0, Math.min(1, parsed));
    try {
      localStorage.setItem('sentinel_soc_volume', String(currentVolume));
    } catch {
      // Ignore localStorage restrictions
    }
  }
  return currentVolume;
}

/**
 * Gets currently selected sound profile name.
 */
export function getSoundProfile() {
  return currentSoundProfile;
}

/**
 * Sets active sound profile and persists preference.
 */
export function setSoundProfile(profile) {
  if (profile) {
    currentSoundProfile = profile;
    try {
      localStorage.setItem('sentinel_soc_sound_profile', profile);
    } catch {
      // Ignore localStorage restrictions
    }
  }
  return currentSoundProfile;
}

/**
 * Immediately stops all active playing sounds, oscillators, gain ramps, and scheduled timeouts.
 */
export function stopAlertSound() {
  // Stop HTML5 Audio element if active
  if (activeAudioElement) {
    try {
      activeAudioElement.pause();
      activeAudioElement.currentTime = 0;
    } catch {
      // Ignore
    }
    activeAudioElement = null;
  }

  // Clear all pending setTimeout handles
  activeTimeouts.forEach((t) => clearTimeout(t));
  activeTimeouts = [];

  // Stop and disconnect all active AudioNodes
  activeAudioNodes.forEach((node) => {
    try {
      if (node instanceof OscillatorNode) {
        node.stop();
        node.disconnect();
      } else if (node instanceof GainNode) {
        node.gain.cancelScheduledValues(0);
        node.gain.setValueAtTime(0, 0);
        node.disconnect();
      } else if (node && typeof node.disconnect === 'function') {
        node.disconnect();
      }
    } catch {
      // Ignore node already stopped errors
    }
  });
  activeAudioNodes = [];
}

/**
 * Plays a synthesized audio alert.
 * Automatically stops any previously playing sound to prevent overlaps.
 * @param {string} soundType - Sound profile name (default 'cyber_hacking_alarm')
 * @param {number} customVol - Optional custom volume override
 */
export function playAlertSound(soundType = null, customVol = null) {
  if (isMutedState) return;

  const targetProfile = soundType || currentSoundProfile || 'cyber_hacking_alarm';
  const effectiveVol = typeof customVol === 'number' ? customVol : currentVolume;

  if (effectiveVol <= 0) return;

  // Prevent overlapping sounds by stopping active playback first
  stopAlertSound();

  try {
    const ctx = getAudioContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const masterGain = ctx.createGain();
    const finalGainVal = Math.max(0, Math.min(1, effectiveVol));
    masterGain.gain.setValueAtTime(finalGainVal, now);
    masterGain.connect(ctx.destination);
    activeAudioNodes.push(masterGain);

    if (targetProfile === 'biohazard_alarm') {
      // ── Biohazard Alarm: play the user's downloaded MP3 file ──
      // Falls back to Web Audio synthesis if the file cannot be loaded.
      masterGain.disconnect(); // not needed for HTML5 audio path
      activeAudioNodes = activeAudioNodes.filter((n) => n !== masterGain);

      const audio = new Audio('/sounds/dennish18-biohazard-alarm-143105.mp3');
      audio.volume = Math.max(0, Math.min(1, effectiveVol));
      audio.preload = 'auto';
      activeAudioElement = audio;

      const playPromise = audio.play();
      if (playPromise !== undefined) {
        playPromise.catch((err) => {
          console.warn('Biohazard alarm MP3 playback failed, falling back to synthesized sound:', err);
          activeAudioElement = null;
          // Fallback: synthesize cyber_hacking_alarm
          playAlertSound('cyber_hacking_alarm', effectiveVol);
        });
      }

      audio.onended = () => {
        activeAudioElement = null;
      };

    } else if (targetProfile === 'cyber_hacking_alarm') {
      // Custom Futuristic Cyber/Hacking Alarm
      // Layered synthesis: Electronic pitch sweep + high-frequency digital pulses + rhythmic alert burst
      
      // 1. Electronic Pitch Sweep (Sawtooth 600 Hz -> 1400 Hz -> 900 Hz)
      const sweepOsc = ctx.createOscillator();
      const sweepGain = ctx.createGain();
      sweepOsc.type = 'sawtooth';
      sweepOsc.frequency.setValueAtTime(600, now);
      sweepOsc.frequency.exponentialRampToValueAtTime(1400, now + 0.05);
      sweepOsc.frequency.exponentialRampToValueAtTime(900, now + 0.10);

      sweepGain.gain.setValueAtTime(0.001, now);
      sweepGain.gain.linearRampToValueAtTime(0.28, now + 0.01);
      sweepGain.gain.exponentialRampToValueAtTime(0.001, now + 0.10);

      sweepOsc.connect(sweepGain);
      sweepGain.connect(masterGain);
      activeAudioNodes.push(sweepOsc, sweepGain);

      sweepOsc.start(now);
      sweepOsc.stop(now + 0.11);

      // 2. High-Frequency Staccato Digital Pulses (Square 1760 Hz / 2349 Hz / 2793 Hz)
      const pulses = [
        { delay: 0.00, freq: 1760 },
        { delay: 0.07, freq: 2349.32 },
        { delay: 0.14, freq: 2793.83 },
      ];

      pulses.forEach((p) => {
        const pOsc = ctx.createOscillator();
        const pGain = ctx.createGain();
        pOsc.type = 'square';
        pOsc.frequency.setValueAtTime(p.freq, now + p.delay);

        pGain.gain.setValueAtTime(0.001, now + p.delay);
        pGain.gain.linearRampToValueAtTime(0.20, now + p.delay + 0.005);
        pGain.gain.exponentialRampToValueAtTime(0.001, now + p.delay + 0.045);

        pOsc.connect(pGain);
        pGain.connect(masterGain);
        activeAudioNodes.push(pOsc, pGain);

        pOsc.start(now + p.delay);
        pOsc.stop(now + p.delay + 0.05);
      });

      // 3. Short Rhythmic Alert Burst Accent (Dual Sine D#6: 1244.5 Hz + A#6: 1864.7 Hz)
      const burstStart = now + 0.22;
      const bOsc1 = ctx.createOscillator();
      const bOsc2 = ctx.createOscillator();
      const bGain = ctx.createGain();

      bOsc1.type = 'sine';
      bOsc2.type = 'sine';
      bOsc1.frequency.setValueAtTime(1244.51, burstStart);
      bOsc2.frequency.setValueAtTime(1864.66, burstStart);

      bGain.gain.setValueAtTime(0.001, burstStart);
      bGain.gain.linearRampToValueAtTime(0.25, burstStart + 0.01);
      bGain.gain.exponentialRampToValueAtTime(0.001, burstStart + 0.11);

      bOsc1.connect(bGain);
      bOsc2.connect(bGain);
      bGain.connect(masterGain);
      activeAudioNodes.push(bOsc1, bOsc2, bGain);

      bOsc1.start(burstStart);
      bOsc2.start(burstStart);
      bOsc1.stop(burstStart + 0.12);
      bOsc2.stop(burstStart + 0.12);

      // Automatically clear node references after completion
      const totalDurationMs = 380;
      const tId = setTimeout(() => {
        activeAudioNodes = activeAudioNodes.filter((n) => n !== masterGain);
      }, totalDurationMs);
      activeTimeouts.push(tId);

    } else if (targetProfile === 'cyber_pulse_chime') {
      // Sleek High-Tech Cyber Digital Pulse & Security Chime
      const pings = [
        { startTime: now, f1: 880, f2: 1318.5, duration: 0.09, peakGain: 0.25 },
        { startTime: now + 0.10, f1: 1046.5, f2: 1567.98, duration: 0.11, peakGain: 0.30 },
        { startTime: now + 0.22, f1: 1760, f2: 2093, duration: 0.14, peakGain: 0.22 },
      ];

      pings.forEach((p) => {
        const osc1 = ctx.createOscillator();
        const gain1 = ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(p.f1, p.startTime);

        gain1.gain.setValueAtTime(0.001, p.startTime);
        gain1.gain.linearRampToValueAtTime(p.peakGain, p.startTime + 0.008);
        gain1.gain.exponentialRampToValueAtTime(0.001, p.startTime + p.duration);

        osc1.connect(gain1);
        gain1.connect(masterGain);
        activeAudioNodes.push(osc1, gain1);

        osc1.start(p.startTime);
        osc1.stop(p.startTime + p.duration + 0.01);

        const osc2 = ctx.createOscillator();
        const gain2 = ctx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(p.f2, p.startTime);

        gain2.gain.setValueAtTime(0.001, p.startTime);
        gain2.gain.linearRampToValueAtTime(p.peakGain * 0.5, p.startTime + 0.008);
        gain2.gain.exponentialRampToValueAtTime(0.001, p.startTime + p.duration);

        osc2.connect(gain2);
        gain2.connect(masterGain);
        activeAudioNodes.push(osc2, gain2);

        osc2.start(p.startTime);
        osc2.stop(p.startTime + p.duration + 0.01);
      });

      const totalDurationMs = 450;
      const tId = setTimeout(() => {
        activeAudioNodes = activeAudioNodes.filter((n) => n !== masterGain);
      }, totalDurationMs);
      activeTimeouts.push(tId);

    } else if (targetProfile === 'danger_siren' || targetProfile === 'critical_alarm') {
      // High-Pitched Emergency Security Siren
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const gain = ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'sine';

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
      activeAudioNodes.push(osc1, osc2, gain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.5);
      osc2.stop(now + 0.5);

    } else if (targetProfile === 'emergency_beep') {
      // High-Frequency Triple Alarm Beep
      [0, 0.12, 0.24].forEach((delay, idx) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        osc.frequency.setValueAtTime(1174.66 + idx * 100, now + delay);

        gain.gain.setValueAtTime(0.01, now + delay);
        gain.gain.linearRampToValueAtTime(0.4, now + delay + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.001, now + delay + 0.08);

        osc.connect(gain);
        gain.connect(masterGain);
        activeAudioNodes.push(osc, gain);

        osc.start(now + delay);
        osc.stop(now + delay + 0.09);
      });

    } else if (targetProfile === 'gentle_chime') {
      // Bright Soft Security Chime
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
      activeAudioNodes.push(osc, gain);

      osc.start(now);
      osc.stop(now + 0.42);

    } else {
      // 'cyber_alert': Modern Clean High-Tech Siren Stinger
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
      activeAudioNodes.push(osc, gain);

      osc.start(now);
      osc.stop(now + 0.36);
    }
  } catch (err) {
    console.warn('Web Audio alert sound playback suppressed:', err);
  }
}
