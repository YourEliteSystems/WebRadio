import React, { useState, useEffect, useRef, useMemo } from 'react';
import Sidebar from './components/Sidebar.jsx';
import StationGrid from './components/StationGrid.jsx';
import PlayerBar from './components/PlayerBar.jsx';
import NowPlayingDisplay from './components/player/NowPlayingDisplay.jsx';
import PluginView from './ui/PluginView.jsx';
import PluginSlot from './ui/PluginSlot.jsx';
import { useRadioSearch } from './hooks/useRadioSearch';
import { usePlayer } from './hooks/usePlayer';
import { useFavorites } from './hooks/useFavorites';
import { useUpdateInfo } from './hooks/useUpdateInfo';
import { subscribe as subscribeNav, getNavigationTree } from './ui/navigationRegistry';

export default function App() {
  const [currentView, setCurrentView] = useState('home');

  // Ensure currentView always points to a valid navigation item.
  // Navigation is loaded async (syncWithMain in RendererPluginManager),
  // so on first render topLevelItems may be empty. This effect validates
  // currentView once navigation is available and falls back to the first
  // item if currentView doesn't match any registered item.
  const currentViewRef = useRef(currentView);
  useEffect(() => {
    currentViewRef.current = currentView;
  }, [currentView]);

  useEffect(() => {
    const validateCurrentView = () => {
      const tree = getNavigationTree();
      if (!tree.topLevelItems || tree.topLevelItems.length === 0) return;

      const current = currentViewRef.current;
      const isValid = tree.topLevelItems.some(
        item => item.id === current || item.route === current || (current === 'home' && (item.id === 'home' || item.id === 'radio' || item.route === 'home'))
      );
      if (!isValid) {
        const firstItem = tree.topLevelItems[0];
        setCurrentView(firstItem.route || firstItem.id);
      }
    };

    validateCurrentView();
    const unsub = subscribeNav(validateCurrentView);
    return unsub;
  }, []);

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
    isMuted,
    nowPlayingStation,
    nowPlayingTitle,
    isPlaying,
    handlePlay,
    handleStop,
    handleVolumeChange,
    handleMuteToggle
  } = usePlayer();

  const { favorites, toggleFavorite } = useFavorites();
  const { updateInfo, version, isPrerelease, channel, versionChannel } = useUpdateInfo();

  const [channelsMeta, setChannelsMeta] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function loadChannelMeta() {
      try {
        if (window.updatesAPI?.getAllChannelMetadata) {
          const res = await window.updatesAPI.getAllChannelMetadata();
          if (mounted && res?.ok && Array.isArray(res.channels)) {
            setChannelsMeta(res.channels);
          }
        }
      } catch (err) {
        /* bewusst still */
      }
    }

    loadChannelMeta();

    return () => {
      mounted = false;
    };
  }, []);

  // Channel-Metadaten werden zentral aus ChannelMetadata (Core) bezogen.
  // Aktiver Update-Channel (steuert Update-Badge) und Channel der
  // installierten Version (steuert den Versions-Stempel) bleiben getrennt,
  // damit ein Kanal-Wechsel die laufende Build-Version nicht umdeutet.
  const channelMeta = useMemo(
    () => channelsMeta.find((m) => m.id === channel) || null,
    [channelsMeta, channel]
  );

  const versionChannelMeta = useMemo(
    () => channelsMeta.find((m) => m.id === (versionChannel || channel)) || null,
    [channelsMeta, versionChannel, channel]
  );

  const isFavorite = nowPlayingStation && favorites.some(f => f.url === (nowPlayingStation.url_resolved || nowPlayingStation.url));

  // Media Control Listeners – nur einmalig registrieren
  // Der Medientasten-/Tray-Stop stoppt IMMER den aktiven Provider.
  // Bei aktivem MediaHub wird ausschließlich die Unified Player API bedient
  // (YouTube), der Radio-Provider wird nicht zusätzlich gestoppt.
  useEffect(() => {
    if (!window.media || !window.media.onStop) return;

    const unsub = window.media.onStop(() => {
      if (!window.playerAPI || !window.playerAPI.stop) {
        handleStop();
        return;
      }

      window.playerAPI.getState()
        .catch(() => null)
        .then((state) => {
          const radioActive = !state || !state.source || state.source.id === 'radio';
          if (radioActive) {
            // Radio-Pfad: Legacy-Aufruf räumt zusätzlich die lokale
            // Audioschiene (Buffer, AudioContext) auf.
            handleStop();
            return;
          }
          // MediaHub-Pfad: nur den aktiven (YouTube-) Provider stoppen.
          return window.playerAPI.stop()
            .catch((err) => console.warn('Media-Stop fehlgeschlagen:', err));
        });
    });

    return () => {
      if (typeof unsub === 'function') unsub();
    };
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
          <img className="app-logo" src="../assets/icons/tray.png" alt="WebRadio" />
          <span className="app-title">WebRadio</span>
          {version && (
            <span
              className={`app-version ${versionChannelMeta?.id || (isPrerelease ? 'beta' : '')}`}
              style={{ '--update-channel-color': versionChannelMeta?.color }}
              title={`WebRadio ${version} – ${versionChannelMeta?.label ?? (isPrerelease ? 'Beta' : 'Stable')}-Build`}
            >
              v{version}
              {isPrerelease && <span className="app-version-badge">{versionChannelMeta?.shortLabel ?? (isPrerelease ? 'BETA' : '')}</span>}
            </span>
          )}
          {updateInfo && (
            <button
              className={`update-badge ${channelMeta?.id || 'stable'}`}
              onClick={() => window.api?.openSettings?.()}
              style={{ '--update-channel-color': channelMeta?.color }}
              title={`Update verfügbar: v${updateInfo.version} (${channelMeta?.label ?? 'Stable'})`}
            >
              {channelMeta?.icon ?? (
                <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
                  <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.93V15h-2v1.93A8 8 0 0 1 4.07 11H6V9H4.07A8 8 0 0 1 11 4.07V6h2V4.07A8 8 0 0 1 19.93 9H18v2h1.93A8 8 0 0 1 13 16.93z" />
                </svg>
              )}
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

      <NowPlayingDisplay />

      <PlayerBar
        station={nowPlayingStation}
        title={nowPlayingTitle}
        volume={volume}
        isMuted={isMuted}
        onVolumeChange={handleVolumeChange}
        onMuteToggle={handleMuteToggle}
        onPlay={handlePlayCurrent}
        onStop={handleStop}
        isPlaying={isPlaying}
        isFavorite={isFavorite}
        onToggleFavorite={() => toggleFavorite(null, nowPlayingStation)}
      />
    </>
  );
}