import React, { useEffect, useRef, useState } from 'react';
import { getAnalyser } from '../services/playerService';
import { applyThemeCss, resolveActiveTheme } from '../services/themeService';

export default function PlayerBar({ 
  station, 
  title, 
  volume, 
  onVolumeChange, 
  onPlay, 
  onStop,
  isPlaying,
  isFavorite,
  onToggleFavorite
}) {
  const canvasRef = useRef(null);
  const [themes, setThemes] = useState([]);
  const [currentTheme, setCurrentTheme] = useState('');

  // Theme-Liste für den Selector (Stylesheet wird bereits beim Bootstrap gesetzt)
  useEffect(() => {
    if (!window.themeAPI?.getThemes) return;

    Promise.all([
      window.themeAPI.getThemes(),
      window.themeAPI.getActiveTheme()
    ]).then(([res, activeId]) => {
      setThemes(res);
      const theme = resolveActiveTheme(res, activeId);
      if (theme) setCurrentTheme(theme.css);
    });
  }, []);

  const handleThemeChange = (e) => {
    const cssPath = e.target.value;
    setCurrentTheme(cssPath);
    applyThemeCss(cssPath);

    const foundTheme = themes.find(t => t.css === cssPath);
    if (foundTheme && window.themeAPI.setActiveTheme) {
      window.themeAPI.setActiveTheme(foundTheme.id);
    }
  };


  // Visualizer Animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const analyser = getAnalyser();
    if (!analyser) return;

    const ctx = canvas.getContext('2d');
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let animationId;

    const draw = () => {
      animationId = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);
      
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      const barWidth = (canvas.width / dataArray.length) * 2.5;
      let x = 0;
      
      for (let i = 0; i < dataArray.length; i++) {
        const barHeight = (dataArray[i] / 255) * canvas.height;
        
        // Brighter Gradient color for visualizer
        const gradient = ctx.createLinearGradient(0, canvas.height, 0, 0);
        gradient.addColorStop(0, '#00f2fe'); // Bright Cyan
        gradient.addColorStop(1, '#4facfe'); // Bright Blue
        
        ctx.fillStyle = gradient;
        ctx.fillRect(x, canvas.height - barHeight, barWidth, barHeight);
        
        x += barWidth + 1;
      }
    };
    
    draw();
    return () => cancelAnimationFrame(animationId);
  }, []);

  const openSettings = () => {
    if (window.api && window.api.openSettings) {
      window.api.openSettings();
    }
  };

  return (
    <footer className="player">
      <div className="now-playing">
        <img 
          className="np-logo" 
          src={station?.favicon || station?.logo || '../assets/default-logo.png'} 
          onError={(e) => { e.target.src = '../assets/default-logo.png'; }}
          alt="logo" 
        />
        <div className="np-info">
          <div className="np-station">{station?.name || 'Kein Sender'}</div>
          <div className="np-title">{title || '–'}</div>
        </div>
        {station && (
          <button 
            className="player-btn" 
            onClick={onToggleFavorite} 
            title="Favorit"
            style={{ color: isFavorite ? '#ef4444' : 'var(--text-muted)', marginLeft: '8px', width: '32px', height: '32px' }}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" stroke="currentColor" strokeWidth="2" fill={isFavorite ? 'currentColor' : 'none'} strokeLinecap="round" strokeLinejoin="round">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
            </svg>
          </button>
        )}
      </div>

      <div className="player-center">
        <button 
          className="player-btn play" 
          onClick={() => onPlay()}
          title="Play / Retry"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="5 3 19 12 5 21 5 3"></polygon>
          </svg>
        </button>
        <button 
          className="player-btn" 
          onClick={onStop}
          title="Stop"
        >
          <svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
          </svg>
        </button>
      </div>

      <div className="player-right">
        {themes.length > 0 && (
          <select 
            value={currentTheme} 
            onChange={handleThemeChange} 
            style={{width: "110px", padding: "6px", fontSize: "12px", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "6px", color: "var(--text-main)", cursor: "pointer"}}
          >
            {themes.map(t => <option key={t.id || t.css} value={t.css} style={{background: "#161921"}}>{t.name}</option>)}
          </select>
        )}
        <div className="volume-container">
          <svg viewBox="0 0 24 24" width="16" height="16" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
          <input 
            type="range" 
            min="0" 
            max="1" 
            step="0.01" 
            value={volume} 
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))} 
          />
        </div>
        <canvas ref={canvasRef} id="vu" width="100" height="30"></canvas>
        <button className="player-btn" onClick={openSettings} title="Einstellungen">
          <svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="3"></circle>
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path>
          </svg>
        </button>
      </div>
    </footer>
  );
}
