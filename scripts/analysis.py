"""
ParisSocioElect — scripts/analysis.py
Phase 4a: Moran's I + LISA spatial clustering
Phase 4b: K-means social typology clustering

Input:  data/processed/paris_2026_t1.geojson
Output: Overwrites GeoJSON with additional LISA + cluster columns
        Prints summary report to stdout

Usage:  python scripts/analysis.py
"""

import os
import sys
import warnings

import numpy as np
import pandas as pd
import geopandas as gpd

# ─── Dependency check ────────────────────────────────────────────────────────
def _check_deps():
    missing = []
    try:
        import esda  # noqa: F401
    except ImportError:
        missing.append("esda")
    try:
        import libpysal  # noqa: F401
    except ImportError:
        missing.append("libpysal")
    try:
        import sklearn  # noqa: F401
    except ImportError:
        missing.append("scikit-learn")
    if missing:
        print(f"Installing missing dependencies: {', '.join(missing)}")
        import subprocess
        subprocess.check_call(
            [sys.executable, "-m", "pip", "install", "--quiet",
             "--break-system-packages"] + missing
        )

_check_deps()

from esda.moran import Moran, Moran_Local
from libpysal.weights import Queen
from sklearn.preprocessing import StandardScaler
from sklearn.cluster import KMeans
from sklearn.metrics import silhouette_score

warnings.filterwarnings("ignore", category=FutureWarning)

# ─── Paths ───────────────────────────────────────────────────────────────────
PROCESSED     = os.path.join("data", "processed")
OUTPUT        = os.path.join(PROCESSED, "paris_2026_t1.geojson")
WEB_PROCESSED = os.path.join("web", "public", "data", "processed")
WEB_OUTPUT    = os.path.join(WEB_PROCESSED, "paris_2026_t1.geojson")

# ─── Variables ───────────────────────────────────────────────────────────────
LISA_VARS = [
    "taux_abstention",
    "revenu_median",
    "hlm_density",
    "pct_gregoire",
    "pct_dati",
    "pct_chikirou",
    "pct_bournazel",
    "pct_knafo",
]

CLUSTER_VARS = [
    "taux_abstention",
    "revenu_median",
    "hlm_density",
    "pct_gregoire",
    "pct_dati",
    "pct_chikirou",
    "pct_bournazel",
    "pct_knafo",
]

LISA_LABELS = {1: "HH", 2: "LH", 3: "LL", 4: "HL", 0: "NS"}
K_RANGE = range(3, 9)  # k = 3..8


# ══════════════════════════════════════════════════════════════════════════════
# Phase 4a — Moran's I + LISA
# ══════════════════════════════════════════════════════════════════════════════

def build_weights(gdf):
    """Build Queen contiguity weights from BV polygons."""
    print("Building Queen contiguity weights...")
    w = Queen.from_dataframe(gdf, use_index=False)
    # Handle islands (BVs with no neighbors) by adding self-loop
    # so they don't crash the analysis
    w_islands = w.islands
    if w_islands:
        print(f"  {len(w_islands)} island polygons detected (no contiguous neighbors)")
    w.transform = "R"  # row-standardize
    print(f"  {w.n} observations, mean neighbors = {w.mean_neighbors:.1f}")
    return w


def run_global_moran(gdf, w, variables):
    """Compute global Moran's I for each variable. Returns dict of results."""
    results = {}
    print("\n" + "=" * 72)
    print("GLOBAL MORAN'S I")
    print("=" * 72)
    print(f"{'Variable':22s}  {'Moran I':>9s}  {'E[I]':>9s}  {'z-score':>9s}  {'p-value':>9s}")
    print("-" * 72)

    for var in variables:
        series = gdf[var].copy()
        # Fill NaN with median for spatial analysis
        n_missing = series.isna().sum()
        if n_missing > 0:
            series = series.fillna(series.median())

        mi = Moran(series.values, w)
        results[var] = mi
        sig = "***" if mi.p_sim < 0.001 else "**" if mi.p_sim < 0.01 else "*" if mi.p_sim < 0.05 else ""
        print(f"  {var:20s}  {mi.I:9.4f}  {mi.EI:9.4f}  {mi.z_sim:9.4f}  {mi.p_sim:9.4f} {sig}")

    return results


def run_lisa(gdf, w, variables):
    """
    Compute Local Moran's I (LISA) for each variable.
    Adds lisa_{var} columns to gdf (HH/HL/LH/LL/NS).
    Returns dict of Moran_Local objects.
    """
    results = {}
    print("\n" + "=" * 72)
    print("LISA (Local Indicators of Spatial Association)")
    print("=" * 72)

    for var in variables:
        series = gdf[var].copy()
        n_missing = series.isna().sum()
        if n_missing > 0:
            series = series.fillna(series.median())

        lm = Moran_Local(series.values, w, permutations=999)
        results[var] = lm

        # Classify: significant (p < 0.05) quadrants, else NS
        col_name = f"lisa_{var}"
        labels = []
        for i in range(len(gdf)):
            if lm.p_sim[i] < 0.05:
                labels.append(LISA_LABELS.get(lm.q[i], "NS"))
            else:
                labels.append("NS")
        gdf[col_name] = labels

        # Distribution
        counts = pd.Series(labels).value_counts()
        dist_str = "  ".join(f"{k}={counts.get(k, 0)}" for k in ["HH", "HL", "LH", "LL", "NS"])
        print(f"  {var:20s}  {dist_str}")

    return results


# ══════════════════════════════════════════════════════════════════════════════
# Phase 4b — K-means clustering
# ══════════════════════════════════════════════════════════════════════════════

def run_kmeans(gdf, variables):
    """
    Standardize variables, run K-means for k=3..8,
    pick optimal k by silhouette score, add cluster_id to gdf.
    """
    print("\n" + "=" * 72)
    print("K-MEANS CLUSTERING")
    print("=" * 72)

    # Prepare matrix — fill NaN with median per column
    X_raw = gdf[variables].copy()
    for col in variables:
        X_raw[col] = X_raw[col].fillna(X_raw[col].median())

    scaler = StandardScaler()
    X = scaler.fit_transform(X_raw)

    # Evaluate silhouette for k = 3..8
    print(f"\n{'k':>4s}  {'Silhouette':>12s}  {'Inertia':>12s}")
    print("-" * 34)
    scores = {}
    models = {}
    for k in K_RANGE:
        km = KMeans(n_clusters=k, n_init=20, random_state=42, max_iter=500)
        labels = km.fit_predict(X)
        sil = silhouette_score(X, labels)
        scores[k] = sil
        models[k] = km
        print(f"  {k:2d}    {sil:10.4f}    {km.inertia_:10.1f}")

    # Pick best k
    best_k = max(scores, key=scores.get)
    print(f"\n  Optimal k = {best_k} (silhouette = {scores[best_k]:.4f})")

    # Assign cluster labels
    best_model = models[best_k]
    gdf["cluster_id"] = best_model.fit_predict(X)

    # Descriptive stats per cluster
    print(f"\n{'Cluster':>8s}  {'n':>5s}", end="")
    for v in variables:
        # Truncate long variable names for table alignment
        short = v.replace("pct_", "").replace("taux_", "")[:10]
        print(f"  {short:>10s}", end="")
    print()
    print("-" * (16 + 12 * len(variables)))

    for cid in sorted(gdf["cluster_id"].unique()):
        mask = gdf["cluster_id"] == cid
        n = mask.sum()
        print(f"  {cid:6d}  {n:5d}", end="")
        for v in variables:
            mean_val = gdf.loc[mask, v].mean()
            print(f"  {mean_val:10.2f}", end="")
        print()

    return scores, best_k


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════

def main():
    # ── Load data ─────────────────────────────────────────────────────────
    # Try primary path, fall back to web path
    if os.path.exists(OUTPUT):
        input_path = OUTPUT
    elif os.path.exists(WEB_OUTPUT):
        input_path = WEB_OUTPUT
    else:
        sys.exit(f"ERROR: GeoJSON not found at {OUTPUT} or {WEB_OUTPUT}")

    print(f"Loading {input_path}...")
    gdf = gpd.read_file(input_path)
    print(f"  {len(gdf)} BV features loaded")

    # Verify required columns exist
    available = set(gdf.columns)
    for var in LISA_VARS:
        if var not in available:
            print(f"  WARNING: column '{var}' not found, skipping from analysis")
    lisa_vars = [v for v in LISA_VARS if v in available]
    cluster_vars = [v for v in CLUSTER_VARS if v in available]

    if len(lisa_vars) < 2:
        sys.exit("ERROR: Not enough numeric columns for spatial analysis")

    # ── Phase 4a: Spatial autocorrelation ─────────────────────────────────
    w = build_weights(gdf)
    global_results = run_global_moran(gdf, w, lisa_vars)
    lisa_results = run_lisa(gdf, w, lisa_vars)

    # ── Phase 4b: K-means ─────────────────────────────────────────────────
    sil_scores, best_k = run_kmeans(gdf, cluster_vars)

    # ── Save output ───────────────────────────────────────────────────────
    # Ensure CRS is WGS84
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        gdf = gdf.to_crs("EPSG:4326")

    os.makedirs(PROCESSED, exist_ok=True)
    os.makedirs(WEB_PROCESSED, exist_ok=True)

    gdf.to_file(OUTPUT, driver="GeoJSON")
    gdf.to_file(WEB_OUTPUT, driver="GeoJSON")

    print(f"\nOutput written to:")
    print(f"  {OUTPUT}")
    print(f"  {WEB_OUTPUT}")

    # ── Summary ───────────────────────────────────────────────────────────
    new_cols = [c for c in gdf.columns if c.startswith("lisa_") or c == "cluster_id"]
    print(f"\nNew columns added ({len(new_cols)}): {', '.join(new_cols)}")


if __name__ == "__main__":
    main()
