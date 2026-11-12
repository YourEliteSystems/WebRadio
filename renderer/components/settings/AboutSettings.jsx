import React, { useState, useEffect } from 'react';
import { useTranslation } from '../../localization/index.js';

const AboutSettings = () => {
  const { t } = useTranslation();
  const [currentVersion, setCurrentVersion] = useState('–');
  const [installedChannel, setInstalledChannel] = useState('stable');
  const [channelsMeta, setChannelsMeta] = useState([]);

  useEffect(() => {
    const loadVersion = async () => {
      try {
        if (window.updatesAPI?.getCurrentVersion) {
          const info = await window.updatesAPI.getCurrentVersion();
          if (info?.ok) {
            setCurrentVersion(`v${info.version}`);
            // Installierter Release-Typ – unabhaengig vom ausgewaehlten
            // Update-Kanal.
            setInstalledChannel(info.versionChannel || 'stable');
          }
        } else if (window.updaterAPI?.getVersion) {
          const v = await window.updaterAPI.getVersion();
          setCurrentVersion(`v${v}`);
        }
      } catch (err) {
        console.error("Failed to load version:", err);
      }
    };

    loadVersion();

    const loadChannelMetadata = async () => {
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
    };
    loadChannelMetadata();
  }, []);

  const installedMeta = channelsMeta.find((meta) => meta.id === installedChannel) || null;

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h1>{t('settings.about.title')}</h1>
        <p>{t('settings.about.subtitle')}</p>
      </div>

      <div className="settings-card">
        <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px'}}>
          <div className="app-logo" style={{width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-color)'}}></div>
          <div>
            <h2 style={{margin: 0, fontSize: '20px', fontWeight: 600}}>{t('app.name')}</h2>
            <p style={{margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)'}}>{t('app.tagline')}</p>
          </div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontSize: '13px', color: 'var(--text-muted)'}}>{t('app.version')}</span>
            <span style={{display: 'inline-flex', alignItems: 'center', gap: '8px'}}>
              <strong id="currentVersionAbout" style={{fontSize: '13px'}}>{currentVersion}</strong>
              <span
                className={`channel-badge ${installedChannel}`}
                style={{ '--update-channel-color': installedMeta?.color }}
                title={t('settings.updates.installedReleaseType')}
              >
                {installedMeta?.shortLabel ?? installedChannel.toUpperCase()}
              </span>
            </span>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontSize: '13px', color: 'var(--text-muted)'}}>{t('app.developer')}</span>
            <strong style={{fontSize: '13px'}}>YourEliteSystems</strong>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontSize: '13px', color: 'var(--text-muted)'}}>{t('app.platform')}</span>
            <strong style={{fontSize: '13px'}}>Electron</strong>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <p style={{fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0}}>
          {t('app.description')}
        </p>
        <p style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px'}}>
          {t('app.copyright')}
        </p>
      </div>
    </div>
  );
};

export default AboutSettings;
