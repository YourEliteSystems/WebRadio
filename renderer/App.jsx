import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
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
import InlineSvg from './components/InlineSvg.jsx';

// Fallback-Icon für das Update-Badge, solange die Channel-Metadaten über IPC
// noch nicht verfügbar sind. Entspricht dem Beta-Icon aus ChannelMetadata,
// damit Badge und Einstellungs-Ansicht nie unterschiedliche Symbole zeigen.
const FALLBACK_CHANNEL_ICON =
  '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm1 14.93V15h-2v1.93A8 8 0 0 1 4.07 11H6V9H4.07A8 8 0 0 1 11 4.07V6h2V4.07A8 8 0 0 1 19.93 9H18v2h1.93A8 8 0 0 1 13 16.93z"/></svg>';

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

  const handlePlayCurrent = useCallback(() => {
    if (nowPlayingStation) {
      handlePlay(nowPlayingStation.url_resolved || nowPlayingStation.url, nowPlayingStation);
    }
  }, [handlePlay, nowPlayingStation]);

  const mediaActionBusy = useRef(false);
  const runSystemMediaAction = useCallback(async (action) => {
    if (mediaActionBusy.current || !window.playerAPI) return;
    mediaActionBusy.current = true;
    try {
      const state = await window.playerAPI.getState();
      const radioActive = state?.source?.type === 'radio' || state?.source?.id === 'radio';
      if (action === 'toggle') {
        if (radioActive && state.state === 'playing') {
          await handleStop();
        } else if (radioActive && state.state === 'loading') {
          return;
        } else if (radioActive && (state.state === 'stopped' || state.state === 'error')) {
          handlePlayCurrent();
        } else {
          await window.playerAPI.toggle();
        }
        return;
      }
      if (action === 'play' || action === 'pause') {
        if (radioActive && action === 'pause') {
          if (state.state === 'playing' || state.state === 'loading') await handleStop();
          return;
        }
        if (radioActive && action === 'play') {
          if (state.state === 'loading' || state.state === 'playing') return;
          handlePlayCurrent();
          return;
        }
        if (!radioActive) {
          await window.playerAPI.requestMediaAction(action);
          return;
        }
      }
      if (action === 'stop') {
        if (radioActive) await handleStop();
        else await window.playerAPI.stop();
        return;
      }
      if ((action === 'next' || action === 'previous') && radioActive) {
        const currentUrl = state.source?.url || nowPlayingStation?.url_resolved || nowPlayingStation?.url;
        const index = stations.findIndex((candidate) => {
          const url = candidate.url_resolved || candidate.url;
          try { return new URL(url).href === new URL(currentUrl).href; } catch { return url === currentUrl; }
        });
        if (stations.length < 2 || index < 0) return;
        const direction = action === 'next' ? 1 : -1;
        const candidate = stations[(index + direction + stations.length) % stations.length];
        handlePlay(candidate.url_resolved || candidate.url, candidate);
        return;
      }
      if (radioActive && action === 'pause') await handleStop();
      else if (radioActive && action === 'play') handlePlayCurrent();
      else if (action === 'pause') await window.playerAPI.pause();
      else if (action === 'play') await window.playerAPI.play();
    } catch (err) {
      console.warn(`System-Medienaktion '${action}' fehlgeschlagen:`, err);
    } finally {
      mediaActionBusy.current = false;
    }
  }, [handleStop, handlePlayCurrent, handlePlay, nowPlayingStation, stations]);

  // System-Medienaktionen laufen durch dieselbe Player-API/Audio-Engine.
  useEffect(() => {
    if (!window.media || !window.playerAPI) return;
    const unsubscribers = [
      window.media.onPlayPause?.(() => runSystemMediaAction('toggle')),
      window.media.onStop?.(() => runSystemMediaAction('stop')),
      window.media.onNext?.(() => runSystemMediaAction('next')),
      window.media.onPrevious?.(() => runSystemMediaAction('previous'))
    ].filter((unsubscribe) => typeof unsubscribe === 'function');

    return () => unsubscribers.forEach((unsubscribe) => unsubscribe());
  }, [runSystemMediaAction]);

  // Chromium veröffentlicht Metadaten und Remote-Aktionen über navigator.mediaSession.
  // Das Betriebssystem kann je nach Plattform/Umgebung nur einen Teil davon anzeigen.
  useEffect(() => {
    const session = typeof navigator !== 'undefined' ? navigator.mediaSession : null;
    if (!session || !window.playerAPI) return;

    let updateSequence = 0;
    const updateSession = async (state) => {
      const sequence = ++updateSequence;
      let mediaState = state;
      try {
        const authoritativeMediaState = await window.playerAPI.getMediaState();
        if (authoritativeMediaState) mediaState = authoritativeMediaState;
      } catch { /* optional media metadata query */ }
      if (sequence !== updateSequence) return;
      const hasMedia = Boolean(mediaState?.source && mediaState.state !== 'idle');
      try {
        session.metadata = hasMedia && typeof window.MediaMetadata === 'function'
          ? new window.MediaMetadata({
              title: mediaState.source?.name || mediaState.title || mediaState.provider?.name || 'WebRadio',
              artist: mediaState.artist || 'WebRadio',
              album: mediaState.provider?.name || 'WebRadio',
              artwork: mediaState.artwork ? [{ src: mediaState.artwork }] : []
            })
          : null;
        session.playbackState = mediaState?.state === 'playing'
          ? 'playing'
          : mediaState?.state === 'paused' ? 'paused' : 'none';
      } catch (err) {
        console.warn('Media-Session-Metadaten konnten nicht aktualisiert werden:', err);
      }

      let capabilities = null;
      try { capabilities = await window.playerAPI.getMediaCapabilities(); } catch { /* optional API */ }
      if (sequence !== updateSequence) return;
      // IPC-State-Pushes lassen die private Stream-URL bewusst weg; die sichtbare
      // Senderauswahl ist die autoritative Navigation für Radio.
      const currentRadioUrl = mediaState?.source?.url || nowPlayingStation?.url_resolved || nowPlayingStation?.url;
      const stationIndex = stations.findIndex((station) => {
        const url = station.url_resolved || station.url;
        try { return new URL(url).href === new URL(currentRadioUrl).href; } catch { return url === currentRadioUrl; }
      });
      const radioNavigationAvailable = mediaState?.source?.type === 'radio' && stations.length > 1 && stationIndex >= 0;
      capabilities = {
        ...capabilities,
        actions: {
          ...capabilities?.actions,
          next: Boolean(radioNavigationAvailable),
          previous: Boolean(radioNavigationAvailable)
        }
      };
      const handlers = {
        play: 'play',
        pause: 'pause',
        nexttrack: 'next',
        previoustrack: 'previous'
      };
      for (const [mediaAction, action] of Object.entries(handlers)) {
        try {
          const actionReady = action === 'play'
            ? ['stopped', 'paused', 'error'].includes(mediaState.state)
            : action === 'pause' ? ['playing', 'loading'].includes(mediaState.state) : true;
          const isSupported = hasMedia && actionReady && capabilities?.actions?.[action];
          session.setActionHandler(mediaAction, isSupported ? () => runSystemMediaAction(action) : null);
        } catch {
          // Browser/Electron build or OS does not expose this action.
        }
      }
    };

    const unsubscribe = window.playerAPI.onStateChanged(updateSession);
    window.playerAPI.getState().then(updateSession).catch(() => {});
    return () => {
      if (typeof unsubscribe === 'function') unsubscribe();
      for (const action of ['play', 'pause', 'nexttrack', 'previoustrack']) {
        try { session.setActionHandler(action, null); } catch { /* unsupported action */ }
      }
      updateSequence++;
      try { session.metadata = null; session.playbackState = 'none'; } catch { /* shutdown */ }
    };
  }, [runSystemMediaAction, stations]);

  // Load initial popular stations
  useEffect(() => {
    search('Top');
  }, [search]);

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
              {/* Kanal-Icon: SVG-String aus den Core-Metadaten, muss als
                  Inline-SVG gerendert werden (React würde den String sonst als
                  Text ausgeben). */}
              <InlineSvg
                className="update-badge-icon"
                markup={channelMeta?.icon || FALLBACK_CHANNEL_ICON}
              />
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