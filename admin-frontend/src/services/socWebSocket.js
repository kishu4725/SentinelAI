/**
 * SentinelAI Real-Time WebSocket Client
 * Connects the SOC Admin Command Center to the FastAPI backend (/api/ws/soc).
 * Handles automatic reconnects with exponential backoff and connection status updates.
 */

import { getStoredToken } from './apiService';

let ws = null;
let isIntentionalClose = false;
let reconnectTimer = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_DELAY = 10000;

const listeners = new Set();
const statusListeners = new Set();

let connectionStatus = 'DISCONNECTED'; // 'ONLINE' | 'CONNECTING' | 'RECONNECTING' | 'DISCONNECTED'

function setStatus(newStatus) {
  connectionStatus = newStatus;
  statusListeners.forEach((fn) => {
    try {
      fn(connectionStatus);
    } catch (err) {
      console.error('Error in WS status listener:', err);
    }
  });
}

/**
 * Returns current WebSocket connection status string.
 */
export function getWebSocketStatus() {
  return connectionStatus;
}

/**
 * Subscribes to WebSocket connection status changes.
 */
export function subscribeWebSocketStatus(callback) {
  statusListeners.add(callback);
  callback(connectionStatus);
  return () => statusListeners.delete(callback);
}

/**
 * Subscribes to incoming real-time security threat broadcast events.
 */
export function subscribeThreatEvents(callback) {
  listeners.add(callback);
  return () => listeners.delete(callback);
}

/**
 * Calculates WebSocket URL pointing to FastAPI backend.
 */
function getWebSocketUrl() {
  const isHttps = typeof window !== 'undefined' && window.location.protocol === 'https:';
  const wsProtocol = isHttps ? 'wss:' : 'ws:';
  const apiBase =
    (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_API_BASE_URL)
      ? import.meta.env.VITE_API_BASE_URL
      : 'http://127.0.0.1:8000/api';

  try {
    const urlObj = new URL(apiBase);
    const host = urlObj.host; // 127.0.0.1:8000 or localhost:8000
    return `${wsProtocol}//${host}/api/ws/soc`;
  } catch {
    return 'ws://127.0.0.1:8000/api/ws/soc';
  }
}

/**
 * Connects to the FastAPI SOC WebSocket endpoint.
 */
export function connectSOCWebSocket() {
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
    return;
  }

  // The backend only accepts SOC admins; connecting without a token would just be rejected.
  const token = getStoredToken();
  if (!token) {
    setStatus('DISCONNECTED');
    return;
  }

  isIntentionalClose = false;
  setStatus(reconnectAttempts > 0 ? 'RECONNECTING' : 'CONNECTING');

  const wsUrl = `${getWebSocketUrl()}?token=${encodeURIComponent(token)}`;

  try {
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      reconnectAttempts = 0;
      setStatus('ONLINE');
      // Start ping heartbeat interval
      if (ws.pingInterval) clearInterval(ws.pingInterval);
      ws.pingInterval = setInterval(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send('ping');
        }
      }, 25000);
    };

    ws.onmessage = (event) => {
      if (event.data === 'pong') return;
      try {
        const payload = JSON.parse(event.data);
        listeners.forEach((fn) => {
          try {
            fn(payload);
          } catch (err) {
            console.error('Error in threat event listener:', err);
          }
        });
      } catch (err) {
        console.warn('Error parsing incoming WS message:', err);
      }
    };

    ws.onerror = (err) => {
      console.warn('SOC WebSocket encountered an error:', err);
    };

    ws.onclose = (closeEvent) => {
      if (ws && ws.pingInterval) clearInterval(ws.pingInterval);
      ws = null;
      // 1008 = policy violation: the backend rejected our token. Retrying won't help.
      if (closeEvent && closeEvent.code === 1008) {
        setStatus('DISCONNECTED');
        return;
      }
      if (!isIntentionalClose) {
        setStatus('RECONNECTING');
        reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(1.5, reconnectAttempts), MAX_RECONNECT_DELAY);
        if (reconnectTimer) clearTimeout(reconnectTimer);
        reconnectTimer = setTimeout(() => {
          connectSOCWebSocket();
        }, delay);
      } else {
        setStatus('DISCONNECTED');
      }
    };
  } catch (err) {
    console.error('Failed to initiate WebSocket connection:', err);
    setStatus('DISCONNECTED');
  }
}

/**
 * Disconnects from the WebSocket endpoint intentionally.
 */
export function disconnectSOCWebSocket() {
  isIntentionalClose = true;
  if (reconnectTimer) clearTimeout(reconnectTimer);
  if (ws) {
    if (ws.pingInterval) clearInterval(ws.pingInterval);
    ws.close();
    ws = null;
  }
  setStatus('DISCONNECTED');
}
