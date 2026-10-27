import { useEffect, useState } from 'react';
import { SettingsPage } from '../features/settings/SettingsPage.tsx';
import { TtsPage } from '../features/tts/TtsPage.tsx';
import { AudiobookPage } from '../features/audiobook/AudiobookPage.tsx';
import { VoiceLabPage } from '../features/voices/VoiceLabPage.tsx';
import { BrandMark } from '../ui/components/Brand.tsx';
import { Player } from '../ui/components/Player.tsx';
import { Toasts } from '../ui/components/Toasts.tsx';
import { BookIcon, GearIcon, VoiceIcon, WaveIcon } from '../ui/icons.tsx';
import { getHealth } from './api.ts';
import { useT, type MessageKey } from './i18n.ts';
import { useSettings } from './settings.ts';
import { useConnection } from './stores.ts';

type Page = 'tts' | 'voices' | 'audiobook' | 'settings';

const NAV: { page: Page; label: MessageKey; Icon: typeof WaveIcon }[] = [
  { page: 'tts', label: 'nav.tts', Icon: WaveIcon },
  { page: 'voices', label: 'nav.voices', Icon: VoiceIcon },
  { page: 'audiobook', label: 'nav.audiobook', Icon: BookIcon },
  { page: 'settings', label: 'nav.settings', Icon: GearIcon },
];

const HASHES: Record<Page, string> = { tts: '#/', voices: '#/voices', audiobook: '#/audiobook', settings: '#/settings' };

function pageFromHash(): Page {
  const hash = window.location.hash;
  if (hash === HASHES.settings) return 'settings';
  if (hash === HASHES.voices) return 'voices';
  if (hash === HASHES.audiobook) return 'audiobook';
  return 'tts';
}

function useDocumentLang() {
  const lang = useSettings((s) => s.lang);
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
}

export function App() {
  const t = useT();
  const [page, setPage] = useState<Page>(pageFromHash);
  const keyPresent = useConnection((s) => s.keyPresent);
  const setKeyPresent = useConnection((s) => s.setKeyPresent);
  useDocumentLang();

  useEffect(() => {
    const onHash = () => setPage(pageFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    getHealth()
      .then((h) => setKeyPresent(h.keyPresent))
      .catch(() => setKeyPresent(null));
  }, [setKeyPresent]);

  const go = (next: Page) => {
    window.location.hash = HASHES[next];
    setPage(next);
  };

  const statusKey: MessageKey = keyPresent === null ? 'nav.keyUnknown' : keyPresent ? 'nav.keyOk' : 'nav.keyMissing';

  return (
    <div className="shell">
      <nav className="sidebar" aria-label="Timbre Studio">
        <div className="brand">
          <BrandMark />
          <span className="brand-text">
            <span className="brand-name">Timbre Studio</span>
            <span className="brand-tag">{t('app.tagline')}</span>
          </span>
        </div>
        {NAV.map(({ page: target, label, Icon }) => (
          <button key={target} type="button" className="nav-item" aria-current={page === target ? 'page' : undefined} onClick={() => go(target)} title={t(label)}>
            <Icon className="nav-icon" />
            <span className="nav-label">{t(label)}</span>
          </button>
        ))}
        <div className="sidebar-foot">
          <span className={`status-dot ${keyPresent ? 'ok' : keyPresent === false ? 'bad' : ''}`} />
          {t(statusKey)}
        </div>
      </nav>
      <main className="main">
        {page === 'tts' && <TtsPage />}
        {page === 'voices' && <VoiceLabPage />}
        {page === 'audiobook' && <AudiobookPage />}
        {page === 'settings' && <SettingsPage />}
      </main>
      <Player />
      <Toasts />
    </div>
  );
}
