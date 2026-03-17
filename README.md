# Paris Vote Map

Carte interactive des ~900 bureaux de vote parisiens pour le **premier tour des élections municipales 2026**, croisée avec les données socio-économiques INSEE (revenu médian, densité HLM).

**[→ Démo en ligne](https://YOUR_USERNAME.github.io/paris-vote-map)**

---

## Aperçu

- Choroplèthe par bureau de vote : taux d'abstention / revenu médian / densité HLM
- Nuage de points : densité HLM × taux d'abstention, droite OLS, r² et r de Pearson
- Interaction bidirectionnelle carte ↔ graphique

## Stack technique

| Couche | Outil |
|--------|-------|
| Traitement des données | Python · pandas · GeoPandas |
| Carte interactive | MapLibre GL JS (CDN) |
| Graphique statistique | D3.js v7 (CDN) |
| Frontend | HTML/CSS/JS natif (fichier unique) |
| Déploiement | GitHub Pages |

## Lancer le projet

### 1. Installer les dépendances Python

```bash
pip install pandas geopandas shapely pyproj
```

### 2. Télécharger les données brutes

Placer les fichiers dans `data/raw/` avec les sous-dossiers et noms exacts attendus par `scripts/process.py` :

| Chemin attendu | Source |
|----------------|--------|
| `data/raw/premier_tour_resultat/municipales-2026-resultats-bv-par-communes-2026-03-16.csv` | data.gouv.fr — Ministère de l'Intérieur |
| `data/raw/bureaux_vote/secteurs-des-bureaux-de-vote-2026.geojson` | opendata.paris.fr |
| `data/raw/BASE_TD_FILO_IRIS_2021_DISP_CSV/BASE_TD_FILO_IRIS_2021_DISP.csv` | INSEE Filosofi |
| `data/raw/RPLS_01-01-2024_Iris/data_RPLS2024_Iris.csv` | INSEE RPLS |
| `data/raw/CONTOURS-IRIS-PE_.../.../*.gpkg` | INSEE ou IGN, dossier `CONTOURS-IRIS*` contenant un fichier `.gpkg` |

Le script détecte automatiquement le `.gpkg` IRIS dans le premier dossier `data/raw/CONTOURS-IRIS*` trouvé.

### 3. Traiter les données

```bash
python scripts/process.py
```

Le script génère :

- `data/processed/paris_2026_t1.geojson` pour l'output de pipeline
- `web/data/processed/paris_2026_t1.geojson` pour le frontend statique servi depuis `web/`

Il affiche aussi les **breakpoints Q1–Q4** à copier dans `web/index.html` (variable `BREAKS`).

### 4. Ouvrir la carte

```bash
# Serveur local (nécessaire pour charger le GeoJSON)
python -m http.server 8000 --directory web
# puis ouvrir http://localhost:8000
```

Le fichier généré pour le frontend est `web/data/processed/paris_2026_t1.geojson` dans le dépôt, chargé côté navigateur via le chemin relatif `data/processed/paris_2026_t1.geojson`. Il faut donc exécuter `python scripts/process.py` après chaque mise à jour des données.

### 5. Déployer sur GitHub Pages

```bash
git add .
git commit -m "feat: initial release v1.0"
git push
# Activer GitHub Pages → branche main → dossier /web
```

Le fichier `web/data/processed/paris_2026_t1.geojson` doit être versionné pour que GitHub Pages puisse servir l'application sans accès au dossier racine `data/`.

---

## Structure du projet

```
paris-vote-map/
├── data/
│   ├── raw/          # fichiers bruts (non versionnés)
│   └── processed/    # GeoJSON généré
├── scripts/
│   └── process.py    # pipeline de données
├── web/
│   └── index.html    # frontend complet
└── README.md
```

---

## Note méthodologique

### Association spatiale

Les données socio-économiques INSEE sont disponibles à l'échelle des IRIS (~1 000 unités pour Paris), qui ne coïncident pas avec les bureaux de vote (~900 unités). La méthode retenue est la **méthode centroïde** : le centroïde de chaque bureau de vote est intersecté avec le maillage IRIS ; le bureau hérite des indicateurs de l'IRIS dans lequel il tombe. Cette approche est reconnue comme un compromis acceptable dans la littérature (ANR Cartelec, Jadot et al. 2010).

### Limites du taux d'abstention

Le taux officiel est calculé sur les *inscrits* uniquement, ce qui exclut les non-inscrits et les mal-inscrits. Or, selon Braconnier & Dormagen (2007), les quartiers populaires et les zones HLM présentent des taux de non-inscription nettement supérieurs aux quartiers aisés. Le taux d'abstention officiel **sous-estime donc systématiquement** le décrochage politique réel dans ces zones.

### Décalage de populations

Les données INSEE décrivent l'ensemble de la population résidente (étrangers, mineurs, non-inscrits inclus) ; les données électorales ne couvrent que les citoyens français adultes inscrits. Les deux dénominateurs sont différents (Rivière, 2012). Les corrélations doivent être interprétées avec prudence.

---

## Sources et références

- **Données électorales** : Ministère de l'Intérieur via data.gouv.fr
- **Géographie des bureaux de vote** : Ville de Paris, opendata.paris.fr
- **Données socio-économiques IRIS** : INSEE Filosofi / RPLS
- Braconnier C. & Dormagen J.-Y. (2007). *La démocratie de l'abstention.* Gallimard.
- Rivière J. (2012). Le vote parisien en 2012. *Métropolitiques.*
- Cagé J. & Piketty T. (2023). *Une histoire du conflit politique.* Seuil.
- ANR Cartelec, Jadot A. et al. (2010). *Géographie électorale et sociologie politique.*
- Ipsos-BVA (2026). Sociologie de l'abstention au premier tour des municipales 2026.

---

*Projet personnel · données publiques · licence MIT*
