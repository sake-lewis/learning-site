# Timbre Studio — Design system

Redesign of 2026-10-27, built from five design skills: Impeccable (craft floor, Operate mode),
Anthropic frontend-design, Emil Kowalski's design-engineering rules, an Apple HIG skill and
UI/UX Pro Max (audio and podcast product rows).

## Direction: "the console"

Timbre Studio is a working tool (Impeccable's *Operate* mode): people write, listen, compare and
export for long sessions. Its visual world comes from the subject itself, the recording studio:
graphite console panels, amber VU-meter light, a green "ready" lamp and a red "rec" lamp.
Ambition shows as precision: one typeface, a tight scale, a single accent reserved for action and
selection, and one signature element, the waveform strip.

- **Dark only** because of the use scene (long evening sessions, judging audio by ear and by
  waveform), not because of the product category. The light theme was removed at the user's request
  (2026-10-27); native controls follow through `color-scheme: dark`.
- **Signature**: the bottom player as a console strip (amber played waveform, timecode in tabular
  mono, a large round transport button) and voice "tone discs" that give every voice a stable,
  recognisable identity.

## Tokens

| Role | Value |
| --- | --- |
| Page | #121110 |
| Panels (second neutral layer: sidebar, inspector, player) | #171614 |
| Surface (editor, rows, cards) | #1C1A18 |
| Surface 2 (inputs, hover) | #24221F |
| Hairline | rgba(255,240,220,.08) |
| Text | #F2EDE6 |
| Muted text | #A39C92 |
| Faint text (placeholders) | #8A8378 |
| Accent (amber) | #F2B544, ink on it #1A1408 |
| Accent as text | #F5C46A |
| Ready (green) | #4CD38A |
| Rec / danger (red) | #FF5A4E |
| Warning (orange) | #FF8A3D |

Neutrals are tinted warm; no pure black, white or grey. The accent appears only on the primary
action, the current selection, progress and the played part of a waveform.

- **Type**: Instrument Sans Variable for everything (one family in Operate mode); JetBrains Mono
  only for measurements (timecodes, counts, durations). Fixed rem scale, ratio about 1.2:
  12 / 13 / 14.5 / 16 / 19 / 23 / 28 px. Titles weight 620, tracking -0.02em. Labels are sentence
  case, never all caps.
- **Space**: 4/8 grid. Groups tight, separation generous; headings have more space above than below.
- **Shape**: rows and cards 12 px radius, inputs and buttons 10 px, pills only for small chips.
  Elevation is declared once: a hairline border *or* a shadow, never both. No nested cards.
- **Motion** (Emil Kowalski): `--ease-out: cubic-bezier(0.23, 1, 0.32, 1)`, drawer
  `cubic-bezier(0.32, 0.72, 0, 1)`. Press feedback `scale(0.97)` over 160 ms; hovers 150 ms `ease`;
  toasts and drawers 220–300 ms; nothing over 300 ms. Hover effects only under
  `(hover: hover) and (pointer: fine)`. Reduced motion keeps fades and drops movement.
  No page-load choreography, no bounce.
- **Browser surfaces**: amber text selection and caret, thin themed scrollbars (`scrollbar-color`),
  2 px amber focus ring with offset, tabular numerals for every number.

## Refused defaults

Inter, purple-to-blue gradients, neon-on-black, gradient text, glass as decoration, glows,
eyebrow labels, all-caps labels, middle-dot meta strings, coloured side borders, nested cards,
monospace as a "technical" costume, emoji icons.
