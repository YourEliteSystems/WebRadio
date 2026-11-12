import React, { useState, useCallback } from 'react';
import { useTranslation } from '../../localization/index.js';

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
  const { t } = useTranslation();
  const [nowPlayingMode, setNowPlayingMode] = useState(() => readMode());

  const handleModeChange = useCallback((mode) => {
    writeMode(mode);
    setNowPlayingMode(mode);
  }, []);

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h1>{t('settings.player.title')}</h1>
        <p>{t('settings.player.subtitle')}</p>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">{t('settings.player.cardTitle')}</span>
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
                <span className="radio-title">{t('settings.player.offTitle')}</span>
                <span className="radio-description">{t('settings.player.offDescription')}</span>
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
                <span className="radio-title">{t('settings.player.onceTitle')}</span>
                <span className="radio-description">{t('settings.player.onceDescription')}</span>
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
                <span className="radio-title">{t('settings.player.persistentTitle')}</span>
                <span className="radio-description">{t('settings.player.persistentDescription')}</span>
              </span>
            </label>
          </div>
        </div>

        <div className="settings-card-info">
          <p>{t('settings.player.infoUnified')}</p>
          <p>{t('settings.player.infoTechnical')}</p>
        </div>
      </div>
    </div>
  );
}