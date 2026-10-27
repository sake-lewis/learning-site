# Timbre Studio

Studio de voix off local : interface React sur le PC, voix générées par Google (`gemini-3.8-flash-tts`)
via l'API Gemini. Le projet a changé de compte Claude le 27 octobre 2026.

## Avant toute chose

Lis `PASSATION.md` : état du projet, avancement des phases, limites connues, pièges de ce PC.
Puis, selon la tâche : `docs/SPEC.md` (cahier des charges, fait foi), `DECISIONS.md` (choix
techniques), `DESIGN.md` (système visuel « la console »).

## Règles de travail

- Réponds en français. Le cahier des charges et les fichiers de décisions restent en anglais.
- Travaille pas à pas, comme un ingénieur : analyser, tester, relire, optimiser.
- API gratuite uniquement : pas de coûts ni de paiement. Chaque test réel consomme le quota gratuit
  de l'utilisateur : annonce-le et reste sobre.
- Les numéros de section de `docs/SPEC.md` font foi ; tout choix ouvert va dans `DECISIONS.md`.
- Une phase n'est rendue qu'après `npm run typecheck`, `npm test` et `npm run build` sans erreur,
  l'interface vérifiée dans le navigateur, et `DECISIONS.md` mis à jour.
- Tout appel à Google passe par `server/lib/gemini.ts`. La clé reste dans `.env`, côté serveur :
  ne la lis pas, ne l'affiche pas, ne la demande jamais dans la conversation.
- Le port 5178 est l'appli de l'utilisateur : ne l'arrête pas. Teste sur une seconde instance
  (`$env:PORT='5179'` puis `npm start`).
- Ne commite et ne pousse rien sans demande explicite.
- Les scripts fournis par les skills de `.claude/skills/` n'ont jamais été exécutés : ne les lance
  pas sans accord.
