# SocioÉlect Paris
### Carte socio-électorale des bureaux de vote parisiens · 2026

> **[EN]** Interactive map of ~900 Paris voting precincts for the 2026 municipal elections — crossed with INSEE socioeconomic data to study the geography of abstention and political choice.
> **[FR]** Carte interactive des ~900 bureaux de vote parisiens pour les municipales 2026, croisée avec des indicateurs socio-économiques INSEE pour étudier la géographie de l'abstention et du vote.
> **[中]** 2026年巴黎市政选举约900个投票站的交互式地图，结合INSEE社会经济数据，探究弃权率和投票选择的空间分布规律。

---

## Contents / Sommaire / 目录

- [English](#english)
- [Français](#français)
- [中文](#中文)

---

## English

### What this project does

This project produces an interactive map of the ~900 *bureaux de vote* (voting precincts) in Paris for the first round of the 2026 municipal elections (16 March 2026). Each precinct is coloured according to:

- **Abstention rate** — share of registered voters who did not vote
- **Median household income** (INSEE Filosofi, 2021)
- **Social housing density** — number of HLM units per km² (INSEE RPLS, 2024)
- **Vote share per candidate list** (Grégoire / Dati / Chikirou / Bournazel / Knafo)

A scatter plot with an OLS regression line and Pearson *r* allows visual inspection of the correlation between social housing density and abstention rate. The map and the chart are fully bidirectionally linked: clicking a precinct on the map highlights it in the chart, and vice versa.

### Research questions

1. Is there a measurable spatial correlation between social housing density and abstention at the precinct level in Paris?
2. Does the geography of vote share differ across candidate lists? Do working-class precincts and affluent precincts vote differently?
3. How do income and social housing density co-vary across arrondissements?

### On the definition of abstention

The **official abstention rate** is computed as:

```
abstention_rate = abstentions / registered_voters
```

This definition has a well-known structural bias: it excludes residents who are *not registered* (non-inscrits). Research shows that non-registration is disproportionately concentrated in working-class areas and in zones with high social housing density (Braconnier & Dormagen, 2007). The official rate therefore **systematically underestimates** the real disengagement from political life in these areas. Any positive correlation observed between social housing density and abstention in this dataset is therefore a conservative lower bound of the true correlation.

### Data sources

| Dataset | Description | Source |
|---------|-------------|--------|
| Election results | First-round results by *bureau de vote*, 2026 | Ministère de l'Intérieur via data.gouv.fr |
| Voting precinct boundaries | GeoJSON polygons for 903 precincts | Ville de Paris, opendata.paris.fr |
| IRIS income data | Median disposable income by IRIS unit (DISP_MED21, 2021) | INSEE Filosofi |
| Social housing stock | Number of HLM units by IRIS unit (nbLsPls, 2024) | INSEE RPLS |
| IRIS boundaries | Lambert-93 polygon layer for France | INSEE / IGN |

Note: 59 of 903 precincts have no `revenu_median` value because INSEE applies statistical secrecy rules (marked `"ns"` or `"nd"` in the source) to IRIS units with too few households. This is expected and unavoidable.

### Methodological notes

**Spatial join (BV → IRIS).** INSEE socioeconomic data are published at the IRIS scale (~900 units for Paris), which does not coincide with voting precinct boundaries (~903 units). The join uses the **centroid method**: each precinct's centroid is matched to the IRIS polygon that contains it. If a centroid falls outside all IRIS polygons (boundary artefact), the nearest IRIS is used as a fallback. This approach is a recognised compromise in the electoral geography literature (ANR Cartelec, Jadot et al. 2010).

**Population mismatch.** INSEE data describe the *entire resident population* (including foreigners, minors, and non-registered residents), while electoral data cover only *adult French citizens who are registered to vote*. The two denominators are structurally different (Rivière, 2012). Correlations should be interpreted with appropriate caution.

**HLM density, not share.** The RPLS dataset provides the number of social housing units per IRIS, but not the total number of dwellings in the IRIS. It is therefore not possible to compute a share (HLM / total dwellings) without an additional source. The chosen indicator is **HLM density (units/km²)**, which measures concentration rather than share.

### Key results (first round, 2026)

| Candidate | List | City-wide vote share |
|-----------|------|---------------------|
| Grégoire | LUG (Union des gauches) | 38.0 % |
| Dati | LUD (Droite) | 25.5 % |
| Chikirou | LFI | 11.7 % |
| Bournazel | LUC (Centre) | 11.3 % |
| Knafo | LEXD | 10.4 % |
| Others | LUXD + LEXG | 3.1 % |

City-wide abstention: median 37.9 %, range 35.8 %–45.6 % (Q1–Q4).

---

### How to reproduce

#### 1. Install Python dependencies

```bash
pip install pandas geopandas shapely pyproj
```

#### 2. Download raw data

Place files in `data/raw/` with **exact subdirectory names and filenames** expected by `scripts/process.py`:

| Expected path | Source |
|---------------|--------|
| `data/raw/premier_tour_resultat/municipales-2026-resultats-bv-par-communes-2026-03-16.csv` | data.gouv.fr — Ministère de l'Intérieur |
| `data/raw/bureaux_vote/secteurs-des-bureaux-de-vote-2026.geojson` | opendata.paris.fr |
| `data/raw/BASE_TD_FILO_IRIS_2021_DISP_CSV/BASE_TD_FILO_IRIS_2021_DISP.csv` | INSEE Filosofi |
| `data/raw/RPLS_01-01-2024_Iris/data_RPLS2024_Iris.csv` | INSEE RPLS |
| `data/raw/CONTOURS-IRIS-PE_.../.../*.gpkg` | INSEE / IGN — the script auto-detects the `.gpkg` in the first `CONTOURS-IRIS*` folder |

#### 3. Run the pipeline

```bash
python scripts/process.py
```

This produces:
- `data/processed/paris_2026_t1.geojson` (pipeline output)
- `web/data/processed/paris_2026_t1.geojson` (copied for the static frontend)

The script also prints the Q1–Q4 breakpoints for the `BREAKS` variable in `web/index.html`. Copy and paste them if the data has changed.

#### 4. Serve locally

```bash
python -m http.server 8000 --directory web
# then open http://localhost:8000
```

A local server is required because the browser fetches the GeoJSON via a relative path.

---

### How to adapt to another city or election

The pipeline is deliberately structured so that each data source is loaded by an independent function. To migrate to another French municipality or another election:

1. **Election results** — replace the CSV in `data/raw/premier_tour_resultat/`. Change the `Code commune` filter in `load_elections()` (currently `"75056"` for Paris). Adjust the `CANDIDATES` dictionary to match the *nuances* of the new election.

2. **Precinct boundaries** — replace the GeoJSON in `data/raw/bureaux_vote/`. Update the column names used to build `join_key` in `load_bv()` to match the new file schema.

3. **IRIS data** — the Filosofi and RPLS CSVs are France-wide; update only the `startswith("751")` filter in `load_revenus()`, `load_hlm()`, and `load_iris()` to match the INSEE commune codes of the new city (e.g. `"691"` for Lyon, `"132"` for Marseille).

4. **Frontend** — update the `BREAKS` variable in `web/index.html` with the breakpoints printed by the pipeline. Update labels and candidate names in the sidebar HTML.

---

### References

- Braconnier C. & Dormagen J.-Y. (2007). *La démocratie de l'abstention.* Gallimard.
- Rivière J. (2012). Le vote parisien en 2012. *Métropolitiques.*
- Cagé J. & Piketty T. (2023). *Une histoire du conflit politique.* Seuil.
- ANR Cartelec, Jadot A. et al. (2010). *Géographie électorale et sociologie politique.*
- Ipsos-BVA (2026). Sociologie de l'abstention au premier tour des municipales 2026.

---

## Français

### Ce que fait ce projet

Ce projet produit une carte interactive des ~900 bureaux de vote parisiens pour le premier tour des élections municipales 2026 (16 mars 2026). Chaque bureau est colorié selon :

- **Taux d'abstention** — part des inscrits n'ayant pas voté
- **Revenu médian des ménages** (INSEE Filosofi, 2021)
- **Densité de logements sociaux** — nombre de HLM par km² (INSEE RPLS, 2024)
- **Score par liste candidate** (Grégoire / Dati / Chikirou / Bournazel / Knafo)

Un nuage de points avec droite OLS et coefficient de Pearson *r* permet d'observer la corrélation entre densité HLM et taux d'abstention. La carte et le graphique sont entièrement liés : cliquer un bureau sur la carte le met en évidence dans le graphique, et réciproquement.

### Questions de recherche

1. Existe-t-il une corrélation spatiale mesurable entre densité de logements sociaux et abstention à l'échelle des bureaux de vote parisiens ?
2. La géographie des scores varie-t-elle selon les listes ? Les bureaux populaires et les bureaux aisés votent-ils différemment ?
3. Comment revenu médian et densité HLM covarient-ils selon les arrondissements ?

### Sur la définition du taux d'abstention

Le **taux officiel** est calculé ainsi :

```
taux_abstention = abstentions / inscrits
```

Cette définition présente un biais structurel connu : elle exclut les résidents *non inscrits*. Or, la non-inscription est surreprésentée dans les quartiers populaires et dans les zones à forte densité HLM (Braconnier & Dormagen, 2007). Le taux officiel **sous-estime donc systématiquement** le décrochage politique réel dans ces zones. La corrélation positive observée entre densité HLM et abstention dans ce jeu de données constitue donc une borne inférieure conservatrice de la corrélation réelle.

### Sources de données

| Données | Description | Source |
|---------|-------------|--------|
| Résultats électoraux | Résultats du premier tour par bureau de vote, 2026 | Ministère de l'Intérieur via data.gouv.fr |
| Géographie des BV | Polygones GeoJSON des 903 bureaux | Ville de Paris, opendata.paris.fr |
| Revenus IRIS | Revenu disponible médian par IRIS (DISP_MED21, 2021) | INSEE Filosofi |
| Logements sociaux | Nombre de HLM par IRIS (nbLsPls, 2024) | INSEE RPLS |
| Contours IRIS | Couche Lambert-93 pour la France entière | INSEE / IGN |

Note : 59 des 903 bureaux n'ont pas de valeur `revenu_median` car l'INSEE applique le secret statistique (indicateur `"ns"` ou `"nd"`) aux IRIS comprenant trop peu de ménages. C'est attendu et inévitable.

### Notes méthodologiques

**Jointure spatiale (BV → IRIS).** Les données socio-économiques INSEE sont disponibles à l'échelle des IRIS (~900 unités pour Paris), qui ne coïncident pas avec les bureaux de vote (~903 unités). La méthode retenue est la **méthode centroïde** : le centroïde de chaque bureau est intersecté avec le maillage IRIS ; si un centroïde tombe hors de tout polygone IRIS (artefact de frontière), l'IRIS le plus proche est utilisé en repli. Cette approche est reconnue comme un compromis acceptable dans la littérature (ANR Cartelec, Jadot et al. 2010).

**Décalage de populations.** Les données INSEE décrivent l'*ensemble de la population résidente* (étrangers, mineurs, non-inscrits inclus), tandis que les données électorales ne couvrent que les citoyens français adultes inscrits. Les deux dénominateurs sont structurellement différents (Rivière, 2012). Les corrélations doivent donc être interprétées avec prudence.

**Densité HLM, pas part.** Le fichier RPLS donne le nombre de logements sociaux par IRIS, mais pas le nombre total de logements dans l'IRIS. Il n'est donc pas possible de calculer une part (HLM / total logements) sans source supplémentaire. L'indicateur retenu est la **densité HLM (unités/km²)**, qui mesure la concentration plutôt que la proportion.

### Résultats clés (premier tour, 2026)

| Candidate | Liste | Score ville entière |
|-----------|-------|---------------------|
| Grégoire | LUG (Union des gauches) | 38,0 % |
| Dati | LUD (Droite) | 25,5 % |
| Chikirou | LFI | 11,7 % |
| Bournazel | LUC (Centre) | 11,3 % |
| Knafo | LEXD | 10,4 % |
| Autres | LUXD + LEXG | 3,1 % |

Abstention ville entière : médiane 37,9 %, plage Q1–Q4 : 35,8 %–45,6 %.

---

### Lancer le projet

#### 1. Installer les dépendances Python

```bash
pip install pandas geopandas shapely pyproj
```

#### 2. Télécharger les données brutes

Placer les fichiers dans `data/raw/` avec les **noms de sous-dossiers et noms de fichiers exacts** attendus par `scripts/process.py` :

| Chemin attendu | Source |
|----------------|--------|
| `data/raw/premier_tour_resultat/municipales-2026-resultats-bv-par-communes-2026-03-16.csv` | data.gouv.fr — Ministère de l'Intérieur |
| `data/raw/bureaux_vote/secteurs-des-bureaux-de-vote-2026.geojson` | opendata.paris.fr |
| `data/raw/BASE_TD_FILO_IRIS_2021_DISP_CSV/BASE_TD_FILO_IRIS_2021_DISP.csv` | INSEE Filosofi |
| `data/raw/RPLS_01-01-2024_Iris/data_RPLS2024_Iris.csv` | INSEE RPLS |
| `data/raw/CONTOURS-IRIS-PE_.../.../*.gpkg` | INSEE / IGN — le script détecte automatiquement le `.gpkg` dans le premier dossier `CONTOURS-IRIS*` |

#### 3. Traiter les données

```bash
python scripts/process.py
```

Génère :
- `data/processed/paris_2026_t1.geojson` (sortie pipeline)
- `web/data/processed/paris_2026_t1.geojson` (copie pour le frontend)

Le script affiche également les breakpoints Q1–Q4 à copier dans la variable `BREAKS` de `web/index.html` si les données ont changé.

#### 4. Servir localement

```bash
python -m http.server 8000 --directory web
# puis ouvrir http://localhost:8000
```

Un serveur local est nécessaire car le navigateur charge le GeoJSON via un chemin relatif.

---

### Adapter à une autre ville ou une autre élection

Le pipeline est structuré de façon à ce que chaque source de données soit chargée par une fonction indépendante. Pour migrer vers une autre commune française ou une autre élection :

1. **Résultats électoraux** — remplacer le CSV dans `data/raw/premier_tour_resultat/`. Modifier le filtre `Code commune` dans `load_elections()` (actuellement `"75056"` pour Paris). Adapter le dictionnaire `CANDIDATES` aux *nuances* de la nouvelle élection.

2. **Géographie des bureaux de vote** — remplacer le GeoJSON dans `data/raw/bureaux_vote/`. Mettre à jour les noms de colonnes utilisés pour construire `join_key` dans `load_bv()`.

3. **Données IRIS** — les CSV Filosofi et RPLS couvrent la France entière ; modifier uniquement le filtre `startswith("751")` dans `load_revenus()`, `load_hlm()` et `load_iris()` selon les codes INSEE de la nouvelle commune (ex. `"691"` pour Lyon, `"132"` pour Marseille).

4. **Frontend** — mettre à jour la variable `BREAKS` dans `web/index.html` avec les breakpoints affichés par le pipeline. Mettre à jour les libellés et les noms de candidats dans le HTML.

---

### Références

- Braconnier C. & Dormagen J.-Y. (2007). *La démocratie de l'abstention.* Gallimard.
- Rivière J. (2012). Le vote parisien en 2012. *Métropolitiques.*
- Cagé J. & Piketty T. (2023). *Une histoire du conflit politique.* Seuil.
- ANR Cartelec, Jadot A. et al. (2010). *Géographie électorale et sociologie politique.*
- Ipsos-BVA (2026). Sociologie de l'abstention au premier tour des municipales 2026.

---

## 中文

### 项目简介

本项目为2026年巴黎市政选举第一轮（2026年3月16日）约900个投票站（bureaux de vote）制作了一张交互式地图。每个投票站按以下指标着色：

- **弃权率** — 注册选民中未投票的比例
- **家庭收入中位数**（INSEE Filosofi，2021年）
- **社会住房密度** — 每平方公里HLM（经济适用房）套数（INSEE RPLS，2024年）
- **各候选人名单得票率**（Grégoire / Dati / Chikirou / Bournazel / Knafo）

散点图配有OLS回归线和皮尔逊*r*系数，可直观呈现社会住房密度与弃权率的相关关系。地图与图表完全双向联动：在地图上点击投票站，该站在图表中同步高亮，反之亦然。

### 研究问题

1. 在巴黎投票站层面，社会住房密度与弃权率之间是否存在可测量的空间相关性？
2. 不同候选人名单的地理分布是否存在差异？工薪阶层投票站与富裕投票站的投票选择是否不同？
3. 收入中位数与社会住房密度如何在各区（arrondissement）之间共变？

### 关于弃权率的定义问题

**官方弃权率**的计算公式为：

```
弃权率 = 弃权人数 / 注册选民人数
```

这一定义存在已知的结构性偏差：它排除了**未注册**的居民。研究表明，未注册现象在工薪阶层社区和社会住房密集区域中尤为突出（Braconnier & Dormagen，2007年）。因此，官方弃权率**系统性地低估**了这些地区真实的政治脱嵌程度。本数据集中观察到的社会住房密度与弃权率的正相关，是真实相关性的保守下界。

### 数据来源

| 数据集 | 描述 | 来源 |
|--------|------|------|
| 选举结果 | 2026年第一轮各投票站结果 | 内政部经data.gouv.fr |
| 投票站边界 | 903个投票站的GeoJSON多边形 | 巴黎市，opendata.paris.fr |
| IRIS收入数据 | 各IRIS单元可支配收入中位数（DISP_MED21，2021年） | INSEE Filosofi |
| 社会住房存量 | 各IRIS单元HLM套数（nbLsPls，2024年） | INSEE RPLS |
| IRIS边界 | 全法国Lambert-93投影多边形层 | INSEE / IGN |

注：903个投票站中有59个没有`revenu_median`值，原因是INSEE对住户数量过少的IRIS单元实施统计保密（源数据中标记为`"ns"`或`"nd"`）。这是预期且不可避免的情况。

### 方法论说明

**空间连接（投票站 → IRIS）。** INSEE社会经济数据发布在IRIS尺度（巴黎约900个单元），与投票站边界（约903个单元）并不重合。采用**质心法**进行连接：将每个投票站的质心与IRIS多边形网格进行叠置匹配；若质心落在所有IRIS多边形之外（边界伪影），则使用最近邻IRIS作为备选。该方法在选举地理学文献中被认为是可接受的折中方案（ANR Cartelec，Jadot等，2010年）。

**人口口径差异。** INSEE数据描述的是*全体常住人口*（含外国人、未成年人、未注册居民），而选举数据仅覆盖*已注册的成年法国公民*。两者的分母在结构上不同（Rivière，2012年）。相关性解读应保持审慎。

**社会住房密度，而非比例。** RPLS数据集提供各IRIS的社会住房套数，但不提供该IRIS的住房总数，因此无法在不引入额外数据源的情况下计算比例（HLM / 总住房）。本项目采用**HLM密度（套/km²）**作为指标，衡量集中程度而非占比。

### 关键结果（2026年第一轮）

| 候选人 | 名单 | 全市得票率 |
|--------|------|-----------|
| Grégoire | LUG（左翼联合） | 38.0% |
| Dati | LUD（右翼） | 25.5% |
| Chikirou | LFI（不屈的法国） | 11.7% |
| Bournazel | LUC（中间派） | 11.3% |
| Knafo | LEXD | 10.4% |
| 其他 | LUXD + LEXG | 3.1% |

全市弃权率：中位数37.9%，Q1–Q4范围：35.8%–45.6%。

---

### 复现流程

#### 1. 安装Python依赖

```bash
pip install pandas geopandas shapely pyproj
```

#### 2. 下载原始数据

将文件放入`data/raw/`，使用`scripts/process.py`**精确要求的子目录名和文件名**：

| 期望路径 | 来源 |
|----------|------|
| `data/raw/premier_tour_resultat/municipales-2026-resultats-bv-par-communes-2026-03-16.csv` | data.gouv.fr — 内政部 |
| `data/raw/bureaux_vote/secteurs-des-bureaux-de-vote-2026.geojson` | opendata.paris.fr |
| `data/raw/BASE_TD_FILO_IRIS_2021_DISP_CSV/BASE_TD_FILO_IRIS_2021_DISP.csv` | INSEE Filosofi |
| `data/raw/RPLS_01-01-2024_Iris/data_RPLS2024_Iris.csv` | INSEE RPLS |
| `data/raw/CONTOURS-IRIS-PE_.../.../*.gpkg` | INSEE / IGN — 脚本自动检测第一个`CONTOURS-IRIS*`文件夹中的`.gpkg`文件 |

#### 3. 运行数据处理流程

```bash
python scripts/process.py
```

生成：
- `data/processed/paris_2026_t1.geojson`（流程输出）
- `web/data/processed/paris_2026_t1.geojson`（前端静态文件副本）

脚本还会打印Q1–Q4断点值，若数据有更新，需将其复制到`web/index.html`的`BREAKS`变量中。

#### 4. 本地运行

```bash
python -m http.server 8000 --directory web
# 然后打开 http://localhost:8000
```

必须使用本地服务器，因为浏览器通过相对路径加载GeoJSON文件。

---

### 迁移至其他地区或其他选举

数据处理流程经过刻意设计，每个数据源由独立函数加载。迁移至法国其他市镇或其他选举的步骤：

1. **选举结果** — 替换`data/raw/premier_tour_resultat/`中的CSV文件。修改`load_elections()`中的`Code commune`筛选条件（当前为巴黎的`"75056"`）。根据新选举的*nuances*（政党标签）调整`CANDIDATES`字典。

2. **投票站地理边界** — 替换`data/raw/bureaux_vote/`中的GeoJSON文件。更新`load_bv()`中用于构建`join_key`的列名，使其与新文件的字段结构一致。

3. **IRIS数据** — Filosofi和RPLS的CSV文件覆盖全法国；仅需修改`load_revenus()`、`load_hlm()`和`load_iris()`中的`startswith("751")`筛选条件，替换为新市镇的INSEE代码（如里昂为`"691"`，马赛为`"132"`）。

4. **前端** — 用流程打印的断点值更新`web/index.html`中的`BREAKS`变量，并相应更新侧边栏HTML中的标签和候选人姓名。

---

### 参考文献

- Braconnier C. & Dormagen J.-Y. (2007). *La démocratie de l'abstention.* Gallimard.
- Rivière J. (2012). Le vote parisien en 2012. *Métropolitiques.*
- Cagé J. & Piketty T. (2023). *Une histoire du conflit politique.* Seuil.
- ANR Cartelec, Jadot A. et al. (2010). *Géographie électorale et sociologie politique.*
- Ipsos-BVA (2026). Sociologie de l'abstention au premier tour des municipales 2026.

---

## Tech stack

| Layer | Tool |
|-------|------|
| Data processing | Python · pandas · GeoPandas |
| Interactive map | MapLibre GL JS (CDN) |
| Statistical chart | D3.js v7 (CDN) |
| Frontend | Native HTML/CSS/JS (single file) |
| Deployment | GitHub Pages |

## Project structure

```
socioelect-paris/
├── data/
│   ├── raw/          # raw files (not versioned)
│   └── processed/    # generated GeoJSON
├── scripts/
│   └── process.py    # data pipeline
├── web/
│   ├── index.html    # full frontend
│   └── data/
│       └── processed/
│           └── paris_2026_t1.geojson   # committed for GitHub Pages
└── README.md
```

---

## Licence

This project is released under the **MIT Licence** — free to use, copy, modify, and distribute.

All underlying data are public: Ministère de l'Intérieur (electoral results), Ville de Paris (precinct boundaries), INSEE (Filosofi, RPLS, IRIS contours).

---

## AI disclosure / Divulgation IA / AI使用披露

This project was built with extensive use of AI (Claude, Anthropic). AI assisted with data pipeline design, frontend development, spatial join logic, and documentation. All outputs were reviewed and validated by the author.

Ce projet a été construit avec une utilisation intensive de l'IA (Claude, Anthropic). L'IA a participé à la conception du pipeline de données, au développement frontend, à la logique de jointure spatiale et à la documentation. L'ensemble des résultats a été relu et validé par l'auteur.

本项目大量借助AI（Claude，Anthropic）完成构建，包括数据处理流程设计、前端开发、空间连接逻辑及文档撰写。所有输出均经作者审核与验证。
