import { useState, useEffect, useCallback } from 'react';
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
  const [nowPlayingStation, setNowPlayingStation] = useState(null);
  const [nowPlayingTitle, setNowPlayingTitle] = useState('–');
  const [isPlaying, setIsPlaying] = useState(false);

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
    setVolumeState(val);
    setVolume(val);
    localStorage.setItem('webradio_volume', val.toString());
  }, []);

  return {
    volume,
    nowPlayingStation,
    nowPlayingTitle,
    isPlaying,
    handlePlay,
    handleStop,
    handleVolumeChange
  };
}
