# Decisions

Choices the specification leaves open, recorded per phase (spec section 10, rule 1).

## Phase 1 — Scaffold and first voice (2026-10-27)

- **Dependency versions** pinned exactly: `@google/genai` 2.31.0, React 19.3.1, Vite 8.3.5, TypeScript 7.0.2, Express 5.3.0, zod 4.6.7, Dexie 4.4.7, Zustand 5.0.16, Vitest 5.0.5.
- **Server runs TypeScript directly** with Node 24 type stripping (`erasableSyntaxOnly`), so there is no server build step. The key is loaded with `node --env-file-if-exists=.env`, so a missing `.env` does not crash the server; `/api/health` reports the key as missing instead.
- **Port 5178**, bound to 127.0.0.1. In dev, Vite runs on 5173 and proxies `/api` with `changeOrigin`, so the guard still sees its own Host; the dev origins are allowed only when `TIMBRE_DEV=1`.
- **Session token** is served by `GET /api/session`, which accepts only `Sec-Fetch-Site: same-origin` (or none). Every other `/api` route requires `X-Timbre-Token`. The client refreshes the token once on a 401, which covers server restarts.
- **Shared code** (zod schemas, WAV reader/writer, voice list, prices) lives in `shared/` and is imported by both client and server. `wav.ts` is therefore in `shared/` rather than `src/audio/`.
- **Output format**: the server asks Google for `audio/wav` and wraps headerless `audio/l16` in a WAV header if that is what comes back, so the client always receives WAV 24 kHz mono 16-bit.
- **Spend cap** is an estimate at Standard-tier prices (25 audio tokens/s), persisted in `data/usage.json` so a restart does not reset it. Default cap: $2/day, overridable with `DAILY_CAP_USD` in `.env`.
- **Capabilities**: the Library probe is one `voices.list({ page_size: 1 })` call, cached 10 min. Voice design and replication stay `unknown` until Phase 5–6, because confirming them would require creating a voice.
- **Voice genders** for the 30 prebuilt voices follow Google's catalogue naming; Phase 5 replaces this with the Extended Library metadata.
- **Fonts**: no web-font download (privacy, offline use, strict CSP). The stack is Inter if installed, then Segoe UI Variable / Segoe UI on Windows.
- **Phase 1 scope limits**: one segment of up to 8,000 characters (segmentation and the 50,000-character editor come in Phase 2); the script draft survives page switches but not a reload (project autosave is Phase 2); waveform peaks are computed on the main thread from 16-bit PCM (moved to a Worker with the Phase 3 DSP).
- **Generated audio autoplays** after a Generate click, since the click is the user's request to hear it; nothing plays on load.
- **Navigation** uses the URL hash (`#/`, `#/settings`) rather than a router dependency.

## Phase 2 — Voice Lab (2026-10-27)

- **Priority change**: the user asked for voice creation, modification and cloning first, so the Voice Lab moved from Phase 6 to Phase 2 (spec section 10 updated).
- **Voice design** uses `ai.voices.create({ store: true, voice: { type: "prompted", … } })` with `gemini-3.8-flash-tts` as the design model. Stored voices live in the user's Google project (1 year after last use, 200 per project) and are mirrored in IndexedDB with their prompt, form values, sample and default direction.
- **Persona prompt** is composed in English from the form (Google's examples are English); free text and accents that are not in the suggestion list pass through as typed. The user can edit the final prompt before sending.
- **Modify = remix** through `prompted.base_voice`, a field present in SDK 2.31.0 although Google's 2026-09-23 announcement called remixing "coming soon". If Google answers 400 to a remix, the server retries once as a fresh design from the original prompt plus the change and flags `remixFallback`, which the UI explains.
- **Keeping versions**: after a remix the user compares v1 and v2; keeping the new one deletes the old voice at Google, keeping the old one deletes the new. Nothing is deleted before that choice.
- **Cloning**: consent locales limited to fr-FR, fr-CA, en-US and en-GB, the four whose exact statement was verified. The consent clip can only be recorded live; the source clip can be recorded or imported. The browser converts both to 24 kHz mono 16-bit WAV; the server re-checks format and length (source 10–30 s, consent 2–30 s). The consent locale is sent as `language_code` because the guide does not name the `lang_id` field. Raw clips are discarded after the call; only their SHA-256 hashes are kept.
- **Simplified level check** (silent, too quiet, clipping) for cloning clips; the full quality gate of spec 4.1 comes with Voice Match in Phase 6.
- **Capabilities** for voice design and cloning are learned from the first real call (403 marks them unavailable); no probe ever creates a voice.
- **Voice creation pricing** is not published: each creation is counted as a call in the daily tracker but priced at $0. Separate local limit: 10 creations per minute, 50 per day.
- **Sync with Google** imports remote voices missing locally and fetches samples for up to 10 designed voices per sync.
- **Caching fix**: `index.html` is now served with `Cache-Control: no-cache` and hashed assets as immutable, so a rebuilt interface shows on the next load instead of up to an hour later.
- **IndexedDB version 2** adds indexes on `voicePresets` (name, voiceId, createdAt).

## Phase 2b — Free tier, previews, audiobook (2026-10-27)

- **Free tier only**: cost estimates, prices (`shared/pricing.ts` → `shared/models.ts`), the spend tracker, `DAILY_CAP_USD` and the local daily caps are removed. The only local limit left is an anti-runaway guard (30 TTS calls and 10 voice creations per minute). Settings shows the requests sent today and the local time of Google's daily reset (midnight Pacific time, computed with the time zone database, DST-safe).
- **Free-tier quotas are unknown**: Google does not publish per-model free limits for `gemini-3.8-flash-tts`, and a developer report shows enforcement below the dashboard figure. The app therefore never assumes a number: it reacts to 429 answers.
- **Voice previews**: five predefined sentences per language (French, English); a voice's own language picks the set, otherwise the interface language. A preview is generated once per voice, language and model, then cached in IndexedDB (`previews`, Dexie version 3); "Another sentence" replaces it. The ▶ button inside a voice row does not change the selected voice.
- **Audiobook**: text cleaned (Windows line endings, soft hyphens, page-number lines, PDF hard wraps re-joined), chapters detected from headings ("Chapitre", "Chapter", "Partie", "Prologue", Markdown `#`, Roman numerals), segments of about 2,500 characters (3,500 max) so a 40-page book is about 30 requests. Books and segments live in IndexedDB (Dexie version 4); the queue runs one request at a time and resumes at the first unfinished segment after a pause, a reload or a crash.
- **Quota handling in the queue**: per-minute 429 → wait 65 s, then 130 s, 195 s, 260 s; a per-day 429 (detected from Google's message) or a fifth consecutive 429 → the book pauses with the next reset time. Temporary errors (timeout, network, 5xx, no audio) → 3 attempts with 10 s, 20 s waits, then the segment is marked failed and the book pauses. Key, permission, model and input errors stop at once.
- **Assembly** builds chapter and book WAVs as Blobs made of a new header plus slices of the stored segments and shared silence buffers (600 ms between segments, 2 s between chapters), so a 270 MB book is never copied in memory. The player skips the waveform above 36 MB.
- **Server timeout** raised to 300 s per TTS call for 4-minute segments.
- **Testing on a second port**: the server honours `PORT`, so a test instance (e.g. 5179) can run beside the user's own instance on 5178 with a separate IndexedDB.

## Review fixes (independent code review, 2026-10-27)

- **One attempt per Google call**: the SDK retried 408/409/429/5xx and connection errors 4 extra times by default, including non-idempotent POSTs. Every call now passes `maxRetries: 0`; retries live in the audiobook queue, which knows about quotas.
- **Real deadline**: the SDK ignores `timeout_ms` once a `signal` is passed, so the 300 s limit never applied. Calls now use `AbortSignal.any([caller, AbortSignal.timeout(300 s)])` and a deadline maps to `TIMEOUT`.
- **Structured quota errors**: the server reads Google's error body (`violations[].quotaId`, `RetryInfo.retryDelay`) and returns `scope: day | minute` and `retryAfterSec`; the queue pauses on a daily quota and otherwise waits for Google's suggested delay. Error details now carry Google's own message, not the SDK's boilerplate, with the literal key value redacted.
- **Guard path case**: Express routes ignore case, so `/API/tts` bypassed the token check. The guard now lower-cases the path and treats `/api` itself as an API path (tests added).
- **Upstream 401 → 502 `KEY_INVALID`**: the browser keeps 401 for an expired local token and now refreshes the token only on `BAD_TOKEN`, so an invalid key no longer sends every request twice.
- **Audiobook lock**: the in-tab lock is taken before any await, released only by its owner, and a Web Lock (`navigator.locks`) stops a second tab from generating the same book.
- **Body reads**: a cancel or dropped connection while reading audio maps to `CANCELLED` / `NETWORK` instead of a raw exception.
- **Remix safety**: keeping a new version saves the preset first and deletes the old voice after; an undecided new version is deleted when the panel closes.
- **Microphone**: a recording started after the page was left, or a failing `MediaRecorder`, releases the stream at once.
- **One origin**: `localhost:5178` redirects to `127.0.0.1:5178` so data never splits between two IndexedDB stores.
- **Memory**: texts over 1,500 characters (audiobook segments) are not kept in the server cache; WAV durations are read from the first 4 KB only; waveform colours are read once per theme.
- **Launcher**: `scripts/prepare.ts` (run by `Timbre Studio.bat`) checks Node ≥ 24, reinstalls when `package-lock.json` changes and rebuilds when sources are newer than `dist/`.
- **No `delivery` field**: the review suggested `delivery: 'inline'`, but a live test showed Google rejects it ("Audio delivery mode is not supported"), so it is not sent. Audio still arrives inline by default.

## Redesign — "the console" (2026-10-27)

- Design system written to `DESIGN.md`, built from five skill repositories installed under `.claude/skills/` (downloads kept in `.skills-src/`, git-ignored): pbakaus/impeccable, anthropics/skills, nextlevelbuilder/ui-ux-pro-max-skill, emilkowalski/skills, SudewaJay/apple-design-skill (installed as `apple-design-hig` to avoid clashing with Emil's `apple-design`). Their scripts were never run.
- Self-hosted fonts from npm (`@fontsource-variable/instrument-sans`, `@fontsource-variable/jetbrains-mono`), so the strict CSP and offline use are kept.
- New components: `VoiceOrb` (deterministic tone disc per voice, curated warm and cool pairs), `BrandMark`, `EqLoader` (loading state), `BookCover`.
- Middle-dot meta strings replaced by hairline-separated lists or sentences; labels in sentence case; grouped lists instead of nested cards; hover styles only on precise pointers; reduced motion keeps fades only.

## Dark only (2026-10-27)

- **User decision**: the app is always dark. The light theme and the Dark / Light / System choice are removed; spec 6, 6.2, F14, 7.4 and 9 and `DESIGN.md` are updated to match.
- `tokens.css` keeps one set of colour tokens on `:root` with `color-scheme: dark`, so native controls (select lists, scrollbars, checkboxes) are dark too. `index.html` declares `<meta name="color-scheme" content="dark">` and `theme-color`, so the first paint is dark before the stylesheet loads, even when Windows is in light mode. The `data-theme` attribute is gone.
- Settings: the "Appearance" section becomes "Interface" and only holds the language.
- **Stored settings**: no Dexie migration. A settings row saved earlier still holds `theme`; it is ignored on load and dropped on the next save (checked in the browser with a row saved as `light`).
- The player reads its waveform colours from the tokens once, instead of on every theme change.
- Out of reach: `window.confirm` dialogs belong to the browser and follow the browser's own theme.

## Second review fixes (2026-10-27)

Points 1–5 of the code review made on the new account; points 6–9 follow in the next section.

- **Fonts and CSP**: Vite inlined the 2 KB JetBrains Mono cyrillic-ext subset as a `data:` URI, which `font-src 'self'` blocked (three console errors per load). `build.assetsInlineLimit` now never inlines font files; the CSP stays strict.
- **Chapter headings**: a heading word alone no longer opens a chapter ("Partie remise, dit-il." was read as a chapter title). "Chapitre", "Chapter", "Partie", "Part", "Livre" and "Book" need a number after them (digits, ordinal suffixes such as "1er", upper-case Roman numerals, or a spelled-out French or English number such as "premier", "vingt-et-un", "Twenty-One"); after the number comes nothing, a separator and a title, or a title that is not a full sentence. "Prologue", "Épilogue", "Introduction", "Conclusion", "Avant-propos", "Préface" and "Postface" must stand alone or be followed by a separator. Markdown `#` headings and lone Roman numerals are unchanged. Ordinal-first headings ("Première partie") are still not detected, as before.
- **Durations**: `formatDuration` rounds to the minute before splitting hours, so 7,170 s reads "2 h 00 min" instead of "1 h 60 min".
- **Variant of a Google voice** (Create tab with a starting voice): the request now carries the full description as `fallbackPrompt`, so a refused `base_voice` falls back to a fresh design as spec F15 requires. The result card says so, and the saved prompt then omits the starting voice. Not tested live, because it would create a voice at Google.
- **Imported book files**: decoded as UTF-16 when a byte-order mark says so, UTF-8 when the bytes are valid UTF-8, otherwise Windows-1252 (older French `.txt` files saved on Windows), instead of always UTF-8.
- Tests added for headings, durations and text decoding: 47 tests in total.

## Review points 6–9 and longer direction (2026-10-27)

- **Retention** (spec 7.4): Text to Speech takes (`segmentId` null) and their history rows (`projectId` null) older than 30 days are deleted at launch, before the first render. `RETENTION_DAYS` is a constant, not a setting yet (the spec's `retentionDays` field). Project takes are left for the Phase 3 "chosen take" rule; audiobooks, voices and previews are never purged. The history shows 10 rows and a "Show more" button pages through the rest, so no stored generation is out of reach; the history and Settings say generations are kept 30 days. Checked in the browser: 14 seeded rows with two of 40 and 45 days left 12, listed in two pages.
- **Waveform**: a `ResizeObserver` on the player canvas triggers a redraw when the strip changes width (window resize, zoom). Checked in the browser: going from 1,280 to 1,000 px wide, the canvas went from 615 to 277 px and matched the strip.
- **Audiobook lock**: `startBook` returns `ran`, `busy-here` or `other-tab`; the runner state switches to "generating" only once the Web Lock is held, and the book page explains when another tab holds it. Checked in the browser with the lock held from the page: message shown, book still ready, no `/api/tts` request.
- **Cloning imports** (spec S6): a file over 20 MB or 3 minutes is refused before decoding (`UPLOAD_LIMITS` in `shared/consent.ts`). The duration comes from the media element's metadata, without decoding; when the browser cannot tell (NaN, Infinity, or no answer within 5 s), decoding decides as before. Checked with 21 MB, 4 min and 12 s files.
- **Direction up to 1,500 characters** (user request, for scene context): `MAX_STYLE_CHARS` goes from 200 to 1,500 on client and server (spec 5.1 updated). The four direction fields become multi-line text areas; the hint now mentions scene context and warns that a very long direction can make the voice drift (spec section 2). The book page shows the first 120 characters of a book's direction, the rest on hover. A 1,501-character direction gets a local 400 before any call to Google. A real generation with a long direction was not run (it spends free-tier quota), so Google's own limit on `speech_metadata.style` is not confirmed.
- Tests added for the upload caps and the direction limit: 53 tests in total.

## Verification pass (2026-10-27)

- **Request log fix** (spec S11): the log read `req.path` when the response ended, but routers mounted on `/api` rewrite it to `/tts`, so only guard refusals and body errors were logged, never a generation. The log now reads `originalUrl` when the request starts, drops the query string and matches `/api` in any case, like the guard.
- **Live server checks** on a test instance: foreign Host → 403, no token → 401 (also on `/API/tts`), cross-site or foreign-origin session request → 403, invalid voice → 400, malformed JSON → 400, body over 64 KB → 413, bad voice id → 400, unknown route → 404, `localhost` → 302 to `127.0.0.1`, security headers present, no `X-Powered-By`, `/api/health` carries no key, server bound to `127.0.0.1` only.
- **Bundle**: no `AIza` string, no SDK code or Google endpoint (the only `@google/genai` text is the Settings label), no font inlined as `data:`.
- **Pages**: every page and Voice Lab tab at 1,280 and 375 px without horizontal overflow or console error; the mobile inspector drawer holds the new direction text area.
- **Tests added**: placeholders identical in the French and English tables, no empty message; `startBook` results (`other-tab` without a "generating" flash, `busy-here` while a start is pending). 58 tests in total.
- `npm audit` could not run: the npm advisory endpoint timed out (`ETIMEDOUT`) from this network. No dependency changed since the last clean audit.

## App icon and Google connection (2026-10-27)

- **App icon**: the user's emblem (`Emblème néon de voix IA.png`, 1,254 px, transparent) is the application's icon outside the interface. `Timbre Studio.ico` (16 to 256 px, PNG entries, cropped to the emblem plus a 2 % margin) is used by a "Timbre Studio" shortcut on the Windows desktop that starts `Timbre Studio.bat`; `src/ui/favicon.png` (64 px, hashed by Vite) is the browser tab icon. The in-app brand mark stays amber: the emblem's blue and purple neon is outside the "console" palette of `DESIGN.md`.
- **"fetch failed" from Google** (reported by the user: "Unable to make request: TypeError: fetch failed"): Node's fetch tries each of Google's addresses for 250 ms by default (happy eyeballs), while a TCP connection takes 140–250 ms on this PC; IPv6 is unreachable. A slow moment made all eight IPv4 addresses time out, which is exactly that message (reproduced with a 100 ms limit). The server now allows 2 s per address (`setDefaultAutoSelectFamilyAttemptTimeout`, `LIMITS.connectAttemptMs`). The user's own occurrence was not logged with its cause, so this is the most likely cause, not a proven one.
- **One retry for a connection that never opened**: when the system code shows the connection failed before any byte was sent (`ETIMEDOUT`, `ECONNREFUSED`, `ENETUNREACH`, `EHOSTUNREACH`, `ENOTFOUND`, `EAI_AGAIN`, `UND_ERR_CONNECT_TIMEOUT`), the call is tried once more after 1 s; nothing reached Google, so no quota is spent. A reset connection (`ECONNRESET`) or any answer from Google is never retried, so the "one request per call" rule of the review fixes still holds.
- **Clear error**: the SDK raises `APIConnectionError` → `ConnectionError` → `TypeError: fetch failed` → socket error. It used to map to `UPSTREAM` ("Google returned an error"); it now maps to `UNREACHABLE` ("Google's servers could not be reached from this PC…") with the system code in the detail, and the server logs `Google unreachable (CODE)`. The audiobook queue treats `UNREACHABLE` as transient. Tests run the real SDK against a closed local port.
