import React, { useEffect, useRef, useState } from 'react';
import { useUnifiedPlayer } from '../../hooks/useUnifiedPlayer';

const NOW_PLAYING_DISPLAY_DURATION = 5000; // 5 Sekunden

const MODES = Object.freeze({
  OFF: 'off',
  ONCE: 'once',
  PERSISTENT: 'persistent'
});

const STORAGE_KEY = 'nowPlayingMode';

function readMode() {
  const saved = typeof window !== 'undefined' ? window.localStorage.getItem(STORAGE_KEY) : null;
  if (saved === MODES.OFF || saved === MODES.ONCE || saved === MODES.PERSISTENT) {
    return saved;
  }
  return MODES.ONCE;
}

function getNowPlayingContent(state) {
  if (!state) return null;

  const { state: playerState, title, artist, artwork, source } = state;

  if (playerState !== 'playing' && playerState !== 'loading') {
    return null;
  }

  // Provider-technische Bezeichner (z.B. "Radio", "FFmpeg") sollen nicht als
  // Musikinfo fungieren. Wir versuchen, konkrete Metadaten zu verwenden.
  const rawTitle = typeof title === 'string' ? title.trim() : null;
  const rawArtist = typeof artist === 'string' ? artist.trim() : null;

  if (!rawTitle && !rawArtist) {
    return null;
  }

  let displayTitle = rawTitle || null;
  let displayArtist = rawArtist || null;

  // Radio-Streams liefern oft nur ein Titel-Äquivalent (z.B. StreamTitle).
  // In dem Fall soll das als Titel angezeigt werden, nicht "Radio – FFmpeg".
  if (!displayTitle && source && source.type === 'radio' && rawTitle) {
    displayTitle = rawTitle;
  }

  if (!displayArtist) {
    displayArtist = 'Unbekannter Interpret';
  }

  return {
    title: displayTitle,
    artist: displayArtist,
    artwork: (artwork && typeof artwork === 'string') ? artwork : null,
    sourceLabel: source?.name || null
  };
}

function getContentIdentity(content) {
  if (!content) return null;
  // Nur tatsächlich angezeigte Metadaten zählen als Identität.
  // Technische Felder wie z.B. sourceLabel gehören nicht dazu.
  return `${content.title || ''}|${content.artist || ''}`;
}

export default function NowPlayingDisplay() {
  const { playerState } = useUnifiedPlayer();
  const mode = readMode();

  const [visible, setVisible] = useState(false);
  const [content, setContent] = useState(null);
  const currentIdentityRef = useRef(null);
  const timerRef = useRef(null);

  const hide = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    setVisible(false);
    setContent(null);
  };

  const show = (nextContent) => {
    if (!nextContent || !nextContent.title) {
      return;
    }

    const identity = getContentIdentity(nextContent);

    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }

    setContent(nextContent);
    setVisible(true);
    currentIdentityRef.current = identity;

    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      setVisible(false);
      setContent(null);
      currentIdentityRef.current = null;
    }, NOW_PLAYING_DISPLAY_DURATION);
  };

  // Wir abonnieren State-Änderungen direkt über die API, damit wir den
  // initialen State, der via useUnifiedPlayer geladen wird, nicht als
  // "neuer Titelwechsel" behandeln müssen.
  useEffect(() => {
    const api = window.playerAPI;
    if (!api) return;

    let subscription = null;

    const handleState = (state) => {
      if (!state) return;

      const content = getNowPlayingContent(state);
      if (mode === MODES.OFF) {
        hide();
        return;
      }

      if (mode === MODES.PERSISTENT) {
        if (!content) {
          setVisible(false);
          setContent(null);
          currentIdentityRef.current = null;
          return;
        }
        // Persistent: Anzeige bleibt erhalten, nur Inhalt aktualisieren.
        // Kein Neuaufbau, kein Timing-Reset.
        if (visible) {
          setContent(content);
        } else {
          setContent(content);
          setVisible(true);
        }
        return;
      }

      // mode === ONCE
      if (!content) {
        hide();
        return;
      }

      const identity = getContentIdentity(content);

      // Kein neuer Inhalt → keine erneute Anzeige (auch nicht bei
      // Play/Pause/Volume/IIR-technischen Updates).
      if (currentIdentityRef.current === identity) {
        return;
      }

      show(content);
    };

    subscription = api.onStateChanged(handleState);

    return () => {
      if (typeof subscription === 'function') {
        subscription();
      }
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [mode, visible]);

  // Mode-Änderungen dürfen im ONCE-Modus nicht den aktuellen "alten"
  // Inhalt als neuen Titelwechsel interpretieren.
  useEffect(() => {
    if (mode === MODES.OFF) {
      hide();
    } else {
      currentIdentityRef.current = null;
    }
  }, [mode]);

  // Cleanup auf dem Unmount.
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  if (mode === MODES.OFF || !visible || !content) {
    return null;
  }

  const artworkSrc = content.artwork || undefined;

  return (
    <div className="now-playing-display visible">
      {artworkSrc && (
        <img
          className="np-artwork"
          src={artworkSrc}
          alt=""
          onError={(e) => {
            e.currentTarget.removeAttribute('src');
          }}
        />
      )}
      <div className="now-playing-info">
        <div className="np-title">{content.title}</div>
        <div className="np-artist">{content.artist}</div>
        {content.sourceLabel && <div className="np-source">{content.sourceLabel}</div>}
      </div>
    </div>
  );
}
