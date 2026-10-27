import { describe, expect, it } from 'vitest';
import { decodeText } from './textFile.ts';

const TEXT = 'Été, à côté du cœur : « l’été ».';

const bytes = (values: number[]) => new Uint8Array(values);

/** Windows-1252 encoding of TEXT, written out by hand (no encoder for it in the platform). */
const CP1252 = bytes([
  0xc9, 0x74, 0xe9, 0x2c, 0x20, 0xe0, 0x20, 0x63, 0xf4, 0x74, 0xe9, 0x20, 0x64, 0x75, 0x20, 0x63, 0x9c, 0x75, 0x72, 0x20, 0x3a, 0x20, 0xab, 0x20, 0x6c, 0x92,
  0xe9, 0x74, 0xe9, 0x20, 0xbb, 0x2e,
]);

function utf16(text: string, littleEndian: boolean): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(2 + text.length * 2);
  const view = new DataView(out.buffer);
  view.setUint16(0, 0xfeff, littleEndian);
  for (let i = 0; i < text.length; i++) view.setUint16(2 + i * 2, text.charCodeAt(i), littleEndian);
  return out;
}

describe('decodeText', () => {
  it('reads UTF-8, with or without a byte-order mark', () => {
    const utf8 = new TextEncoder().encode(TEXT);
    expect(decodeText(utf8)).toBe(TEXT);
    expect(decodeText(bytes([0xef, 0xbb, 0xbf, ...utf8]))).toBe(TEXT);
  });

  it('falls back to Windows-1252 for an older Windows text file', () => {
    expect(decodeText(CP1252)).toBe(TEXT);
  });

  it('reads UTF-16 files saved by Notepad as "Unicode"', () => {
    expect(decodeText(utf16(TEXT, true))).toBe(TEXT);
    expect(decodeText(utf16(TEXT, false))).toBe(TEXT);
  });
});
