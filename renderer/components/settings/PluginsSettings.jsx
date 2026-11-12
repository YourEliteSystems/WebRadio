import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useTranslation } from '../../localization/index.js';

const STATUS_TONE = {
  up_to_date: 'ok',
  update_available: 'accent',
  updated: 'ok',
  incompatible: 'warn',
  not_published: 'warn',
  channel_mismatch: 'warn',
  no_source: 'muted',
  idle: 'muted',
  checking: 'muted',
  downloading: 'accent',
  installing: 'accent',
  error: 'danger',
  rollback_failed: 'danger'
};

const PluginsSettings = () => {
  const { t } = useTranslation();
  const [plugins, setPlugins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [reloading, setReloading] = useState(false);
  const [updateState, setUpdateState] = useState(null);
  const [checking, setChecking] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [dialog, setDialog] = useState(null);
  const [notice, setNotice] = useState(null);

  const updatesApi = typeof window !== 'undefined' ? window.pluginUpdatesAPI : null;

  const tr = useCallback((key, fallback) => {
    const value = t(key);
    return value === key ? fallback : value;
  }, [t]);

  const loadPlugins = useCallback(async () => {
    try {
      setLoading(true);
      const list = await window.api.getPlugins();
      setPlugins(list);
    } catch (err) {
      console.error('Failed to load plugins:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const loadUpdateState = useCallback(async () => {
    if (!updatesApi) return;
    try {
      const state = await updatesApi.getState();
      setUpdateState(state);
    } catch (err) {
      console.error('Failed to load plugin update state:', err);
    }
  }, [updatesApi]);

  useEffect(() => {
    loadPlugins();
    loadUpdateState();

    if (window.api?.onPluginsChanged) {
      const handler = () => loadPlugins();
      window.api.onPluginsChanged(handler);
      return () => {
        if (window.api?.onPluginsChanged) window.api.onPluginsChanged(handler);
      };
    }
  }, [loadPlugins, loadUpdateState]);

  useEffect(() => {
    if (!updatesApi?.onChanged) return undefined;
    const unsubscribe = updatesApi.onChanged((state) => setUpdateState(state));
    return unsubscribe;
  }, [updatesApi]);

  const updateFor = useCallback((pluginId) => {
    return updateState?.plugins?.find((entry) => entry.id === pluginId) || null;
  }, [updateState]);

  const handleTogglePlugin = async (pluginId, enabled) => {
    try {
      await window.api.togglePlugin(pluginId, enabled);
      await loadPlugins();
    } catch (err) {
      console.error('Failed to toggle plugin:', err);
    }
  };

  const handleReloadPlugins = async () => {
    try {
      setReloading(true);
      if (window.api?.reloadPlugins) await window.api.reloadPlugins();
      await loadPlugins();
    } catch (err) {
      console.error('Failed to reload plugins:', err);
    } finally {
      setReloading(false);
    }
  };

  const openPluginsFolder = async () => {
    if (window.diagnosticsAPI?.getPaths) {
      try {
        const paths = await window.diagnosticsAPI.getPaths();
        if (paths?.plugins) window.shellAPI?.openPath(paths.plugins);
      } catch (err) {
        console.error('Failed to open plugins folder:', err);
      }
    }
  };

  const runCheck = async (pluginId) => {
    if (!updatesApi) return;
    try {
      setChecking(true);
      setNotice(null);
      if (pluginId) await updatesApi.checkPlugin(pluginId, { force: true });
      else await updatesApi.check({ force: true });
      await loadUpdateState();
    } catch (err) {
      setNotice({ tone: 'danger', text: err.message });
    } finally {
      setChecking(false);
    }
  };

  const applyUpdate = async (plugin, options = {}) => {
    if (!updatesApi) return;
    try {
      setBusyId(plugin.id);
      setNotice(null);
      const result = await updatesApi.apply(plugin.id, options);
      if (result.ok) {
        setNotice({ tone: 'ok', text: t('settings.plugins.updates.result.success') });
      } else if (result.code === 'install_failed_rolled_back') {
        setNotice({ tone: 'warn', text: t('settings.plugins.updates.result.rolledBack') });
      } else if (result.code === 'rollback_failed') {
        setNotice({ tone: 'danger', text: t('settings.plugins.updates.result.rollbackFailed') });
      } else {
        setNotice({ tone: 'danger', text: result.message || result.code });
      }
      await Promise.all([loadPlugins(), loadUpdateState()]);
    } catch (err) {
      setNotice({ tone: 'danger', text: err.message });
    } finally {
      setBusyId(null);
    }
  };

  const requestUpdate = (plugin, update) => {
    if (!update) return;
    if (update.requiresPermissionApproval) {
      setDialog({ type: 'permissions', plugin, update });
      return;
    }
    if (update.requiresUnsignedApproval) {
      setDialog({ type: 'unsigned', plugin, update });
      return;
    }
    applyUpdate(plugin, {});
  };

  const confirmDialog = async () => {
    if (!dialog) return;
    const { plugin, update, type } = dialog;
    setDialog(null);
    await applyUpdate(plugin, {
      allowUnsigned: type === 'unsigned' || Boolean(update?.requiresUnsignedApproval),
      approvedPermissions: update?.permissions?.added || []
    });
  };

  const updateAll = async () => {
    const applicable = (updateState?.plugins || []).filter((entry) =>
      entry.status === 'update_available' &&
      !entry.requiresPermissionApproval &&
      !entry.requiresUnsignedApproval
    );
    for (const entry of applicable) {
      const plugin = plugins.find((item) => item.id === entry.id) || { id: entry.id, name: entry.name };
      await applyUpdate(plugin, {});
    }
  };

  const autoCheck = updateState?.settings?.autoCheck !== false;
  const toggleAutoCheck = async (enabled) => {
    if (!updatesApi) return;
    try {
      await updatesApi.setSettings({ autoCheck: enabled });
      await loadUpdateState();
    } catch (err) {
      setNotice({ tone: 'danger', text: err.message });
    }
  };

  const changeChannel = async (pluginId, channel) => {
    if (!updatesApi) return;
    try {
      await updatesApi.setChannel(pluginId, channel);
      await updatesApi.checkPlugin(pluginId, { force: true });
      await loadUpdateState();
    } catch (err) {
      setNotice({ tone: 'danger', text: err.message });
    }
  };

  const statusLabel = useCallback((status) => {
    return tr(`settings.plugins.updates.status.${status}`, status);
  }, [tr]);

  const permissionLabel = useCallback((permission) => {
    return tr(`settings.plugins.updates.permissionNames.${permission}`, permission);
  }, [tr]);

  const compatibleUpdates = useMemo(
    () => (updateState?.plugins || []).filter((entry) => entry.status === 'update_available' && !entry.incompatible),
    [updateState]
  );

  const toneFor = (status) => STATUS_TONE[status] || 'muted';

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h1>{t('settings.plugins.title')}</h1>
        <p>{t('settings.plugins.subtitle')}</p>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">{t('settings.plugins.updates.sectionTitle')}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => runCheck()}
              className="btn-secondary"
              style={{ width: 'auto', padding: '6px 14px', fontSize: '12px' }}
              disabled={checking || !updatesApi}
            >
              {checking ? t('settings.plugins.updates.checking') : t('settings.plugins.updates.checkAll')}
            </button>
            <button
              onClick={updateAll}
              className="btn-secondary"
              style={{ width: 'auto', padding: '6px 14px', fontSize: '12px' }}
              disabled={compatibleUpdates.length === 0 || Boolean(busyId)}
            >
              {t('settings.plugins.updates.updateAll')}
            </button>
          </div>
        </div>

        <p style={{ color: 'var(--text-muted)', fontSize: '12px', margin: '0 0 10px' }}>
          {t('settings.plugins.updates.sectionHint')}
        </p>

        <label className="plugin-autocheck">
          <input
            type="checkbox"
            checked={autoCheck}
            onChange={(event) => toggleAutoCheck(event.target.checked)}
            disabled={!updatesApi}
          />
          <span>{t('settings.plugins.updates.autoCheck')}</span>
        </label>
        <p style={{ color: 'var(--text-muted)', fontSize: '11px', margin: '6px 0 0' }}>
          {t('settings.plugins.updates.autoCheckHint')}
        </p>

        {updateState?.catalog?.ok === false && (
          <p className="plugin-update-error">
            {t('settings.plugins.updates.hints.catalog')}
          </p>
        )}

        {notice && (
          <p className={`plugin-update-notice is-${notice.tone}`}>{notice.text}</p>
        )}
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">{t('settings.plugins.cardTitle')}</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={openPluginsFolder} className="diag-open-btn">
              <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
              </svg>
              {t('common.openFolder')}
            </button>
            <button
              onClick={handleReloadPlugins}
              className="btn-secondary"
              style={{ width: 'auto', padding: '6px 14px', fontSize: '12px' }}
              disabled={reloading}
            >
              {reloading ? t('common.rescanning') : t('common.reload')}
            </button>
          </div>
        </div>

        <div id="pluginList">
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
              {t('common.loading')}
            </p>
          ) : plugins.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
              {t('settings.plugins.empty')}
            </p>
          ) : (
            plugins.map((plugin) => {
              const update = updateFor(plugin.id);
              const status = update?.status || 'idle';
              const canUpdate = status === 'update_available';
              return (
                <div key={plugin.id} className="plugin-item plugin-item-update">
                  <div className="plugin-item-info">
                    <span className="plugin-item-name">{plugin.name}</span>
                    <span className="plugin-version">
                      {t('settings.plugins.updates.installedVersion')} {update?.installedVersion || '—'}
                    </span>
                  </div>

                  <div className="plugin-update-status">
                    <span className={`plugin-update-badge is-${toneFor(status)}`}>
                      {statusLabel(status)}
                    </span>
                    {canUpdate && update?.availableVersion && (
                      <span className="plugin-update-available">
                        {t('settings.plugins.updates.availableVersion')} {update.availableVersion}
                      </span>
                    )}
                  </div>

                  <label
                    className="toggle-wrap"
                    title={plugin.enabled ? t('settings.plugins.disable') : t('settings.plugins.enable')}
                  >
                    <input
                      type="checkbox"
                      checked={plugin.enabled || false}
                      onChange={(e) => handleTogglePlugin(plugin.id, e.target.checked)}
                    />
                    <span className="toggle-slider"></span>
                  </label>

                  {updateState && (
                    <div className="plugin-update-details">
                      <div className="plugin-update-meta">
                        <label className="plugin-update-meta-item">
                          <span>{t('settings.plugins.updates.channel')}</span>
                          <select
                            value={update?.channel || 'stable'}
                            onChange={(event) => changeChannel(plugin.id, event.target.value)}
                          >
                            <option value="stable">stable</option>
                            <option value="beta">beta</option>
                            <option value="alpha">alpha</option>
                          </select>
                        </label>

                        {update?.developerName && (
                          <span className="plugin-update-meta-item">
                            <span>{t('settings.plugins.updates.developer')}</span>
                            <strong>{update.developerName}</strong>
                          </span>
                        )}

                        <span className="plugin-update-meta-item">
                          <span>{t('settings.plugins.updates.source')}</span>
                          <strong>
                            {update?.source?.host || t('settings.plugins.updates.sourceMissing')}
                          </strong>
                        </span>

                        {update?.downloadHost && (
                          <span className="plugin-update-meta-item">
                            <span>{t('settings.plugins.updates.downloadHost')}</span>
                            <strong>{update.downloadHost}</strong>
                          </span>
                        )}

                        <span className="plugin-update-meta-item">
                          <span>{t('settings.plugins.updates.integrity')}</span>
                          <strong>
                            {update?.integrity === 'verified'
                              ? t('settings.plugins.updates.integrityVerified')
                              : update?.integrity === 'failed'
                                ? t('settings.plugins.updates.integrityFailed')
                                : t('settings.plugins.updates.integrityPending')}
                          </strong>
                        </span>

                        {update?.signature && (
                          <span className="plugin-update-meta-item">
                            <span>{t('settings.plugins.updates.signature')}</span>
                            <strong>
                              {update.signature.status === 'valid'
                                ? t('settings.plugins.updates.signatureValid')
                                : update.signature.status === 'unsigned'
                                  ? t('settings.plugins.updates.signatureUnsigned')
                                  : update.signature.status === 'unknown_key'
                                    ? t('settings.plugins.updates.signatureUnknown')
                                    : t('settings.plugins.updates.signatureInvalid')}
                            </strong>
                          </span>
                        )}

                        <span className="plugin-update-meta-item">
                          <span>{t('settings.plugins.updates.lastChecked')}</span>
                          <strong>
                            {update?.lastCheckedAt
                              ? new Date(update.lastCheckedAt).toLocaleString()
                              : t('settings.plugins.updates.neverChecked')}
                          </strong>
                        </span>
                      </div>

                      {status === 'no_source' && (
                        <p className="plugin-update-hint">{t('settings.plugins.updates.hints.noSource')}</p>
                      )}
                      {status === 'incompatible' && (
                        <p className="plugin-update-hint">{t('settings.plugins.updates.hints.incompatible')}</p>
                      )}
                      {status === 'not_published' && (
                        <p className="plugin-update-hint">{t('settings.plugins.updates.hints.notPublished')}</p>
                      )}
                      {status === 'channel_mismatch' && (
                        <p className="plugin-update-hint">{t('settings.plugins.updates.hints.channelMismatch')}</p>
                      )}
                      {update?.error?.message && status !== 'no_source' && (
                        <p className="plugin-update-error">{update.error.message}</p>
                      )}
                      {update?.requiresPermissionApproval && (
                        <p className="plugin-update-hint">{t('settings.plugins.updates.hints.permissions')}</p>
                      )}

                      {update?.changelog && (
                        <details className="plugin-update-changelog">
                          <summary>{t('settings.plugins.updates.changelog')}</summary>
                          <pre>{update.changelog}</pre>
                        </details>
                      )}

                      <div className="plugin-update-actions">
                        <button
                          className="btn-secondary"
                          style={{ width: 'auto', padding: '5px 12px', fontSize: '12px' }}
                          onClick={() => runCheck(plugin.id)}
                          disabled={checking || Boolean(busyId)}
                        >
                          {t('settings.plugins.updates.checkOne')}
                        </button>
                        <button
                          className="btn-primary"
                          style={{ width: 'auto', padding: '5px 12px', fontSize: '12px' }}
                          onClick={() => requestUpdate(plugin, update)}
                          disabled={!canUpdate || Boolean(busyId) || update?.incompatible}
                        >
                          {busyId === plugin.id ? t('settings.plugins.updates.status.installing') : t('settings.plugins.updates.update')}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      {dialog && (
        <div className="modal-backdrop open" role="dialog" aria-modal="true">
          <div className="modal">
            <h2 className="modal-title">
              {dialog.type === 'permissions'
                ? t('settings.plugins.updates.permissions.title')
                : t('settings.plugins.updates.unsigned.title')}
            </h2>
            <p className="modal-text">
              {dialog.type === 'permissions'
                ? t('settings.plugins.updates.permissions.intro')
                : t('settings.plugins.updates.unsigned.warning')}
            </p>

            {dialog.type === 'permissions' && (
              <>
                <div className="modal-warning">
                  <strong>{dialog.plugin.name} {dialog.update?.availableVersion}</strong>
                  <ul className="plugin-permission-list">
                    {(dialog.update?.permissions?.added || []).map((permission) => (
                      <li key={permission}>{permissionLabel(permission)} <code>{permission}</code></li>
                    ))}
                  </ul>
                  {(dialog.update?.permissions?.addedCapabilities || []).length > 0 && (
                    <>
                      <p style={{ marginBottom: '4px' }}>{t('settings.plugins.updates.permissions.capabilities')}</p>
                      <ul className="plugin-permission-list">
                        {dialog.update.permissions.addedCapabilities.map((capability) => (
                          <li key={capability}><code>{capability}</code></li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
                {(dialog.update?.permissions?.removed || []).length > 0 && (
                  <p className="modal-text">
                    {t('settings.plugins.updates.permissions.removed')}: {dialog.update.permissions.removed.join(', ')}
                  </p>
                )}
              </>
            )}

            <div className="modal-actions">
              <button className="btn-secondary" onClick={() => setDialog(null)}>
                {dialog.type === 'permissions'
                  ? t('settings.plugins.updates.permissions.cancel')
                  : t('settings.plugins.updates.cancel')}
              </button>
              <button className="btn-primary" onClick={confirmDialog}>
                {dialog.type === 'permissions'
                  ? t('settings.plugins.updates.permissions.confirm')
                  : t('settings.plugins.updates.unsigned.confirm')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PluginsSettings;
