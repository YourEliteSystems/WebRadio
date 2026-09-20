import React from 'react';

const SettingsSidebar = ({ currentPage, setCurrentPage }) => {
  const navItems = [
    {
      id: 'integrations',
      label: 'Integrationen',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
        </svg>
      ),
      group: 'Allgemein'
    },
    {
      id: 'plugins',
      label: 'Plugins',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
        </svg>
      ),
      group: 'Allgemein'
    },
    {
      id: 'themes',
      label: 'Themes',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
        </svg>
      ),
      group: 'Allgemein'
    },
    {
      id: 'updates',
      label: 'Updates',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="1 4 1 10 7 10" />
          <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
        </svg>
      ),
      group: 'Allgemein'
    },
    {
      id: 'player',
      label: 'Player',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      ),
      group: 'Allgemein'
    },
    {
      id: 'about',
      label: 'Über',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
      ),
      group: 'Allgemein'
    },
    {
      id: 'diagnostics',
      label: 'Diagnostics',
      icon: (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      ),
      group: 'System'
    }
  ];

  const groupedItems = navItems.reduce((acc, item) => {
    if (!acc[item.group]) {
      acc[item.group] = [];
    }
    acc[item.group].push(item);
    return acc;
  }, {});

  return (
    <nav className="settings-nav">
      {Object.entries(groupedItems).map(([groupName, items]) => (
        <React.Fragment key={groupName}>
          <span className="settings-nav-label">{groupName}</span>
          {items.map((item) => (
            <button
              key={item.id}
              className={`settings-nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
              data-page={item.id}
            >
              {item.icon}
              {item.label}
              {item.id === 'updates' && (
                <span 
                  id="nav-update-dot"
                  style={{ display: 'none', width: '7px', height: '7px', borderRadius: '50%', 
                          background: 'var(--accent-color)', marginLeft: 'auto', 
                          boxShadow: '0 0 6px rgba(99,102,241,0.7)' }}
                />
              )}
            </button>
          ))}
        </React.Fragment>
      ))}
    </nav>
  );
};

export default SettingsSidebar;
