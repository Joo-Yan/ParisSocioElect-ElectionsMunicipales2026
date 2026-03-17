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

Note : 59 des 903 bureaux n'ont pas de valeur `revenu_median` car l'INSEE applique le secret statistique (indicateur `"ns"` ou `"nd"`) aux IRIS comprenant trop peu de ménages. C'est attendu et inévitable.

## Notes méthodologiques

**Jointure spatiale (BV -> IRIS).** Les données socio-économiques INSEE sont disponibles à l'échelle des IRIS (~900 unités pour Paris), qui ne coïncident pas avec les bureaux de vote (~903 unités). La méthode retenue est la **méthode centroïde** : le centroïde de chaque bureau est intersecté avec le maillage IRIS ; si un centroïde tombe hors de tout polygone IRIS (artefact de frontière), l'IRIS le plus proche est utilisé en repli. Cette approche est reconnue comme un compromis acceptable dans la littérature (ANR Cartelec, Jadot et al. 2010).

**Décalage de populations.** Les données INSEE décrivent l'*ensemble de la population résidente* (étrangers, mineurs, non-inscrits inclus), tandis que les données électorales ne couvrent que les citoyens français adultes inscrits. Les deux dénominateurs sont structurellement différents (Rivière, 2012). Les corrélations doivent donc être interprétées avec prudence.

**Densité HLM, pas part.** Le fichier RPLS donne le nombre de logements sociaux par IRIS, mais pas le nombre total de logements dans l'IRIS. Il n'est donc pas possible de calculer une part (HLM / total logements) sans source supplémentaire. L'indicateur retenu est la **densité HLM (unités/km²)**, qui mesure la concentration plutôt que la proportion.

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

### 2. Télécharger les données brutes

Placer les fichiers dans `data/raw/` avec les **noms de sous-dossiers et noms de fichiers exacts** attendus par `scripts/process.py` :

| Chemin attendu | Source |
|----------------|--------|
| `data/raw/premier_tour_resultat/municipales-2026-resultats-bv-par-communes-2026-03-16.csv` | data.gouv.fr - Ministère de l'Intérieur |
| `data/raw/bureaux_vote/secteurs-des-bureaux-de-vote-2026.geojson` | opendata.paris.fr |
| `data/raw/BASE_TD_FILO_IRIS_2021_DISP_CSV/BASE_TD_FILO_IRIS_2021_DISP.csv` | INSEE Filosofi |
| `data/raw/RPLS_01-01-2024_Iris/data_RPLS2024_Iris.csv` | INSEE RPLS |
| `data/raw/CONTOURS-IRIS-PE_.../.../*.gpkg` | INSEE / IGN - le script détecte automatiquement le `.gpkg` dans le premier dossier `CONTOURS-IRIS*` |

### 3. Traiter les données

```bash
python scripts/process.py
```

Genere :
- `data/processed/paris_2026_t1.geojson` (sortie pipeline)
- `web/data/processed/paris_2026_t1.geojson` (copie pour le frontend)

Le script affiche également les breakpoints Q1-Q4 à copier dans la variable `BREAKS` de `web/index.html` si les données ont changé.

### 4. Servir localement

```bash
python -m http.server 8000 --directory web
# puis ouvrir http://localhost:8000
```

Un serveur local est nécessaire car le navigateur charge le GeoJSON via un chemin relatif.

---

## Adapter à une autre ville ou une autre élection

Le pipeline est structuré de façon à ce que chaque source de données soit chargée par une fonction indépendante. Pour migrer vers une autre commune française ou une autre élection :

1. **Résultats électoraux** - remplacer le CSV dans `data/raw/premier_tour_resultat/`. Modifier le filtre `Code commune` dans `load_elections()` (actuellement `"75056"` pour Paris). Adapter le dictionnaire `CANDIDATES` aux *nuances* de la nouvelle élection.
2. **Géographie des bureaux de vote** - remplacer le GeoJSON dans `data/raw/bureaux_vote/`. Mettre à jour les noms de colonnes utilisés pour construire `join_key` dans `load_bv()`.
3. **Données IRIS** - les CSV Filosofi et RPLS couvrent la France entière ; modifier uniquement le filtre `startswith("751")` dans `load_revenus()`, `load_hlm()` et `load_iris()` selon les codes INSEE de la nouvelle commune (ex. `"691"` pour Lyon, `"132"` pour Marseille).
4. **Frontend** - mettre à jour la variable `BREAKS` dans `web/index.html` avec les breakpoints affichés par le pipeline. Mettre à jour les libellés et les noms de candidats dans le HTML.

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
| Carte interactive | MapLibre GL JS (CDN) |
| Graphique statistique | D3.js v7 (CDN) |
| Frontend | HTML/CSS/JS natif (fichier unique) |
| Déploiement | GitHub Pages |

## Structure du projet

```text
socioelect-paris/
├── data/
│   ├── raw/          # fichiers bruts (non versionnés)
│   └── processed/    # GeoJSON généré
├── scripts/
│   └── process.py    # pipeline de traitement
├── web/
│   ├── index.html    # frontend complet
│   └── data/
│       └── processed/
│           └── paris_2026_t1.geojson   # versionnée pour GitHub Pages
└── README.md
```

## Licence

Ce projet est publié sous **licence MIT**.

Les données sous-jacentes sont publiques : Ministère de l'Intérieur (résultats électoraux), Ville de Paris (géographie des bureaux), INSEE (Filosofi, RPLS, contours IRIS).

## Divulgation IA

Ce projet a été construit avec une utilisation intensive de l'IA (Claude, Anthropic). L'IA a participé à la conception du pipeline de données, au développement frontend, à la logique de jointure spatiale et à la documentation. L'ensemble des résultats a été relu et validé par l'auteur.
