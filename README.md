# Top Wikipedia (TRMNL plugin)

Affiche les articles Wikipedia les plus consultes hier, pour une edition
au choix (en/fr/de/es), avec une miniature pour l'article n°1 quand une
image existe. Quatre vues (full / half_horizontal / half_vertical /
quadrant), compatibles TRMNL OG et TRMNL X (paysage et portrait).

---

## 1. Conformite Framework TRMNL

Les templates suivent exactement la hierarchie imposee par le Framework
(doc officielle : trmnl.com/framework/docs/structure) :

- **On ne fournit jamais** les div `screen`, `view`, ou `mashup` — la
  plateforme les ajoute automatiquement. On fournit uniquement :
  - un seul `<div class="layout">...</div>` par vue
  - un `<div class="title_bar">...</div>` en **frere** (sibling) du
    `layout`, jamais imbrique dedans
- Le classement d'articles utilise le composant **Columns**
  (`<div class="columns"><div class="column">...</div></div>`), qui
  gere lui-meme la distribution en colonnes et la troncature si le
  contenu depasse l'espace disponible — c'est le mecanisme officiel
  recommande pour adapter automatiquement un meme contenu a un petit
  ecran (OG) et un grand ecran (X), sans dupliquer de logique.
- Chaque item de la liste utilise le composant **Item**
  (`.item > .meta > .index` + `.content > .title/.description`) —
  la classe `.list` existante dans un premier jet a ete retiree car
  **depreciee** par TRMNL.
- Aucun style inline (`style="..."`) nulle part : uniquement des
  classes utilitaires du Framework (`gap--large`, `w--[200px]`,
  `image--cover`, etc.)

## 2. Adaptation OG vs X (responsive)

Un seul jeu de fichiers `.liquid` sert TOUS les appareils : c'est le
CSS du Framework qui adapte le rendu selon l'ecran, via des prefixes
de classe :

| Prefixe | S'applique a | Usage ici |
|---|---|---|
| (aucun) | Tous les ecrans (mobile-first) | Taille par defaut = TRMNL OG (800px, 1-bit) |
| `lg:` | TRMNL X (1024px+, 4-bit) | Miniature plus grande, texte plus grand |
| `portrait:` | TRMNL X en orientation portrait | Bascule l'image et la liste en colonne au lieu de cote a cote |

Exemple concret dans `full.liquid` :
```html
<div class="layout layout--row portrait:layout--col gap--large">
```
Par defaut (OG, ou X en paysage) : image et liste cote a cote.
En portrait sur X : empile verticalement.

```html
<img class="image image-dither image--cover h--[360px] lg:h--[520px] portrait:h--[280px]" ...>
```
Miniature plus grande sur X, plus petite si l'ecran est en portrait.

**A tester manuellement** avant publication : ouvrir le Markup Editor
TRMNL, selectionner "TRMNL X" dans le device switcher, verifier le
rendu en paysage ET en portrait (bouton orientation en haut du
previewer).

## 3. Conformite Chef (le linter TRMNL)

Chaque regle de Chef et pourquoi ce plugin la respecte :

| Regle Chef | Statut | Pourquoi |
|---|---|---|
| `async_functions_are_not_present` | OK | Aucun JavaScript dans ce plugin |
| `waits_for_dom_load` | OK | Idem, pas de JS |
| `opacity_is_not_present` | OK | Aucune propriete `opacity:` |
| `inline_styles_are_not_present` | OK | Zero style inline, uniquement des classes Framework |
| `markup_size_elements_are_excluded` | OK | On n'ajoute jamais `view--full` etc. nous-memes |
| `markups_have_content` | OK | Chaque vue fait largement plus de 10 caracteres |
| `title_casing` / `title_length` | OK | "Top Wikipedia" = 13 caracteres, commence par une majuscule |
| `custom_fields_values_are_used` | OK | Le champ `lang` apparait dans chaque template (`{{ lang \| default: "en" }}`) |
| `author_bio_is_present` / `category_is_present` | OK | Champ `author_bio` inclus dans `settings.yml` avec categorie |
| `image_links_respond_ok` | OK | La seule balise `<img>` a une URL Liquid dynamique (`{{ ... }}`), donc ignoree par ce check |
| `not_a_fork` | OK | Nouvelle soumission, pas un fork |
| `webhook_strategy_has_copyable_url` | N/A | On utilise la strategie `polling`, pas `webhook` |
| `icon_is_present` | A faire manuellement | Doit etre uploade dans Settings (pas inclus dans le zip) |
| `featured_image_is_present` | A faire manuellement | Bouton "Generate" disponible dans la page Settings du plugin |
| `responsive_classes_are_present` (avertissement) | OK | `lg:` et `portrait:` presents dans `full.liquid` |
| `form_field_links_use_html` (avertissement) | OK | Aucune URL brute dans les descriptions de champs |

Les deux seules choses que Chef ne peut pas verifier depuis le zip
(icone + image mise en avant) sont a faire une fois dans l'interface
TRMNL, voir etape 9 ci-dessous.

## 4. Pas a pas complet avec GitHub Desktop

### Etape 1 — Installer GitHub Desktop (si pas deja fait)
1. Aller sur https://desktop.github.com
2. Telecharger et installer la version Windows/macOS
3. Ouvrir l'app, se connecter avec ton compte GitHub (nbbou81000)

### Etape 2 — Creer le depot sur GitHub.com
1. Aller sur https://github.com/new
2. Nom du depot : `trmnl-wiki-pageviews`
3. Visibilite : Public (necessaire pour que jsDelivr serve les fichiers)
4. Ne pas cocher "Add a README" (on a deja le notre)
5. Cliquer "Create repository"

### Etape 3 — Cloner le depot vide avec GitHub Desktop
1. Sur la page du nouveau depot GitHub, cliquer le bouton vert "Code"
2. Cliquer "Open with GitHub Desktop"
3. Choisir un dossier local (ex: Documents/trmnl-wiki-pageviews)
4. Cliquer "Clone"

### Etape 4 — Copier les fichiers du zip dans le dossier clone
1. Dezipper wiki-pageviews.zip
2. Copier TOUT le contenu du dossier wiki-pageviews/ (pas le dossier
   lui-meme, son contenu) dans le dossier clone a l'etape 3
3. Verifier que tu retrouves bien a la racine : settings.yml,
   config.json, README.md, les dossiers scripts/, templates/, docs/,
   .github/

### Etape 5 — Premier commit et push
1. Revenir dans GitHub Desktop : la liste des fichiers ajoutes
   apparait automatiquement dans l'onglet "Changes"
2. En bas a gauche, champ "Summary" : ecrire par exemple
   "Initial commit"
3. Cliquer "Commit to main"
4. Cliquer "Push origin" en haut

### Etape 6 — Lancer le workflow une premiere fois manuellement
Le workflow GitHub Actions ne se declenche automatiquement qu'une
fois par jour (08:00 UTC). Pour peupler les donnees tout de suite :
1. Sur GitHub.com, aller dans l'onglet "Actions" du depot
2. Cliquer sur le workflow "Daily Wikipedia pageviews" a gauche
3. Cliquer le bouton "Run workflow" (menu deroulant a droite) puis
   confirmer "Run workflow"
4. Attendre ~1 minute, rafraichir la page : un rond vert = succes
5. Verifier que le depot contient maintenant docs/data/all.json et
   des images dans docs/images/en/, docs/images/de/, etc.
6. Dans GitHub Desktop, faire "Fetch origin" puis "Pull origin" pour
   rapatrier ces nouveaux fichiers dans ton dossier local si tu veux
   les voir

### Etape 7 — Verifier que jsDelivr sert bien les fichiers
Une fois le push effectue, jsDelivr met parfois 1-2 minutes a
rafraichir son cache. Teste dans un navigateur :
```
https://cdn.jsdelivr.net/gh/nbbou81000/trmnl-wiki-pageviews@main/docs/data/all.json
```
Tu dois voir un tableau JSON avec 4 entrees (en/fr/de/es). Si tu vois
une erreur 404, attends une minute et reessaie.

### Etape 8 — Creer le Private Plugin sur TRMNL
1. Sur https://usetrmnl.com, aller dans Plugins → Private Plugin →
   "+ Add New"
2. Choisir la strategie "Polling"
3. Copier le contenu de settings.yml : reporter le polling_url dans
   le champ correspondant de l'interface (l'URL jsDelivr de l'etape 7)
4. Dans la section "Custom Fields" (form builder), coller ou recreer
   les deux champs presents dans settings.yml :
   - le champ author_bio (categorie, description, lien GitHub)
   - le champ lang (liste deroulante en/fr/de/es)
5. Copier-coller le contenu de chaque fichier templates/*.liquid dans
   l'onglet correspondant du Markup Editor (Full, Half Horizontal,
   Half Vertical, Quadrant)
6. Cliquer "Save"

### Etape 9 — Ajouter l'icone et l'image mise en avant
Ces deux elements ne font pas partie du zip et doivent etre ajoutes a
la main (Chef les bloquera sinon) :
1. Sur la page de settings du plugin prive, section "Icon" : uploader
   une image carree (ex: un logo Wikipedia stylise ou une lettre "W")
2. Section "Featured Image" : cliquer le bouton pour en generer une
   automatiquement a partir de ton rendu actuel

### Etape 10 — Tester sur OG et X avant publication
1. Dans le Markup Editor, utiliser le selecteur d'appareil en haut :
   tester "TRMNL OG" puis "TRMNL X"
2. Pour TRMNL X, tester aussi le bouton orientation (paysage/portrait)
3. Verifier les 4 vues (Full, Half Horizontal, Half Vertical,
   Quadrant) sur chaque combinaison

### Etape 11 — Publier comme Recipe (optionnel)
1. Depuis la page de settings du plugin prive, cliquer "Publish as a
   Recipe"
2. Chef lance ses verifications automatiques (section 3 ci-dessus) —
   si tout est vert, l'equipe TRMNL est notifiee pour la revue
   manuelle (1-2 jours en general)

### Pour les mises a jour futures
A chaque fois que tu modifies un fichier (script, config, template) :
1. Modifier le fichier localement dans le dossier clone
2. Dans GitHub Desktop : les changements apparaissent automatiquement
   dans "Changes"
3. Ecrire un resume, "Commit to main", puis "Push origin"
4. Si tu as modifie un .liquid, recopier son contenu dans le Markup
   Editor TRMNL (le repo GitHub ne met a jour QUE les donnees/images
   via l'Action — les templates doivent etre recopies a la main dans
   TRMNL a chaque changement)

## 5. Limites connues

- Les donnees d'un jour donne ne sont fiables que le lendemain — le
  plugin affiche donc toujours "hier".
- Certains articles n'ont pas d'image exploitable — dans ce cas aucune
  miniature n'est affichee.
- Les miniatures restent en tramage 1-bit meme sur TRMNL X (4-bit) —
  amelioration possible plus tard (generer une version niveaux de
  gris non-tramee dediee a X), non implementee dans cette v1.
- Le filtrage des pages non-articles (Special:, Portail:, etc.) est
  fait par prefixe de titre.

## 6. Fichiers

- scripts/fetch-pageviews.js - recupere + traite une langue donnee
- scripts/build-index.js - fusionne les JSON par langue
- config.json - liste des langues generees chaque jour
- templates/full.liquid - vue plein ecran (avec miniature)
- templates/half_horizontal.liquid - vue mi-ecran horizontale
- templates/half_vertical.liquid - vue mi-ecran verticale
- templates/quadrant.liquid - vue quart d'ecran
- settings.yml - configuration du plugin (strategie, custom fields)
- .github/workflows/daily.yml - cron quotidien
