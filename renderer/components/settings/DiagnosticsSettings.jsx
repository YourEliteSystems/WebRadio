import React, { useState, useEffect, useCallback } from 'react';

const DiagnosticsSettings = () => {
  const [healthChecks, setHealthChecks] = useState([]);
  const [systemInfo, setSystemInfo] = useState(null);
  const [crashReports, setCrashReports] = useState([]);
  const [loadingHealth, setLoadingHealth] = useState(true);
  const [loadingSystem, setLoadingSystem] = useState(true);
  const [loadingCrash, setLoadingCrash] = useState(true);
  const [diagPaths, setDiagPaths] = useState(null);

  // Lade Diagnostics-Pfade
  const loadDiagPaths = useCallback(async () => {
    try {
      if (window.diagnosticsAPI?.getPaths) {
        const paths = await window.diagnosticsAPI.getPaths();
        setDiagPaths(paths);
      }
    } catch (err) {
      console.error("Failed to load diagnostic paths:", err);
    }
  }, []);

  // Health Check laden
  const loadHealthCheck = useCallback(async () => {
    if (!window.diagnosticsAPI?.getHealth) return;
    
    try {
      setLoadingHealth(true);
      const results = await window.diagnosticsAPI.getHealth();
      setHealthChecks(results || []);
    } catch (err) {
      console.error("Failed to load health checks:", err);
    } finally {
      setLoadingHealth(false);
    }
  }, []);

  // System Info laden
  const loadSystemInfo = useCallback(async () => {
    if (!window.diagnosticsAPI?.getSystemInfo) return;
    
    try {
      setLoadingSystem(true);
      const info = await window.diagnosticsAPI.getSystemInfo();
      setSystemInfo(info);
    } catch (err) {
      console.error("Failed to load system info:", err);
    } finally {
      setLoadingSystem(false);
    }
  }, []);

  // Crash Reports laden
  const loadCrashReports = useCallback(async () => {
    if (!window.diagnosticsAPI?.getCrashReports) return;
    
    try {
      setLoadingCrash(true);
      const reports = await window.diagnosticsAPI.getCrashReports();
      setCrashReports(reports || []);
    } catch (err) {
      console.error("Failed to load crash reports:", err);
    } finally {
      setLoadingCrash(false);
    }
  }, []);

  useEffect(() => {
    loadDiagPaths();
    loadHealthCheck();
    loadSystemInfo();
    loadCrashReports();
  }, [loadDiagPaths, loadHealthCheck, loadSystemInfo, loadCrashReports]);

  const openFolder = async (key) => {
    if (!diagPaths || !diagPaths[key]) return;
    window.shellAPI?.openPath(diagPaths[key]);
  };

  const handleReloadHealth = () => {
    loadHealthCheck();
  };

  const handleReloadCrashReports = () => {
    loadCrashReports();
  };

  const handleClearCrashReports = async () => {
    try {
      await window.diagnosticsAPI?.clearCrashReports();
      loadCrashReports();
    } catch (err) {
      console.error("Failed to clear crash reports:", err);
    }
  };

  const handleDeleteCrashReport = async (id) => {
    try {
      await window.diagnosticsAPI.deleteCrashReport(id);
      loadCrashReports();
    } catch (err) {
      console.error("Failed to delete crash report:", err);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h1>Diagnostics</h1>
        <p>System-Gesundheit, Logs und Absturzberichte</p>
      </div>

      {/* Ordner-Buttons */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">Ordner</span>
        </div>
        <div className="diag-folder-row">
          <button className="diag-open-btn" onClick={() => openFolder('logs')}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Logs-Ordner
          </button>
          <button className="diag-open-btn" onClick={() => openFolder('crash')}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Crash-Ordner
          </button>
          <button className="diag-open-btn" onClick={() => openFolder('userData')}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            App-Daten
          </button>
          <button className="diag-open-btn" onClick={() => openFolder('plugins')}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Plugins-Ordner
          </button>
          <button className="diag-open-btn" onClick={() => openFolder('themes')}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            Themes-Ordner
          </button>
        </div>
      </div>

      {/* Health Check */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">Health Check</span>
          <button onClick={handleReloadHealth} className="btn-secondary" style={{width: 'auto', padding: '6px 14px', fontSize: '12px'}}>
            ↺ Neu prüfen
          </button>
        </div>
        <div id="healthCheckList">
          {loadingHealth ? (
            <p style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '12px 0'}}>
              Wird geladen...
            </p>
          ) : healthChecks.length === 0 ? (
            <p style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '12px 0'}}>
              Keine Prüfungen vorhanden
            </p>
          ) : (
            healthChecks.map((check) => (
              <div key={check.name} className="health-check-item">
                <span className={`health-dot ${check.success ? 'ok' : 'fail'}`}></span>
                <span style={{flex: 1, color: 'var(--text-main)'}}>{check.name}</span>
                <span style={{fontSize: '11px', color: check.success ? '#22c55e' : '#ef4444'}}>
                  {check.success ? '✓ OK' : '✗ ' + (check.message || 'Fehler')}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* System Info */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">System Info</span>
        </div>
        <table className="sysinfo-table">
          <tbody>
            {loadingSystem ? (
              <tr>
                <td colSpan="2" style={{textAlign: 'center', color: 'var(--text-muted)'}}>
                  Wird geladen...
                </td>
              </tr>
            ) : systemInfo ? (
              <>
                <tr>
                  <td>Plattform</td>
                  <td style={{color: 'var(--text-main)', fontWeight: 500}}>{systemInfo.system?.platform || '–'}</td>
                </tr>
                <tr>
                  <td>Architektur</td>
                  <td style={{color: 'var(--text-main)', fontWeight: 500}}>{systemInfo.system?.architecture || '–'}</td>
                </tr>
                <tr>
                  <td>Hostname</td>
                  <td style={{color: 'var(--text-main)', fontWeight: 500}}>{systemInfo.system?.hostname || '–'}</td>
                </tr>
                <tr>
                  <td>CPU</td>
                  <td style={{color: 'var(--text-main)', fontWeight: 500}}>{systemInfo.cpu?.model || '–'}</td>
                </tr>
                <tr>
                  <td>CPU-Kerne</td>
                  <td style={{color: 'var(--text-main)', fontWeight: 500}}>{systemInfo.cpu?.cores || '–'}</td>
                </tr>
                <tr>
                  <td>RAM gesamt</td>
                  <td style={{color: 'var(--text-main)', fontWeight: 500}}>{systemInfo.memory?.total || '–'}</td>
                </tr>
                <tr>
                  <td>RAM frei</td>
                  <td style={{color: 'var(--text-main)', fontWeight: 500}}>{systemInfo.memory?.free || '–'}</td>
                </tr>
                <tr>
                  <td>Node.js</td>
                  <td style={{color: 'var(--text-main)', fontWeight: 500}}>{systemInfo.runtime?.node || '–'}</td>
                </tr>
                <tr>
                  <td>Electron</td>
                  <td style={{color: 'var(--text-main)', fontWeight: 500}}>{systemInfo.runtime?.electron || '–'}</td>
                </tr>
                <tr>
                  <td>Chromium</td>
                  <td style={{color: 'var(--text-main)', fontWeight: 500}}>{systemInfo.runtime?.chromium || '–'}</td>
                </tr>
                <tr>
                  <td>V8</td>
                  <td style={{color: 'var(--text-main)', fontWeight: 500}}>{systemInfo.runtime?.v8 || '–'}</td>
                </tr>
              </>
            ) : (
              <tr>
                <td colSpan="2" style={{textAlign: 'center', color: 'var(--text-muted)'}}>
                  Keine Systeminformationen verfügbar
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Crash Reports */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">Crash Reports</span>
          <div style={{display: 'flex', gap: '8px'}}>
            <button onClick={handleClearCrashReports} className="btn-secondary" style={{width: 'auto', padding: '6px 14px', fontSize: '12px', color: '#ef4444'}}>
              🗑 Alle löschen
            </button>
            <button onClick={handleReloadCrashReports} className="btn-secondary" style={{width: 'auto', padding: '6px 14px', fontSize: '12px'}}>
              ↺ Neu laden
            </button>
          </div>
        </div>
        <div id="crashReportList">
          {loadingCrash ? (
            <p style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '12px 0'}}>
              Wird geladen...
            </p>
          ) : crashReports.length === 0 ? (
            <p style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '12px 0'}}>
              Keine Crash-Reports vorhanden ✓
            </p>
          ) : (
            crashReports.map((report) => {
              const date = report.created ? new Date(report.created).toLocaleString('de-DE') : '–';
              return (
                <div key={report.id} className="crash-report-item">
                  <span className="crash-report-name" title={report.file}>{report.file}</span>
                  <span className="crash-report-date">{date}</span>
                  <button 
                    className="btn-icon-sm" 
                    onClick={() => handleDeleteCrashReport(report.id)}
                    title="Löschen"
                  >
                    🗑
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};

export default DiagnosticsSettings;
