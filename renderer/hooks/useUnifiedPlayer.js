import { useState, useEffect, useCallback } from 'react';

/**
 * useUnifiedPlayer – React Hook für die Unified Player API.
 *
 * Abonniert window.playerAPI.onStateChanged() und stellt den Player-State
 * als React-State bereit. Alle Controls leiten an window.playerAPI weiter.
 *
 * Kein MediaHub-, YouTube- oder Radio-spezifischer Code hier.
 * Die PlayerBar und andere Komponenten dürfen ausschließlich diesen Hook
 * oder window.playerAPI direkt nutzen.
 */
export function useUnifiedPlayer() {
  const [playerState, setPlayerState] = useState({
    state:   'idle',
    title:   null,
    artist:  null,
    artwork: null,
    volume:  1.0,
    source:  null
  });

  const [apiAvailable, setApiAvailable] = useState(false);

  // Einmalig beim Mount: aktuellen State laden und Subscription aufbauen
  useEffect(() => {
    if (!window.playerAPI) {
      setApiAvailable(false);
      return;
    }

    setApiAvailable(true);

    // Sofortiger State-Abruf mit Error-Handling
    window.playerAPI.getState().then((state) => {
      if (state) setPlayerState(state);
    }).catch((err) => {
      console.error('[useUnifiedPlayer] Failed to get initial state:', err);
      // Fallback-State setzen
      setPlayerState({
        state: 'idle',
        title: null,
        artist: null,
        artwork: null,
        volume: 1.0,
        source: null
      });
    });

    // State-Subscription (gibt Unsubscribe zurück → sauberes Cleanup)
    const unsubscribe = window.playerAPI.onStateChanged((state) => {
      if (state) setPlayerState(state);
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // ─── Controls ───────────────────────────────────────────
  const play = useCallback(() => {
    if (window.playerAPI?.play) {
      window.playerAPI.play().catch(err => {
        console.error('[useUnifiedPlayer] Play failed:', err);
      });
    }
  }, []);

  const pause = useCallback(() => {
    if (window.playerAPI?.pause) {
      window.playerAPI.pause().catch(err => {
        console.error('[useUnifiedPlayer] Pause failed:', err);
      });
    }
  }, []);

  const stop = useCallback(() => {
    if (window.playerAPI?.stop) {
      window.playerAPI.stop().catch(err => {
        console.error('[useUnifiedPlayer] Stop failed:', err);
      });
    }
  }, []);

  const toggle = useCallback(() => {
    if (window.playerAPI?.toggle) {
      window.playerAPI.toggle().catch(err => {
        console.error('[useUnifiedPlayer] Toggle failed:', err);
      });
    }
  }, []);

  const setVolume = useCallback((v) => {
    if (window.playerAPI?.setVolume) {
      window.playerAPI.setVolume(v).catch(err => {
        console.error('[useUnifiedPlayer] SetVolume failed:', err);
      });
    }
  }, []);

  // ─── Computed Helpers ────────────────────────────────────

  /** Ist ein Provider aktiv und spielt? */
  const isPlaying = playerState.state === 'playing';

  /** Ist ein Provider aktiv (loading oder playing)? */
  const isActive  = playerState.state === 'playing' || playerState.state === 'loading';

  /**
   * Source-Label für die Anzeige, z.B.:
   *   "MediaHub · YouTube"
   *   "Radio"
   */
  const sourceLabel = (() => {
    const { source } = playerState;
    if (!source) return null;
    if (source.provider && source.provider !== source.name) {
      return `${source.name} · ${source.provider}`;
    }
    return source.name || null;
  })();

  return {
    // Full state object
    playerState,
    
    // API availability
    apiAvailable,

    // Convenience flags
    isPlaying,
    isActive,

    // Display helpers
    sourceLabel,

    // Controls
    play,
    pause,
    stop,
    toggle,
    setVolume
  };
}
