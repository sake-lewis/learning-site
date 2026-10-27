// Settings (F14): connection status, free-tier usage, appearance, local data.
import { useCallback, useEffect, useState } from 'react';
import type { Capabilities, Health } from '../../../shared/schemas.ts';
import { getCapabilities, getHealth } from '../../app/api.ts';
import { useT } from '../../app/i18n.ts';
import { quotaResetLabel } from '../../app/quota.ts';
import { RETENTION_DAYS } from '../../app/retention.ts';
import { useSettings } from '../../app/settings.ts';
import { useConnection, usePlayer, useToasts } from '../../app/stores.ts';
import { db, type Lang } from '../../db/schema.ts';

export function SettingsPage() {
  const t = useT();
  const { lang, update } = useSettings();
  const setKeyPresent = useConnection((s) => s.setKeyPresent);
  const clearPlayer = usePlayer((s) => s.clear);
  const toast = useToasts((s) => s.push);
  const [health, setHealth] = useState<Health | null>(null);
  const [caps, setCaps] = useState<Capabilities | null>(null);
  const [offline, setOffline] = useState(false);

  const refresh = useCallback(async () => {
    try {
      const h = await getHealth();
      setHealth(h);
      setKeyPresent(h.keyPresent);
      setOffline(false);
      setCaps(await getCapabilities());
    } catch {
      setOffline(true);
    }
  }, [setKeyPresent]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const clearAll = async () => {
    if (!window.confirm(t('settings.data.confirm'))) return;
    await db.transaction('rw', db.takes, db.history, async () => {
      await db.takes.clear();
      await db.history.clear();
    });
    clearPlayer();
    toast('success', t('settings.data.cleared'));
  };

  const capLabel = (value: Capabilities['library'] | undefined) => t(`settings.cap.${value ?? 'unknown'}`);

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <h1>{t('settings.title')}</h1>
        </header>

        <section className="stack" aria-labelledby="api-title">
          <h2 id="api-title" className="section-title">
            {t('settings.api')}
          </h2>
          {offline ? (
            <p className="alert">{t('error.NETWORK')}</p>
          ) : (
            <ul className="list settings-list">
              <li>
                <span className="label">{t('settings.key')}</span>
                <span className="value-line">
                  <span className={`status-dot ${health?.keyPresent ? 'ok' : health ? 'bad' : ''}`} />
                  {health ? (health.keyPresent ? t('settings.key.present') : t('settings.key.missing')) : '…'}
                </span>
              </li>
              <li>
                <span className="label">{t('settings.models')}</span>
                <span className="value-line">{health?.models.tts.join(', ') ?? '…'}</span>
              </li>
              <li>
                <span className="label">{t('settings.library')}</span>
                <span className="value-line">{capLabel(caps?.library)}</span>
              </li>
              <li>
                <span className="label">{t('settings.voiceDesign')}</span>
                <span className="value-line">{capLabel(caps?.voiceDesign)}</span>
              </li>
              <li>
                <span className="label">{t('settings.replication')}</span>
                <span className="value-line">{capLabel(caps?.replication)}</span>
              </li>
              <li>
                <span className="label">{t('settings.sdk')}</span>
                <span className="value-line">@google/genai {health?.sdkVersion ?? '…'}</span>
              </li>
            </ul>
          )}
          {health && !health.keyPresent && <p className="notice">{t('settings.howto')}</p>}
        </section>

        <section className="stack" aria-labelledby="usage-title">
          <h2 id="usage-title" className="section-title">
            {t('settings.usage')}
          </h2>
          <div className="card stack" style={{ gap: 6 }}>
            <p style={{ fontSize: 'var(--text-lg)', fontWeight: 600 }} className="num">
              {health ? t('settings.usage.value', { calls: health.usage.calls }) : '…'}
            </p>
            <p className="help" style={{ margin: 0, maxWidth: '70ch' }}>
              {t('settings.usage.note', { time: quotaResetLabel(lang) })}
            </p>
          </div>
        </section>

        <section className="stack" aria-labelledby="look-title">
          <h2 id="look-title" className="section-title">
            {t('settings.interface')}
          </h2>
          <ul className="list settings-list">
            <li>
              <span className="label" id="lang-label">
                {t('settings.language')}
              </span>
              <div className="segmented" role="radiogroup" aria-labelledby="lang-label" style={{ maxWidth: 360 }}>
                {(
                  [
                    ['fr', 'Français'],
                    ['en', 'English'],
                  ] as [Lang, string][]
                ).map(([value, label]) => (
                  <label key={value}>
                    <input type="radio" name="lang" checked={lang === value} onChange={() => update({ lang: value })} />
                    {label}
                  </label>
                ))}
              </div>
            </li>
          </ul>
        </section>

        <section className="stack" aria-labelledby="data-title">
          <h2 id="data-title" className="section-title">
            {t('settings.data')}
          </h2>
          <div className="card voice-card-head">
            <p className="help" style={{ margin: 0, maxWidth: '60ch' }}>
              {t('settings.data.note', { days: RETENTION_DAYS })}
            </p>
            <button type="button" className="btn btn-danger" onClick={() => void clearAll()}>
              {t('settings.data.clear')}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
