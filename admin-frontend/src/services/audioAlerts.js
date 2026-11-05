/**
 * SentinelAI SOC Cybersecurity Alert Sound Engine (Delegated to soundService)
 * Unifies all SOC Dashboard alert triggers (WebSocket alerts, settings)
 * into a single source of truth using Web Audio API synthesis.
 * 
 * Priority 5: Added Web Speech API for spoken CRITICAL/HIGH alert announcements.
 */

import {
  playAlertSound,
  stopAlertSound,
  isAudioMuted as checkIsMuted,
  toggleAudioMute as toggleMuteState,
  getSoundProfile,
} from './soundService';

// Deduplication set for spoken alerts — prevents repeating the same event_id
const _spokenEventIds = new Set();

/**
 * Initializes AudioContext safely on user interaction gesture.
 */
export function initAudioContext() {
  // Web Audio Context is managed lazily inside soundService
}

/**
 * Returns whether audio alerts are currently muted.
 */
export function isAudioMuted() {
  return checkIsMuted();
}

/**
 * Toggles audio mute state.
 */
export function toggleAudioMute() {
  return toggleMuteState();
}

/**
 * Speaks a security alert announcement using Web Speech API.
 * Only fires for CRITICAL and HIGH events, respects mute, handles missing browser support.
 * 
 * @param {string} text - The announcement text
 * @param {string} eventId - Used for deduplication; omit to always speak
 */
function speakAlert(text, eventId = null) {
  if (checkIsMuted()) return;
  if (!text) return;

  // Deduplication
  if (eventId) {
    if (_spokenEventIds.has(eventId)) return;
    _spokenEventIds.add(eventId);
    // Cleanup old entries to prevent memory growth
    if (_spokenEventIds.size > 200) {
      const oldest = [..._spokenEventIds].slice(0, 50);
      oldest.forEach((id) => _spokenEventIds.delete(id));
    }
  }

  // Browser support check
  if (!('speechSynthesis' in window) || !window.SpeechSynthesisUtterance) {
    return; // Silently skip — not supported
  }

  try {
    // Cancel any ongoing speech to avoid queue build-up
    window.speechSynthesis.cancel();

    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.rate = 1.05;
    utterance.pitch = 0.95;
    utterance.volume = 0.9;
    utterance.lang = 'en-US';

    // Prefer a clear, authoritative voice if available
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find((v) =>
      v.lang.startsWith('en') && (v.name.includes('Google') || v.name.includes('Microsoft') || v.name.includes('Alex'))
    );
    if (preferred) utterance.voice = preferred;

    utterance.onerror = () => {}; // Suppress non-critical speech errors
    window.speechSynthesis.speak(utterance);
  } catch {
    // Non-critical — do not surface speech errors to the user
  }
}

/**
 * Builds a spoken alert message from a real threat payload.
 * Safely handles missing fields — never fabricates information.
 * 
 * @param {object} payload - The WebSocket threat payload
 * @returns {string|null} - Announcement text or null if not eligible
 */
export function buildSpeechAlert(payload) {
  if (!payload) return null;

  const riskScore = typeof payload.risk_score === 'number' ? payload.risk_score : 0;
  const riskLevel = String(payload.risk_level || '').toUpperCase();
  const eventType = String(payload.event_type || 'SECURITY EVENT').replace(/_/g, ' ');
  const sourceIp  = payload.source_ip || null;
  const location  = payload.location && !['UNKNOWN', 'PRIVATE'].includes((payload.location || '').toUpperCase())
    ? payload.location
    : null;

  // Only announce CRITICAL and HIGH events
  if (riskScore < 55 && riskLevel !== 'CRITICAL' && riskLevel !== 'HIGH') return null;

  const severity = riskLevel === 'CRITICAL' || riskScore >= 75 ? 'Critical alert' : 'High risk alert';
  const ipPart   = sourceIp ? ` from IP ${sourceIp}` : '';
  const locPart  = location ? `, ${location}` : '';

  return `${severity}. ${eventType} detected${ipPart}${locPart}. Risk score ${Math.round(riskScore)}.`;
}

/**
 * Plays severity-based alert sound via soundService single source of truth.
 * Also triggers Web Speech API announcement for CRITICAL/HIGH events.
 * 
 * - Risk < 40 or LOGIN_SUCCESS: NO SOUND (❌)
 * - Risk >= 40: Plays active synthesized sound profile from soundService
 * - Risk >= 55 CRITICAL/HIGH: Additionally speaks the alert text
 * 
 * @param {number} riskScore
 * @param {string} riskLevel
 * @param {string} eventType
 * @param {object} [fullPayload] - Optional: full WebSocket payload for speech
 */
export function playSeveritySound(riskScore = 0, riskLevel = 'LOW', eventType = '', fullPayload = null) {
  if (checkIsMuted()) return;

  const score = typeof riskScore === 'number' ? riskScore : 0;
  const type  = String(eventType || '').toUpperCase();
  const level = String(riskLevel || '').toUpperCase();

  // Rule: Normal activity (LOGIN_SUCCESS or low risk) = NO SOUND
  if (type === 'LOGIN_SUCCESS' || (score < 40 && level !== 'CRITICAL' && level !== 'HIGH')) {
    return;
  }

  try {
    const activeProfile = getSoundProfile() || 'cyber_hacking_alarm';
    if (score >= 75 || level === 'CRITICAL' || level === 'HIGH') {
      playAlertSound(activeProfile);
    } else {
      playAlertSound('gentle_chime');
    }
  } catch (err) {
    console.warn('Error executing delegated alert sound:', err);
  }

  // Web Speech API — speak the alert for CRITICAL/HIGH only
  if (fullPayload && (score >= 55 || level === 'CRITICAL' || level === 'HIGH')) {
    const speechText = buildSpeechAlert(fullPayload);
    if (speechText) {
      // Small delay so speech starts after the alarm sound begins
      setTimeout(() => speakAlert(speechText, fullPayload.event_id || null), 600);
    }
  }
}

/**
 * Explicit helper for SOC Administrators to preview alert sound tones (Settings page only).
 */
export function testAlertSound(tier = 'CRITICAL') {
  if (checkIsMuted()) return;
  const activeProfile = getSoundProfile() || 'cyber_hacking_alarm';
  playAlertSound(activeProfile);
}

export { stopAlertSound };
