# Timbre Studio : passation de session

Résumé de la session du 27 octobre 2026, pour reprendre le projet sur un autre compte Claude.
Tout ce qu'il faut est dans ce dossier ; rien ne dépend de l'ancien compte.

## Pour reprendre en 1 minute

1. Ouvrez ce dossier dans Claude Code avec le nouveau compte :
   `D:\Programmation\DEVELOPPEMENT JAVA\PROGRAMMES\APPLICATIONS\Timbre Studio`
2. Claude Code lit `CLAUDE.md` tout seul : il saura qu'il doit commencer par ce document et
   connaîtra les règles de travail. Pour bien démarrer, envoyez tout de même ce premier message :

   > Lis PASSATION.md, puis DECISIONS.md, DESIGN.md et docs/SPEC.md. Ne lance rien et ne modifie
   > rien avant de m'avoir résumé l'état du projet et proposé la prochaine étape.

3. Pour utiliser l'application : double-cliquez sur `Timbre Studio.bat`, elle s'ouvre sur
   http://127.0.0.1:5178.

Votre clé Gemini reste dans `.env`. Elle appartient à votre compte Google, pas à votre compte
Claude : le changement de compte ne la touche pas. Ne la collez jamais dans une conversation.

## Le projet en bref

Timbre Studio est un studio de voix off local, dans l'esprit d'ElevenLabs. L'interface tourne sur le
PC, et toute la génération de voix se fait sur les serveurs de Google via l'API Gemini, avec le
modèle `gemini-3.8-flash-tts`.

Pourquoi pas un modèle local : le PC (Dell Precision M4800) a une carte graphique Kepler,
inutilisable par les modèles de voix récents. Un modèle local n'atteindrait pas la même qualité.

Contraintes que vous avez fixées :

- **API gratuite uniquement**, sans paiement ni affichage de coûts. Usage voulu « illimité » :
  l'appli n'impose qu'un garde-fou anti-emballement et réagit aux refus de quota de Google.
- Travail **méthodique, pas à pas**, comme un ingénieur : analyser, tester, relire, optimiser.
- Le cahier des charges est **en anglais** ; les échanges et l'interface sont en français.

## Les documents de référence

| Fichier | Contenu |
| --- | --- |
| `docs/SPEC.md` | Cahier des charges complet (anglais), copié depuis le Claude Doc de l'ancien compte |
| `DECISIONS.md` | Tous les choix techniques, phase par phase, avec leurs raisons |
| `DESIGN.md` | Le système visuel « la console » : couleurs, typographie, règles |
| `README.md` | Mode d'emploi court pour l'utilisateur |
| `CLAUDE.md` | Consignes lues automatiquement par Claude Code à chaque session |
| `PASSATION.md` | Ce document |

Le cahier des charges original reste en ligne sur l'ancien compte
(https://claude.ai/artifact/Y11KGamb5ijWd3uX7xnSea), mais le nouveau compte n'y a pas accès.
**`docs/SPEC.md` fait désormais référence.** Seuls les deux diagrammes n'ont pas pu être exportés :
ils sont signalés à leur place dans le fichier.

## Ce qui fonctionne aujourd'hui

**Voix off (page d'accueil)**
- Texte jusqu'à 8 000 caractères, choix de la voix, direction de jeu (style), choix du modèle.
- Les 30 voix Google, plus vos voix créées.
- Lecture, forme d'onde, téléchargement en WAV (24 kHz, mono).
- Historique des générations récentes.

**Atelier de voix (4 onglets)**
- *Mes voix* : vos voix créées, avec un bouton Test. On peut modifier une voix par prompt (remix),
  comparer l'ancienne et la nouvelle version, puis garder l'une des deux.
- *Voix Google* : la galerie des 30 voix, écoutables en un clic avec une phrase de test prédéfinie
  tirée au hasard.
- *Créer* : voix masculine ou féminine décrite par un prompt (âge, accent, ton, etc.).
- *Cloner* : clonage avec consentement enregistré en direct, selon les règles de Google.

**Livre audio**
- Collez 30 à 40 pages : l'appli détecte les chapitres et découpe en segments d'environ
  2 500 caractères.
- Génération une requête à la fois, avec pause et reprise, et reprise automatique après un quota
  ou un plantage.
- Écoute et téléchargement par chapitre ou du livre entier.

**Réglages** : état de la clé API, requêtes envoyées aujourd'hui, heure locale de la remise à zéro
du quota Google, langue. L'interface est toujours sombre (le thème clair a été retiré le
27 octobre 2026, à votre demande).

## Historique de la session

1. **Cahier des charges** rédigé en anglais : clonage, interface, analyse de sécurité, plan de
   construction en phases pour Claude Code.
2. **Étude du PC** : modèle local écarté, architecture « interface locale + API Google » retenue.
3. **Phase 1** : squelette, lanceur, serveur local sécurisé, première voix générée.
4. **Phase 2, l'atelier de voix** : création, modification par prompt, clonage, conservation.
   Elle passe avant l'éditeur, à votre demande.
5. **Phase 2b** :
   - API gratuite seule, coûts retirés ;
   - écoute des voix avec des textes prédéfinis ;
   - mode livre audio ;
   - revue complète de l'architecture.
6. **Revue de code indépendante** : 14 problèmes corrigés (détail dans `DECISIONS.md`, section
   « Review fixes »). Les plus importants :
   - le SDK Google réessayait chaque requête jusqu'à 5 fois en silence ;
   - le délai maximal de 5 minutes n'était jamais appliqué ;
   - une adresse en majuscules (`/API/...`) passait la protection ;
   - deux onglets pouvaient générer le même livre en même temps.
7. **Refonte de l'interface** : 37 skills installés depuis 5 dépôts GitHub, puis nouveau design
   « la console ». Graphite et ambre, police Instrument Sans, une pastille de couleur par voix,
   un lecteur en bande de console et une couverture par livre audio.
8. **Passation** : le cahier des charges est copié dans `docs/SPEC.md` et ce document rédigé.

## Où en est le plan de construction

| Phase | Contenu | État |
| --- | --- | --- |
| 1 | Squelette et première voix | Terminée |
| 2 | Atelier de voix | Terminée |
| 2b | Gratuit, écoute des voix, livre audio, revue | Code terminé et testé ; à marquer « Done » dans `docs/SPEC.md` après votre vérification |
| Refonte | Design « la console » | Terminée ; sombre uniquement depuis le 27/10 (nouveau compte) |
| 3 | Éditeur : segmentation, balises, lexique, fondus aux jonctions, projets | Pas commencée |
| 4 | Mastering et export : loudness, limiteur, MP3, sous-titres SRT/VTT, ZIP | Pas commencée |
| 5 | Contrôle qualité : transcription, taux d'erreur, nouvelle tentative automatique | Pas commencée |
| 6 | Voice Match, bibliothèque étendue, sécurité finale | Pas commencée |

**Prochaine étape logique** : la phase 3 (éditeur), section 10 de `docs/SPEC.md`. Vérifiez d'abord
avec la nouvelle interface que tout vous convient.

## État technique vérifié en fin de session

- Types client et serveur sans erreur, **36 tests sur 36** réussis, build de production OK.
- `npm audit` : 0 vulnérabilité.
- Une génération réelle passe en une seule requête.
- Votre propre instance (port 5178) était arrêtée en fin de session ; le lanceur la relance.

Commandes de vérification :

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run build
```

## Points ouverts et limites connues

- **Quotas gratuits non publiés** par Google pour ce modèle. L'appli ne suppose aucun chiffre et
  réagit aux refus (erreur 429). Le quota du jour repart à minuit heure du Pacifique, soit 9 h à
  Paris à partir du 2 novembre.
- **Données de l'offre gratuite** : Google peut utiliser les contenus envoyés pour améliorer ses
  produits.
- **Clonage** : Google ne le propose pas dans l'Espace économique européen dans AI Studio. L'appli
  le découvre au premier essai : Google refuse (403), l'erreur est expliquée et le serveur note la
  fonction comme indisponible. L'onglet Cloner reste pourtant visible : à masquer en phase 6.
- **Remix de voix** : le champ `base_voice` existe dans le SDK, mais Google l'annonçait « bientôt
  disponible ». En cas de refus, l'appli recrée la voix depuis le prompt complet et le signale.
- **Versionnement git** : Timbre Studio a son propre dépôt git depuis le 27 octobre 2026 (branche
  `main`), relié à https://github.com/sake-lewis/learning-site (dépôt **public**). Le dépôt parent
  (`D:\Programmation\DEVELOPPEMENT JAVA`), qui appartient à un autre utilisateur Windows, n'est plus
  concerné. `.env`, `data/`, `dist/`, `node_modules/`, `.skills-src/` et `.claude/skills/` ne sont
  pas versionnés. Les commits sont signés `sake-lewis` avec l'adresse privée GitHub, réglée dans ce
  dépôt seulement.
- **Skills** : les 37 skills sont dans `.claude/skills/` et seront donc disponibles pour le nouveau
  compte. Ils restent sur ce PC : ni eux ni leurs sources brutes (`.skills-src/`) ne sont versionnés,
  car leurs licences n'autorisent pas forcément la republication sur GitHub. Aucun script de ces
  dépôts n'a été exécuté, y compris ceux d'Impeccable.
- **Données de test** : un livre de test de 2 chapitres existe sur http://127.0.0.1:5179, une
  origine séparée. Il n'apparaît pas dans votre appli normale.

## Notes techniques pour la prochaine session Claude

À lire avant de toucher au code ; tout est détaillé dans `DECISIONS.md`.

**Stack**
- Client : React 19.3.1, Vite 8.3.5, TypeScript 7.0.2, Zustand, Dexie (IndexedDB, version 4 :
  projects, segments, takes, voicePresets, lexicons, history, settings, previews, books,
  bookSegments).
- Serveur : Express 5.3.0, lancé par Node 24 en TypeScript direct (type stripping), sans étape de
  build. Validation zod partout.
- SDK `@google/genai` **2.31.0, version figée**.

**Appels Google** (tous dans `server/lib/gemini.ts`, le seul module qui parle à Google)
- TTS par l'API Interactions : `ai.interactions.create(...)`, voir `synthesize()`. La réponse est
  `output_audio.data`, un WAV en base64.
- Voix par `ai.voices.create / list / get / delete`. On passe l'identifiant nu `voice_…`.
- Chaque appel passe `maxRetries: 0` et un `signal` qui combine l'annulation et
  `AbortSignal.timeout(300 s)`. Le SDK ignore `timeout_ms` dès qu'un signal est fourni.
- **Ne pas envoyer `delivery: 'inline'`** : Google répond « Audio delivery mode is not supported ».
- Les erreurs 429 sont analysées (`quotaInfo`) pour distinguer le quota par jour et par minute,
  avec le délai d'attente conseillé par Google.

**Sécurité**
- Serveur lié à 127.0.0.1:5178. Contrôle des en-têtes Host et Origin, CSP stricte, pas de CORS.
- Jeton de session `X-Timbre-Token`, renouvelé à chaque lancement et servi par `/api/session`.
  Le chemin est mis en minuscules avant contrôle.
- Une clé invalide côté Google donne `502 KEY_INVALID`. Le 401 est réservé au jeton local : le
  navigateur ne renouvelle le jeton que sur `BAD_TOKEN`.
- `localhost` redirige vers `127.0.0.1` pour ne pas scinder les données IndexedDB.
- La clé n'existe que dans `.env`, côté serveur. Le navigateur n'importe jamais le SDK.

**Pièges rencontrés sur ce PC**
- Le port 5178 est celui de l'appli de l'utilisateur : ne pas l'arrêter. Pour tester, lancer une
  seconde instance avec `$env:PORT='5179'` puis `npm start`. L'outil d'aperçu de
  `.claude/launch.json` vise 5178.
- PowerShell `Set-Content -Encoding utf8` ajoute un BOM. Écrire avec
  `[IO.File]::WriteAllText(chemin, texte, (New-Object Text.UTF8Encoding($false)))` ou l'outil Edit.
- TypeScript 7 refuse `Uint8Array<ArrayBufferLike>` pour les Blob et `crypto.subtle` : typer en
  `Uint8Array<ArrayBuffer>`.
- `index.html` est servi en `no-cache` : après un build, un simple rechargement montre la nouvelle
  interface.
- Le lanceur (`scripts/prepare.ts`) réinstalle si `package-lock.json` change et reconstruit si les
  sources sont plus récentes que `dist/`.
- GitHub était très lent depuis ce réseau (clones bloqués). Le téléchargement fichier par fichier
  depuis `raw.githubusercontent.com` a fonctionné.

**Règles de travail** (section 10 de `docs/SPEC.md`)
- Les numéros de section du cahier font foi ; tout choix ouvert va dans `DECISIONS.md`.
- Une phase n'est rendue qu'après types, tests et build OK, interface vérifiée dans le navigateur,
  et `DECISIONS.md` mis à jour.
- Chaque test réel consomme le quota gratuit de l'utilisateur : le dire et rester sobre.
- Ne pas commiter ni pousser sans demande explicite.
