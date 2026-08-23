import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar.jsx';
import StationGrid from './components/StationGrid.jsx';
import PlayerBar from './components/PlayerBar.jsx';
import PluginView from './ui/PluginView.jsx';
import PluginSlot from './ui/PluginSlot.jsx';
import { useRadioSearch } from './hooks/useRadioSearch';
import { usePlayer } from './hooks/usePlayer';
import { useFavorites } from './hooks/useFavorites';
import { useUpdateInfo } from './hooks/useUpdateInfo';

export default function App() {
  const [currentView, setCurrentView] = useState('home');

  const {
    stations, setStations,
    searchQuery, setSearchQuery,
    country, setCountry,
    genre, setGenre,
    countries, tags,
    search
  } = useRadioSearch();

  const {
    volume,
    nowPlayingStation,
    nowPlayingTitle,
    isPlaying,
    handlePlay,
    handleStop,
    handleVolumeChange
  } = usePlayer();

  const { favorites, toggleFavorite } = useFavorites();
  const updateInfo = useUpdateInfo();

  const isFavorite = nowPlayingStation && favorites.some(f => f.url === (nowPlayingStation.url_resolved || nowPlayingStation.url));

  // Media Control Listeners – nur einmalig registrieren
  useEffect(() => {
    if (window.media) {
      window.media.onStop(() => handleStop());
      // window.media.onPlayPause(() => ...)
    }
  }, [handleStop]);

  // Load initial popular stations
  useEffect(() => {
    search('Top');
  }, [search]);

  const handlePlayCurrent = () => {
    if (nowPlayingStation) {
      handlePlay(nowPlayingStation.url_resolved || nowPlayingStation.url, nowPlayingStation);
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
          onSearch={search}
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
                onToggleFavorite={(station) => toggleFavorite(station, nowPlayingStation)}
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
        onToggleFavorite={() => toggleFavorite(null, nowPlayingStation)}
      />
    </>
  );
}