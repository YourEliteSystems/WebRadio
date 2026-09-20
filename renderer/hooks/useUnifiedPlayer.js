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

  // Einmalig beim Mount: aktuellen State laden und Subscription aufbauen
  useEffect(() => {
    if (!window.playerAPI) return;

    // Sofortiger State-Abruf
    window.playerAPI.getState().then((state) => {
      if (state) setPlayerState(state);
    }).catch(() => {/* PluginAPI evtl. nicht verfügbar */});

    // State-Subscription (gibt Unsubscribe zurück → sauberes Cleanup)
    const unsubscribe = window.playerAPI.onStateChanged((state) => {
      if (state) setPlayerState(state);
    });

    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
    };
  }, []);

  // ─── Controls ───────────────────────────────────────────
  const play      = useCallback(() => window.playerAPI?.play(),        []);
  const pause     = useCallback(() => window.playerAPI?.pause(),       []);
  const stop      = useCallback(() => window.playerAPI?.stop(),        []);
  const toggle    = useCallback(() => window.playerAPI?.toggle(),      []);
  const setVolume = useCallback((v) => window.playerAPI?.setVolume(v), []);

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
