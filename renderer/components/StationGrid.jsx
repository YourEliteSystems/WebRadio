import React from 'react';

export default function StationGrid({ stations, favorites = [], onPlay, onToggleFavorite }) {
  if (!stations || stations.length === 0) {
    return (
      <div style={{ color: 'var(--text-muted)', textAlign: 'center', marginTop: '40px' }}>
        Keine Sender gefunden. Nutze die Suche in der Seitenleiste.
      </div>
    );
  }

  return (
    <div className="station-grid">
      {stations.map((station) => {
        const url = station.url_resolved || station.url;
        const isFav = favorites.some(f => f.url === url);
        
        return (
          <div 
            key={station.stationuuid || station.id || Math.random()} 
            className="station-card" 
          >
            <button 
              onClick={(e) => { e.stopPropagation(); onToggleFavorite(station); }}
              style={{
                position: 'absolute', top: '8px', right: '8px', zIndex: 10,
                background: 'rgba(0,0,0,0.5)', border: 'none', borderRadius: '50%',
                width: '28px', height: '28px', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: isFav ? '#ef4444' : 'rgba(255,255,255,0.5)'
              }}
              title="Favorit"
            >
              <svg viewBox="0 0 24 24" width="14" height="14" stroke="currentColor" strokeWidth="2" fill={isFav ? 'currentColor' : 'none'} strokeLinecap="round" strokeLinejoin="round">
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path>
              </svg>
            </button>

            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }} onClick={() => onPlay(url, station)}>
              <img 
                className="logo" 
                src={station.favicon || station.logo || '../assets/default-logo.png'} 
                onError={(e) => { e.target.src = '../assets/default-logo.png'; }}
                alt={station.name} 
              />
              <div className="station-name" style={{ marginTop: '12px' }}>{station.name}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
