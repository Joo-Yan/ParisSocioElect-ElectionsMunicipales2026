"""
ParisSocioElect — scripts/process_idf.py
Grand Paris (Île-de-France) commune-level data pipeline.

Entrée  : data/raw/ (élections, RPLS COM, Filosofi IRIS, Admin-Express commune boundaries)
Sortie  : data/processed/idf_2026_t1.geojson + web/public/data/processed/idf_2026_t1.geojson

Données nécessaires :
  data/raw/premier_tour_resultat/municipales-2026-resultats-bv-par-communes-2026-03-16.csv
  data/raw/RPLS_01-01-2024_Iris/data_RPLS2024_COM.csv
  data/raw/BASE_TD_FILO_IRIS_2021_DISP_CSV/BASE_TD_FILO_IRIS_2021_DISP.csv
  data/raw/ADMIN-EXPRESS-COG/ (commune boundary GPKG — Admin-Express COG IGN)
"""

import os
import glob
import pandas as pd
import geopandas as gpd
import numpy as np

# ─── Chemins ─────────────────────────────────────────────────────────────────
RAW       = "data/raw"
PROCESSED = "data/processed"
OUTPUT    = os.path.join(PROCESSED, "idf_2026_t1.geojson")
WEB_PROCESSED = os.path.join("web", "public", "data", "processed")
WEB_OUTPUT    = os.path.join(WEB_PROCESSED, "idf_2026_t1.geojson")

ELECTIONS_CSV = os.path.join(RAW, "premier_tour_resultat",
    "municipales-2026-resultats-bv-par-communes-2026-03-16.csv")
RPLS_COM_CSV  = os.path.join(RAW, "RPLS_01-01-2024_Iris",
    "data_RPLS2024_COM.csv")
FILO_IRIS_CSV = os.path.join(RAW, "BASE_TD_FILO_IRIS_2021_DISP_CSV",
    "BASE_TD_FILO_IRIS_2021_DISP.csv")

# Admin-Express: search for GPKG in data/raw/ADMIN-EXPRESS-COG/
_ae_matches = glob.glob(os.path.join(RAW, "ADMIN-EXPRESS-COG*", "**", "*.gpkg"),
                        recursive=True)
ADMIN_EXPRESS_GPKG = _ae_matches[0] if _ae_matches else None

# IDF départements
IDF_DEPS = ["75", "77", "78", "91", "92", "93", "94", "95"]

# Political family groupings for IDF communes
# Broader than Paris-specific nuances to capture suburban diversity
MAJOR_NUANCES = {
    "pct_gauche":   ["LUG", "LFI", "LSOC", "LCOM", "LDVG", "LEXG", "LVEC", "LECO"],
    "pct_centre":   ["LUC", "LREN", "LMDM", "LDVC", "LDSV"],
    "pct_droite":   ["LUD", "LLR", "LDVD", "LUDR", "LUDI", "LREC"],
    "pct_ext_droite": ["LRN", "LEXD", "LUXD"],
}
# ─────────────────────────────────────────────────────────────────────────────


# ══════════════════════════════════════════════════════════════════════════════
# 1. Élections — IDF communes (aggregated from BV level)
# ══════════════════════════════════════════════════════════════════════════════
def load_elections_idf():
    print("[1/4] Élections IDF…")
    df = pd.read_csv(ELECTIONS_CSV, sep=";", encoding="utf-8", low_memory=False)

    # Filter IDF
    df["dep"] = df["Code département"].astype(str).str.zfill(2)
    idf = df[df["dep"].isin(IDF_DEPS)].copy()
    print(f"  {len(idf)} BV rows across IDF ({idf['Code commune'].nunique()} communes)")

    # Numeric columns
    for col in ["Inscrits", "Votants", "Abstentions", "Exprimés", "Blancs", "Nuls"]:
        idf[col] = pd.to_numeric(idf[col], errors="coerce").fillna(0)

    # Compute voix per nuance group for each BV
    for pct_col, nuance_list in MAJOR_NUANCES.items():
        voix_col_name = pct_col.replace("pct_", "voix_")
        voix = pd.Series(0.0, index=idf.index)
        for i in range(1, 20):
            nuance_col = f"Nuance liste {i}"
            voix_col   = f"Voix {i}"
            if nuance_col not in idf.columns:
                break
            mask = idf[nuance_col].isin(nuance_list)
            voix[mask] += pd.to_numeric(idf.loc[mask, voix_col], errors="coerce").fillna(0)
        idf[voix_col_name] = voix

    # Compute total "autres" voix = Exprimés minus all tracked
    tracked_voix_cols = [c.replace("pct_", "voix_") for c in MAJOR_NUANCES]
    idf["voix_autres"] = idf["Exprimés"] - idf[tracked_voix_cols].sum(axis=1)
    idf["voix_autres"] = idf["voix_autres"].clip(lower=0)

    # Aggregate to commune level
    agg_cols = {
        "Inscrits": "sum",
        "Votants": "sum",
        "Abstentions": "sum",
        "Exprimés": "sum",
        "Blancs": "sum",
        "Nuls": "sum",
    }
    for pct_col in MAJOR_NUANCES:
        agg_cols[pct_col.replace("pct_", "voix_")] = "sum"
    agg_cols["voix_autres"] = "sum"

    communes = idf.groupby("Code commune").agg(agg_cols).reset_index()
    communes = communes.rename(columns={"Code commune": "code_commune"})

    # Derive rates
    communes["taux_abstention"] = (
        communes["Abstentions"] / communes["Inscrits"] * 100
    ).round(2)
    communes["taux_participation"] = (
        communes["Votants"] / communes["Inscrits"] * 100
    ).round(2)

    for pct_col in MAJOR_NUANCES:
        voix_col = pct_col.replace("pct_", "voix_")
        communes[pct_col] = (communes[voix_col] / communes["Exprimés"] * 100).round(2)
    communes["pct_autres"] = (communes["voix_autres"] / communes["Exprimés"] * 100).round(2)

    # Also get commune name and département from first BV
    labels = idf.groupby("Code commune").first()[
        ["Libellé commune", "dep"]
    ].reset_index().rename(columns={
        "Code commune": "code_commune",
        "Libellé commune": "nom_commune",
        "dep": "departement",
    })
    communes = communes.merge(labels, on="code_commune", how="left")

    # Keep useful columns
    keep = ["code_commune", "nom_commune", "departement",
            "Inscrits", "Abstentions", "taux_abstention",
            "taux_participation"]
    keep += list(MAJOR_NUANCES.keys()) + ["pct_autres"]
    communes = communes[keep].rename(columns={
        "Inscrits": "inscrits",
        "Abstentions": "abstentions",
    })

    print(f"  {len(communes)} communes after aggregation")
    print(f"  taux_abstention — min={communes['taux_abstention'].min():.1f}%  "
          f"med={communes['taux_abstention'].median():.1f}%  "
          f"max={communes['taux_abstention'].max():.1f}%")
    return communes


# ══════════════════════════════════════════════════════════════════════════════
# 2. Admin-Express Commune Boundaries
# ══════════════════════════════════════════════════════════════════════════════
def load_commune_boundaries():
    assert ADMIN_EXPRESS_GPKG, (
        "Admin-Express GPKG introuvable dans data/raw/ADMIN-EXPRESS-COG*/\n"
        "Télécharger depuis https://data.geopf.fr/telechargement/download/ADMIN-EXPRESS-COG/"
    )
    print(f"[2/4] Admin-Express ({os.path.basename(ADMIN_EXPRESS_GPKG)})…")

    # List available layers
    import fiona
    layers = fiona.listlayers(ADMIN_EXPRESS_GPKG)
    print(f"  Available layers: {layers}")

    # Try common layer names
    commune_layer = None
    for name in ["COMMUNE", "commune", "Commune"]:
        if name in layers:
            commune_layer = name
            break
    if commune_layer is None:
        # Try partial match
        for name in layers:
            if "commune" in name.lower():
                commune_layer = name
                break
    assert commune_layer, f"No COMMUNE layer found in {layers}"

    gdf = gpd.read_file(ADMIN_EXPRESS_GPKG, layer=commune_layer)
    print(f"  {len(gdf)} communes in full dataset")

    # Known column names from Admin-Express COG 4.0
    code_col = "code_insee"
    dep_col = "code_insee_du_departement"
    name_col = "nom_officiel"

    # Fallback: try to detect columns if names differ
    if code_col not in gdf.columns:
        for candidate in ["INSEE_COM", "CODE_INSEE", "insee_com"]:
            if candidate in gdf.columns:
                code_col = candidate
                break
    if dep_col not in gdf.columns:
        for candidate in ["INSEE_DEP", "CODE_DEP", "insee_dep"]:
            if candidate in gdf.columns:
                dep_col = candidate
                break

    assert code_col in gdf.columns, f"No commune code column found in {list(gdf.columns)}"

    if dep_col in gdf.columns:
        idf_gdf = gdf[gdf[dep_col].astype(str).isin(IDF_DEPS)].copy()
    else:
        gdf["_dep"] = gdf[code_col].astype(str).str[:2]
        idf_gdf = gdf[gdf["_dep"].isin(IDF_DEPS)].copy()
        idf_gdf = idf_gdf.drop(columns=["_dep"])

    idf_gdf = idf_gdf.rename(columns={code_col: "code_commune"})

    keep_cols = ["code_commune", "geometry"]
    if name_col in idf_gdf.columns:
        idf_gdf = idf_gdf.rename(columns={name_col: "nom_ae"})
        keep_cols.append("nom_ae")

    idf_gdf = idf_gdf[keep_cols]

    # Ensure WGS84
    if idf_gdf.crs and idf_gdf.crs.to_epsg() != 4326:
        idf_gdf = idf_gdf.to_crs("EPSG:4326")

    print(f"  {len(idf_gdf)} IDF communes with boundaries")
    return idf_gdf


# ══════════════════════════════════════════════════════════════════════════════
# 3. RPLS — Logements sociaux (commune level)
# ══════════════════════════════════════════════════════════════════════════════
def load_rpls_commune():
    print("[3/4] RPLS HLM (commune)…")
    df = pd.read_csv(RPLS_COM_CSV, sep=";", encoding="utf-8", low_memory=False)
    df["dep"] = df["CodGeo"].astype(str).str[:2]
    idf = df[df["dep"].isin(IDF_DEPS)].copy()

    idf["n_hlm"] = pd.to_numeric(idf["nbLsPls"], errors="coerce").fillna(0)
    idf = idf.rename(columns={"CodGeo": "code_commune"})
    idf["code_commune"] = idf["code_commune"].astype(str)

    # Paris: keep only the commune-level row (75056), drop arrondissement rows (75101-75120)
    paris_arr_mask = idf["code_commune"].str.match(r"^751\d{2}$")
    idf = idf[~paris_arr_mask]

    print(f"  {len(idf)} IDF communes with RPLS data")
    print(f"  n_hlm total IDF: {idf['n_hlm'].sum():.0f}")
    return idf[["code_commune", "n_hlm"]]


# ══════════════════════════════════════════════════════════════════════════════
# 4. Filosofi — Revenu médian (aggregated from IRIS to commune)
# ══════════════════════════════════════════════════════════════════════════════
def load_revenus_commune():
    print("[4/4] Filosofi revenus (IRIS → commune)…")
    df = pd.read_csv(FILO_IRIS_CSV, sep=";", encoding="utf-8", low_memory=False)
    df["IRIS"] = df["IRIS"].astype(str)
    df["dep"] = df["IRIS"].str[:2]
    idf = df[df["dep"].isin(IDF_DEPS)].copy()

    idf["revenu_median"] = pd.to_numeric(idf["DISP_MED21"], errors="coerce")

    # Derive commune code from IRIS (first 5 digits)
    idf["code_commune"] = idf["IRIS"].str[:5]

    # Paris arrondissements: IRIS codes 75101-75120 all map to commune 75056
    paris_mask = idf["code_commune"].str.startswith("751")
    idf.loc[paris_mask, "code_commune"] = "75056"

    # Aggregate: median of IRIS medians per commune (approximation)
    # A weighted median would be better but we lack population weights per IRIS
    commune_rev = idf.groupby("code_commune")["revenu_median"].median().reset_index()
    commune_rev["revenu_median"] = commune_rev["revenu_median"].round(0)

    n_valid = commune_rev["revenu_median"].notna().sum()
    print(f"  {n_valid}/{len(commune_rev)} communes with revenu_median")
    return commune_rev


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main():
    os.makedirs(PROCESSED, exist_ok=True)
    os.makedirs(WEB_PROCESSED, exist_ok=True)

    # Load data
    df_elec = load_elections_idf()
    gdf_communes = load_commune_boundaries()
    df_rpls = load_rpls_commune()
    df_rev  = load_revenus_commune()

    # Join: boundaries ← elections
    gdf = gdf_communes.merge(df_elec, on="code_commune", how="left")

    # Join: ← RPLS
    gdf = gdf.merge(df_rpls, on="code_commune", how="left")
    # Communes absent from RPLS have zero social housing (not missing data)
    gdf["n_hlm"] = gdf["n_hlm"].fillna(0)

    # Compute HLM density (per km²) using geometry area
    gdf_proj = gdf.to_crs("EPSG:2154")
    gdf["area_km2"] = (gdf_proj.geometry.area / 1e6).round(3)
    gdf["hlm_density"] = (gdf["n_hlm"] / gdf["area_km2"]).round(1)
    gdf.loc[gdf["area_km2"] == 0, "hlm_density"] = np.nan

    # Join: ← Filosofi revenus
    gdf = gdf.merge(df_rev, on="code_commune", how="left")

    # Report coverage
    n_total = len(gdf)
    n_with_elec = gdf["taux_abstention"].notna().sum()
    n_with_hlm  = gdf["n_hlm"].notna().sum()
    n_with_rev  = gdf["revenu_median"].notna().sum()

    print(f"\n── Couverture ─────────────────────────────────────────────────")
    print(f"  Communes totales (géométrie): {n_total}")
    print(f"  Avec données électorales:     {n_with_elec}/{n_total}")
    print(f"  Avec RPLS HLM:                {n_with_hlm}/{n_total}")
    print(f"  Avec revenu médian:            {n_with_rev}/{n_total}")

    # Drop communes without election data (no match in BV CSV)
    gdf = gdf[gdf["taux_abstention"].notna()].copy()
    print(f"  → {len(gdf)} communes retenues (avec données électorales)")

    # Final column selection
    pct_cols = list(MAJOR_NUANCES.keys()) + ["pct_autres"]
    keep = [
        "geometry", "code_commune", "nom_commune", "departement",
        "inscrits", "abstentions", "taux_abstention",
        "revenu_median", "n_hlm", "hlm_density", "area_km2",
    ] + pct_cols
    keep = [c for c in keep if c in gdf.columns]
    gdf_out = gdf[keep]

    # Save
    gdf_out.to_file(OUTPUT, driver="GeoJSON")
    gdf_out.to_file(WEB_OUTPUT, driver="GeoJSON")

    size_mb = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f"\n✅ Sortie : {OUTPUT}")
    print(f"   {len(gdf_out)} communes  ·  {size_mb:.1f} MB")
    print(f"✅ Copie frontend : {WEB_OUTPUT}")

    # Per-département summary
    print(f"\n── Par département ────────────────────────────────────────────")
    dep_stats = gdf_out.groupby("departement").agg({
        "code_commune": "count",
        "taux_abstention": "median",
        "revenu_median": "median",
        "hlm_density": "median",
    }).rename(columns={"code_commune": "n_communes"})
    print(dep_stats.to_string())

    # Breakpoints for frontend
    print(f"\n── Breakpoints (quintiles) ─────────────────────────────────────")
    for col, label in [
        ("taux_abstention", "abstention"),
        ("revenu_median",   "revenu"),
        ("hlm_density",     "hlm"),
    ] + [(c, c.replace("pct_", "")) for c in pct_cols]:
        if col not in gdf_out.columns:
            continue
        s = gdf_out[col].dropna()
        if len(s) == 0:
            continue
        q = [round(s.quantile(i / 5), 1) for i in range(1, 5)]
        print(f"  {label:20s}: Q1={q[0]:>8.1f}  Q2={q[1]:>8.1f}  Q3={q[2]:>8.1f}  Q4={q[3]:>8.1f}")


if __name__ == "__main__":
    main()
