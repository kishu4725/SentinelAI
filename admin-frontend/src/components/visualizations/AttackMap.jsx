import { useState, useEffect, useRef, useMemo } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { getMockAttackMapData, HONEYPOT_DESTINATION } from '../../data/mockAttackMapData';
import './AttackMap.css';

// Severity color & glow configuration
const SEVERITY_CONFIG = {
  CRITICAL: { color: '#ef4444', label: 'CRITICAL' },
  HIGH: { color: '#f97316', label: 'HIGH' },
  MEDIUM: { color: '#eab308', label: 'MEDIUM' },
  LOW: { color: '#06b6d4', label: 'LOW' }
};

// Generates smooth curved quadratic arc points for Leaflet Polylines between two lat/lng coordinates
function getArcPolylinePoints(lat1, lng1, lat2, lng2, numPoints = 25) {
  const points = [];
  const midLat = (lat1 + lat2) / 2;
  const midLng = (lng1 + lng2) / 2;
  const dx = lng2 - lng1;
  const dy = lat2 - lat1;
  const dist = Math.sqrt(dx * dx + dy * dy);

  // Perpendicular curvature offset
  const curvature = Math.min(dist * 0.25, 20);
  const offsetX = -dy * (dist > 0 ? curvature / dist : 0);
  const offsetY = dx * (dist > 0 ? curvature / dist : 0);

  const controlLat = midLat + offsetY;
  const controlLng = midLng + offsetX;

  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    const lat = (1 - t) * (1 - t) * lat1 + 2 * (1 - t) * t * controlLat + t * t * lat2;
    const lng = (1 - t) * (1 - t) * lng1 + 2 * (1 - t) * t * controlLng + t * t * lng2;
    points.push([lat, lng]);
  }
  return points;
}

export default function AttackMap({
  attacks = getMockAttackMapData(),
  honeypot = HONEYPOT_DESTINATION,
  onSelectThreat
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const layersGroupRef = useRef(null);

  const [timeFilter, setTimeFilter] = useState('24h');
  const [selectedAttackId, setSelectedAttackId] = useState(null);

  // Filter attacks based on selected timeframe
  const filteredAttacks = useMemo(() => {
    if (timeFilter === '5m') {
      return attacks.filter(a => a.timeCategory === '5m');
    }
    if (timeFilter === '15m') {
      return attacks.filter(a => a.timeCategory === '5m' || a.timeCategory === '15m');
    }
    if (timeFilter === '1h') {
      return attacks.filter(a => a.timeCategory === '5m' || a.timeCategory === '15m' || a.timeCategory === '1h');
    }
    return attacks; // 24h shows all
  }, [attacks, timeFilter]);

  // Selected threat record details
  const activeThreat = useMemo(() => {
    return attacks.find(a => a.id === selectedAttackId) || null;
  }, [attacks, selectedAttackId]);

  // Compute metrics summary
  const stats = useMemo(() => {
    const activeCount = filteredAttacks.length;
    const uniqueCountries = new Set(filteredAttacks.map(a => a.sourceCountry)).size;
    const highRiskCount = filteredAttacks.filter(a => a.severity === 'HIGH' || a.severity === 'CRITICAL').length;
    const blockedCount = filteredAttacks.filter(a => a.responseStatus === 'BLOCKED').length;

    return { activeCount, uniqueCountries, highRiskCount, blockedCount };
  }, [filteredAttacks]);

  // Top 5 Threat Origin Countries for SDefender / Threatrix Overlay Panel
  const topCountries = useMemo(() => {
    const counts = {};
    filteredAttacks.forEach(a => {
      counts[a.sourceCountry] = (counts[a.sourceCountry] || 0) + 1;
    });
    const maxVal = Math.max(...Object.values(counts), 1);

    return Object.entries(counts)
      .map(([country, count]) => ({
        country,
        count,
        percent: Math.round((count / maxVal) * 100)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [filteredAttacks]);

  // Initialize Leaflet Map Instance
  useEffect(() => {
    const container = mapContainerRef.current;
    if (!container) return;

    // Clean up previous Leaflet ID if container was reused
    if (container._leaflet_id && !mapInstanceRef.current) {
      container._leaflet_id = null;
    }

    if (!mapInstanceRef.current) {
      const map = L.map(container, {
        center: [20, 10],
        zoom: 2,
        minZoom: 2,
        maxZoom: 14,
        zoomControl: true,
        attributionControl: true
      });

      // OpenStreetMap tile layer with dark CSS inversion filter (100% free, no API key, no watermark)
      const tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        subdomains: ['a', 'b', 'c'],
        maxZoom: 14,
        tileSize: 256
      });

      tileLayer.addTo(map);

      layersGroupRef.current = L.layerGroup().addTo(map);
      mapInstanceRef.current = map;

      // Force size invalidation at multiple frames to ensure map renders tiles cleanly
      requestAnimationFrame(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      });
      setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 150);
      setTimeout(() => {
        if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
      }, 500);
    }

    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  // Update Markers, Arcs, and Labels when filteredAttacks or selectedAttackId changes
  useEffect(() => {
    const map = mapInstanceRef.current;
    const layerGroup = layersGroupRef.current;
    if (!map || !layerGroup) return;

    layerGroup.clearLayers();

    // 1. Add Honeypot Target Node (Bengaluru, India)
    const hpLat = honeypot.lat || 12.9716;
    const hpLng = honeypot.lng || 77.5946;

    const honeypotIcon = L.divIcon({
      className: 'honeypot-radar-icon',
      html: `
        <div className="honeypot-label-pill">🎯 ${honeypot.city || 'Bengaluru'}, ${honeypot.country || 'India'}</div>
        <div className="honeypot-target-pin"></div>
        <div className="honeypot-pulse-ring"></div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12]
    });

    const hpMarker = L.marker([hpLat, hpLng], { icon: honeypotIcon });
    hpMarker.bindTooltip(
      `<strong>SENTINELAI HONEYPOT</strong><br/>${honeypot.city || 'Bengaluru'}, ${honeypot.region || 'Karnataka'}, ${honeypot.country || 'India'}`,
      { direction: 'top', className: 'soc-map-tooltip' }
    );
    layerGroup.addLayer(hpMarker);

    // 2. Render Attacker Source Markers and Trajectory Arcs
    filteredAttacks.forEach((atk) => {
      const srcLat = atk.sourceLat;
      const srcLng = atk.sourceLng;
      if (srcLat === undefined || srcLng === undefined) return;

      const isSelected = selectedAttackId === atk.id;
      const sevConfig = SEVERITY_CONFIG[atk.severity] || SEVERITY_CONFIG.LOW;

      // Draw curved attack arc to Bengaluru Honeypot
      const arcPoints = getArcPolylinePoints(srcLat, srcLng, hpLat, hpLng);
      const arcPolyline = L.polyline(arcPoints, {
        color: sevConfig.color,
        weight: isSelected ? 4 : 2.5,
        opacity: isSelected ? 0.95 : 0.7,
        dashArray: isSelected ? '8, 4' : '6, 4'
      });

      arcPolyline.on('click', () => {
        setSelectedAttackId(atk.id);
        if (onSelectThreat) onSelectThreat(atk);
      });

      arcPolyline.bindTooltip(
        `<strong>${atk.sourceCity || atk.sourceCountry}</strong> → ${atk.targetCity || 'Bengaluru'}<br/>${atk.attackType} (${atk.riskScore}/100)`,
        { sticky: true }
      );

      layerGroup.addLayer(arcPolyline);

      // Draw Attacker Source Beacon Marker
      const labelText = atk.sourceCity
        ? `${atk.sourceCity}, ${atk.sourceCountry}`
        : atk.sourceCountry;

      const attackerIcon = L.divIcon({
        className: 'attacker-leaflet-icon',
        html: `
          <div className="attacker-pill">${labelText}</div>
          <div className="attacker-dot ${atk.severity}"></div>
          <div className="attacker-pulse-beacon ${atk.severity}"></div>
        `,
        iconSize: [22, 22],
        iconAnchor: [11, 11]
      });

      const atkMarker = L.marker([srcLat, srcLng], { icon: attackerIcon });
      atkMarker.on('click', () => {
        setSelectedAttackId(atk.id);
        if (onSelectThreat) onSelectThreat(atk);
      });

      atkMarker.bindTooltip(
        `<strong>${atk.sourceCity || atk.sourceCountry}</strong> ${atk.sourceRegion ? `(${atk.sourceRegion})` : ''}<br/>IP: ${atk.sourceIp}<br/>Type: ${atk.attackType}<br/>Severity: ${atk.severity}`,
        { direction: 'top', className: 'soc-map-tooltip' }
      );

      layerGroup.addLayer(atkMarker);
    });
  }, [filteredAttacks, selectedAttackId, honeypot, onSelectThreat]);

  // View Preset Handler
  const handlePresetView = (viewType) => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (viewType === 'world') {
      map.setView([20, 10], 2);
    } else if (viewType === 'india') {
      map.setView([20.5937, 78.9629], 5);
    } else if (viewType === 'karnataka') {
      map.setView([13.25, 76.50], 9);
    }

    setTimeout(() => {
      if (mapInstanceRef.current) mapInstanceRef.current.invalidateSize();
    }, 100);
  };

  return (
    <div className="attack-map-card">
      {/* Top Header */}
      <div className="attack-map-header">
        <div className="attack-map-title-group">
          <div className="attack-map-icon">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <circle cx="12" cy="12" r="10" />
              <line x1="2" y1="12" x2="22" y2="12" />
              <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
            </svg>
          </div>
          <div>
            <h3 className="attack-map-title">
              Live Threat Telemetry & Attack Map
              <span style={{ fontSize: '0.625rem', background: 'rgba(56, 189, 248, 0.18)', color: '#38bdf8', padding: '0.12rem 0.45rem', borderRadius: '4px', fontWeight: 700, letterSpacing: '0.04em' }}>
                SOC COMMAND CENTER
              </span>
            </h3>
            <p className="attack-map-subtitle">Real-time threat vectors & honeypot telemetry nodes (Bengaluru, India)</p>
          </div>
        </div>

        {/* View Presets & Timeframe Filter Controls */}
        <div className="attack-map-controls">
          <div className="preset-view-group">
            <span style={{ fontSize: '0.65rem', color: '#64748b', fontWeight: 600, marginRight: '0.2rem' }}>Zoom:</span>
            <button type="button" className="preset-btn" onClick={() => handlePresetView('world')}>World</button>
            <button type="button" className="preset-btn" onClick={() => handlePresetView('india')}>India</button>
            <button type="button" className="preset-btn" onClick={() => handlePresetView('karnataka')}>Karnataka (Mysuru)</button>
          </div>

          <span style={{ fontSize: '0.685rem', color: '#64748b', fontWeight: 600, marginRight: '0.15rem' }}>Timeframe:</span>
          <button
            type="button"
            className={`time-filter-btn ${timeFilter === '5m' ? 'active' : ''}`}
            onClick={() => setTimeFilter('5m')}
          >
            Last 5m
          </button>
          <button
            type="button"
            className={`time-filter-btn ${timeFilter === '15m' ? 'active' : ''}`}
            onClick={() => setTimeFilter('15m')}
          >
            Last 15m
          </button>
          <button
            type="button"
            className={`time-filter-btn ${timeFilter === '1h' ? 'active' : ''}`}
            onClick={() => setTimeFilter('1h')}
          >
            Last 1h
          </button>
          <button
            type="button"
            className={`time-filter-btn ${timeFilter === '24h' ? 'active' : ''}`}
            onClick={() => setTimeFilter('24h')}
          >
            Last 24h
          </button>
        </div>
      </div>

      {/* Metrics Summary Grid */}
      <div className="attack-map-stats-grid">
        <div className="map-stat-box cyan">
          <div>
            <div className="map-stat-label">Active Attacks</div>
            <div className="map-stat-val">{stats.activeCount}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#38bdf8" strokeWidth="2">
            <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
          </svg>
        </div>

        <div className="map-stat-box purple">
          <div>
            <div className="map-stat-label">Attack Sources</div>
            <div className="map-stat-val">{stats.uniqueCountries} <span style={{ fontSize: '0.65rem', color: '#94a3b8' }}>Countries</span></div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a855f7" strokeWidth="2">
            <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
            <circle cx="12" cy="10" r="3" />
          </svg>
        </div>

        <div className="map-stat-box red">
          <div>
            <div className="map-stat-label">High Risk Attacks</div>
            <div className="map-stat-val">{stats.highRiskCount}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2">
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
          </svg>
        </div>

        <div className="map-stat-box green">
          <div>
            <div className="map-stat-label">Blocked Attacks</div>
            <div className="map-stat-val">{stats.blockedCount}</div>
          </div>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
          </svg>
        </div>
      </div>

      {/* Outer Wrapper with Dedicated Inner Leaflet Container */}
      <div className="map-canvas-wrapper">
        {/* Top Threat Origins Glass Panel Overlay (SDefender & Threatrix Style) */}
        <div className="map-top-origins-panel">
          <div className="origins-panel-title">
            <span>Top Origins</span>
            <span style={{ fontSize: '0.6rem', color: '#94a3b8' }}>{timeFilter}</span>
          </div>
          {topCountries.map((item) => (
            <div key={item.country} className="origin-row">
              <span className="origin-name">{item.country}</span>
              <div className="origin-bar-container">
                <div className="origin-bar-fill" style={{ width: `${item.percent}%` }}></div>
              </div>
              <span className="origin-count">{item.count}</span>
            </div>
          ))}
        </div>

        <div ref={mapContainerRef} className="leaflet-map-element" />
      </div>

      {/* Selected Threat Details Panel */}
      {activeThreat && (
        <div className="threat-info-panel">
          <div className="info-panel-header">
            <div className="info-panel-title">
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: SEVERITY_CONFIG[activeThreat.severity]?.color || '#ef4444' }}></span>
              Vector: {activeThreat.sourceIp}
            </div>
            <button
              type="button"
              className="info-panel-close"
              onClick={() => setSelectedAttackId(null)}
              title="Close Panel"
            >
              ✕
            </button>
          </div>

          <div className="info-grid">
            <div className="info-row">
              <span className="info-label">City / Region</span>
              <span className="info-val">{activeThreat.sourceCity || 'N/A'}, {activeThreat.sourceRegion || ''}</span>
            </div>

            <div className="info-row">
              <span className="info-label">Country</span>
              <span className="info-val">{activeThreat.sourceCountry}</span>
            </div>

            <div className="info-row">
              <span className="info-label">Target Honeypot</span>
              <span className="info-val">{activeThreat.target}</span>
            </div>

            <div className="info-row">
              <span className="info-label">Attack Type</span>
              <span className="info-val">{activeThreat.attackType} ({activeThreat.protocol})</span>
            </div>

            <div className="info-row">
              <span className="info-label">Attempts</span>
              <span className="info-val">{activeThreat.attempts} probes</span>
            </div>

            <div className="info-row">
              <span className="info-label">Risk Score</span>
              <span className="info-val" style={{ color: SEVERITY_CONFIG[activeThreat.severity]?.color, fontWeight: 800 }}>
                {activeThreat.riskScore} / 100
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Severity</span>
              <span className={`severity-tag ${activeThreat.severity}`}>
                {activeThreat.severity}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">ML Decision</span>
              <span className="info-val" style={{ color: activeThreat.mlDecision === 'ANOMALOUS' ? '#ef4444' : '#eab308' }}>
                {activeThreat.mlDecision}
              </span>
            </div>

            <div className="info-row">
              <span className="info-label">Response Status</span>
              <span className={`status-tag ${activeThreat.responseStatus}`}>
                {activeThreat.responseStatus}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Footer Legend */}
      <div className="attack-map-footer">
        <div className="severity-legend">
          <span style={{ fontWeight: 700, color: '#94a3b8' }}>SEVERITY:</span>
          <div className="legend-item">
            <span className="legend-dot critical"></span>
            <span>CRITICAL</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot high"></span>
            <span>HIGH</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot medium"></span>
            <span>MEDIUM</span>
          </div>
          <div className="legend-item">
            <span className="legend-dot low"></span>
            <span>LOW</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#64748b' }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#06b6d4', display: 'inline-block' }}></span>
          Target Node: SentinelAI Honeypot Bengaluru (12.9716° N, 77.5946° E)
        </div>
      </div>
    </div>
  );
}
