# Timbre Studio

Studio de voix off local : l'interface tourne sur votre PC, les voix sont générées par Google
(Gemini 3.8 Flash TTS) via l'API Gemini.

## Première utilisation

1. Créez une clé API dans Google AI Studio (menu « Get API key »).
2. Double-cliquez sur **Timbre Studio.bat**. La première fois, il installe ce qu'il faut, puis ouvre
   le fichier `.env` dans le Bloc-notes : collez votre clé après `GEMINI_API_KEY=`, enregistrez, fermez.
3. L'application s'ouvre dans le navigateur sur http://127.0.0.1:5178.

La clé reste dans le fichier `.env`, sur ce PC. Ne la collez jamais dans une conversation.

## Commandes

| Commande | Rôle |
| --- | --- |
| `npm start` | Lance l'application (interface + serveur local) |
| `npm run build` | Vérifie les types et reconstruit l'interface |
| `npm run dev` | Mode développement avec rechargement à chaud (http://127.0.0.1:5173) |
| `npm test` | Tests unitaires |

## Où sont les choses

- Spécification : `docs/SPEC.md` (cahier des charges « Timbre Studio — Product Specification »).
- Reprise du projet : `PASSATION.md`.
- Choix techniques : `DECISIONS.md`.
- Voix générées : dans le navigateur (IndexedDB), section « Générations récentes », téléchargeables en WAV.
