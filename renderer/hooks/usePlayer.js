import { useState, useEffect, useCallback, useRef } from 'react';
import { playStream, stopPlayer, setVolume } from '../services/playerService';

/**
 * Hook für den Player-Zustand: Wiedergabe, Stop, Lautstärke,
 * Metadaten-Listener und Media-Key-Integration.
 */
export function usePlayer() {
  const [volume, setVolumeState] = useState(() => {
    const saved = localStorage.getItem('webradio_volume');
    return saved !== null ? parseFloat(saved) : 1.0;
  });
  const [isMuted, setIsMuted] = useState(false);
  const [nowPlayingStation, setNowPlayingStation] = useState(null);
  const [nowPlayingTitle, setNowPlayingTitle] = useState('–');
  const [isPlaying, setIsPlaying] = useState(false);

  // Lautstärke vor Mute speichern
  const premuteVolume = useRef(null);

  // Metadaten-Listener (IPC aus dem Main-Prozess)
  // Einmalig beim Mount registrieren – nicht bei jedem Sender-Wechsel erneut!
  useEffect(() => {
    if (window.radioAPI?.onMetadata) {
      window.radioAPI.onMetadata((meta) => {
        if (meta.StreamTitle) {
          const display = meta.Artist && meta.Song
            ? `${meta.Artist} - ${meta.Song}`
            : meta.StreamTitle;
          setNowPlayingTitle(display);
        }
      });
    }
  }, []);

  // Medientasten: VolumeUp / VolumeDown / Mute (Linux + Windows)
  useEffect(() => {
    const STEP = 0.05;

    const onUp = () => {
      setVolumeState(prev => {
        const next = Math.min(1, parseFloat((prev + STEP).toFixed(2)));
        setVolume(next);
        localStorage.setItem('webradio_volume', next.toString());
        if (next > 0) setIsMuted(false);
        return next;
      });
    };

    const onDown = () => {
      setVolumeState(prev => {
        const next = Math.max(0, parseFloat((prev - STEP).toFixed(2)));
        setVolume(next);
        localStorage.setItem('webradio_volume', next.toString());
        if (next === 0) setIsMuted(true);
        return next;
      });
    };

    const onMute = () => {
      setVolumeState(prev => {
        if (prev > 0) {
          // Stumm schalten
          premuteVolume.current = prev;
          setVolume(0);
          setIsMuted(true);
          return 0;
        } else {
          // Wieder einschalten
          const restore = premuteVolume.current ?? 0.5;
          setVolume(restore);
          localStorage.setItem('webradio_volume', restore.toString());
          setIsMuted(false);
          return restore;
        }
      });
    };

    window.media?.onVolumeUp?.(onUp);
    window.media?.onVolumeDown?.(onDown);
    window.media?.onMute?.(onMute);

    // Cleanup beim Unmount
    return () => {
      // ipcRenderer-Listener werden über removeListener- Funktionen
      // im Preload bereinigt (jeweils als Rückgabewert der on*-Methoden).
    };
  }, []);

  const handlePlay = useCallback((url, station) => {
    if (!url) return;
    playStream(url, station);
    setNowPlayingStation(station);
    setNowPlayingTitle('Lädt stream...');
    setIsPlaying(true);

    // Track in history if api available
    if (window.pluginAPI?.addHistory) {
      window.pluginAPI.addHistory({
        name: station.name,
        url: url,
        favicon: station.favicon || station.logo
      }).catch(err => console.warn("History API not implemented in backend:", err));
    }
  }, []);

  const handleStop = useCallback(() => {
    stopPlayer();
    setIsPlaying(false);
    setNowPlayingTitle('–');
  }, []);

  const handleVolumeChange = useCallback((val) => {
    const clamped = Math.max(0, Math.min(1, val));
    setVolumeState(clamped);
    setVolume(clamped);
    setIsMuted(clamped === 0);
    localStorage.setItem('webradio_volume', clamped.toString());
  }, []);

  const handleMuteToggle = useCallback(() => {
    setVolumeState(prev => {
      if (prev > 0) {
        premuteVolume.current = prev;
        setVolume(0);
        setIsMuted(true);
        return 0;
      } else {
        const restore = premuteVolume.current ?? 0.5;
        setVolume(restore);
        localStorage.setItem('webradio_volume', restore.toString());
        setIsMuted(false);
        return restore;
      }
    });
  }, []);

  return {
    volume,
    isMuted,
    nowPlayingStation,
    nowPlayingTitle,
    isPlaying,
    handlePlay,
    handleStop,
    handleVolumeChange,
    handleMuteToggle
  };
}
