import { useState } from 'react';
import AppShell from '../components/layout/AppShell';
import {
  playAlertSound,
  stopAlertSound,
  getVolume,
  setVolume,
  isAudioMuted,
  toggleAudioMute,
  getSoundProfile,
  setSoundProfile,
} from '../services/soundService';

export default function SettingsPage({ onNavigate }) {
  const [refreshInterval, setRefreshInterval] = useState('5s');
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [slackAlerts, setSlackAlerts] = useState(false);
  const [soundTone, setSoundToneState] = useState(() => getSoundProfile() || 'biohazard_alarm');
  const [volume, setVolumeState] = useState(() => getVolume());
  const [isMuted, setIsMutedState] = useState(() => isAudioMuted());
  const [savedMessage, setSavedMessage] = useState(false);

  const handleSoundToneChange = (val) => {
    setSoundToneState(val);
    setSoundProfile(val);
    playAlertSound(val);
  };

  const handleVolumeChange = (val) => {
    const num = parseFloat(val);
    setVolumeState(num);
    setVolume(num);
  };

  const handleToggleMute = () => {
    const muted = toggleAudioMute();
    setIsMutedState(muted);
  };

  const handleSave = (e) => {
    e.preventDefault();
    setSavedMessage(true);
    setTimeout(() => setSavedMessage(false), 3000);
  };

  return (
    <AppShell onNavigate={onNavigate} activeTab="settings">
      <div className="dashboard-container">
        <div className="dashboard-top-bar">
          <div>
            <h2 className="section-main-heading">SOC System Settings</h2>
            <p className="section-main-subtext">Configure telemetry polling, notification channels, and SOC parameters</p>
          </div>
          <div className="demo-disclaimer-bar">
            DEMO / MOCK DATA MODE
          </div>
        </div>

        <form onSubmit={handleSave} className="dashboard-row-2col">
          <div className="soc-card">
            <div className="soc-card-header">
              <h3 className="soc-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
                  <circle cx="12" cy="12" r="3"/>
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
                </svg>
                Telemetry & Polling Configuration
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.25rem', display: 'block' }}>
                  Telemetry Stream Refresh Rate
                </label>
                <select
                  className="time-filter-select"
                  style={{ width: '100%', padding: '0.4rem 0.65rem' }}
                  value={refreshInterval}
                  onChange={(e) => setRefreshInterval(e.target.value)}
                >
                  <option value="1s">Real-time Stream (1s)</option>
                  <option value="5s">Standard Polling (5s)</option>
                  <option value="15s">Low Bandwidth (15s)</option>
                  <option value="manual">Manual Refresh Only</option>
                </select>
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '0.75rem', marginBottom: '0.35rem', display: 'block' }}>
                  Notification Integration Channels
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.775rem', color: '#cbd5e1', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={emailAlerts}
                      onChange={(e) => setEmailAlerts(e.target.checked)}
                    />
                    Enable Emergency Email Dispatch (soc-alerts@sentinel.ai)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.775rem', color: '#cbd5e1', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={slackAlerts}
                      onChange={(e) => setSlackAlerts(e.target.checked)}
                    />
                    Enable Slack / Webhook Security Channel Push
                  </label>
                </div>
              </div>

              <div style={{ paddingTop: '0.65rem', borderTop: '1px solid rgba(51, 65, 85, 0.5)', marginTop: '0.5rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <label className="form-label" style={{ fontSize: '0.75rem', margin: 0, color: '#f8fafc', fontWeight: 700 }}>
                    SOC Cyber Alert Sound Profile
                  </label>
                  <div style={{ display: 'flex', gap: '0.35rem' }}>
                    <button
                      type="button"
                      className="action-btn"
                      style={{ padding: '0.2rem 0.55rem', fontSize: '0.675rem', background: '#7e22ce', color: '#fff', border: 'none' }}
                      onClick={() => playAlertSound(soundTone)}
                    >
                      🔊 Test Sound
                    </button>
                    <button
                      type="button"
                      className="action-btn"
                      style={{ padding: '0.2rem 0.55rem', fontSize: '0.675rem', background: '#dc2626', color: '#fff', border: 'none' }}
                      onClick={() => stopAlertSound()}
                    >
                      ⏹ Stop Sound
                    </button>
                  </div>
                </div>

                <select
                  className="time-filter-select"
                  style={{ width: '100%', padding: '0.4rem 0.65rem', marginBottom: '0.75rem' }}
                  value={soundTone}
                  onChange={(e) => handleSoundToneChange(e.target.value)}
                >
                  <option value="biohazard_alarm">☣️ Biohazard Alarm (Your Custom Sound)</option>
                  <option value="cyber_hacking_alarm">⚡ Futuristic Cyber/Hacking Alarm</option>
                  <option value="cyber_pulse_chime">✨ Sleek Cyber Digital Pulse</option>
                  <option value="cyber_alert">🔊 High-Tech Pulse Stinger</option>
                  <option value="danger_siren">🚨 High-Pitch Security Siren</option>
                  <option value="emergency_beep">⚡ Rapid Emergency Alarm Beep</option>
                  <option value="gentle_chime">🔔 Gentle Security Chime</option>
                </select>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', background: 'rgba(15, 23, 42, 0.5)', padding: '0.65rem', borderRadius: '6px', border: '1px solid rgba(51, 65, 85, 0.4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#cbd5e1' }}>
                    <span style={{ fontWeight: 600 }}>Alert Sound Volume</span>
                    <span style={{ fontWeight: 700, color: '#38bdf8' }}>{Math.round(volume * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={volume}
                    onChange={(e) => handleVolumeChange(e.target.value)}
                    style={{ width: '100%', accentColor: '#38bdf8', cursor: 'pointer' }}
                  />

                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.75rem', color: '#cbd5e1', cursor: 'pointer', marginTop: '0.2rem' }}>
                    <input
                      type="checkbox"
                      checked={isMuted}
                      onChange={handleToggleMute}
                    />
                    Mute All SOC Alert Audio Notifications
                  </label>
                </div>
              </div>
            </div>
          </div>

          <div className="soc-card">
            <div className="soc-card-header">
              <h3 className="soc-card-title">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#818cf8" strokeWidth="2">
                  <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4"/>
                </svg>
                API Key & Sensor Tokens
              </h3>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div>
                <span style={{ fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>Active Sensor Ingestion Key</span>
                <div style={{ background: '#05070d', padding: '0.5rem 0.75rem', borderRadius: '4px', border: '1px solid #1e293b', fontFamily: 'ui-monospace, Consolas, monospace', fontSize: '0.75rem', color: '#818cf8', marginTop: '0.2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span>sn_live_9a8f7c6b5e4d3c2b1a0</span>
                  <button type="button" className="action-btn" style={{ fontSize: '0.675rem', padding: '0.2rem 0.4rem' }}>Copy Key</button>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="action-btn"
                  style={{ width: '100%', padding: '0.45rem', fontSize: '0.8rem', marginTop: '0.5rem', background: '#0284c7', border: 'none', color: '#fff', borderRadius: '6px', cursor: 'pointer', fontWeight: 700 }}
                >
                  Save System Settings
                </button>
                {savedMessage && (
                  <span style={{ fontSize: '0.725rem', color: '#4ade80', display: 'block', textAlign: 'center', marginTop: '0.4rem' }}>
                    ✓ Settings saved successfully (Mock Mode)
                  </span>
                )}
              </div>
            </div>
          </div>
        </form>
      </div>
    </AppShell>
  );
}
