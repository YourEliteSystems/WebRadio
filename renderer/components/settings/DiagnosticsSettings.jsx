import React, { useState, useEffect, useCallback } from 'react';
import { useTranslation } from '../../localization/index.js';

const DiagnosticsSettings = () => {
  const { t, formatDateTime } = useTranslation();
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

  // Die Namen der Health-Checks stammen aus dem Diagnostics-Core (englisch).
  // Bekannte Prüfungen werden lokalisiert, unbekannte technisch unverändert
  // angezeigt – es wird nie ein Name geraten.
  const CHECK_LABEL_KEYS = {
    'Plugin Directory': 'settings.diagnostics.checks.pluginDirectory',
    'Theme Directory': 'settings.diagnostics.checks.themeDirectory',
    'Plugin Data': 'settings.diagnostics.checks.pluginData',
    Logs: 'settings.diagnostics.checks.logs',
    'History File': 'settings.diagnostics.checks.historyFile',
    'Favorites File': 'settings.diagnostics.checks.favoritesFile',
    'Settings File': 'settings.diagnostics.checks.settingsFile',
    'Registry File': 'settings.diagnostics.checks.registryFile'
  };

  const checkLabel = (name) => {
    const labelKey = CHECK_LABEL_KEYS[name];
    return labelKey ? t(labelKey) : name;
  };

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

  // Technische Bezeichnungen (Node.js, Electron, Chromium, V8) bleiben
  // unübersetzt – sie sind Produktnamen, keine Beschriftungen.
  const systemRows = systemInfo ? [
    [t('settings.diagnostics.platform'), systemInfo.system?.platform],
    [t('settings.diagnostics.architecture'), systemInfo.system?.architecture],
    [t('settings.diagnostics.hostname'), systemInfo.system?.hostname],
    [t('settings.diagnostics.cpu'), systemInfo.cpu?.model],
    [t('settings.diagnostics.cores'), systemInfo.cpu?.cores],
    [t('settings.diagnostics.ramTotal'), systemInfo.memory?.total],
    [t('settings.diagnostics.ramFree'), systemInfo.memory?.free],
    ['Node.js', systemInfo.runtime?.node],
    ['Electron', systemInfo.runtime?.electron],
    ['Chromium', systemInfo.runtime?.chromium],
    ['V8', systemInfo.runtime?.v8]
  ] : [];

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h1>{t('settings.diagnostics.title')}</h1>
        <p>{t('settings.diagnostics.subtitle')}</p>
      </div>

      {/* Ordner-Buttons */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">{t('settings.diagnostics.foldersTitle')}</span>
        </div>
        <div className="diag-folder-row">
          <button className="diag-open-btn" onClick={() => openFolder('logs')}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            {t('settings.diagnostics.logsFolder')}
          </button>
          <button className="diag-open-btn" onClick={() => openFolder('crash')}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            {t('settings.diagnostics.crashFolder')}
          </button>
          <button className="diag-open-btn" onClick={() => openFolder('userData')}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            {t('settings.diagnostics.userDataFolder')}
          </button>
          <button className="diag-open-btn" onClick={() => openFolder('plugins')}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            {t('settings.diagnostics.pluginsFolder')}
          </button>
          <button className="diag-open-btn" onClick={() => openFolder('themes')}>
            <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
            {t('settings.diagnostics.themesFolder')}
          </button>
        </div>
      </div>

      {/* Health Check */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">{t('settings.diagnostics.healthTitle')}</span>
          <button onClick={handleReloadHealth} className="btn-secondary" style={{width: 'auto', padding: '6px 14px', fontSize: '12px'}}>
            {t('settings.diagnostics.healthRecheck')}
          </button>
        </div>
        <div id="healthCheckList">
          {loadingHealth ? (
            <p style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '12px 0'}}>
              {t('common.loading')}
            </p>
          ) : healthChecks.length === 0 ? (
            <p style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '12px 0'}}>
              {t('settings.diagnostics.healthEmpty')}
            </p>
          ) : (
            healthChecks.map((check) => (
              <div key={check.name} className="health-check-item">
                <span className={`health-dot ${check.success ? 'ok' : 'fail'}`}></span>
                <span style={{flex: 1, color: 'var(--text-main)'}}>
                  {checkLabel(check.name)}
                </span>
                <span style={{fontSize: '11px', color: check.success ? '#22c55e' : '#ef4444'}}>
                  {check.success
                    ? t('settings.diagnostics.healthOk')
                    : t('settings.diagnostics.healthFail', {
                        message: check.message || t('settings.diagnostics.healthError')
                      })}
                </span>
              </div>
            ))
          )}
        </div>
      </div>

      {/* System Info */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">{t('settings.diagnostics.systemTitle')}</span>
        </div>
        <table className="sysinfo-table">
          <tbody>
            {loadingSystem ? (
              <tr>
                <td colSpan="2" style={{textAlign: 'center', color: 'var(--text-muted)'}}>
                  {t('common.loading')}
                </td>
              </tr>
            ) : systemInfo ? (
              systemRows.map(([label, value]) => (
                <tr key={label}>
                  <td>{label}</td>
                  <td style={{color: 'var(--text-main)', fontWeight: 500}}>{value || t('common.none')}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan="2" style={{textAlign: 'center', color: 'var(--text-muted)'}}>
                  {t('settings.diagnostics.systemEmpty')}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Crash Reports */}
      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">{t('settings.diagnostics.crashTitle')}</span>
          <div style={{display: 'flex', gap: '8px'}}>
            <button onClick={handleClearCrashReports} className="btn-secondary" style={{width: 'auto', padding: '6px 14px', fontSize: '12px', color: '#ef4444'}}>
              {t('settings.diagnostics.crashDeleteAll')}
            </button>
            <button onClick={handleReloadCrashReports} className="btn-secondary" style={{width: 'auto', padding: '6px 14px', fontSize: '12px'}}>
              {t('common.reload')}
            </button>
          </div>
        </div>
        <div id="crashReportList">
          {loadingCrash ? (
            <p style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '12px 0'}}>
              {t('common.loading')}
            </p>
          ) : crashReports.length === 0 ? (
            <p style={{color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '12px 0'}}>
              {t('settings.diagnostics.crashEmpty')}
            </p>
          ) : (
            crashReports.map((report) => {
              const date = report.created ? formatDateTime(new Date(report.created)) : t('common.none');
              return (
                <div key={report.id} className="crash-report-item">
                  <span className="crash-report-name" title={report.file}>{report.file}</span>
                  <span className="crash-report-date">{date}</span>
                  <button
                    className="btn-icon-sm"
                    onClick={() => handleDeleteCrashReport(report.id)}
                    title={t('common.delete')}
                    aria-label={t('common.delete')}
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
