import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import StationGrid from './components/StationGrid.jsx';
import PlayerBar from './components/PlayerBar.jsx';
import PluginView from './ui/PluginView.jsx';
import PluginSlot from './ui/PluginSlot.jsx';
import { playStream, stopPlayer, setVolume } from './services/playerService';

export default function App() {
  const [currentView, setCurrentView] = useState('home');
  const [stations, setStations] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [country, setCountry] = useState('');
  const [genre, setGenre] = useState('');
  const [updateInfo, setUpdateInfo] = useState(null);

  const [volume, setVolumeState] = useState(() => {
    const saved = localStorage.getItem('webradio_volume');
    return saved !== null ? parseFloat(saved) : 1.0;
  });
  const [nowPlayingStation, setNowPlayingStation] = useState(null);
  const [nowPlayingTitle, setNowPlayingTitle] = useState('–');
  const [isPlaying, setIsPlaying] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [countries, setCountries] = useState([]);
  const [tags, setTags] = useState([]);

  const isFavorite = nowPlayingStation && favorites.some(f => f.url === (nowPlayingStation.url_resolved || nowPlayingStation.url));

  // Metadata Listener (IPC from Main Process)
  useEffect(() => {
    if (window.radioAPI?.onMetadata) {
      window.radioAPI.onMetadata((meta) => {
        //console.log("Metadaten empfangen:", meta);
        if (meta.StreamTitle) {
          const display = meta.Artist && meta.Song ? `${meta.Artist} - ${meta.Song}` : meta.StreamTitle;
          setNowPlayingTitle(display);
        }
      });
    }

    // Add Media Control Listeners
    if (window.media) {
      window.media.onStop(() => handleStop());
      // window.media.onPlayPause(() => ...)
    }
  }, [nowPlayingStation]);

  // Load initial popular stations, filters and favorites
  useEffect(() => {
    handleSearch('Top');
    if (window.api?.getFavorites) {
      window.api.getFavorites().then(res => setFavorites(res || []));
    }
    if (window.api?.getCountries) {
      window.api.getCountries().then(res => setCountries(res || []));
    }
    if (window.api?.getTags) {
      window.api.getTags().then(res => setTags(res || []));
    }
    if (window.updaterAPI?.onUpdateAvailable) {
      window.updaterAPI.onUpdateAvailable((info) => {
        setUpdateInfo(info);
      });
    }
  }, []);

  const handleSearch = async (overrideQuery) => {
    if (!window.api?.searchRadio) {
      console.warn("searchRadio API not found in window.api. Running in dev without electron?");
      return;
    }
    const useOverride = typeof overrideQuery === 'string';
    const q = useOverride ? overrideQuery : searchQuery;
    try {
      const results = await window.api.searchRadio({
        name: q || '',
        country: useOverride ? '' : country,
        genre: useOverride ? '' : genre,
      });
      setStations(results.slice(0, 50));
    } catch (err) {
      console.error("Fehler bei der Sendersuche:", err);
    }
  };

  const handlePlay = (url, station) => {
    if (!url) return;
    playStream(url);
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
  };

  const handlePlayCurrent = () => {
    if (nowPlayingStation) {
      handlePlay(nowPlayingStation.url_resolved || nowPlayingStation.url, nowPlayingStation);
    }
  };

  const handleStop = () => {
    stopPlayer();
    setIsPlaying(false);
    setNowPlayingTitle('–');
  };

  const handleVolumeChange = (val) => {
    setVolumeState(val);
    setVolume(val);
    localStorage.setItem('webradio_volume', val.toString());
  };

  const handleToggleFavorite = async (stationOverride) => {
    const stationToToggle = stationOverride || nowPlayingStation;
    if (!stationToToggle) return;

    const url = stationToToggle.url_resolved || stationToToggle.url;
    const isFav = favorites.some(f => f.url === url);

    if (isFav) {
      if (window.api?.removeFavorite) await window.api.removeFavorite(url);
      setFavorites(prev => prev.filter(f => f.url !== url));
    } else {
      const newFav = {
        name: stationToToggle.name,
        url: url,
        favicon: stationToToggle.favicon || stationToToggle.logo
      };
      if (window.api?.addFavorite) await window.api.addFavorite(newFav);
      setFavorites(prev => [...prev, newFav]);
    }
  };

  const handleWindowControl = (action) => {
    if (window.windowControls && window.windowControls[action]) {
      window.windowControls[action]();
    }
  };

  return (
    <>
      <div className="titlebar">
        <div className="titlebar-left">
          <div className="app-logo"></div>
          <span className="app-title">WebRadio</span>
          {updateInfo && (
            <button
              className="update-badge"
              onClick={() => window.api?.openSettings?.()}
              title={`Update verfügbar: v${updateInfo.version}`}
            >
              <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.93V15h-2v1.93A8 8 0 0 1 4.07 11H6V9H4.07A8 8 0 0 1 11 4.07V6h2V4.07A8 8 0 0 1 19.93 9H18v2h1.93A8 8 0 0 1 13 16.93z" />
              </svg>
              Update v{updateInfo.version}
            </button>
          )}
        </div>
        <div className="titlebar-right">
          <button className="window-btn" onClick={() => handleWindowControl('minimize')}>
            <svg viewBox="0 0 10 1"><rect width="10" height="1" /></svg>
          </button>
          <button className="window-btn" onClick={() => handleWindowControl('maximize')}>
            <svg viewBox="0 0 10 10"><rect x="1" y="1" width="8" height="8" fill="none" stroke="currentColor" /></svg>
          </button>
          <button className="window-btn close" onClick={() => handleWindowControl('close')}>
            <svg viewBox="0 0 10 10"><path d="M1 1 L9 9 M9 1 L1 9" stroke="currentColor" /></svg>
          </button>
        </div>
      </div>

      <div id="main-container">
        <Sidebar
          currentView={currentView}
          setCurrentView={setCurrentView}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          country={country}
          setCountry={setCountry}
          genre={genre}
          setGenre={setGenre}
          countries={countries}
          tags={tags}
          onSearch={handleSearch}
          onLoadFavorites={() => {
            setStations(favorites);
          }}
          onLoadHistory={() => {
            if (window.pluginAPI?.getHistory) {
              window.pluginAPI.getHistory().then(res => setStations(res));
            }
          }}
        />

        <main className="content">
          {currentView === 'home' ? (
            <>
              <div className="content-header">
                <h1>Entdecken</h1>
              </div>
              <StationGrid
                stations={stations}
                favorites={favorites}
                onPlay={handlePlay}
                onToggleFavorite={handleToggleFavorite}
              />
            </>
          ) : (
            <PluginView viewId={currentView} />
          )}
        </main>
      </div>

      <PluginSlot id="app-overlay" />

      <PlayerBar
        station={nowPlayingStation}
        title={nowPlayingTitle}
        volume={volume}
        onVolumeChange={handleVolumeChange}
        onPlay={handlePlayCurrent}
        onStop={handleStop}
        isPlaying={isPlaying}
        isFavorite={isFavorite}
        onToggleFavorite={handleToggleFavorite}
      />
    </>
  );
}