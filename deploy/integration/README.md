# Déploiement Scribe sur l'environnement d'intégration

Procédure pour déployer **(1) le patch sdkjs** et **(2) l'addon Scribe** dans le
conteneur OnlyOffice de l'intégration. Le déploiement de **Drive** est traité à part.

> **Cible** : un conteneur OnlyOffice Document Server qui tourne (image construite
> en amont par l'équipe infra). Chaque script s'exécute **à l'intérieur** du
> conteneur — il ne touche que le système de fichiers local, donc aucun `kubectl`
> ni `docker` n'est requis depuis le script. On y entre par
> `kubectl exec -it <pod> -- bash` (ou `docker exec`), puis on lance le script ;
> il peut aussi être branché comme étape `RUN` au build de l'image (install durable).

---

## ⚠️ 2 choses à câbler avant le premier déploiement

Ces deux valeurs sont laissées en paramètre (placeholders en tête de script) :

1. **Canal des artefacts sdkjs** (`SDKJS_ARTIFACTS_SRC`).
   Le patch sdkjs ne se compile **pas** dans le conteneur (Closure Compiler + Docker).
   Tu produis les bundles compilés en amont (`sdk-all.js`, `sdk-all-min.js`) et tu
   indiques au script **d'où les prendre** : répertoire local, tarball, ou URL de
   release. → *décision à confirmer : où publies-tu ces 2 fichiers ?*

2. **Convention de « dernière béta »** (`SCRIBE_GIT_REPO` + `SCRIBE_TAG_PATTERN`).
   Par défaut le script résout **le plus haut tag `v*-beta.*` du repo Drive**
   (convention existante : `v1.62.0-beta.10`…), Scribe vivant dans le repo Drive.
   Si tu adoptes plus tard un namespace dédié, passe `--pattern 'scribe-v*-beta.*'`.
   → *décision à confirmer : on reste sur les tags Drive, ou tag Scribe dédié ?*

---

## Matrice de compatibilité (à respecter impérativement)

| Élément              | Version cible (intégration) | Verrou                                   |
|----------------------|------------------------------|------------------------------------------|
| OnlyOffice DS        | `9.4.0-129`                  | —                                        |
| Patch sdkjs          | construit depuis upstream `v9.4.0.129` | **version-locked** : casse l'éditeur si l'OO diffère |
| Addon Scribe         | tag béta du repo Drive       | `minVersion` 8.2.0 (large)             |

Le patch sdkjs est **épinglé à la version exacte d'OO**. Le script
`deploy-sdkjs-patch.sh` **refuse** de s'appliquer hors de la plage acceptée
(défaut `9.4.0-129` exact ; garde-fou souple `--min/--max`, voir plus bas).

### ⚠️ Cible du patch = `sdk-all.js` SEUL (changement 9.3 → 9.4)

ONLYOFFICE a changé de système de build en 9.4 (Grunt+Closure → build Python par
concaténation) **et** déplacé l'API builder (`apiBuilder.js`, où vit
`ApiRun.GetInlineDrawings`) : en 9.4, `apiBuilder.js` n'est **que** dans
`sdk-all.js`, pas dans `sdk-all-min.js`. Or `sdk-all.js` est le bundle chargé par
`api/documents/preload.html` + `cache-scripts.html` (contexte builder/`callCommand`).
**Vérifié en live sur le conteneur 9.3 validé** : le plugin fonctionne avec le patch
présent uniquement dans `sdk-all.js`.

➡️ On déploie donc **uniquement `sdk-all.js` patché** ; `sdk-all-min.js` reste stock
(on n'y touche pas). Le script installe exactement les bundles patchés présents dans
l'artefact, donc il gère aussi bien 9.4 (1 fichier) que l'ancien 9.3 (2 fichiers).

### ⚠️ Validation runtime encore requise sur 9.4

Le commit du patch se **fusionne proprement** sur `v9.4.0.129` et compile, mais
`GetInlineDrawings` lit le modèle interne d'OO (`ParaRun.Content[]`, constantes
`para_Drawing`…). 9.3 → 9.4 a pu le faire évoluer → le **round-trip image doit être
re-testé en live sur un éditeur 9.4** avant de considérer le patch validé.

---

## Ordre de déploiement

1. **Patch sdkjs** (`deploy-sdkjs-patch.sh`) — couche basse, dont dépend l'addon
   pour le round-trip des images.
2. **Addon Scribe** (`deploy-scribe-addon.sh`).
3. Faire **recharger le navigateur** (voir § Cache) et vérifier les traces de version.

L'addon fonctionne sans le patch, mais les fonctions image retombent silencieusement
en mode dégradé → déployer le patch d'abord.

---

## 1. Patch sdkjs

```bash
# Plage de versions = exacte 9.3.0-138 par défaut (min == max).
# Élargir SEULEMENT après avoir validé le même bundle sur d'autres builds OO.
SDKJS_ARTIFACTS_SRC=https://<ton-canal>/scribe-sdkjs-9.3.0-138.tar.gz \
  ./deploy-sdkjs-patch.sh

# Exemple avec une plage explicite et une source locale :
./deploy-sdkjs-patch.sh --src /opt/scribe/sdkjs-bundle/ --min 9.3.0-138 --max 9.3.0-199
```

Ce que fait le script :
- lit la version OO (`dpkg`) et **refuse** si hors plage `[--min .. --max]` (override `--force`) ;
- récupère les artefacts (dossier / tarball / URL) ;
- **vérifie que les bundles contiennent bien le patch** (`GetInlineDrawings`) *avant* d'écraser quoi que ce soit ;
- (optionnel) vérifie les sommes `*.sha256` ;
- **sauvegarde** les originaux (`*.scribe-bak.<horodatage>`) ;
- installe `sdk-all.js` / `sdk-all-min.js` et **supprime les `.gz` périmés** ;
- écrit `SCRIBE_SDKJS_PATCH.txt` (trace serveur) et affiche un contrôle on-disk.

**Rollback :** `./deploy-sdkjs-patch.sh --rollback` (restaure la dernière sauvegarde).

**Artefacts attendus** (produits par ton build Closure Compiler en amont) :
`sdk-all.js`, `sdk-all-min.js` (+ optionnel `sdk-all.js.sha256`, `sdk-all-min.js.sha256`).

---

## 2. Addon Scribe

```bash
# Déployer la dernière béta (auto-résolue sur le repo Drive) :
SCRIBE_GIT_REPO=https://<ton-git>/cozy-drive.git ./deploy-scribe-addon.sh

# Déployer un tag précis :
./deploy-scribe-addon.sh --repo https://<ton-git>/cozy-drive.git --ref v1.62.0-beta.12

# Mode hors-ligne (sans git, depuis un bundle préparé en amont) :
./deploy-scribe-addon.sh --from /opt/scribe/onlyoffice-scribe.tar.gz
```

Ce que fait le script :
- résout la **dernière béta** = plus haut tag `v*-beta.*` (`sort -V`), ou un `--ref` explicite, ou un `--from` local ;
- **estampille un jeton de cache** dans `index.html` (`code.js?v=<tag>`) → § Cache ;
- **ajoute une bannière de déploiement** dans `code.js` (log console + `window.__scribeDeploy`) → § Traçabilité ;
- sauvegarde l'ancien dossier plugin, installe le nouveau, **supprime les `.gz` périmés** ;
- enregistre le plugin (`documentserver-pluginsmanager.sh`) et écrit `DEPLOYED_VERSION.txt`.

**Rollback :** affiché en fin de script (`rm -rf <dest> && mv <dest>.scribe-bak.<ts> <dest>`).

---

## Cache navigateur — empêcher qu'une ancienne version reste servie

Deux niveaux de cache mordent ici :

1. **Le `.gz` côté serveur.** OnlyOffice pré-compresse les assets ; nginx
   (`gzip_static`) sert le `.gz` **à la place** du fichier frais. → les deux scripts
   **suppriment les `.gz` périmés** après copie (cause n°1 des « j'ai déployé mais
   c'est l'ancien code »).

2. **Le cache HTTP du navigateur.**
   - **Addon** : `index.html` charge `code.js` **sans** query string → résolu en
     estampillant `code.js?v=<tag>` à chaque déploiement (URL change ⇒ re-fetch forcé).
   - **sdkjs** : OO ne change **pas** l'URL de `sdk-all*.js` quand seul le contenu
     change → **hard reload obligatoire** côté testeurs (DevTools → Network →
     *Disable cache* → Ctrl+Shift+R). C'est documenté dans la sortie du script.

---

## Traçabilité — garantir la version réellement exécutée dans le browser

Sur les bétas, on veut prouver quelle version tourne vraiment :

- **Console** : au chargement du plugin, `code.js` logge déjà
  `[Scribe] build <SCRIBE_BUILD>`, et la bannière de déploiement ajoute
  `[Scribe] deployed tag=<tag> build=<SCRIBE_BUILD>`.
- **`window.__scribeDeploy`** = `{ tag, build, at }` (inspectable / scriptable).
- **Network tab** : la requête doit finir par `code.js?v=<tag>` (et non `from cache`).
- **Serveur** : `DEPLOYED_VERSION.txt` (addon) et `SCRIBE_SDKJS_PATCH.txt` (sdkjs)
  dans les dossiers concernés.
- **Patch sdkjs live** : confirmé fonctionnellement par le round-trip d'une image
  dans un document (le plugin appelle `apiRun.GetInlineDrawings()`).

> Si la console montre un tag/build plus ancien que celui déployé → c'est un cache
> navigateur : *Disable cache* + hard reload, et vérifier le `?v=` dans Network.

---

## Pré-requis dans le conteneur

| Outil          | addon            | sdkjs            |
|----------------|------------------|------------------|
| `bash`, `dpkg` | requis           | requis           |
| `git`          | requis (sauf `--from`) | non             |
| `curl`         | non              | requis si source = URL |
| `tar`          | si `--from`/tarball | si tarball/URL |
| accès réseau au git Drive | requis (sauf `--from`) | non (sauf URL d'artefacts) |

Si le conteneur n'a ni git ni réseau sortant, utilise les **modes hors-ligne** :
`--from <bundle>` (addon) et `--src <dossier|tarball>` (sdkjs), les bundles étant
préparés en amont et copiés dans le conteneur.

---

## Ce qui n'est PAS couvert ici (rappels)

- **Drive** : déploiement séparé, plus tard.
- **Config AI du cozy-stack** : confirmée déjà en place côté intégration (rien à faire).
- **Secret JWT OO** : géré par l'image/infra (en dev seulement il est désactivé).
- **Build du patch sdkjs** : se fait **en amont** (Closure Compiler + Docker), hors
  de ce conteneur ; ces scripts ne font qu'**installer** les artefacts compilés.
