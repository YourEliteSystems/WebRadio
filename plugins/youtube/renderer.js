// YouTube Integration Plugin - Renderer Script
// Lädt im Renderer-Prozess und stellt UI-Komponenten bereit

(function() {
  'use strict';

  // YouTube IFrame API laden
  let ytPlayer = null;
  let ytReady = false;
  let currentVideoId = null;
  let playerState = 'unstarted';

  // Punkte, an denen ein Befehl noch nicht verarbeitet wurde (per commandId).
  // Defer Kommandos, bis das IFrame vollständig initialisiert ist.
  let pendingCommands = [];

  // YouTube IFrame API Callback
  window.onYouTubeIframeAPIReady = function() {
    ytReady = true;
    console.log('[YouTube Plugin] YouTube IFrame API ready');

    // Verarbeitet alle gesammelten Befehle in der Reihenfolge
    while (pendingCommands.length > 0) {
      const cmd = pendingCommands.shift();
      processCommand(cmd);
    }
  };

  // YouTube API Script laden
  const tag = document.createElement('script');
  tag.src = 'https://www.youtube.com/iframe_api';
  const firstScriptTag = document.getElementsByTagName('script')[0];
  firstScriptTag.parentNode.insertBefore(tag, firstScriptTag);

  // Client-ID für den IFrame-Player
  function createYouTubePlayer(containerId, videoId, options = {}) {
    if (!ytReady) {
      console.warn('[YouTube Plugin] YouTube API not ready yet');
      return null;
    }

    if (ytPlayer) {
      ytPlayer.destroy();
    }

    const playerOptions = {
      videoId: videoId,
      playerVars: {
        autoplay: options.autoplay ? 1 : 0,
        controls: options.controls !== false ? 1 : 0,
        disablekb: options.disablekb ? 1 : 0,
        fs: options.fs !== false ? 1 : 0,
        modestbranding: options.modestbranding ? 1 : 0,
        rel: options.rel !== false ? 1 : 0,
        showinfo: options.showinfo ? 1 : 0
      },
      events: {
        'onReady': onPlayerReady,
        'onStateChange': onPlayerStateChange,
        'onError': onPlayerError
      }
    };

    ytPlayer = new YT.Player(containerId, playerOptions);
    currentVideoId = videoId;
    return ytPlayer;
  }

  function onPlayerReady(event) {
    console.log('[YouTube Plugin] Player ready');
    playerState = 'ready';

    // Video-Metadaten abrufen und melden
    if (ytPlayer && ytPlayer.getVideoData && window.playerAPI) {
      const videoData = ytPlayer.getVideoData();
      if (videoData && videoData.title) {
        window.playerAPI.reportProviderState('mediahub', {
          title: videoData.title,
          artwork: `https://img.youtube.com/vi/${videoData.video_id}/mqdefault.jpg`
        });
      }
    }
  }

  function onPlayerStateChange(event) {
    playerState = getStateName(event.data);
    console.log('[YouTube Plugin] Player state:', playerState);

    // Events an WebRadio weiterleiten
    if (window.pluginAPI) {
      if (event.data === YT.PlayerState.PLAYING) {
        window.pluginAPI.log('info', 'YouTubePlugin', 'Video playing');
      } else if (event.data === YT.PlayerState.PAUSED) {
        window.pluginAPI.log('info', 'YouTubePlugin', 'Video paused');
      } else if (event.data === YT.PlayerState.ENDED) {
        window.pluginAPI.log('info', 'YouTubePlugin', 'Video ended');
      }
    }

    // Unified Player API State melden
    if (window.playerAPI) {
      const unifiedState = mapYouTubeStateToUnified(event.data);
      if (unifiedState) {
        window.playerAPI.reportProviderState('mediahub', unifiedState);
      }
    }
  }

  function onPlayerError(event) {
    console.error('[YouTube Plugin] Player error:', event.data);
    if (window.pluginAPI) {
      window.pluginAPI.log('error', 'YouTubePlugin', `Player error: ${event.data}`);
    }
    if (window.playerAPI) {
      window.playerAPI.reportProviderState('mediahub', { state: 'error', error: event.data });
    }
  }

  function mapYouTubeStateToUnified(ytState) {
    switch(ytState) {
      case YT.PlayerState.PLAYING:
        return { state: 'playing' };
      case YT.PlayerState.PAUSED:
        return { state: 'paused' };
      case YT.PlayerState.BUFFERING:
        return { state: 'loading' };
      case YT.PlayerState.ENDED:
        return { state: 'stopped' };
      case YT.PlayerState.UNSTARTED:
      case YT.PlayerState.CUED:
        return { state: 'idle' };
      default:
        return null;
    }
  }

  function getStateName(state) {
    switch(state) {
      case YT.PlayerState.UNSTARTED: return 'unstarted';
      case YT.PlayerState.ENDED: return 'ended';
      case YT.PlayerState.PLAYING: return 'playing';
      case YT.PlayerState.PAUSED: return 'paused';
      case YT.PlayerState.BUFFERING: return 'buffering';
      case YT.PlayerState.CUED: return 'cued';
      default: return 'unknown';
    }
  }

  // ─── Main-to-Renderer-Kommandos empfangen ────────────────────────────────────
  // Der Main-Prozess sendet Kommandos via window.electronAPI (preload).
  // Da dieser Code im Renderer läuft, verwenden wir window.require('electron')
  // (durch preload.js via contextBridge bereitgestellt) oder directly
  // den IPC-Channel, den die App offenbart.
  function listenToCommands() {
    if (window._mediahubCommandHandler) return;

    window._mediahubCommandHandler = (message) => {
      if (!message || !message.channel) {
        console.warn('[YouTube Plugin] mediahub:command ohne Channel:', message);
        return;
      }

      // Verarbeite Befehle in der empfangenen Reihenfolge
      processCommand(message);
    };

    // electronAPI wird durch preload.js (contextBridge) bereitgestellt
    if (window.electronAPI && typeof window.electronAPI.on !== 'function') {
      // Fallback: Fenster-Ereignis oder direktes IPC-Interface prüfen
      if (window.ipcRenderer && window.ipcRenderer.on) {
        window.ipcRenderer.on('mediahub:command', (_event, message) => {
          window._mediahubCommandHandler(message);
        });
      }
    }
  }

  // ─── Kommando-Verarbeitung (inkl. Queue, bis IFrame bereit) ────────────────
  function processCommand(message) {
    if (!message || !message.channel) return;

    // Nanoseconds / Timestamp-Sicherheit: kein Kommandoverfalls ignorieren
    if (message.timestamp && Date.now() - message.timestamp > 30000) {
      console.warn(`[YouTube Plugin] Veraltetes Kommand ${message.channel}`);
      return;
    }

    switch (message.channel) {
      case 'player:command:play': {
        if (message.commandId === undefined) {
          console.warn('[YouTube Plugin] play ohne commandId');
          return;
        }

        const videoId = message.videoId || currentVideoId;
        if (!videoId) {
          // Keine Video-ID; Befehl als pending
          pendingCommands.push(message);
          return;
        }

        if (!ytReady) {
          // IFrame noch nicht bereit → pending
          pendingCommands.push(message);
          return;
        }

        if (!ytPlayer) {
          // Kein Player erstellt; initialisiere zuerst
          pendingCommands.push(message);
          return;
        }

        // Doppelte Player-Instanzen verhindern
        if (ytPlayer && ytPlayer.destroyed) {
          ytPlayer = null;
        }

        if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
          ytPlayer.playVideo();
        } else if (ytPlayer && typeof ytPlayer.cueVideoById === 'function') {
          ytPlayer.cueVideoById(videoId);
        } else {
          console.warn('[YouTube Plugin] YouTube Player nicht initialisiert');
        }

        // Status-Meldung an Main senden
        if (window.playerAPI) {
          window.playerAPI.reportProviderState('mediahub', { state: 'playing' });
        }
        break;
      }
      case 'player:command:pause': {
        if (message.commandId === undefined) {
          console.warn('[YouTube Plugin] pause ohne commandId');
          return;
        }
        if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
          ytPlayer.pauseVideo();
        }
        if (window.playerAPI) {
          window.playerAPI.reportProviderState('mediahub', { state: 'paused' });
        }
        break;
      }
      case 'player:command:stop': {
        if (message.commandId === undefined) {
          console.warn('[YouTube Plugin] stop ohne commandId');
          return;
        }
        if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
          ytPlayer.stopVideo();
        }
        // Session nicht zerstören, sondern nur beenden (bestehendes Player-Verhalten)
        if (window.playerAPI) {
          window.playerAPI.reportProviderState('mediahub', { state: 'stopped' });
        }
        break;
      }
      case 'player:command:setVolume': {
        if (message.commandId === undefined) {
          console.warn('[YouTube Plugin] setVolume ohne commandId');
          return;
        }
        const volume = Math.max(0, Math.min(1, Number(message.volume) || 0));
        if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
          ytPlayer.setVolume(volume * 100);
        }
        if (window.playerAPI) {
          window.playerAPI.reportProviderState('mediahub', { state: 'volume-changed', volume });
        }
        break;
      }
      default:
        console.warn(`[YouTube Plugin] Unbekanntes Kommand ${message.channel}`);
    }
  }

  // Player-Steuerungsfunktionen
  function playVideo() {
    if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
      ytPlayer.playVideo();

      // Unified Player API State melden
      if (window.playerAPI) {
        window.playerAPI.reportProviderState('mediahub', { state: 'playing' });
      }
    }
  }

  function pauseVideo() {
    if (ytPlayer && typeof ytPlayer.pauseVideo === 'function') {
      ytPlayer.pauseVideo();

      // Unified Player API State melden
      if (window.playerAPI) {
        window.playerAPI.reportProviderState('mediahub', { state: 'paused' });
      }
    }
  }

  function stopVideo() {
    if (ytPlayer && typeof ytPlayer.stopVideo === 'function') {
      ytPlayer.stopVideo();

      // Unified Player API State melden
      if (window.playerAPI) {
        window.playerAPI.reportProviderState('mediahub', { state: 'stopped' });
      }
    }
  }

  function setVolume(volume) {
    const clamped = Math.max(0, Math.min(1, Number(volume) || 0));
    if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
      ytPlayer.setVolume(clamped * 100);
    }
  }

  function seekTo(seconds, allowSeekAhead = true) {
    if (ytPlayer && typeof ytPlayer.seekTo === 'function') {
      ytPlayer.seekTo(seconds, allowSeekAhead);
    }
  }

  function getPlayerState() {
    return playerState;
  }

  function getCurrentTime() {
    if (ytPlayer && typeof ytPlayer.getCurrentTime === 'function') {
      return ytPlayer.getCurrentTime();
    }
    return 0;
  }

  function getDuration() {
    if (ytPlayer && typeof ytPlayer.getDuration === 'function') {
      return ytPlayer.getDuration();
    }
    return 0;
  }

  // YouTube Video ID aus URL extrahieren
  function extractVideoId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\\w\/|embed\/|watch\?v=|\&v=)([^#\&\\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  // YouTube-Suche (über oEmbed für Metadaten)
  async function getVideoInfo(videoId) {
    try {
      const response = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
      if (response.ok) {
        return await response.json();
      }
    } catch (error) {
      console.error('[YouTube Plugin] Error fetching video info:', error);
    }
    return null;
  }

  // Plugin-API global verfügbar machen
  window.youtubePlugin = {
    initPlayer,
    playVideo,
    pauseVideo,
    stopVideo,
    setVolume,
    seekTo,
    getPlayerState,
    getCurrentTime,
    getDuration,
    extractVideoId,
    getVideoInfo,
    isReady: () => ytReady,
    getCurrentVideoId: () => currentVideoId
  };

  console.log('[YouTube Plugin] Renderer script loaded');

  // React-Komponente für YouTube-Suche und Player
  function createYouTubeComponent() {
    const container = document.createElement('div');
    container.className = 'youtube-plugin-container';

    container.innerHTML = `
      <style>
        .youtube-plugin-container {
          display: flex;
          flex-direction: column;
          height: 100%;
          gap: 16px;
        }
        .youtube-search-bar {
          display: flex;
          gap: 8px;
          margin-bottom: 16px;
        }
        .youtube-search-input {
          flex: 1;
          padding: 10px 14px;
          border-radius: 8px;
          border: 1px solid rgba(255,255,255,0.1);
          background: rgba(0,0,0,0.2);
          color: var(--text-main);
          font-size: 14px;
        }
        .youtube-search-input:focus {
          outline: none;
          border-color: var(--accent-color);
        }
        .youtube-search-btn {
          padding: 10px 20px;
          background: var(--accent-color);
          border: none;
          border-radius: 8px;
          color: white;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
        }
        .youtube-search-btn:hover {
          background: var(--accent-hover);
        }
        .youtube-player-container {
          flex: 1;
          background: rgba(0,0,0,0.3);
          border-radius: 12px;
          overflow: hidden;
          position: relative;
        }
        .youtube-player-wrapper {
          position: relative;
          padding-bottom: 56.25%;
          height: 0;
        }
        .youtube-player-wrapper iframe {
          position: absolute;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
        }
        .youtube-placeholder {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100%;
          color: var(--text-muted);
          font-size: 14px;
        }
        .youtube-controls {
          display: flex;
          gap: 8px;
          padding: 12px;
          background: rgba(0,0,0,0.2);
          border-radius: 8px;
        }
        .youtube-control-btn {
          padding: 8px 16px;
          background: rgba(255,255,255,0.05);
          border: 1px solid rgba(255,255,255,0.1);
          border-radius: 6px;
          color: var(--text-main);
          font-size: 13px;
          cursor: pointer;
        }
        .youtube-control-btn:hover {
          background: rgba(255,255,255,0.1);
        }
      </style>

      <div class="youtube-search-bar">
        <input type="text" class="youtube-search-input" id="yt-search-input" placeholder="YouTube URL oder Video ID eingeben...">
        <button class="youtube-search-btn" id="yt-load-btn">Laden</button>
      </div>

      <div class="youtube-player-container" id="yt-player-container">
        <div class="youtube-placeholder">
          Video URL oder ID eingeben um zu starten
        </div>
      </div>

      <div class="youtube-controls">
        <button class="youtube-control-btn" id="yt-play-btn">▶ Play</button>
        <button class="youtube-control-btn" id="yt-pause-btn">⏸ Pause</button>
        <button class="youtube-control-btn" id="yt-stop-btn">⏹ Stop</button>
      </div>
    `;

    // Event Handler
    const searchInput = container.querySelector('#yt-search-input');
    const loadBtn = container.querySelector('#yt-load-btn');
    const playBtn = container.querySelector('#yt-play-btn');
    const pauseBtn = container.querySelector('#yt-pause-btn');
    const stopBtn = container.querySelector('#yt-stop-btn');
    const playerContainer = container.querySelector('#yt-player-container');

    let playerElement = null;

    loadBtn.addEventListener('click', () => {
      const input = searchInput.value.trim();
      if (!input) return;

      const videoId = window.youtubePlugin.extractVideoId(input) || input;
      if (videoId) {
        // Player Container leeren
        playerContainer.innerHTML = '';

        // Player Wrapper erstellen
        const wrapper = document.createElement('div');
        wrapper.className = 'youtube-player-wrapper';
        wrapper.id = 'yt-player-' + Date.now();
        playerContainer.appendChild(wrapper);

        // Player initialisieren
        window.youtubePlugin.initPlayer(wrapper.id, videoId, {
          autoplay: true,
          controls: true
        });
      }
    });

    playBtn.addEventListener('click', () => {
      window.youtubePlugin.playVideo();
    });

    pauseBtn.addEventListener('click', () => {
      window.youtubePlugin.pauseVideo();
    });

    stopBtn.addEventListener('click', () => {
      window.youtubePlugin.stopVideo();
      playerContainer.innerHTML = '<div class="youtube-placeholder">Video gestoppt</div>';
    });

    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        loadBtn.click();
      }
    });

    // Listener für Main-to-Renderer-Kommandos anmelden
    listenToCommands();

    return container;
  }

  // Plugin-UI registrieren wenn PluginAPI verfügbar
  if (window.pluginAPI && typeof window.pluginAPI.registerUI === 'function') {
    try {
      window.pluginAPI.registerUI({
        id: 'youtube-view',
        type: 'view',
        name: 'YouTube',
        renderFn: createYouTubeComponent
      });
      console.log('[YouTube Plugin] UI registered successfully');
    } catch (err) {
      console.error('[YouTube Plugin] Failed to register UI:', err);
    }
  } else {
    // Fallback: Direkt in Registry eintragen (für manuelle Integration)
    if (typeof window !== 'undefined' && window.views) {
      window.views.set('youtube', {
        renderFn: createYouTubeComponent
      });
      console.log('[YouTube Plugin] View registered in fallback mode');
    }
  }

})();
