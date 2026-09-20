import React, { useState, useEffect, useRef } from 'react';
import { useUnifiedPlayer } from '../hooks/useUnifiedPlayer';

const NOW_PLAYING_DISPLAY_DURATION = 5000;

const NOW_PLAYING_MODES = Object.freeze({
  OFF: 'off',
  ONCE: 'once',
  PERSISTENT: 'persistent'
});

const DEFAULT_MODE = NOW_PLAYING_MODES.ONCE;

function getStorageKey() {
  return 'nowPlayingMode';
}

function getDefaultMode() {
  return DEFAULT_MODE;
}

function getNowPlayingModeFromStorage() {
  const saved = localStorage.getItem(getStorageKey());
  if (saved === NOW_PLAYING_MODES.OFF || saved === NOW_PLAYING_MODES.ONCE || saved === NOW_PLAYING_MODES.PERSISTENT) {
    return saved;
  }
  return getDefaultMode();
}

export default function NowPlayingDisplay() {
  const [mode, setMode] = useState(() => getNowPlayingModeFromStorage());
  const { playerState } = useUnifiedPlayer();
  const [displayVisible, setDisplayVisible] = useState(false);
  const [displayContent, setDisplayContent] = useState(null);
  const timerRef = useRef(null);
  const contentHashRef = useRef(null);

  const getContentHash = (state) => {
    if (!state || state.state === 'idle' || state.state === 'stopped') {
      return null;
    }
    const title = state.title || null;
    const artist = state.artist || null;
    const sourceType = state.source?.type || null;
    const sourceName = state.source?.name || null;
    return `${title || ''}|${artist || ''}|${sourceType || ''}|${sourceName || ''}`;
  };

  const getDisplayContent = (state) => {
    if (!state || state.state === 'idle' || state.state === 'stopped') {
      return null;
    }

    const title = state.title || null;
    const artist = state.artist || null;
    const sourceName = state.source?.name || null;
    const sourceType = state.source?.type || null;
    const artwork = state.artwork || null;

    let displayTitle = title;
    let displayArtist = artist;
    let displaySource = sourceName;

    if (!displayTitle && sourceType === 'radio' && state.title) {
      displayTitle = state.title;
    }

    if (!displayTitle) {
      displayTitle = null;
    }

    if (!displayArtist) {
      displayArtist = 'Unbekannter Interpret';
    }

    if (!displaySource && sourceType === 'radio') {
      displaySource = sourceName || 'Radio';
    }

    if (!displaySource) {
      displaySource = null;
    }

    return {
      title: displayTitle,
      artist: displayArtist,
      source: displaySource,
      artwork: artwork
    };
  };

  useEffect(() => {
    if (!window.playerAPI) return;

    const unsubscribe = window.playerAPI.onStateChanged((state) => {
      if (!state) return;

      const newMode = getNowPlayingModeFromStorage();
      setMode(newMode);

      if (newMode === NOW_PLAYING_MODES.OFF) {
        if (timerRef.current) {
          clearTimeout(timerRef.current);
          timerRef.current = null;
        }
        setDisplayVisible(false);
        setDisplayContent(null);
        return;
      }

      const newHash = getContentHash(state);

      if (newMode === NOW_PLAYING_MODES.ONCE) {
        if (newHash && newHash !== contentHashRef.current) {
          contentHashRef.current = newHash;
          const content = getDisplayContent(state);
          if (content && content.title) {
            setDisplayContent(content);
            setDisplayVisible(true);
            if (timerRef.current) {
              clearTimeout(timerRef.current);
            }
            timerRef.current = setTimeout(() => {
              setDisplayVisible(false);
              timerRef.current = null;
            }, NOW_PLAYING_DISPLAY_DURATION);
          } else {
            setDisplayVisible(false);
            setDisplayContent(null);
          }
        }
      } else if (newMode === NOW_PLAYING_MODES.PERSISTENT) {
        const content = getDisplayContent(state);
        if (content) {
          setDisplayContent(content);
          setDisplayVisible(true);
        } else {
          setDisplayVisible(false);
          setDisplayContent(null);
        }
      }
    });

    return () => {
      if (typeof unsubscribe === 'function') {
        unsubscribe();
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (mode === NOW_PLAYING_MODES.OFF || !displayVisible || !displayContent) {
    return null;
  }

  const { title, artist, source, artwork } = displayContent;

  const artworkSrc = artwork || '../assets/default-logo.png';

  return (
    <div className="now-playing-display">
      {artwork && <img className="np-artwork" src={artworkSrc} alt="Artwork" />}
      <div className="now-playing-info">
        <div className="np-title">{title}</div>
        <div className="np-artist">{artist}</div>
        {source && <div className="np-source">{source}</div>}
      </div>
    </div>
  );
}