# SocioElect Paris
### 巴黎投票站社会选举地图 · 2026

**语言：** [Français](README.md) | [English](README.en.md) | **中文**

> 面向 2026 年巴黎市政选举约 900 个投票站的交互式地图，结合 INSEE 社会经济指标，用于研究弃权率与投票选择的空间分布。

在线访问地址：
https://joo-yan.github.io/ParisSocioElect-ElectionsMunicipales2026/

---

## 项目简介

本项目为 2026 年巴黎市政选举第一轮（2026 年 3 月 16 日）约 900 个投票站（*bureaux de vote*）制作了一张交互式地图。每个投票站按以下指标着色：

- **弃权率** - 注册选民中未投票的比例
- **家庭收入中位数**（INSEE Filosofi，2021 年）
- **社会住房密度** - 每平方公里 HLM 套数（INSEE RPLS，2024 年）
- **各候选名单得票率**（Gregoire / Dati / Chikirou / Bournazel / Knafo）

散点图配有 OLS 回归线和皮尔逊 *r* 系数，可直观呈现社会住房密度与弃权率的相关关系。地图与图表完全双向联动：在地图上点击投票站，该站会在图表中同步高亮，反之亦然。

## 研究问题

1. 在巴黎投票站层面，社会住房密度与弃权率之间是否存在可测量的空间相关性？
2. 不同候选名单的得票地理分布是否存在差异？工薪阶层投票站与富裕投票站的投票选择是否不同？
3. 家庭收入中位数与社会住房密度如何在各区之间共同变化？

## 关于弃权率的定义

**官方弃权率**的计算公式为：

```text
弃权率 = 弃权人数 / 注册选民人数
```

这一定义存在已知的结构性偏差：它排除了*未注册*居民。研究表明，未注册现象在工薪阶层社区和社会住房密集区域中更为集中（Braconnier & Dormagen, 2007）。因此，官方弃权率会**系统性低估**这些地区真实的政治脱离程度。本数据集中观察到的社会住房密度与弃权率之间的正相关，只能被视为真实相关性的保守下界。

## 数据来源

| 数据集 | 描述 | 来源 |
|--------|------|------|
| 选举结果 | 2026 年第一轮各投票站结果 | 法国内政部，经 data.gouv.fr 发布 |
| 投票站边界 | 903 个投票站的 GeoJSON 多边形 | 巴黎市，opendata.paris.fr |
| IRIS 收入数据 | 各 IRIS 单元可支配收入中位数（DISP_MED21，2021 年） | INSEE Filosofi |
| 社会住房存量 | 各 IRIS 单元 HLM 套数（nbLsPls，2024 年） | INSEE RPLS |
| IRIS 边界 | 全法国 Lambert-93 投影多边形图层 | INSEE / IGN |

注：903 个投票站中有 59 个没有 `revenu_median` 值，因为 INSEE 会对住户数量过少的 IRIS 单元实施统计保密（源数据中标记为 `"ns"` 或 `"nd"`）。这是预期且不可避免的情况。

## 方法说明

**空间连接（投票站 -> IRIS）。** INSEE 社会经济数据发布在 IRIS 尺度（巴黎约 900 个单元），与投票站边界（约 903 个单元）并不重合。这里采用**质心法**：将每个投票站的质心匹配到包含它的 IRIS 多边形中；若某个质心落在所有 IRIS 多边形之外（边界伪影），则使用最近的 IRIS 作为回退方案。这是法国选举地理研究里常见且可接受的折中做法（ANR Cartelec, Jadot et al. 2010）。

**统计口径差异。** INSEE 数据描述的是*全部常住人口*（包含外国人、未成年人和未注册居民），而选举数据仅覆盖*已登记投票的成年法国公民*。两者分母在结构上不同（Riviere, 2012），因此相关性需要谨慎解释。

**使用 HLM 密度，而非占比。** RPLS 数据集提供每个 IRIS 的社会住房套数，但不提供该 IRIS 的住房总量，因此无法在不引入额外数据源的情况下计算占比（HLM / 总住房）。本项目使用的是**HLM 密度（套/km²）**，用于衡量集中程度，而不是比例。

## 关键结果（2026 年第一轮）

| 候选人 | 名单 | 全市得票率 |
|--------|------|-----------|
| Gregoire | LUG（左翼联合） | 38.0 % |
| Dati | LUD（右翼） | 25.5 % |
| Chikirou | LFI | 11.7 % |
| Bournazel | LUC（中间派） | 11.3 % |
| Knafo | LEXD | 10.4 % |
| 其他 | LUXD + LEXG | 3.1 % |

全市弃权率：中位数 37.9 %，Q1-Q4 范围 35.8 %-45.6 %。

---

## 复现方式

### 1. 安装 Python 依赖

```bash
pip install pandas geopandas shapely pyproj
```

### 2. 下载原始数据

将文件放入 `data/raw/`，并使用 `scripts/process.py` 预期的**精确子目录名和文件名**：

| 期望路径 | 来源 |
|----------|------|
| `data/raw/premier_tour_resultat/municipales-2026-resultats-bv-par-communes-2026-03-16.csv` | data.gouv.fr - 法国内政部 |
| `data/raw/bureaux_vote/secteurs-des-bureaux-de-vote-2026.geojson` | opendata.paris.fr |
| `data/raw/BASE_TD_FILO_IRIS_2021_DISP_CSV/BASE_TD_FILO_IRIS_2021_DISP.csv` | INSEE Filosofi |
| `data/raw/RPLS_01-01-2024_Iris/data_RPLS2024_Iris.csv` | INSEE RPLS |
| `data/raw/CONTOURS-IRIS-PE_.../.../*.gpkg` | INSEE / IGN - 脚本会自动检测第一个 `CONTOURS-IRIS*` 目录中的 `.gpkg` 文件 |

### 3. 运行数据处理流程

```bash
python scripts/process.py
```

生成：
- `data/processed/paris_2026_t1.geojson`（流程输出）
- `web/data/processed/paris_2026_t1.geojson`（前端静态副本）

如果数据发生变化，脚本还会打印 `web/index.html` 中 `BREAKS` 变量所需的 Q1-Q4 分段值。

### 4. 本地启动

```bash
python -m http.server 8000 --directory web
# 然后打开 http://localhost:8000
```

必须使用本地服务器，因为浏览器会通过相对路径加载 GeoJSON 文件。

---

## 迁移到其他城市或选举

这个数据流程被刻意拆分为独立加载函数，因此迁移到法国其他市镇或其他选举时比较直接：

1. **选举结果** - 替换 `data/raw/premier_tour_resultat/` 中的 CSV。修改 `load_elections()` 里的 `Code commune` 过滤条件（巴黎当前为 `"75056"`）。再根据新选举的 *nuances* 调整 `CANDIDATES` 字典。
2. **投票站边界** - 替换 `data/raw/bureaux_vote/` 中的 GeoJSON。更新 `load_bv()` 中用于构造 `join_key` 的列名，以匹配新文件结构。
3. **IRIS 数据** - Filosofi 和 RPLS 的 CSV 都覆盖全法国；只需要在 `load_revenus()`、`load_hlm()` 和 `load_iris()` 中，把 `startswith("751")` 改成目标城市对应的 INSEE 代码前缀，例如里昂用 `"691"`，马赛用 `"132"`。
4. **前端** - 用流程打印的断点值更新 `web/index.html` 中的 `BREAKS` 变量，并同步更新侧边栏中的标签和候选人姓名。

## 参考文献

- Braconnier C. & Dormagen J.-Y. (2007). *La démocratie de l'abstention.* Gallimard.
- Riviere J. (2012). Le vote parisien en 2012. *Metropolitiques.*
- Cage J. & Piketty T. (2023). *Une histoire du conflit politique.* Seuil.
- ANR Cartelec, Jadot A. et al. (2010). *Geographie electorale et sociologie politique.*
- Ipsos-BVA (2026). Sociologie de l'abstention au premier tour des municipales 2026.

## 技术栈

| 层级 | 工具 |
|------|------|
| 数据处理 | Python · pandas · GeoPandas |
| 交互地图 | MapLibre GL JS (CDN) |
| 统计图表 | D3.js v7 (CDN) |
| 前端 | 原生 HTML/CSS/JS（单文件） |
| 部署 | GitHub Pages |

## 项目结构

```text
socioelect-paris/
├── data/
│   ├── raw/          # 原始数据文件（不纳入版本控制）
│   └── processed/    # 生成的 GeoJSON
├── scripts/
│   └── process.py    # 数据处理流程
├── web/
│   ├── index.html    # 完整前端
│   └── data/
│       └── processed/
│           └── paris_2026_t1.geojson   # 为 GitHub Pages 提交的文件
└── README.md
```

## 许可证

本项目采用 **MIT License**。

底层数据均为公开数据：法国内政部（选举结果）、巴黎市（投票站边界）、INSEE（Filosofi、RPLS、IRIS 边界）。

## AI 使用披露

本项目在构建过程中大量使用了 AI（Claude，Anthropic），包括数据流程设计、前端开发、空间连接逻辑和文档撰写。所有输出均由作者复核并确认。
