# SocioElect Paris
### Socio-electoral map of Paris voting precincts · 2026

**Languages:** [Français](README.md) | **English** | [中文](README.zh-CN.md)

> Interactive map of ~900 Paris voting precincts for the 2026 municipal elections, crossed with INSEE socioeconomic indicators to study the geography of abstention and political choice.

Live version:
https://joo-yan.github.io/ParisSocioElect-ElectionsMunicipales2026/

---

## What this project does

This project produces an interactive map of the ~900 *bureaux de vote* (voting precincts) in Paris for the first round of the 2026 municipal elections (16 March 2026). Each precinct is coloured according to:

- **Abstention rate** - share of registered voters who did not vote
- **Median household income** (INSEE Filosofi, 2021)
- **Social housing density** - number of HLM units per km² (INSEE RPLS, 2024)
- **Vote share per candidate list** (Gregoire / Dati / Chikirou / Bournazel / Knafo)

A scatter plot with an OLS regression line and Pearson *r* allows visual inspection of the correlation between social housing density and abstention rate. The map and chart are fully bidirectionally linked: clicking a precinct on the map highlights it in the chart, and vice versa.

The project also includes:

- **Grand Paris (Île-de-France) view** — toggle between the Paris precinct-level view and a commune-level view covering 1,200+ municipalities in the Île-de-France region.
- **Scrollytelling narrative** — a guided 8-step story that automatically drives layer selection and map camera (Paris view only).
- **2020 / 2026 comparison** — each precinct shows the change in abstention rate relative to the first round of the 2020 municipal elections.
- **Non-registered voter estimation** — real non-participation rate combining official abstentions with estimated non-registrants derived from INSEE RP 2021.
- **Spatial regression** — OLS → LM diagnostic tests → SLM / SEM via `scripts/analysis.py`, complemented by global Moran's I, LISA clustering, and K-means social typology.

## Research questions

1. Is there a measurable spatial correlation between social housing density and abstention at the precinct level in Paris?
2. Does the geography of vote share differ across candidate lists? Do working-class precincts and affluent precincts vote differently?
3. How do income and social housing density co-vary across arrondissements?

## On the definition of abstention

The **official abstention rate** is computed as:

```text
abstention_rate = abstentions / registered_voters
```

This definition has a well-known structural bias: it excludes residents who are *not registered*. Research shows that non-registration is disproportionately concentrated in working-class areas and in zones with high social housing density (Braconnier & Dormagen, 2007). The official rate therefore **systematically underestimates** the real disengagement from political life in these areas. Any positive correlation observed between social housing density and abstention in this dataset is therefore a conservative lower bound of the true correlation.

## Data sources

| Dataset | Description | Source |
|---------|-------------|--------|
| Election results | First-round results by *bureau de vote*, 2026 | Ministère de l'Intérieur via data.gouv.fr |
| Voting precinct boundaries | GeoJSON polygons for 903 precincts | Ville de Paris, opendata.paris.fr |
| IRIS income data | Median disposable income by IRIS unit (DISP_MED21, 2021) | INSEE Filosofi |
| Social housing stock | Number of HLM units by IRIS unit (nbLsPls, 2024) | INSEE RPLS |
| IRIS boundaries | Lambert-93 polygon layer for France | INSEE / IGN |
| 2020 results *(optional)* | First-round 2020 abstention by precinct (historical comparison) | data.gouv.fr - Ministère de l'Intérieur |
| RP 2021 *(optional)* | Eligible population (French citizens 18+) by IRIS for non-registrant estimation | INSEE Recensement de la Population 2021 |
| IDF commune boundaries | Île-de-France commune polygons (Admin-Express COG) | IGN |
| RPLS commune IDF | Social housing units by commune (data_RPLS2024_COM.csv) | INSEE RPLS |

Note: 59 of 903 precincts have no `revenu_median` value because INSEE applies statistical secrecy rules (marked `"ns"` or `"nd"` in the source) to IRIS units with too few households. This is expected and unavoidable.

## Methodological notes

**Spatial join (BV -> IRIS).** INSEE socioeconomic data are published at the IRIS scale (~900 units for Paris), which does not coincide with voting precinct boundaries (~903 units). The join uses the **centroid method**: each precinct's centroid is matched to the IRIS polygon that contains it. If a centroid falls outside all IRIS polygons (boundary artefact), the nearest IRIS is used as a fallback. This approach is a recognised compromise in the electoral geography literature (ANR Cartelec, Jadot et al. 2010).

**Population mismatch.** INSEE data describe the *entire resident population* (including foreigners, minors, and non-registered residents), while electoral data cover only *adult French citizens who are registered to vote*. The two denominators are structurally different (Riviere, 2012). Correlations should be interpreted with appropriate caution.

**HLM density, not share.** The RPLS dataset provides the number of social housing units per IRIS, but not the total number of dwellings in the IRIS. It is therefore not possible to compute a share (HLM / total dwellings) without an additional source. The chosen indicator is **HLM density (units/km²)**, which measures concentration rather than share.

**2020 / 2026 comparison.** Precinct numbering in Paris Centre (arrondissements 1-4) changed between 2020 and 2026 due to the inter-arrondissement merger. The pipeline applies per-block offsets to re-align codes before the join.

**Non-registered voter estimation.** INSEE RP 2021 provides an estimate of the eligible voting population (French citizens aged 18+) by IRIS unit. The gap between this population and the registered voter count gives a lower bound on non-registrants, prorated to precinct level. The field `taux_non_inscription` combines official abstentions with estimated non-registrants to produce a real non-participation rate — a more accurate measure of political disengagement than the official figure.

**Spatial regression.** `scripts/analysis.py` runs OLS → LM diagnostic tests → SLM (spatial lag) or SEM (spatial error) depending on which test is significant. It also computes global Moran's I and LISA cluster indicators and a K-means social typology. These analyses run as post-processing on the GeoJSON produced by `process.py`.

## Key results (first round, 2026)

| Candidate | List | City-wide vote share |
|-----------|------|---------------------|
| Gregoire | LUG (Union des gauches) | 38.0 % |
| Dati | LUD (Right) | 25.5 % |
| Chikirou | LFI | 11.7 % |
| Bournazel | LUC (Centre) | 11.3 % |
| Knafo | LEXD | 10.4 % |
| Others | LUXD + LEXG | 3.1 % |

City-wide abstention: median 37.9 %, Q1-Q4 range 35.8 %-45.6 %.

---

## How to reproduce

### 1. Install Python dependencies

```bash
pip install pandas geopandas shapely pyproj
```

Dependencies for `scripts/analysis.py` (`esda`, `libpysal`, `scikit-learn`, `spreg`) are installed automatically on first run if missing.

### 2. Install Node.js dependencies

```bash
npm install
```

### 3. Download raw data

Place files in `data/raw/` with the **exact subdirectory names and filenames** expected by the scripts:

| Expected path | Source | Required |
|---------------|--------|----------|
| `data/raw/premier_tour_resultat/municipales-2026-resultats-bv-par-communes-2026-03-16.csv` | data.gouv.fr - Ministère de l'Intérieur | Yes |
| `data/raw/bureaux_vote/secteurs-des-bureaux-de-vote-2026.geojson` | opendata.paris.fr | Yes |
| `data/raw/BASE_TD_FILO_IRIS_2021_DISP_CSV/BASE_TD_FILO_IRIS_2021_DISP.csv` | INSEE Filosofi | Yes |
| `data/raw/RPLS_01-01-2024_Iris/data_RPLS2024_Iris.csv` | INSEE RPLS (IRIS) | Yes |
| `data/raw/CONTOURS-IRIS-PE_.../.../*.gpkg` | INSEE / IGN — script auto-detects the `.gpkg` in the first `CONTOURS-IRIS*` folder | Yes |
| `data/raw/premier_tour_resultat/municipales-2020-resultats-bv-t1-france.txt` | data.gouv.fr - Ministère de l'Intérieur | No |
| `data/raw/RP2021_indcvi.parquet` | INSEE RP 2021 individuals file | No |
| `data/raw/RPLS_01-01-2024_Iris/data_RPLS2024_COM.csv` | INSEE RPLS (commune) | No (IDF view) |
| `data/raw/ADMIN-EXPRESS-COG/` | IGN Admin-Express COG (commune boundaries) | No (IDF view) |

### 4. Run the Paris pipeline

```bash
python scripts/process.py
```

This produces:
- `data/processed/paris_2026_t1.geojson` (pipeline output)
- `web/public/data/processed/paris_2026_t1.geojson` (copied for the static frontend)

### 5. Run the Île-de-France pipeline *(optional)*

```bash
python scripts/process_idf.py
```

Produces `web/public/data/processed/idf_2026_t1.geojson` (commune-level IDF data).

### 6. Run spatial analysis *(optional)*

```bash
python scripts/analysis.py
```

Computes Moran's I, LISA, K-means, and spatial regression (OLS → SLM/SEM), enriching `data/processed/paris_2026_t1.geojson` with additional columns.

### 7. Serve locally

```bash
npm run dev
# then open http://localhost:5173
```

### 8. Build for production

```bash
npm run build
# output is written to dist/
```

---

## How to adapt to another city or election

The pipeline is deliberately structured so that each data source is loaded by an independent function. To migrate to another French municipality or another election:

1. **Election results** - replace the CSV in `data/raw/premier_tour_resultat/`. Change the `Code commune` filter in `load_elections()` (currently `"75056"` for Paris). Adjust the `CANDIDATES` dictionary to match the *nuances* of the new election.
2. **Precinct boundaries** - replace the GeoJSON in `data/raw/bureaux_vote/`. Update the column names used to build `join_key` in `load_bv()` to match the new file schema.
3. **IRIS data** - the Filosofi and RPLS CSVs are France-wide; update only the `startswith("751")` filter in `load_revenus()`, `load_hlm()`, and `load_iris()` to match the INSEE commune codes of the new city (for example `"691"` for Lyon, `"132"` for Marseille).
4. **IDF view** - `scripts/process_idf.py` is a separate commune-level pipeline. Adapt the department filters in that script to target a different region.
5. **Frontend** - candidate labels, colour breakpoints, and scrollytelling text live in `web/src/main.js` and `web/src/story.js`.

## References

- Braconnier C. & Dormagen J.-Y. (2007). *La démocratie de l'abstention.* Gallimard.
- Riviere J. (2012). Le vote parisien en 2012. *Metropolitiques.*
- Cage J. & Piketty T. (2023). *Une histoire du conflit politique.* Seuil.
- ANR Cartelec, Jadot A. et al. (2010). *Geographie electorale et sociologie politique.*
- Ipsos-BVA (2026). Sociologie de l'abstention au premier tour des municipales 2026.

## Tech stack

| Layer | Tool |
|-------|------|
| Data processing | Python · pandas · GeoPandas |
| Spatial analysis | PySAL (esda, libpysal, spreg) · scikit-learn |
| Interactive map | MapLibre GL JS v5 (npm) |
| Statistical chart | D3.js v7 (npm) |
| Frontend | Vite · ES modules |
| Deployment | GitHub Pages |

## Project structure

```text
socioelect-paris/
├── data/
│   ├── raw/                    # raw files (not versioned)
│   └── processed/              # generated GeoJSON files
├── scripts/
│   ├── process.py              # Paris pipeline (voting precincts)
│   ├── process_idf.py          # Grand Paris pipeline (IDF communes)
│   └── analysis.py             # Moran's I, LISA, K-means, spatial regression
├── web/
│   ├── index.html              # HTML entry point
│   ├── public/
│   │   └── data/processed/     # GeoJSON files committed for GitHub Pages
│   └── src/
│       ├── main.js             # main orchestration
│       ├── map.js              # MapLibre map
│       ├── layers.js           # thematic layers
│       ├── scatter.js          # D3 scatter plot
│       ├── barchart.js         # D3 bar chart
│       ├── story.js            # scrollytelling narrative
│       ├── viewstate.js        # shared Paris / IDF state
│       ├── utils.js            # utilities
│       └── styles.css
├── vite.config.js
├── package.json
└── README.md
```

## Licence

This project is released under the **MIT Licence**.

All underlying data are public: Ministère de l'Intérieur (election results), Ville de Paris (precinct boundaries), and INSEE (Filosofi, RPLS, IRIS boundaries).

## AI disclosure

This project was built with extensive use of AI (Claude, Anthropic). AI assisted with data pipeline design, frontend development, spatial join logic, and documentation. All outputs were reviewed and validated by the author.
