import React, { useState, useCallback } from 'react';

const NOW_PLAYING_MODES = Object.freeze({
  OFF: 'off',
  ONCE: 'once',
  PERSISTENT: 'persistent'
});

const DEFAULT_NOW_PLAYING_MODE = NOW_PLAYING_MODES.ONCE;

const STORAGE_KEY = 'nowPlayingMode';

function readMode() {
  const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
  if (saved === NOW_PLAYING_MODES.OFF || saved === NOW_PLAYING_MODES.ONCE || saved === NOW_PLAYING_MODES.PERSISTENT) {
    return saved;
  }
  return DEFAULT_NOW_PLAYING_MODE;
}

function writeMode(mode) {
  if (mode !== NOW_PLAYING_MODES.OFF && mode !== NOW_PLAYING_MODES.ONCE && mode !== NOW_PLAYING_MODES.PERSISTENT) {
    return;
  }
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(STORAGE_KEY, mode);
  }
}

export default function PlayerSettings() {
  const [nowPlayingMode, setNowPlayingMode] = useState(() => readMode());

  const handleModeChange = useCallback((mode) => {
    writeMode(mode);
    setNowPlayingMode(mode);
  }, []);

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h1>Player-Einstellungen</h1>
        <p>Now-Playing-Anzeige konfigurieren</p>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">Now-Playing-Anzeige</span>
        </div>

        <div className="now-playing-settings">
          <div className="now-playing-mode-option">
            <label>
              <input
                type="radio"
                name="nowPlayingMode"
                value={NOW_PLAYING_MODES.OFF}
                checked={nowPlayingMode === NOW_PLAYING_MODES.OFF}
                onChange={() => handleModeChange(NOW_PLAYING_MODES.OFF)}
              />
              <span className="radio-label">
                <span className="radio-title">Aus</span>
                <span className="radio-description">Now-Playing-Anzeige deaktivieren</span>
              </span>
            </label>
          </div>

          <div className="now-playing-mode-option">
            <label>
              <input
                type="radio"
                name="nowPlayingMode"
                value={NOW_PLAYING_MODES.ONCE}
                checked={nowPlayingMode === NOW_PLAYING_MODES.ONCE}
                onChange={() => handleModeChange(NOW_PLAYING_MODES.ONCE)}
              />
              <span className="radio-label">
                <span className="radio-title">Einmalig bei Titelwechsel</span>
                <span className="radio-description">Anzeige nur beim Wechsel des abgespielten Inhalts (Standard)</span>
              </span>
            </label>
          </div>

          <div className="now-playing-mode-option">
            <label>
              <input
                type="radio"
                name="nowPlayingMode"
                value={NOW_PLAYING_MODES.PERSISTENT}
                checked={nowPlayingMode === NOW_PLAYING_MODES.PERSISTENT}
                onChange={() => handleModeChange(NOW_PLAYING_MODES.PERSISTENT)}
              />
              <span className="radio-label">
                <span className="radio-title">Dauerhaft</span>
                <span className="radio-description">Anzeige immer sichtbar</span>
              </span>
            </label>
          </div>
        </div>

        <div className="settings-card-info">
          <p>Die Anzeige verwendet ausschließlich die Unified Player API und ist providerunabhängig.</p>
          <p>Technische Provider- Informationen (z.B. „Radio – FFmpeg") werden nicht als Musikinfo dargestellt.</p>
        </div>
      </div>
    </div>
  );
}