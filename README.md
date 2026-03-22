# SocioÉlect Paris
### Carte socio-électorale des bureaux de vote parisiens · 2026

**Langues :** **Français** | [English](README.en.md) | [中文](README.zh-CN.md)

> Carte interactive des ~900 bureaux de vote parisiens pour les municipales 2026, croisée avec des indicateurs socio-économiques INSEE pour étudier la géographie de l'abstention et du vote.

Accès direct à la version en ligne :
https://joo-yan.github.io/ParisSocioElect-ElectionsMunicipales2026/

---

## Ce que fait ce projet

Ce projet produit une carte interactive des ~900 bureaux de vote parisiens pour le premier tour des élections municipales 2026 (16 mars 2026). Chaque bureau est colorié selon :

- **Taux d'abstention** — part des inscrits n'ayant pas voté
- **Revenu médian des ménages** (INSEE Filosofi, 2021)
- **Densité de logements sociaux** — nombre de HLM par km² (INSEE RPLS, 2024)
- **Score par liste candidate** (Grégoire / Dati / Chikirou / Bournazel / Knafo)

Un nuage de points avec droite OLS et coefficient de Pearson *r* permet d'observer la corrélation entre densité HLM et taux d'abstention. La carte et le graphique sont entièrement liés : cliquer un bureau sur la carte le met en évidence dans le graphique, et réciproquement.

Le projet propose également :

- **Vue Grand Paris (Île-de-France)** — bascule entre la vue Paris (bureaux de vote) et une vue communale Île-de-France couvrant les 1 200+ communes de la région.
- **Récit scrollytelling** — narration guidée en 8 étapes pilotant automatiquement la couche et le cadrage de la carte (vue Paris uniquement).
- **Comparaison 2020 / 2026** — chaque bureau affiche l'évolution de l'abstention par rapport au premier tour des municipales 2020.
- **Estimation des non-inscrits** — taux de non-participation réelle combinant abstentions et non-inscrits estimés à partir du RP 2021 INSEE.
- **Régression spatiale** — diagnostic OLS → tests LM → SLM / SEM via `scripts/analysis.py`, complété par l'autocorrélation spatiale Moran's I, LISA et classification K-means.

## Questions de recherche

1. Existe-t-il une corrélation spatiale mesurable entre densité de logements sociaux et abstention à l'échelle des bureaux de vote parisiens ?
2. La géographie des scores varie-t-elle selon les listes ? Les bureaux populaires et les bureaux aisés votent-ils différemment ?
3. Comment revenu médian et densité HLM covarient-ils selon les arrondissements ?

## Sur la définition du taux d'abstention

Le **taux officiel** est calculé ainsi :

```text
taux_abstention = abstentions / inscrits
```

Cette définition présente un biais structurel connu : elle exclut les résidents *non inscrits*. Or, la non-inscription est surreprésentée dans les quartiers populaires et dans les zones à forte densité HLM (Braconnier & Dormagen, 2007). Le taux officiel **sous-estime donc systématiquement** le décrochage politique réel dans ces zones. La corrélation positive observée entre densité HLM et abstention dans ce jeu de données constitue donc une borne inférieure conservatrice de la corrélation réelle.

## Sources de données

| Données | Description | Source |
|---------|-------------|--------|
| Résultats électoraux | Résultats du premier tour par bureau de vote, 2026 | Ministère de l'Intérieur via data.gouv.fr |
| Géographie des BV | Polygones GeoJSON des 903 bureaux | Ville de Paris, opendata.paris.fr |
| Revenus IRIS | Revenu disponible médian par IRIS (DISP_MED21, 2021) | INSEE Filosofi |
| Logements sociaux | Nombre de HLM par IRIS (nbLsPls, 2024) | INSEE RPLS |
| Contours IRIS | Couche Lambert-93 pour la France entière | INSEE / IGN |
| Résultats 2020 *(optionnel)* | Abstention du T1 2020 par bureau (comparaison historique) | data.gouv.fr - Ministère de l'Intérieur |
| RP 2021 *(optionnel)* | Population éligible (Français 18+) par IRIS pour estimer les non-inscrits | INSEE Recensement de la Population 2021 |
| Contours communes IDF | Polygones communes Île-de-France (Admin-Express COG) | IGN |
| RPLS commune IDF | Logements sociaux par commune (data_RPLS2024_COM.csv) | INSEE RPLS |

Note : 59 des 903 bureaux n'ont pas de valeur `revenu_median` car l'INSEE applique le secret statistique (indicateur `"ns"` ou `"nd"`) aux IRIS comprenant trop peu de ménages. C'est attendu et inévitable.

## Notes méthodologiques

**Jointure spatiale (BV -> IRIS).** Les données socio-économiques INSEE sont disponibles à l'échelle des IRIS (~900 unités pour Paris), qui ne coïncident pas avec les bureaux de vote (~903 unités). La méthode retenue est la **méthode centroïde** : le centroïde de chaque bureau est intersecté avec le maillage IRIS ; si un centroïde tombe hors de tout polygone IRIS (artefact de frontière), l'IRIS le plus proche est utilisé en repli. Cette approche est reconnue comme un compromis acceptable dans la littérature (ANR Cartelec, Jadot et al. 2010).

**Décalage de populations.** Les données INSEE décrivent l'*ensemble de la population résidente* (étrangers, mineurs, non-inscrits inclus), tandis que les données électorales ne couvrent que les citoyens français adultes inscrits. Les deux dénominateurs sont structurellement différents (Rivière, 2012). Les corrélations doivent donc être interprétées avec prudence.

**Densité HLM, pas part.** Le fichier RPLS donne le nombre de logements sociaux par IRIS, mais pas le nombre total de logements dans l'IRIS. Il n'est donc pas possible de calculer une part (HLM / total logements) sans source supplémentaire. L'indicateur retenu est la **densité HLM (unités/km²)**, qui mesure la concentration plutôt que la proportion.

**Comparaison 2020 / 2026.** Le numérotation des bureaux du Paris Centre (arr. 1-4) a changé entre 2020 et 2026 en raison du regroupement des arrondissements. Le pipeline applique des décalages par bloc d'arrondissement pour rétablir la concordance avant la fusion.

**Estimation des non-inscrits.** Le RP 2021 INSEE permet d'estimer la population éligible au vote (Français 18+) par IRIS. La différence entre cette population et le nombre d'inscrits donne une borne basse du nombre de non-inscrits, proratisée au niveau bureau de vote. Le champ `taux_non_inscription` combine abstentions et non-inscrits estimés pour fournir un taux de non-participation réelle — plus représentatif du décrochage politique effectif que le taux officiel.

**Régression spatiale.** `scripts/analysis.py` effectue un enchaînement OLS → tests diagnostiques LM (Lagrange Multiplier) → modèle SLM (spatial lag) ou SEM (spatial error) selon la significativité des tests. Il produit également l'autocorrélation globale de Moran's I et une classification K-means des bureaux. Ces analyses s'effectuent en post-traitement sur le GeoJSON généré par `process.py`.

## Résultats clés (premier tour, 2026)

| Candidate | Liste | Score ville entière |
|-----------|-------|---------------------|
| Grégoire | LUG (Union des gauches) | 38,0 % |
| Dati | LUD (Droite) | 25,5 % |
| Chikirou | LFI | 11,7 % |
| Bournazel | LUC (Centre) | 11,3 % |
| Knafo | LEXD | 10,4 % |
| Autres | LUXD + LEXG | 3,1 % |

Abstention ville entière : médiane 37,9 %, plage Q1-Q4 : 35,8 %-45,6 %.

---

## Lancer le projet

### 1. Installer les dépendances Python

```bash
pip install pandas geopandas shapely pyproj
```

Les dépendances de `scripts/analysis.py` (`esda`, `libpysal`, `scikit-learn`, `spreg`) sont installées automatiquement à la première exécution si elles sont absentes.

### 2. Installer les dépendances Node.js

```bash
npm install
```

### 3. Télécharger les données brutes

```bash
bash scripts/download_data.sh            # obligatoires uniquement (Paris)
bash scripts/download_data.sh --idf      # + Admin-Express COG (~582 MB, vue Île-de-France)
bash scripts/download_data.sh --optional # + résultats 2020 + RP2021 individus (~530 MB)
```

Le script télécharge et extrait automatiquement tous les fichiers dans `data/raw/`. Prérequis : `curl` et `7z` (`sudo apt install p7zip-full` sur Debian/Ubuntu, `brew install p7zip` sur macOS).

### 4. Traiter les données Paris

```bash
python scripts/process.py
```

Génère :
- `data/processed/paris_2026_t1.geojson` (sortie pipeline)
- `web/public/data/processed/paris_2026_t1.geojson` (copie pour le frontend)

### 5. Traiter les données Île-de-France *(optionnel)*

```bash
python scripts/process_idf.py
```

Génère `web/public/data/processed/idf_2026_t1.geojson` (communes IDF).

### 6. Lancer les analyses spatiales *(optionnel)*

```bash
python scripts/analysis.py
```

Calcule Moran's I, LISA, K-means et la régression spatiale (OLS → SLM/SEM) et enrichit `data/processed/paris_2026_t1.geojson` avec les colonnes correspondantes.

### 7. Servir localement

```bash
npm run dev
# puis ouvrir http://localhost:5173
```

### 8. Construire pour la production

```bash
npm run build
# les fichiers sont générés dans dist/
```

---

## Adapter à une autre ville ou une autre élection

Le pipeline est structuré de façon à ce que chaque source de données soit chargée par une fonction indépendante. Pour migrer vers une autre commune française ou une autre élection :

1. **Résultats électoraux** - remplacer le CSV dans `data/raw/premier_tour_resultat/`. Modifier le filtre `Code commune` dans `load_elections()` (actuellement `"75056"` pour Paris). Adapter le dictionnaire `CANDIDATES` aux *nuances* de la nouvelle élection.
2. **Géographie des bureaux de vote** - remplacer le GeoJSON dans `data/raw/bureaux_vote/`. Mettre à jour les noms de colonnes utilisés pour construire `join_key` dans `load_bv()`.
3. **Données IRIS** - les CSV Filosofi et RPLS couvrent la France entière ; modifier uniquement le filtre `startswith("751")` dans `load_revenus()`, `load_hlm()` et `load_iris()` selon les codes INSEE de la nouvelle commune (ex. `"691"` pour Lyon, `"132"` pour Marseille).
4. **Vue IDF** - `scripts/process_idf.py` est un pipeline séparé à l'échelle communale. Adapter les filtres de département dans ce script pour couvrir une autre région.
5. **Frontend** - les libellés des candidats, les niveaux de couleur et les textes du récit scrollytelling se trouvent dans `web/src/main.js` et `web/src/story.js`.

## Références

- Braconnier C. & Dormagen J.-Y. (2007). *La démocratie de l'abstention.* Gallimard.
- Rivière J. (2012). Le vote parisien en 2012. *Métropolitiques.*
- Cagé J. & Piketty T. (2023). *Une histoire du conflit politique.* Seuil.
- ANR Cartelec, Jadot A. et al. (2010). *Géographie électorale et sociologie politique.*
- Ipsos-BVA (2026). Sociologie de l'abstention au premier tour des municipales 2026.

## Stack technique

| Couche | Outil |
|--------|-------|
| Traitement des données | Python · pandas · GeoPandas |
| Analyse spatiale | PySAL (esda, libpysal, spreg) · scikit-learn |
| Carte interactive | MapLibre GL JS v5 (npm) |
| Graphique statistique | D3.js v7 (npm) |
| Frontend | Vite · ES modules |
| Déploiement | GitHub Pages |

## Structure du projet

```text
socioelect-paris/
├── data/
│   ├── raw/                    # fichiers bruts (non versionnés)
│   └── processed/              # GeoJSON générés
├── scripts/
│   ├── process.py              # pipeline Paris (bureaux de vote)
│   ├── process_idf.py          # pipeline Grand Paris (communes IDF)
│   └── analysis.py             # Moran's I, LISA, K-means, régression spatiale
├── web/
│   ├── index.html              # point d'entrée HTML
│   ├── public/
│   │   └── data/processed/     # GeoJSON versionnés pour GitHub Pages
│   └── src/
│       ├── main.js             # orchestration principale
│       ├── map.js              # carte MapLibre
│       ├── layers.js           # couches thématiques
│       ├── scatter.js          # nuage de points D3
│       ├── barchart.js         # histogramme D3
│       ├── story.js            # récit scrollytelling
│       ├── viewstate.js        # état partagé Paris / IDF
│       ├── utils.js            # utilitaires
│       └── styles.css
├── vite.config.js
├── package.json
└── README.md
```

## Licence

Ce projet est publié sous **licence MIT**.

Les données sous-jacentes sont publiques : Ministère de l'Intérieur (résultats électoraux), Ville de Paris (géographie des bureaux), INSEE (Filosofi, RPLS, contours IRIS).

## Divulgation IA

Ce projet a été construit avec une utilisation intensive de l'IA (Claude, Anthropic). L'IA a participé à la conception du pipeline de données, au développement frontend, à la logique de jointure spatiale et à la documentation. L'ensemble des résultats a été relu et validé par l'auteur.
