import React from 'react';
import { useTranslation } from '../../localization/index.js';

/**
 * Navigationsstruktur der Einstellungen.
 *
 * `labelKey` verweist auf einen Übersetzungsschlüssel; die sichtbare
 * Beschriftung wird erst beim Rendern aufgelöst. Dadurch ändert ein
 * Sprachwechsel sofort alle Einträge, ohne die Struktur neu aufzubauen.
 */
const NAV_ITEMS = [
  {
    id: 'integrations',
    labelKey: 'settings.nav.integrations',
    groupKey: 'settings.group.general',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
      </svg>
    )
  },
  {
    id: 'plugins',
    labelKey: 'settings.nav.plugins',
    groupKey: 'settings.group.general',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
      </svg>
    )
  },
  {
    id: 'themes',
    labelKey: 'settings.nav.themes',
    groupKey: 'settings.group.general',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    )
  },
  {
    id: 'updates',
    labelKey: 'settings.nav.updates',
    groupKey: 'settings.group.general',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
      </svg>
    )
  },
  {
    id: 'player',
    labelKey: 'settings.nav.player',
    groupKey: 'settings.group.general',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polygon points="5 3 19 12 5 21 5 3" />
      </svg>
    )
  },
  {
    id: 'language',
    labelKey: 'settings.nav.language',
    groupKey: 'settings.group.system',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <line x1="2" y1="12" x2="22" y2="12" />
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
      </svg>
    )
  },
  {
    id: 'about',
    labelKey: 'settings.nav.about',
    groupKey: 'settings.group.system',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 16v-4" />
        <path d="M12 8h.01" />
      </svg>
    )
  },
  {
    id: 'diagnostics',
    labelKey: 'settings.nav.diagnostics',
    groupKey: 'settings.group.system',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    )
  }
];

const SettingsSidebar = ({ currentPage, setCurrentPage }) => {
  const { t } = useTranslation();

  const groupedItems = NAV_ITEMS.reduce((acc, item) => {
    if (!acc[item.groupKey]) {
      acc[item.groupKey] = [];
    }
    acc[item.groupKey].push(item);
    return acc;
  }, {});

  return (
    <nav className="settings-nav">
      {Object.entries(groupedItems).map(([groupKey, items]) => (
        <React.Fragment key={groupKey}>
          <span className="settings-nav-label">{t(groupKey)}</span>
          {items.map((item) => (
            <button
              key={item.id}
              className={`settings-nav-item ${currentPage === item.id ? 'active' : ''}`}
              onClick={() => setCurrentPage(item.id)}
              data-page={item.id}
            >
              {item.icon}
              {t(item.labelKey)}
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
