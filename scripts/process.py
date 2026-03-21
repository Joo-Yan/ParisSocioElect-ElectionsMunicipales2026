"""
ParisSocioElect — scripts/process.py
Entrée  : data/raw/ (fichiers originaux)
Sortie  : data/processed/paris_2026_t1.geojson

Données nécessaires dans data/raw/ :
  premier_tour_resultat/municipales-2026-resultats-bv-par-communes-2026-03-16.csv
  bureaux_vote/secteurs-des-bureaux-de-vote-2026.geojson
  CONTOURS-IRIS-PE_.../contours-iris-pe.gpkg
  BASE_TD_FILO_IRIS_2021_DISP_CSV/BASE_TD_FILO_IRIS_2021_DISP.csv
  RPLS_01-01-2024_Iris/data_RPLS2024_Iris.csv
"""

import os
import glob
import pandas as pd
import geopandas as gpd
from shapely.geometry import Point

# ─── Chemins ─────────────────────────────────────────────────────────────────
RAW       = "data/raw"
PROCESSED = "data/processed"
OUTPUT    = os.path.join(PROCESSED, "paris_2026_t1.geojson")
WEB_PROCESSED = os.path.join("web", "public", "data", "processed")
WEB_OUTPUT    = os.path.join(WEB_PROCESSED, "paris_2026_t1.geojson")

ELECTIONS_CSV = os.path.join(RAW, "premier_tour_resultat",
    "municipales-2026-resultats-bv-par-communes-2026-03-16.csv")
BV_GEOJSON    = os.path.join(RAW, "bureaux_vote",
    "secteurs-des-bureaux-de-vote-2026.geojson")
FILO_CSV      = os.path.join(RAW, "BASE_TD_FILO_IRIS_2021_DISP_CSV",
    "BASE_TD_FILO_IRIS_2021_DISP.csv")
RPLS_CSV      = os.path.join(RAW, "RPLS_01-01-2024_Iris",
    "data_RPLS2024_Iris.csv")

# GPKG : cherche automatiquement dans le dossier CONTOURS-IRIS
_gpkg_matches = glob.glob(os.path.join(RAW, "CONTOURS-IRIS*", "**", "*.gpkg"), recursive=True)
IRIS_GPKG = _gpkg_matches[0] if _gpkg_matches else None

# Nuances des 5 listes principales à Paris
CANDIDATES = {
    "pct_gregoire":  "LUG",
    "pct_dati":      "LUD",
    "pct_chikirou":  "LFI",
    "pct_bournazel": "LUC",
    "pct_knafo":     "LEXD",
}
MINOR_NUANCES = ("LUXD", "LEXG")
# ─────────────────────────────────────────────────────────────────────────────


# ══════════════════════════════════════════════════════════════════════════════
# 1. Élections — Paris uniquement
# ══════════════════════════════════════════════════════════════════════════════
def load_elections():
    print("[1/5] Élections Paris…")
    df = pd.read_csv(ELECTIONS_CSV, sep=";", encoding="utf-8", low_memory=False)

    paris = df[df["Code commune"] == "75056"].copy()
    assert len(paris) > 0, "Aucune ligne Paris (Code commune == 75056) trouvée !"
    print(f"  {len(paris)} bureaux de vote Paris")

    # Clé de jointure : Code BV "0101" → arr=1, bv=1
    paris["arr"] = paris["Code BV"].str[:2].astype(int)
    paris["num"] = paris["Code BV"].str[2:].astype(int)
    paris["join_key"] = paris["Code BV"]   # ex: "0101"

    # Abstention
    paris["taux_abstention"] = (
        paris["Abstentions"] / paris["Inscrits"] * 100
    ).round(2)

    # Exprimés pour calculer les pct candidats
    exprimes = pd.to_numeric(paris["Exprimés"], errors="coerce")

    # Cherche les voix pour chaque candidat par nuance (la position du panneau
    # varie d'un bureau à l'autre)
    for pct_col, nuance in CANDIDATES.items():
        voix_series = pd.Series(0.0, index=paris.index)
        for i in range(1, 14):
            nuance_col = f"Nuance liste {i}"
            voix_col   = f"Voix {i}"
            if nuance_col not in paris.columns:
                break
            mask = paris[nuance_col] == nuance
            voix_series[mask] = pd.to_numeric(
                paris.loc[mask, voix_col], errors="coerce"
            ).fillna(0)
        paris[pct_col] = (voix_series / exprimes * 100).round(2)

    # Regroupe les petites listes restantes dans un indicateur résiduel.
    autres_voix = pd.Series(0.0, index=paris.index)
    for nuance in MINOR_NUANCES:
        voix_series = pd.Series(0.0, index=paris.index)
        for i in range(1, 14):
            nuance_col = f"Nuance liste {i}"
            voix_col   = f"Voix {i}"
            if nuance_col not in paris.columns:
                break
            mask = paris[nuance_col] == nuance
            voix_series[mask] = pd.to_numeric(
                paris.loc[mask, voix_col], errors="coerce"
            ).fillna(0)
        autres_voix += voix_series
    paris["pct_autres"] = (autres_voix / exprimes * 100).round(2)

    cols = ["join_key", "arr", "num",
            "Inscrits", "Abstentions", "taux_abstention"] + list(CANDIDATES.keys()) + ["pct_autres"]
    paris = paris[cols].rename(columns={
        "Inscrits": "inscrits",
        "Abstentions": "abstentions",
    })

    print(f"  taux_abstention — min={paris['taux_abstention'].min():.1f}%  "
          f"med={paris['taux_abstention'].median():.1f}%  "
          f"max={paris['taux_abstention'].max():.1f}%")
    return paris


# ══════════════════════════════════════════════════════════════════════════════
# 2. Géométries bureau de vote
# ══════════════════════════════════════════════════════════════════════════════
def load_bv():
    print("[2/5] BV GeoJSON…")
    gdf = gpd.read_file(BV_GEOJSON)   # CRS: EPSG:4326

    # Clé de jointure : "arrondissement" (str, ex "1") + "num_bv" (str, ex "1")
    #   → "01" + "01" = "0101"  (comme Code BV dans élections)
    gdf["join_key"] = (
        gdf["arrondissement"].astype(int).astype(str).str.zfill(2) +
        gdf["num_bv"].astype(int).astype(str).str.zfill(2)
    )
    # Label lisible pour l'arrondissement : "1er arr." puis "2e arr.", etc.
    arr_values = gdf["arrondissement"].astype(int)
    gdf["arrondissement_label"] = arr_values.map(
        lambda x: f"{x}{'er' if x == 1 else 'e'} arr."
    )

    print(f"  {len(gdf)} BV  —  join_key exemples: {gdf['join_key'].head(3).tolist()}")
    return gdf


# ══════════════════════════════════════════════════════════════════════════════
# 3. IRIS boundary (France entière → filtre Paris)
# ══════════════════════════════════════════════════════════════════════════════
def load_iris():
    assert IRIS_GPKG, "Fichier .gpkg IRIS introuvable dans data/raw/CONTOURS-IRIS*/"
    print(f"[3/5] IRIS GPKG ({os.path.basename(IRIS_GPKG)})…")
    gdf = gpd.read_file(IRIS_GPKG, layer="contours_iris_pe")   # CRS: EPSG:2154

    # Filtre Paris : code_insee commence par "751"
    paris_iris = gdf[gdf["code_insee"].astype(str).str.startswith("751")].copy()
    paris_iris = paris_iris.rename(columns={"code_iris": "CODE_IRIS"})

    print(f"  {len(paris_iris)} IRIS Paris")
    return paris_iris[["CODE_IRIS", "geometry"]]


# ══════════════════════════════════════════════════════════════════════════════
# 4. Revenus INSEE Filosofi (DISP_MED21)
# ══════════════════════════════════════════════════════════════════════════════
def load_revenus():
    print("[4/5] Filosofi revenus…")
    df = pd.read_csv(FILO_CSV, sep=";", encoding="utf-8", low_memory=False)

    paris_filo = df[df["IRIS"].astype(str).str.startswith("751")].copy()
    paris_filo = paris_filo.rename(columns={"IRIS": "CODE_IRIS"})
    paris_filo["revenu_median"] = pd.to_numeric(
        paris_filo["DISP_MED21"], errors="coerce"   # "ns" / "nd" → NaN
    )
    n_valid = paris_filo["revenu_median"].notna().sum()
    print(f"  {n_valid}/{len(paris_filo)} IRIS avec revenu_median valide")
    return paris_filo[["CODE_IRIS", "revenu_median"]]


# ══════════════════════════════════════════════════════════════════════════════
# 5. Logements sociaux RPLS (nbLsPls)
# Indicateur : nombre de HLM / km² (densité, car RPLS n'a pas le total logements)
# ══════════════════════════════════════════════════════════════════════════════
def load_hlm(gdf_iris):
    """
    Calcule la densité de logements sociaux (HLM/km²) par IRIS.
    gdf_iris doit être en EPSG:2154 pour que les surfaces soient en m².
    """
    print("[5/5] RPLS HLM…")
    df = pd.read_csv(RPLS_CSV, sep=";", encoding="utf-8", low_memory=False)

    paris_rpls = df[df["CodGeo"].astype(str).str.startswith("751")].copy()
    paris_rpls = paris_rpls.rename(columns={"CodGeo": "CODE_IRIS"})
    paris_rpls["n_hlm"] = pd.to_numeric(paris_rpls["nbLsPls"], errors="coerce").fillna(0)

    # Surface IRIS en km² (depuis la géométrie en EPSG:2154)
    iris_area = gdf_iris[["CODE_IRIS"]].copy()
    iris_area["area_km2"] = gdf_iris.geometry.area / 1e6

    hlm = paris_rpls[["CODE_IRIS", "n_hlm"]].merge(iris_area, on="CODE_IRIS", how="left")
    hlm["hlm_density"] = (hlm["n_hlm"] / hlm["area_km2"]).round(1)

    print(f"  n_hlm total Paris: {hlm['n_hlm'].sum():.0f}")
    print(f"  hlm_density — min={hlm['hlm_density'].min():.0f}  "
          f"med={hlm['hlm_density'].median():.0f}  "
          f"max={hlm['hlm_density'].max():.0f} HLM/km²")
    return hlm[["CODE_IRIS", "n_hlm", "hlm_density"]]


# ══════════════════════════════════════════════════════════════════════════════
# 6. Jointure centroïde : BV → IRIS
# ══════════════════════════════════════════════════════════════════════════════
def centroid_join(gdf_bv_2154, gdf_iris_2154):
    """
    Pour chaque BV, trouve l'IRIS contenant son centroïde.
    Les deux GeoDataFrames doivent être en EPSG:2154.
    """
    print("  Jointure centroïde BV → IRIS…")

    centroids = gpd.GeoDataFrame(
        {"join_key": gdf_bv_2154["join_key"]},
        geometry=gdf_bv_2154.geometry.centroid,
        crs="EPSG:2154"
    )

    # Jointure principale (within)
    joined = gpd.sjoin(
        centroids, gdf_iris_2154[["CODE_IRIS", "geometry"]],
        how="left", predicate="within"
    )[["join_key", "CODE_IRIS"]].drop_duplicates("join_key")

    #補漏 : centroïdes hors IRIS → voisin le plus proche
    missing_mask = joined["CODE_IRIS"].isna()
    n_miss = missing_mask.sum()
    if n_miss > 0:
        print(f"  {n_miss} centroïdes hors IRIS → nearest neighbour…")
        missing_keys = joined.loc[missing_mask, "join_key"]
        c_miss = centroids[centroids["join_key"].isin(missing_keys)]
        nearest = gpd.sjoin_nearest(
            c_miss, gdf_iris_2154[["CODE_IRIS", "geometry"]], how="left"
        )[["join_key", "CODE_IRIS"]].drop_duplicates("join_key")
        joined = joined.set_index("join_key")
        joined.update(nearest.set_index("join_key"))
        joined = joined.reset_index()

    still = joined["CODE_IRIS"].isna().sum()
    print(f"  Couverture IRIS : {len(joined) - still}/{len(joined)} BV")
    return joined


# ══════════════════════════════════════════════════════════════════════════════
# MAIN
# ══════════════════════════════════════════════════════════════════════════════
def main():
    os.makedirs(PROCESSED, exist_ok=True)
    os.makedirs(WEB_PROCESSED, exist_ok=True)

    # Chargement
    df_elec    = load_elections()
    gdf_bv     = load_bv()           # EPSG:4326
    gdf_iris   = load_iris()         # EPSG:2154
    df_rev     = load_revenus()
    df_hlm     = load_hlm(gdf_iris)

    # Reprojection BV en Lambert93 pour les calculs géo
    gdf_bv_2154 = gdf_bv.to_crs("EPSG:2154")

    # Vérification alignement des clés
    bv_keys  = set(gdf_bv["join_key"])
    elec_keys = set(df_elec["join_key"])
    match = len(bv_keys & elec_keys)
    print(f"\nAlignement clés : {match}/{len(bv_keys)} BV ont une correspondance")
    if match < len(bv_keys) * 0.9:
        print("  ⚠  < 90 % de correspondance — vérifier les clés")
        print(f"  BV GeoJSON exemples:     {sorted(bv_keys)[:5]}")
        print(f"  Élections Paris exemples: {sorted(elec_keys)[:5]}")

    # Fusion élections → BV
    gdf = gdf_bv.merge(df_elec, on="join_key", how="left")

    # Jointure centroïde → CODE_IRIS
    iris_map = centroid_join(gdf_bv_2154, gdf_iris)
    gdf = gdf.merge(iris_map, on="join_key", how="left")

    # Fusion données socio-économiques
    gdf = gdf.merge(df_rev, on="CODE_IRIS", how="left")
    gdf = gdf.merge(df_hlm, on="CODE_IRIS", how="left")

    # Champs finaux pour le frontend
    pct_cols = list(CANDIDATES.keys()) + ["pct_autres"]
    keep = [
        "geometry", "join_key", "arrondissement_label",
        "inscrits", "abstentions", "taux_abstention",
        "revenu_median", "n_hlm", "hlm_density",
    ] + pct_cols

    keep = [c for c in keep if c in gdf.columns]
    gdf_out = gdf[keep].rename(columns={
        "join_key":            "code_bv",
        "arrondissement_label": "arrondissement",
    })

    # Repasser en WGS84 pour le GeoJSON
    gdf_out = gdf_out.to_crs("EPSG:4326")
    gdf_out.to_file(OUTPUT, driver="GeoJSON")
    gdf_out.to_file(WEB_OUTPUT, driver="GeoJSON")

    size_mb = os.path.getsize(OUTPUT) / 1024 / 1024
    print(f"\n✅ Sortie : {OUTPUT}")
    print(f"   {len(gdf_out)} BV  ·  {size_mb:.1f} MB")
    print(f"✅ Copie frontend : {WEB_OUTPUT}")

    if size_mb > 5:
        simplified = OUTPUT.replace(".geojson", "_simplified.geojson")
        print(f"\n⚠  Fichier > 5 MB. Simplifier avec :")
        print(f"   mapshaper {OUTPUT} -simplify 10% -o {simplified}")

    # ── Breakpoints pour index.html (BREAKS variable) ────────────────────────
    print("\n── Breakpoints à coller dans index.html (BREAKS) ──────────────────")
    for col, label in [
        ("taux_abstention", "abstention"),
        ("revenu_median",   "revenu"),
        ("hlm_density",     "hlm"),
    ]:
        if col not in gdf_out.columns:
            continue
        s = gdf_out[col].dropna()
        q = [round(s.quantile(i / 5), 1) for i in range(1, 5)]
        print(f"  {label}: Q1={q[0]}  Q2={q[1]}  Q3={q[2]}  Q4={q[3]}")

    print("\n── Couverture des champs ───────────────────────────────────────────")
    for col in ["taux_abstention", "revenu_median", "hlm_density"] + pct_cols:
        if col not in gdf_out.columns:
            continue
        s = gdf_out[col]
        print(f"  {col:22s}  valide={s.notna().sum():3d}/{len(s)}  "
              f"min={s.min():.1f}  med={s.median():.1f}  max={s.max():.1f}")


if __name__ == "__main__":
    main()
