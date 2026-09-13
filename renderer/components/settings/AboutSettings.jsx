import React, { useState, useEffect } from 'react';

const AboutSettings = () => {
  const [currentVersion, setCurrentVersion] = useState('–');

  useEffect(() => {
    const loadVersion = async () => {
      try {
        if (window.updatesAPI?.getCurrentVersion) {
          const info = await window.updatesAPI.getCurrentVersion();
          if (info?.ok) {
            setCurrentVersion(`v${info.version}`);
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
  }, []);

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h1>Über WebRadio</h1>
        <p>Informationen zur App</p>
      </div>

      <div className="settings-card">
        <div style={{display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '20px'}}>
          <div className="app-logo" style={{width: '48px', height: '48px', borderRadius: '12px', background: 'var(--accent-color)'}}></div>
          <div>
            <h2 style={{margin: 0, fontSize: '20px', fontWeight: 600}}>WebRadio</h2>
            <p style={{margin: '4px 0 0', fontSize: '13px', color: 'var(--text-muted)'}}>Dein modernes Radioerlebnis</p>
          </div>
        </div>
        <div style={{display: 'flex', flexDirection: 'column', gap: '12px'}}>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontSize: '13px', color: 'var(--text-muted)'}}>Version</span>
            <strong id="currentVersionAbout" style={{fontSize: '13px'}}>{currentVersion}</strong>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontSize: '13px', color: 'var(--text-muted)'}}>Entwickler</span>
            <strong style={{fontSize: '13px'}}>YourEliteSystems</strong>
          </div>
          <div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
            <span style={{fontSize: '13px', color: 'var(--text-muted)'}}>Plattform</span>
            <strong style={{fontSize: '13px'}}>Electron</strong>
          </div>
        </div>
      </div>

      <div className="settings-card">
        <p style={{fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6, margin: 0}}>
          WebRadio wurde entwickelt, um deine Lieblingssender einfach und stilvoll zu hören. Mit Plugin-Unterstützung,
          anpassbaren Themes und automatischen Updates bleibst du immer auf dem neuesten Stand.
        </p>
        <p style={{fontSize: '12px', color: 'var(--text-muted)', marginTop: '12px'}}>
          © 2025 YourEliteSystems. Alle Rechte vorbehalten.
        </p>
      </div>
    </div>
  );
};

export default AboutSettings;
