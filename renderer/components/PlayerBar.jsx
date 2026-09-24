import React, { useEffect, useRef, useState } from 'react';
import { useUnifiedPlayer } from '../hooks/useUnifiedPlayer';
import { getAnalyser } from '../services/playerService';
import { applyThemeCss, resolveActiveTheme } from '../services/themeService';

/**
 * PlayerBar – Unified Player API Consumer
 *
 * Diese Komponente kennt KEINE konkreten Provider (kein YouTube, kein MediaHub,
 * kein Spotify). Alle Informationen kommen ausschließlich über useUnifiedPlayer()
 * und window.playerAPI.
 *
 * Legacy-Props (station, title, volume, …) bleiben als optionaler Fallback
 * erhalten, damit App.jsx ohne Breaking Change weiter funktioniert.
 * Sobald playerAPI verfügbar ist, überschreibt der Unified State die Props.
 */
export default function PlayerBar({
  // Legacy Fallback-Props (werden ignoriert, wenn playerAPI verfügbar)
  station,
  title: legacyTitle,
  volume: legacyVolume,
  isMuted: legacyIsMuted,
  onVolumeChange: legacyOnVolumeChange,
  onMuteToggle: legacyOnMuteToggle,
  onPlay: legacyOnPlay,
  onStop: legacyOnStop,
  isPlaying: legacyIsPlaying,
  isFavorite,
  onToggleFavorite
}) {
  const canvasRef = useRef(null);
  const [themes, setThemes] = useState([]);
  const [currentTheme, setCurrentTheme] = useState('');

  // Unified Player API
  const hasUnifiedApi = Boolean(window.playerAPI);
  const {
    playerState,
    isPlaying:    unifiedIsPlaying,
    sourceLabel,
    play,
    pause,
    stop,
    toggle,
    setVolume: setUnifiedVolume
  } = useUnifiedPlayer();

  // Lokaler Lautstärke-State (für Slider-Rendering)
  const [localVolume, setLocalVolume] = useState(() => {
    const saved = localStorage.getItem('webradio_volume');
    return saved !== null ? parseFloat(saved) : 1.0;
  });
  const [localMuted, setLocalMuted] = useState(false);
  const premuteRef = useRef(null);

  // Lautstärke aus Player-State synchronisieren (wenn Unified API aktiv)
  useEffect(() => {
    if (hasUnifiedApi && playerState.volume !== undefined) {
      setLocalVolume(playerState.volume);
    }
  }, [hasUnifiedApi, playerState.volume]);

  // ─── Unified vs. Legacy State Fallback ────────────────
  const effectiveTitle   = hasUnifiedApi
    ? (playerState.title || legacyTitle || '–')
    : (legacyTitle || '–');

  const effectiveArtist  = hasUnifiedApi ? playerState.artist  : null;
  const effectiveArtwork = hasUnifiedApi ? playerState.artwork  : null;
  const effectiveVolume  = hasUnifiedApi ? localVolume          : (legacyVolume ?? 1.0);
  const effectiveMuted   = hasUnifiedApi ? localMuted           : (legacyIsMuted ?? false);
  const effectivePlaying = hasUnifiedApi ? unifiedIsPlaying      : (legacyIsPlaying ?? false);

  // Artwork-Fallback: playerState.artwork → station.favicon → default
  const artworkSrc = effectiveArtwork
    || station?.favicon
    || station?.logo
    || '../assets/default-logo.png';

  // Sender-Anzeige: im MainWindow soll dauerhaft der Sender stehen.
  // Der technische Source-Name (z.B. "Radio") oder Provider (z.B. "FFmpeg")
  // ist keine Sendernamen-Alternative und wird nicht alssender angezeigt.
  const displayName = hasUnifiedApi && playerState.source?.type === 'radio'
    ? (station?.name || playerState.title || '–')
    : (station?.name || effectiveTitle || '–');

  // Für Radio soll dauerhaft „Artist – Song“ sichtbar sein, sofern vorhanden.
  // Auch hier werden keine technischen Source-/Providerbezeichnungen verwendet.
  const displaySubtitle = hasUnifiedApi && playerState.source?.type === 'radio'
    ? (effectiveArtist && effectiveTitle
        ? `${effectiveArtist} – ${effectiveTitle}`
        : effectiveArtist || effectiveTitle || null)
    : (effectiveArtist || null);

  // ─── Theme-Selector ────────────────────────────────────
  useEffect(() => {
    if (!window.themeAPI?.getThemes) return;

    Promise.all([
      window.themeAPI.getThemes(),
      window.themeAPI.getActiveTheme()
    ]).then(([res, activeId]) => {
      setThemes(res);
      const theme = resolveActiveTheme(res, activeId);
      if (theme) setCurrentTheme(theme.css);
    });

    if (window.themeAPI?.onThemeChanged) {
      const unsub = window.themeAPI.onThemeChanged((data) => {
        if (data?.css) setCurrentTheme(data.css);
      });
      return unsub;
    }
  }, []);

  const handleThemeChange = (e) => {
    const cssPath = e.target.value;
    setCurrentTheme(cssPath);
    applyThemeCss(cssPath);

    const foundTheme = themes.find(t => t.css === cssPath);
    if (foundTheme && window.themeAPI.setActiveTheme) {
      window.themeAPI.setActiveTheme(foundTheme.id);
    }
  };

  // ─── Volume Control ─────────────────────────────────────
  // Der Slider (`usePlayer`) liefert 0..1. Beträgt `hasUnifiedApi`, leiten wir
  // den Wert ZUERST in den tatsächlichen Audio-Gain (via `legacyOnVolumeChange`,
  // die usePlayer->playerService.setVolume Bahn) und synchronisieren danach
  // den Unified-Player-UI-State (via `setUnifiedVolume`).
  // (Ohne die `legacyOnVolumeChange` Runde verändert der Unified-Slider
  //  den Audio-Pegel nicht, weil die PlayerAPI-setVolume-Basis im Main
  //  (RadioProvider.setVolume) als no-op fungiert.)
  const handleVolumeChange = (val) => {
    const clamped = Math.max(0, Math.min(1, val));
    setLocalVolume(clamped);
    setLocalMuted(clamped === 0);
    localStorage.setItem('webradio_volume', clamped.toString());

    if (hasUnifiedApi) {
      // Aktualisiere den tatsächlichen Gain im Renderer (ungeringt, kein Provider-Specifisch).
      legacyOnVolumeChange?.(clamped);
      // Synchronisiere mit dem Unified-Player-State.
      setUnifiedVolume(clamped);
    } else if (legacyOnVolumeChange) {
      legacyOnVolumeChange(clamped);
    }
  };

  const handleMuteToggle = () => {
    if (localVolume > 0) {
      premuteRef.current = localVolume;
      handleVolumeChange(0);
    } else {
      const restore = premuteRef.current ?? 0.5;
      handleVolumeChange(restore);
    }

    if (!hasUnifiedApi && legacyOnMuteToggle) {
      legacyOnMuteToggle();
    }
  };

  // ─── Play / Stop Controls ────────────────────────────────
  const handlePlay = () => {
    if (hasUnifiedApi) {
      play();
    } else if (legacyOnPlay) {
      legacyOnPlay();
    }
  };

  const handleStop = () => {
    if (hasUnifiedApi) {
      stop();
    } else if (legacyOnStop) {
      legacyOnStop();
    }
  };

  // ─── Visualizer ─────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const analyser = getAnalyser();
    if (!analyser) return;

    const ctx = canvas.getContext('2d');
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationId;

    const BAR_COUNT = 40;
    const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
    gradient.addColorStop(0, '#00f2fe');
    gradient.addColorStop(1, '#4facfe');
    ctx.fillStyle = gradient;
    const barWidth = canvas.width / BAR_COUNT;
    const binStep  = Math.max(1, Math.floor(dataArray.length / BAR_COUNT));

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let x = 0;
      for (let i = 0; i < BAR_COUNT; i++) {
        const idx = Math.min(dataArray.length - 1, i * binStep);
        const barHeight = (dataArray[idx] / 255) * canvas.height;
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1, barHeight);
        x += barWidth;
      }
    };

    draw();
    return () => cancelAnimationFrame(animationId);
  }, []);

  const openSettings = () => {
    if (window.api?.openSettings) window.api.openSettings();
  };

  return (
    <footer className="player">
      {/* Now Playing Info */}
      <div className="now-playing">
        <img
          className="np-logo"
          src={artworkSrc}
          onError={(e) => { e.target.src = '../assets/default-logo.png'; }}
          alt="logo"
        />
        <div className="np-info">
          <div className="np-station">{displayName}</div>
          {displaySubtitle && (
            <div className="np-subtitle">{displaySubtitle}</div>
          )}
          <div className="np-title">{effectiveTitle}</div>
        </div>
        {/* Favoriten-Button nur bei Radio-Station */}
        {station && !hasUnifiedApi && (
          <button
            className="player-btn"
            onClick={onToggleFavorite}
            title="Favorit"
            style={{
              color: isFavorite ? '#ef4444' : 'var(--text-muted)',
              marginLeft: '8px',
              width: '32px',
              height: '32px'
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor"
              strokeWidth="2" fill={isFavorite ? 'currentColor' : 'none'}
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
        )}
        {/* Favoriten-Button im Unified-Modus wenn Radio aktiv */}
        {hasUnifiedApi && playerState.source?.type === 'radio' && station && (
          <button
            className="player-btn"
            onClick={onToggleFavorite}
            title="Favorit"
            style={{
              color: isFavorite ? '#ef4444' : 'var(--text-muted)',
              marginLeft: '8px',
              width: '32px',
              height: '32px'
            }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor"
              strokeWidth="2" fill={isFavorite ? 'currentColor' : 'none'}
              strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
        )}
      </div>

      {/* Center Controls */}
      <div className="player-center">
        <button
          className={`player-btn play${effectivePlaying ? ' active' : ''}`}
          onClick={handlePlay}
          title="Play / Resume"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor"
            strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
        <button
          className="player-btn"
          onClick={handleStop}
          title="Stop"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor"
            strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          </svg>
        </button>
      </div>

      {/* Right: Volume + Visualizer + Settings */}
      <div className="player-right">
        <div
          className="volume-container"
          onWheel={(e) => {
            e.preventDefault();
            const delta = e.deltaY < 0 ? 0.05 : -0.05;
            handleVolumeChange(Math.max(0, Math.min(1, parseFloat((effectiveVolume + delta).toFixed(2)))));
          }}
        >
          <button
            className="player-btn mute-btn"
            onClick={handleMuteToggle}
            title={effectiveMuted ? 'Stumm (klicken zum Einschalten)' : `Lautstärke: ${Math.round(effectiveVolume * 100)}%`}
            aria-label={effectiveMuted ? 'Ton einschalten' : 'Ton ausschalten'}
          >
            {effectiveMuted || effectiveVolume === 0 ? (
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
                strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                <line x1="23" y1="9" x2="17" y2="15"></line>
                <line x1="17" y1="9" x2="23" y2="15"></line>
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor"
                strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                {effectiveVolume > 0.5 ? (
                  <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                ) : (
                  <path d="M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                )}
              </svg>
            )}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.01"
            value={effectiveVolume}
            aria-label="Lautstärke"
            onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
          />
          <span className="volume-label">{Math.round(effectiveVolume * 100)}%</span>
        </div>
        <canvas ref={canvasRef} id="vu" width="100" height="30"></canvas>
        <button className="player-btn" onClick={openSettings} title="Einstellungen">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor"
            strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </footer>
  );
}
