// Voice "tone disc": a stable, recognisable swatch for each voice, drawn like a speaker cone.
// The same seed always gives the same disc. Curated warm and cool pairs, no purple-to-blue.
import type { CSSProperties } from 'react';

const TONES: readonly [string, string][] = [
  ['#f2b544', '#9a4a17'], // amber, copper
  ['#5fd6b8', '#1d6468'], // sea, teal
  ['#f08a6c', '#7f2a36'], // coral, wine
  ['#c9d46a', '#4a652a'], // lime, olive
  ['#84c6ea', '#2a5776'], // sky, steel
  ['#e9cfa6', '#6f5234'], // sand, walnut
  ['#ec7f9a', '#62284c'], // rose, plum
  ['#a4dcc4', '#2c574b'], // mint, pine
];

/** FNV-1a: small, fast and stable across sessions. */
function hash(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function toneFor(seed: string): [string, string] {
  return TONES[hash(seed) % TONES.length] ?? ['#f2b544', '#9a4a17'];
}

interface VoiceOrbProps {
  seed: string;
  size?: number;
  className?: string;
}

export function VoiceOrb({ seed, size = 32, className = '' }: VoiceOrbProps) {
  const [light, dark] = toneFor(seed);
  const angle = hash(`${seed}#`) % 360;
  const style = {
    '--orb-size': `${size}px`,
    '--orb-light': light,
    '--orb-dark': dark,
    '--orb-angle': `${angle}deg`,
  } as CSSProperties;
  return <span className={`orb ${className}`} style={style} aria-hidden="true" />;
}
