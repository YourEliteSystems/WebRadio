import React, { useCallback, useState } from 'react';
import { useTranslation } from '../../localization/index.js';

const SYSTEM_PREFERENCE = 'system';

/**
 * Spracheinstellungen.
 *
 * Die Auswahl wirkt sofort (kein Neustart). Die Persistenz übernimmt der
 * Main-Prozess über die bestehende sichere Einstellungsspeicherung; scheitert
 * das Speichern, wird die vorherige Auswahl wiederhergestellt und ein
 * verständlicher Fehler angezeigt.
 */
export default function LanguageSettings() {
  const { t, locale, preference, systemLocale, languages, setLanguage, error } = useTranslation();
  const [pending, setPending] = useState(null);
  const [localError, setLocalError] = useState(null);

  const activeLabel = languages.find((language) => language.id === locale)?.label || locale;
  const systemUnsupported = preference === SYSTEM_PREFERENCE
    && systemLocale
    && !languages.some((language) => language.id === systemLocale);

  const handleSelect = useCallback(async (nextPreference) => {
    if (nextPreference === preference || pending) return;

    setPending(nextPreference);
    setLocalError(null);

    const result = await setLanguage(nextPreference);
    if (!result?.ok) {
      setLocalError(result?.error || 'persist-failed');
    }

    setPending(null);
  }, [preference, pending, setLanguage]);

  const renderOption = (id, title, description) => {
    const checked = preference === id;
    return (
      <div className="now-playing-mode-option" key={id}>
        <label>
          <input
            type="radio"
            name="applicationLanguage"
            value={id}
            checked={checked}
            disabled={Boolean(pending)}
            onChange={() => handleSelect(id)}
          />
          <span className="radio-label">
            <span className="radio-title">{title}</span>
            <span className="radio-description">{description}</span>
          </span>
        </label>
      </div>
    );
  };

  return (
    <div className="settings-page">
      <div className="settings-page-header">
        <h1>{t('settings.language.title')}</h1>
        <p>{t('settings.language.subtitle')}</p>
      </div>

      <div className="settings-card">
        <div className="settings-card-header">
          <span className="settings-card-title">{t('settings.language.cardTitle')}</span>
        </div>

        <div className="now-playing-settings" role="radiogroup" aria-label={t('settings.language.cardTitle')}>
          {renderOption(
            SYSTEM_PREFERENCE,
            t('settings.language.systemTitle'),
            t('settings.language.systemDescription')
          )}
          {languages.map((language) => renderOption(
            language.id,
            language.label,
            t('settings.language.activeLanguage', { language: language.label })
          ))}
        </div>

        <div className="settings-card-info">
          <p>{t('settings.language.activeLanguage', { language: activeLabel })}</p>
          {systemLocale && (
            <p>{t('settings.language.systemLanguage', { locale: systemLocale })}</p>
          )}
          {systemUnsupported && (
            <p>{t('settings.language.systemUnsupported', { locale: systemLocale })}</p>
          )}
          <p>{t('settings.language.instantNote')}</p>
          {(localError || error) && (
            <p style={{ color: '#ef4444' }} role="alert">
              {t('settings.language.saveError')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
