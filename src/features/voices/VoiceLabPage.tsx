// Voice Lab (spec F7, F8, F15): My voices, Create a voice, Clone my voice.
import { useEffect, useState } from 'react';
import { useT, type MessageKey } from '../../app/i18n.ts';
import { useSettings } from '../../app/settings.ts';
import { useToasts } from '../../app/stores.ts';
import { useVoices } from '../../app/voices.ts';
import type { VoicePreset } from '../../db/schema.ts';
import { MyVoices } from './MyVoices.tsx';
import { VoiceCloner } from './VoiceCloner.tsx';
import { VoiceDesigner } from './VoiceDesigner.tsx';
import { VoiceGallery } from './VoiceGallery.tsx';

type Tab = 'mine' | 'google' | 'design' | 'clone';

const TABS: { id: Tab; label: MessageKey }[] = [
  { id: 'mine', label: 'voices.tab.mine' },
  { id: 'google', label: 'voices.tab.google' },
  { id: 'design', label: 'voices.tab.design' },
  { id: 'clone', label: 'voices.tab.clone' },
];

export function VoiceLabPage() {
  const t = useT();
  const refresh = useVoices((s) => s.refresh);
  const updateSettings = useSettings((s) => s.update);
  const toast = useToasts((s) => s.push);
  const [tab, setTab] = useState<Tab>('mine');
  const [designBase, setDesignBase] = useState('');

  useEffect(() => {
    void refresh();
  }, [refresh]);

  /** Selects the voice (and its default direction) for Text to Speech, then opens that page. */
  const use = (preset: VoicePreset) => {
    updateSettings({ voice: preset.voiceId, ...(preset.styleLine ? { style: preset.styleLine } : {}) });
    toast('success', t('mine.used', { name: preset.name }));
    window.location.hash = '#/';
  };

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-head">
          <div>
            <h1>{t('voices.title')}</h1>
            <p className="page-sub">{t('voices.intro')}</p>
          </div>
        </header>

        <div className="tabs" role="tablist" aria-label={t('voices.title')}>
          {TABS.map(({ id, label }) => (
            <button key={id} type="button" role="tab" id={`tab-${id}`} aria-selected={tab === id} aria-controls={`panel-${id}`} className="tab" onClick={() => setTab(id)}>
              {t(label)}
            </button>
          ))}
        </div>

        <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
          {tab === 'mine' && (
            <MyVoices
              onCreate={() => {
                setDesignBase('');
                setTab('design');
              }}
              onUse={use}
            />
          )}
          {tab === 'google' && (
            <VoiceGallery
              onUse={(name) => {
                updateSettings({ voice: name });
                toast('success', t('mine.used', { name }));
                window.location.hash = '#/';
              }}
              onVariant={(name) => {
                setDesignBase(name);
                setTab('design');
              }}
            />
          )}
          {tab === 'design' && <VoiceDesigner key={designBase} initialBase={designBase} onUse={use} />}
          {tab === 'clone' && <VoiceCloner onUse={use} />}
        </div>
      </div>
    </div>
  );
}
