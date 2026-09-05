import { useState, useEffect } from 'react';

/**
 * Hook für Update-Benachrichtigungen.
 *
 * Liest den initialen Update-State einmal und hört dann auf
 * Live-Events vom Main-Prozess. Bei Channel-Wechsel wird der
 * State neu initialisiert, damit der Badge nicht stale bleibt.
 */
export function useUpdateInfo() {
  const [updateInfo, setUpdateInfo] = useState(null);
  const [version, setVersion] = useState(null);
  const [isPrerelease, setIsPrerelease] = useState(false);
  const [channel, setChannel] = useState('stable');

  useEffect(() => {
    let mounted = true;
    let cleanupFns = [];

    async function loadInitial() {
      try {
        if (window.updatesAPI?.getCurrentVersion) {
          const info = await window.updatesAPI.getCurrentVersion();
          if (mounted && info?.ok) {
            setVersion(info.version);
            setIsPrerelease(!!info.isPrerelease);
            setChannel(info.channel || 'stable');
          }
        }
        if (window.updatesAPI?.getState) {
          const res = await window.updatesAPI.getState();
          if (mounted && res?.ok && res.state) {
            if (res.state.availableVersion) {
              setUpdateInfo({
                version: res.state.availableVersion,
                channel: res.state.channel,
                releaseNotes: res.state.releaseNotes
              });
            }
            if (res.state.channel) setChannel(res.state.channel);
          }
        }
      } catch (err) {
        // bewusst still – UI fällt auf Default zurück
      }
    }
    loadInitial();

    // Live-Events
    if (window.updatesAPI?.onStateChanged) {
      const off = window.updatesAPI.onStateChanged((s) => {
        if (!mounted) return;
        if (s.channel) setChannel(s.channel);
        if (s.availableVersion && (s.status === 'available' || s.status === 'downloading' || s.status === 'downloaded')) {
          setUpdateInfo({
            version: s.availableVersion,
            channel: s.channel,
            releaseNotes: s.releaseNotes
          });
        } else {
          setUpdateInfo(null);
        }
      });
      cleanupFns.push(off);
    }
    if (window.updatesAPI?.onAvailable) {
      const off = window.updatesAPI.onAvailable((data) => {
        if (!mounted) return;
        setUpdateInfo({
          version: data.version,
          channel: data.channel,
          releaseNotes: data.releaseNotes
        });
      });
      cleanupFns.push(off);
    }
    if (window.updatesAPI?.onChannelChanged) {
      const off = window.updatesAPI.onChannelChanged((data) => {
        if (!mounted) return;
        if (data?.channel) setChannel(data.channel);
      });
      cleanupFns.push(off);
    }
    // Legacy Fallback
    if (!window.updatesAPI && window.updaterAPI?.onUpdateAvailable) {
      window.updaterAPI.onUpdateAvailable((info) => {
        if (!mounted) return;
        setUpdateInfo(info);
      });
    }

    return () => {
      mounted = false;
      cleanupFns.forEach((fn) => {
        try { fn(); } catch { /* ignore */ }
      });
    };
  }, []);

  return { updateInfo, version, isPrerelease, channel };
}
