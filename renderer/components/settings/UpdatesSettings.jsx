import React, { useState, useEffect, useMemo, useCallback } from 'react';

const UpdatesSettings = () => {
  const [status, setStatus] = useState('checking');
  const [updateInfo, setUpdateInfo] = useState(null);
  const [downloadProgress, setDownloadProgress] = useState(null);
  const [downloaded, setDownloaded] = useState(false);
  const [currentVersion, setCurrentVersion] = useState('–');
  const [currentChannel, setCurrentChannel] = useState('stable');
  const [autoCheckEnabled, setAutoCheckEnabled] = useState(true);
  const [channel, setChannel] = useState('stable');
  const [channelMeta, setChannelMeta] = useState(null);
  const [channelsMeta, setChannelsMeta] = useState([]);
  const [showBetaWarning, setShowBetaWarning] = useState(false);
  const [showAlphaWarning, setShowAlphaWarning] = useState(false);
  const [releaseNotes, setReleaseNotes] = useState('');
  const [showReleaseNotes, setShowReleaseNotes] = useState(false);

  // Versions-Stempel (Version Badge) nutzt zentrale Metadaten (alpha/beta/stable)
  // ohne verstreute String-Prüfungen.
  const currentChannelMeta = useMemo(() => {
    if (!currentChannel) return null;
    return channelsMeta.find((m) => m.id === currentChannel) || null;
  }, [currentChannel, channelsMeta]);

  // Format bytes helper
  const formatBytes = (n) => {
    if (!n || n <= 0) return "";
    const units = ["B", "KB", "MB", "GB"];
    let i = 0;
    let v = n;
    while (v >= 1024 && i < units.length - 1) {
      v /= 1024;
      i++;
    }
    return `${v.toFixed(v >= 10 ? 0 : 1)} ${units[i]}`;
  };

  // Markdown rendering helper
  const renderMarkdown = (md) => {
    if (!md) return "";
    const esc = (s) => s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    let html = esc(md);

    // Code-Blöcke ```...```
    html = html.replace(/```([\s\S]*?)```/g, (_, code) =>
      `<pre style="background:rgba(0,0,0,0.4); padding:8px 10px; border-radius:6px; overflow:auto; font-size:12px;"><code>${code.trim()}</code></pre>`
    );
    // Inline-Code
    html = html.replace(/`([^`\n]+)`/g, "<code>$1</code>");
    // Headers
    html = html.replace(/^####\s+(.+)$/gm, "<h4>$1</h4>");
    html = html.replace(/^###\s+(.+)$/gm, "<h3>$1</h3>");
    html = html.replace(/^##\s+(.+)$/gm, "<h3>$1</h3>");
    // Bold **...**
    html = html.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
    // Lists
    html = html.replace(/(^|\n)((?:- .*(?:\n|$))+)/g, (_, pre, block) => {
      const items = block
        .trim()
        .split(/\n/)
        .map((l) => l.replace(/^- /, "").trim())
        .filter(Boolean)
        .map((l) => `<li>${l}</li>`)
        .join("");
      return `${pre}<ul style="margin:6px 0 6px 18px; padding:0;">${items}</ul>`;
    });
    // Newlines
    html = html.replace(/\n{2,}/g, "</p><p>");
    html = html.replace(/\n/g, "<br>");
    return `<p>${html}</p>`;
  };

  // Lade aktuelle Version und Channel
  const loadCurrentVersion = useCallback(async () => {
    try {
      if (window.updatesAPI?.getCurrentVersion) {
        const info = await window.updatesAPI.getCurrentVersion();
        if (info?.ok) {
          setCurrentVersion(`v${info.version}`);
          // Release-Channel-Logik: `info.channel` liefert 'alpha' | 'beta' | 'stable'.
          // Zentral: Fallback auf 'stable', wenn kein gültiger Kanal zurückgegeben wird.
          if (info.channel === 'alpha') {
            setCurrentChannel('alpha');
          } else if (info.channel === 'beta') {
            setCurrentChannel('beta');
          } else {
            setCurrentChannel('stable');
          }
        }
      } else if (window.updaterAPI?.getVersion) {
        const v = await window.updaterAPI.getVersion();
        setCurrentVersion(`v${v}`);
      }
    } catch (err) {
      console.error("Failed to load current version:", err);
    }
  }, []);

  // Lade Channel-Metadaten
  const loadChannelMetadata = useCallback(async () => {
    try {
      if (window.updatesAPI?.getAllChannelMetadata) {
        const res = await window.updatesAPI.getAllChannelMetadata();
        if (res?.ok && Array.isArray(res.channels)) {
          setChannelsMeta(res.channels);
        }
      }
    } catch (err) {
      console.error("Failed to load channel metadata:", err);
    }
  }, []);

  // Lade Channel-Einstellung
  const loadChannel = useCallback(async () => {
    try {
      if (window.updatesAPI?.getChannel) {
        const res = await window.updatesAPI.getChannel();
        if (res?.ok) {
          setChannel(res.channel);
        }
      }
    } catch (err) {
      console.error("Failed to load channel:", err);
    }
  }, []);

  // Lade Auto-Check-Einstellung
  const loadAutoCheckSetting = useCallback(async () => {
    try {
      if (window.api?.updates?.getAutoCheck) {
        const res = await window.api.updates.getAutoCheck();
        if (res?.ok) setAutoCheckEnabled(!!res.enabled);
      } else if (window.updatesAPI?.getAutoCheck) {
        const res = await window.updatesAPI.getAutoCheck();
        if (res?.ok) setAutoCheckEnabled(!!res.enabled);
      }
    } catch (err) {
      console.error("Failed to load auto-check setting:", err);
    }
  }, []);

  // Lade Update-State
  const loadUpdateState = useCallback(async () => {
    try {
      if (window.updatesAPI?.getState) {
        const res = await window.updatesAPI.getState();
        if (res?.ok && res.state) {
          applyStateToUI(res.state);
        } else {
          setStatusView('idle');
        }
      } else {
        setStatusView('idle');
      }
    } catch (err) {
      console.error("Failed to load update state:", err);
    }
  }, []);    // Initiales Laden
  useEffect(() => {
    loadCurrentVersion();
    loadChannel();
    loadChannelMetadata();
    loadAutoCheckSetting();
    loadUpdateState();

    // Channel-Metadaten immer aktuell halten, sobald sich der Channel ändert
    const syncChannelMeta = (c) => {
      if (!Array.isArray(channelsMeta) || channelsMeta.length === 0) return;
      const meta = channelsMeta.find((m) => m.id === c);
      if (meta) setChannelMeta(meta);
    };

    // Event-Listener registrieren
    const registerListeners = () => {
      if (window.updatesAPI?.onStateChanged) {
        window.updatesAPI.onStateChanged((s) => {
          applyStateToUI(s);
        });
      }
      if (window.updatesAPI?.onAvailable) {
        window.updatesAPI.onAvailable((data) => {
          setUpdateInfo(data);
          setStatusView('available', data);
        });
      }
      if (window.updatesAPI?.onNotAvailable) {
        window.updatesAPI.onNotAvailable(() => {
          setStatusView('current', {});
        });
      }
      if (window.updatesAPI?.onProgress) {
        window.updatesAPI.onProgress((p) => {
          applyProgress(p);
        });
      }
      if (window.updatesAPI?.onDownloaded) {
        window.updatesAPI.onDownloaded((data) => {
          setUpdateInfo(data);
          setStatusView('downloaded', data);
        });
      }
      if (window.updatesAPI?.onError) {
        window.updatesAPI.onError(() => {
          setStatusView('error');
        });
      }
      if (window.updatesAPI?.onChannelChanged) {
        window.updatesAPI.onChannelChanged((data) => {
          if (data?.channel) {
            setChannel(data.channel);
            syncChannelMeta(data.channel);
          }
        });
      }
    };

    registerListeners();

    // Check beim Öffnen der Seite
    runUpdateCheck();
  }, [loadCurrentVersion, loadChannel, loadAutoCheckSetting, loadUpdateState]);

  const applyStateToUI = (state) => {
    if (!state) return;

    setUpdateInfo(state);
    const map = {
      idle: 'idle',
      checking: 'checking',
      available: 'available',
      downloading: 'downloading',
      downloaded: 'downloaded',
      'not-available': 'current',
      'up-to-date': 'current',
      error: 'error',
      installing: 'downloaded'
    };
    const view = map[state.status] || 'idle';
    setStatusView(view, {
      version: state.availableVersion,
      channel: state.channel,
      releaseNotes: state.releaseNotes
    });
  };

  const applyProgress = (progress) => {
    if (!progress) {
      setDownloadProgress(null);
      return;
    }
    setDownloadProgress(progress);
  };

  const setStatusView = (state, data = {}) => {
    setStatus(state);
    if (data.releaseNotes) {
      setReleaseNotes(data.releaseNotes);
      setShowReleaseNotes(state === 'available' || state === 'downloaded');
    }
  };

  const runUpdateCheck = async () => {
    setStatus('checking');
    try {
      if (window.updatesAPI?.check) {
        const res = await window.updatesAPI.check();
        if (!res?.ok) {
          setStatus('error');
          return;
        }
        const r = res.result;
        if (r && r.status === 'available') {
          setUpdateInfo(r);
          setStatusView('available', r);
        } else if (r && r.status === 'error') {
          setStatus('error');
        } else {
          setStatusView('current', r || {});
        }
      } else if (window.updaterAPI?.check) {
        const result = await window.updaterAPI.check();
        if (result?.available) {
          setStatusView('available', result);
        } else {
          setStatusView('current', result || {});
        }
      } else {
        setStatus('error');
      }
    } catch (err) {
      console.error("Update check failed:", err);
      setStatus('error');
    }
  };

  const handleCheckUpdate = () => {
    runUpdateCheck();
  };

  const handleInstallUpdate = async () => {
    try {
      if (window.updatesAPI?.download) {
        await window.updatesAPI.download();
      } else if (window.updaterAPI?.install) {
        await window.updaterAPI.install();
      }
    } catch (err) {
      console.error("Install failed:", err);
    }
  };

  const handleDismissUpdate = async () => {
    try {
      if (window.api?.updates?.dismissLater) {
        await window.api.updates.dismissLater();
      } else if (window.updatesAPI?.dismissLater) {
        await window.updatesAPI.dismissLater();
      }
    } catch { /* ignore */ }
    setStatus('idle');
  };

  const handleInstallNow = async () => {
    try {
      if (window.updatesAPI?.install) {
        await window.updatesAPI.install();
      } else if (window.updaterAPI?.install) {
        await window.updaterAPI.install();
      }
    } catch (err) {
      console.error("Install now failed:", err);
    }
  };

  const handleRestartLater = () => {
    setDownloaded(false);
  };

  const handleAutoCheckChange = async (e) => {
    const enabled = e.target.checked;
    setAutoCheckEnabled(enabled);
    try {
      if (window.api?.updates?.setAutoCheck) {
        await window.api.updates.setAutoCheck(enabled);
      } else if (window.updatesAPI?.setAutoCheck) {
        await window.updatesAPI.setAutoCheck(enabled);
      }
    } catch { /* ignore */ }
  };

  const handleChannelChange = (newChannel) => {
    if (newChannel === channel) return;

    const meta = channelsMeta.find((m) => m.id === newChannel);
    if (!meta) {
      commitChannelChange(newChannel);
      return;
    }

    // Beim Wechsel auf Beta: Bestätigung verlangen
    if (meta.id === 'beta') {
      setShowBetaWarning(true);
      return;
    }

    // Beim Wechsel auf Alpha: Bestätigung verlangen
    if (meta.id === 'alpha') {
      setShowAlphaWarning(true);
      return;
    }

    commitChannelChange(newChannel);
  };

  const commitChannelChange = async (newChannel) => {
    if (!window.updatesAPI?.setChannel) return;
    try {
      const res = await window.updatesAPI.setChannel(newChannel);
      if (res?.ok) {
        setChannel(newChannel);
        setCurrentChannel(newChannel);
        // Nach Channel-Wechsel neuen Check anstoßen
        runUpdateCheck();
      } else {
        // zurücksetzen
        setChannel(currentChannel);
      }
    } catch (err) {
      console.error("Channel change failed:", err);
      setChannel(currentChannel);
    }
  };

  const handleBetaWarningConfirm = async () => {
    setShowBetaWarning(false);
    await commitChannelChange('beta');
  };

  const handleBetaWarningCancel = () => {
    setShowBetaWarning(false);
  };

  const handleAlphaWarningConfirm = async () => {
    setShowAlphaWarning(false);
    await commitChannelChange('alpha');
  };

  const handleAlphaWarningCancel = () => {
    setShowAlphaWarning(false);
  };

  const getStatusIcon = () => {
    switch (status) {
      case 'checking':
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
          </svg>
        );
      case 'current':
      case 'up-to-date':
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case 'available':
      case 'downloading':
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="1 4 1 10 7 10" />
            <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
          </svg>
        );
      case 'downloaded':
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        );
      case 'error':
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
        );
      case 'idle':
        return (
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getStatusText = () => {
    switch (status) {
      case 'checking':
        return {
          title: 'Prüfe auf Updates…',
          sub: 'Verbindung zum Update-Server wird hergestellt'
        };
      case 'current':
      case 'up-to-date':
        return {
          title: 'Du bist aktuell',
          sub: `${currentVersion} ist die neueste Version`
        };
      case 'available':
        {
          const chMeta = updateInfo?.channel
            ? channelsMeta.find((m) => m.id === updateInfo.channel)
            : null;
          if (chMeta?.id === 'alpha') {
            return {
              title: `Alpha-Update verfügbar – v${updateInfo?.version}`,
              sub: 'Hinweis: Alpha-Version – experimentell, kann schwere Fehler enthalten.'
            };
          }
          if (chMeta?.id === 'beta') {
            return {
              title: `Beta-Update verfügbar – v${updateInfo?.version}`,
              sub: 'Hinweis: Beta-Version – kann Fehler enthalten.'
            };
          }
          return {
            title: `Update verfügbar – v${updateInfo?.version}`,
            sub: 'Eine neue Version ist bereit zum Herunterladen'
          };
        }
      case 'downloading':
        return {
          title: `Wird heruntergeladen – v${updateInfo?.version}`,
          sub: 'Update wird heruntergeladen…'
        };
      case 'downloaded':
        return {
          title: `Update bereit – v${updateInfo?.version}`,
          sub: 'Das Update ist heruntergeladen und wartet auf Installation'
        };
      case 'error':
        return {
          title: 'Update konnte nicht geprüft werden',
          sub: 'Bitte überprüfe deine Internetverbindung und versuche es später erneut.'
        };
      case 'idle':
        return {
          title: 'Bereit',
          sub: 'Klicke auf „Jetzt prüfen“, um nach Updates zu suchen'
        };
      default:
        return { title: '', sub: '' };
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h1>Updates</h1>
        <p>WebRadio auf dem neuesten Stand halten</p>
      </div>

      <div className="settings-card">
        {/* Status Box */}
        <div className="update-status-box">
          <div className={`update-status-icon ${status}`}>
            {getStatusIcon()}
          </div>
          <div className="update-status-text">
            <strong>{getStatusText().title}</strong>
            <span>{getStatusText().sub}</span>
          </div>
        </div>

        {/* Download Progress */}
        {status === 'downloading' && downloadProgress && (
          <div style={{display: 'block', margin: '12px 0 0'}}>
            <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px'}}>
              <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>Wird heruntergeladen…</span>
              <span style={{fontSize: '12px', color: 'var(--text-main)', fontWeight: '600'}}>
                {Math.round((downloadProgress.progress || 0) * 100)}%
              </span>
            </div>
            <div style={{width: '100%', height: '8px', background: 'rgba(255,255,255,0.08)', borderRadius: '4px', overflow: 'hidden'}}>
              <div style={{width: `${(downloadProgress.progress || 0) * 100}%`, height: '100%', background: 'var(--accent-color)', transition: 'width 200ms ease'}}></div>
            </div>
            <div style={{marginTop: '4px', fontSize: '11px', color: 'var(--text-muted)'}}>
              {formatBytes(downloadProgress.transferred)} / {formatBytes(downloadProgress.total)}
              {downloadProgress.bytesPerSecond && ` • ${formatBytes(downloadProgress.bytesPerSecond)}/s`}
            </div>
          </div>
        )}

        {/* Downloaded */}
        {status === 'downloaded' && (
          <div style={{display: 'block', marginTop: '14px'}}>
            <div style={{padding: '14px 16px', borderRadius: '10px', background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.3)', display: 'flex', gap: '12px', alignItems: 'flex-start'}}>
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" style={{color: 'var(--accent-color)', marginTop: '2px', flexShrink: 0}}>
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
              <div style={{flex: 1}}>
                <strong style={{fontSize: '13px', color: 'var(--text-main)', display: 'block', marginBottom: '2px'}}>Update bereit</strong>
                <span style={{fontSize: '12px', color: 'var(--text-muted)'}}>Das Update wird installiert, sobald WebRadio neu gestartet wird.</span>
              </div>
            </div>
            <div className="update-actions" style={{marginTop: '12px', gap: '8px'}}>
              <button onClick={handleRestartLater} className="btn-secondary" style={{display: 'inline-flex', width: 'auto', padding: '10px 18px', fontSize: '13px'}}>
                Später neu starten
              </button>
              <button onClick={handleInstallNow} className="btn-update" style={{display: 'inline-flex'}}>
                ↻ Jetzt neu starten
              </button>
            </div>
          </div>
        )}

        {/* Release Notes */}
        {showReleaseNotes && (
          <div style={{display: 'block'}}>
            <p style={{fontSize: '12px', color: 'var(--text-muted)', margin: '16px 0 8px', fontWeight: '500', textTransform: 'uppercase', letterSpacing: '0.5px'}}>
              Was ist neu
            </p>
            <div className="update-release-notes" dangerouslySetInnerHTML={{ __html: renderMarkdown(releaseNotes) }}></div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="update-actions" id="updateActionsRow">
          {(status === 'current' || status === 'idle' || status === 'error') && (
            <button onClick={handleCheckUpdate} className="btn-secondary" style={{width: 'auto', padding: '10px 18px', fontSize: '13px'}}>
              Jetzt prüfen
            </button>
          )}
          {status === 'available' && (
            <>
              <button onClick={handleDismissUpdate} className="btn-secondary" style={{display: 'inline-flex', width: 'auto', padding: '10px 18px', fontSize: '13px'}}>
                Später
              </button>
              <button onClick={handleInstallUpdate} className="btn-update">
                ⬇ Update herunterladen
              </button>
            </>
          )}
        </div>

        {/* Auto-Check Option */}
        <div style={{marginTop: '14px', paddingTop: '12px', borderTop: '1px solid rgba(255,255,255,0.06)'}}>
          <label style={{display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: 'var(--text-main)', cursor: 'pointer', userSelect: 'none'}}>
            <input 
              type="checkbox" 
              checked={autoCheckEnabled}
              onChange={handleAutoCheckChange}
              style={{accentColor: 'var(--accent-color)', cursor: 'pointer'}}
            />
            <span>Beim Start nach Updates suchen</span>
          </label>
        </div>
      </div>

      {/* Channel-Auswahl */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">Update-Kanal</span>              <span id="channelBadge" className="channel-badge" data-channel={channel}
            style={{ '--update-channel-color': channelMeta?.color }}
          >
            {channelMeta?.label ?? 'Stable'}
          </span>
        </div>
        <p style={{fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 14px'}}>
          Wähle, welche Versionen dir angeboten werden.
        </p>
        <div className="channel-options">
          {channelsMeta.map((meta) => (
            <label
              key={meta.id}
              className={`channel-option ${channel === meta.id ? 'selected' : ''}`}
              data-channel={meta.id}
            >
              <input
                type="radio"
                name="updateChannel"
                value={meta.id}
                checked={channel === meta.id}
                onChange={() => handleChannelChange(meta.id)}
              />
              <div className="channel-option-content">
                <div className="channel-option-title">{meta.label}</div>
                <div className="channel-option-desc">{meta.description}</div>
              </div>
            </label>
          ))}
        </div>
        {channelMeta?.id === 'beta' && (
          <div className="beta-hint" data-channel="beta" style={{ '--update-channel-color': channelMeta?.color }}>
            {channelMeta?.icon}
            <span>Du erhältst jetzt auch Beta-Versionen. Diese können instabil sein.</span>
          </div>
        )}
        {channelMeta?.id === 'alpha' && (
          <div className="alpha-hint" data-channel="alpha" style={{ '--update-channel-color': channelMeta?.color }}>
            {channelMeta?.icon}
            <span>Du erhältst jetzt auch Alpha-Versionen. Diese sind experimentell und können noch unbekannte Fehler enthalten.</span>
          </div>
        )}
      </div>

      <div className="version-info">
        <span>Aktuelle Version: <strong>{currentVersion}</strong> <span id="currentVersionBadge" className="channel-badge" data-current-channel={currentChannel} style={{ display: currentChannel !== 'stable' ? 'inline-block' : 'none', '--update-channel-color': currentChannelMeta?.color }}>{currentChannelMeta?.shortLabel ?? ''}</span></span>
        <span>WebRadio by Your Elite Systems</span>
      </div>

      {/* Beta-Warnung Modal */}
      {showBetaWarning && (
        <div className="modal-backdrop open" role="dialog" aria-modal="true" aria-labelledby="betaWarningTitle">
          <div className="modal">
            <h2 id="betaWarningTitle">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" style={{color: '#f59e0b'}}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Beta-Versionen aktivieren
            </h2>
            <p>
              Du möchtest WebRadio auf den <strong>Beta-Kanal</strong> umstellen.
            </p>
            <p>
              Beta-Versionen befinden sich noch in Entwicklung und wurden möglicherweise nicht vollständig getestet.
              Sie können <strong>Fehler, Abstürze, Funktionsprobleme oder andere unerwartete Probleme</strong> enthalten.
            </p>
            <div className="modal-warning">
              Der Beta-Kanal sollte nur aktiviert werden, wenn du bereit bist, mögliche Fehler zu melden
              und mit instabileren Versionen zu arbeiten.
            </div>
            <p style={{fontSize: '12px', color: 'var(--text-muted)'}}>
              Möchtest du den Beta-Kanal wirklich aktivieren?
            </p>
            <div className="modal-actions">
              <button onClick={handleBetaWarningCancel} className="btn-secondary" type="button">Abbrechen</button>
              <button onClick={handleBetaWarningConfirm} className="btn-primary danger" type="button">Beta aktivieren</button>
            </div>
          </div>
        </div>
      )}

      {/* Alpha-Warnung Modal */}
      {showAlphaWarning && (
        <div className="modal-backdrop open" role="dialog" aria-modal="true" aria-labelledby="alphaWarningTitle">
          <div className="modal">
            <h2 id="alphaWarningTitle">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" style={{color: '#ef4444'}}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/>
                <line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
              Alpha-Versionen aktivieren
            </h2>
            <p>
              Du möchtest WebRadio auf den <strong>Alpha-Kanal</strong> umstellen.
            </p>
            <p>
              Alpha-Versionen sind experimentelle Builds, die <strong>noch nicht einmal Beta-Stabilität</strong> erreicht haben.
              Sie können <strong>schwere Fehler, Datenverlust, Abstürze oder andere kritische Probleme</strong> enthalten.
            </p>
            <div className="modal-warning" style={{background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)'}}>
              Der Alpha-Kanal sollte nur von Entwicklern aktiviert werden, die bereit sind,
              kritische Fehler zu melden und mit sehr instabilen Versionen zu arbeiten.
            </div>
            <p style={{fontSize: '12px', color: 'var(--text-muted)'}}>
              Möchtest du den Alpha-Kanal wirklich aktivieren?
            </p>
            <div className="modal-actions">
              <button onClick={handleAlphaWarningCancel} className="btn-secondary" type="button">Abbrechen</button>
              <button onClick={handleAlphaWarningConfirm} className="btn-primary danger" type="button">Alpha aktivieren</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UpdatesSettings;
