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
  // Der Main-Prozess sendet Kommandos über mainWindow.webContents.send()
  // auf dem Kanal "mediahub:command". Der Preload exponiert das sichere
  // Abonnieren über window.mediaHubPlayerAPI.onCommand() – der Renderer
  // hat selbst KEINEN ipcRenderer-Zugriff.
  let unsubscribeCommands = null;

  function listenToCommands() {
    if (unsubscribeCommands) return;

    const api = window.mediaHubPlayerAPI;
    if (!api || typeof api.onCommand !== 'function') {
      console.warn('[YouTube Plugin] mediaHubPlayerAPI nicht verfügbar – MediaHub-Kommandos werden nicht empfangen');
      return;
    }

    unsubscribeCommands = api.onCommand((message) => {
      if (!message || !message.channel) {
        console.warn('[YouTube Plugin] mediahub:command ohne Channel:', message);
        return;
      }
      processCommand(message);
    });
  }

  // Teardown: entfernt AUSSCHLIESSLICH den eigenen Listener, damit keine
  // weiteren (z.B. Radio-)Listener betroffen sind.
  function stopListening() {
    if (!unsubscribeCommands) return;
    try {
      unsubscribeCommands();
    } catch (err) {
      console.warn('[YouTube Plugin] Listener konnte nicht entfernt werden:', err);
    }
    unsubscribeCommands = null;
    console.log('[YouTube Plugin] MediaHub-Kommandos abgemeldet');
  }

  // ─── Kommando-Verarbeitung (inkl. Queue, bis IFrame bereit) ────────────────
  // Die Queue ist bewusst begrenzt: Kommandos dürfen sich nicht unkontrolliert
  // ansammeln, wenn der Player nie initialisiert wird.
  const MAX_PENDING_COMMANDS = 8;

  function queueCommand(message) {
    if (pendingCommands.length >= MAX_PENDING_COMMANDS) {
      pendingCommands.shift();
      console.warn('[YouTube Plugin] Pending-Command-Queue voll – ältestes Kommando verworfen');
    }
    pendingCommands.push(message);
  }

  // Meldet, dass ein Kommando nicht ausgeführt werden konnte – ohne einen
  // erfundenen Zustand zu setzen (Main korrigiert über den Renderer-Report).
  function reportNotExecuted(command, reason) {
    console.warn(`[YouTube Plugin] ${command} nicht ausgeführt: ${reason}`);
  }

  /**
   * Erzeugt bei Bedarf einen unsichtbaren Player, damit die globalen
   * Controls (Play/Stop der Player-Leiste, Medientasten) auch ohne
   * geöffnete YouTube-Ansicht auf den eigentlichen Player wirken.
   */
  function ensurePlayer(videoId) {
    if (ytPlayer) return true;
    if (!ytReady) return false;

    let host = document.getElementById('yt-plugin-standalone-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'yt-plugin-standalone-host';
      host.setAttribute('aria-hidden', 'true');
      host.style.position = 'fixed';
      host.style.width = '1px';
      host.style.height = '1px';
      host.style.opacity = '0';
      host.style.pointerEvents = 'none';
      host.style.bottom = '0';
      host.style.right = '0';
      document.body.appendChild(host);
    }

    host.innerHTML = '';
    const slot = document.createElement('div');
    slot.id = 'yt-plugin-standalone-player';
    host.appendChild(slot);

    return Boolean(createYouTubePlayer(slot.id, videoId, { autoplay: true, controls: false }));
  }

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
          reportNotExecuted('play', 'keine Video-ID vorhanden');
          return;
        }

        if (!ytReady) {
          // IFrame-API noch nicht bereit → begrenzt vormerken
          queueCommand(message);
          return;
        }

        // Doppelte Player-Instanzen verhindern
        if (ytPlayer && ytPlayer.destroyed) {
          ytPlayer = null;
        }

        if (!ensurePlayer(videoId)) {
          reportNotExecuted('play', 'YouTube-Player nicht initialisierbar');
          return;
        }

        if (ytPlayer && typeof ytPlayer.playVideo === 'function') {
          ytPlayer.playVideo();
        } else if (ytPlayer && typeof ytPlayer.cueVideoById === 'function') {
          ytPlayer.cueVideoById(videoId);
        } else {
          reportNotExecuted('play', 'YouTube Player Methoden nicht verfügbar');
          return;
        }

        // Status-Meldung an Main senden (nur bei tatsächlich ausgeführtem Befehl)
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
          if (window.playerAPI) {
            window.playerAPI.reportProviderState('mediahub', { state: 'paused' });
          }
        } else {
          reportNotExecuted('pause', 'YouTube-Player nicht verfügbar');
          if (window.playerAPI) {
            window.playerAPI.reportProviderState('mediahub', { state: 'idle' });
          }
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
        // Genau EINE Umrechnung: Main liefert 0..1, die YouTube IFrame API
        // erwartet 0..100.
        const volume = Math.max(0, Math.min(1, Number(message.volume)));
        if (Number.isNaN(volume)) {
          console.warn('[YouTube Plugin] setVolume ohne gültigen Wert:', message.volume);
          return;
        }
        if (ytPlayer && typeof ytPlayer.setVolume === 'function') {
          ytPlayer.setVolume(volume * 100);
        } else {
          reportNotExecuted('setVolume', 'YouTube-Player nicht verfügbar');
        }
        // Der globale Lautstärke-State wird vom PlayerManager verwaltet –
        // hier wird kein eigener (ungültiger) Zustand gemeldet.
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
    initPlayer: createYouTubePlayer,
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

  // Beim Laden des Skripts sofort abonnieren (nicht erst beim Öffnen der
  // YouTube-Ansicht), damit globale Player-Controls jederzeit funktionieren.
  listenToCommands();

  // Teardown-Hook für den Plugin-Lebenszyklus: RendererPluginManager ruft
  // destroy() beim Deaktivieren des Plugins auf – danach bleibt kein
  // IPC-Listener zurück.
  if (typeof window.registerPluginRenderer === 'function') {
    window.registerPluginRenderer('youtube', { destroy: stopListening });
  }

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
