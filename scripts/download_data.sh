#!/usr/bin/env bash
# Télécharge et extrait toutes les données brutes nécessaires au projet.
#
# Usage :
#   bash scripts/download_data.sh            # obligatoires uniquement (Paris)
#   bash scripts/download_data.sh --idf      # + Admin-Express COG (~582 MB, vue IDF)
#   bash scripts/download_data.sh --optional # + résultats 2020 + RP2021 (~530 MB)
#   bash scripts/download_data.sh --idf --optional  # tout

set -euo pipefail

DOWNLOAD_IDF=false
DOWNLOAD_OPTIONAL=false
for arg in "$@"; do
  case $arg in
    --idf)      DOWNLOAD_IDF=true ;;
    --optional) DOWNLOAD_OPTIONAL=true ;;
    *) echo "Option inconnue : $arg  (options valides : --idf, --optional)"; exit 1 ;;
  esac
done

_require_7z() {
  if ! command -v 7z &>/dev/null; then
    echo "ERREUR : 7z introuvable (requis pour $1). Installer avec :"
    echo "  sudo apt install p7zip-full   # Debian/Ubuntu"
    echo "  brew install p7zip            # macOS"
    exit 1
  fi
}

mkdir -p data/raw/premier_tour_resultat \
         data/raw/bureaux_vote \
         data/raw/BASE_TD_FILO_IRIS_2021_DISP_CSV \
         data/raw/RPLS_01-01-2024_Iris

# ─────────────────────────────────────────────────────────
# [1/5] Résultats électoraux 2026 — Ministère de l'Intérieur
# ─────────────────────────────────────────────────────────
ELEC26="data/raw/premier_tour_resultat/municipales-2026-resultats-bv-par-communes-2026-03-20.csv"
if [ ! -f "$ELEC26" ]; then
  echo "[1/5] Résultats 2026 par bureau de vote…"
  curl -L --progress-bar \
    "https://static.data.gouv.fr/resources/elections-municipales-2026-resultats-du-premier-tour/20260320-164249/municipales-2026-resultats-bv-par-communes-2026-03-20.csv" \
    -o "$ELEC26"
else
  echo "[1/5] Résultats 2026 déjà présents, ignoré."
fi

# ─────────────────────────────────────────────────────────
# [2/5] Géographie des bureaux de vote — opendata.paris.fr
# ─────────────────────────────────────────────────────────
BV="data/raw/bureaux_vote/secteurs-des-bureaux-de-vote-2026.geojson"
if [ ! -f "$BV" ]; then
  echo "[2/5] Contours des bureaux de vote Paris…"
  curl -L --progress-bar \
    "https://opendata.paris.fr/api/explore/v2.1/catalog/datasets/secteurs-des-bureaux-de-vote-2026/exports/geojson?lang=fr&timezone=Europe%2FBerlin" \
    -o "$BV"
else
  echo "[2/5] Bureaux de vote déjà présents, ignoré."
fi

# ─────────────────────────────────────────────────────────
# [3/5] INSEE Filosofi IRIS 2021 — revenus disponibles
# ─────────────────────────────────────────────────────────
FILO="data/raw/BASE_TD_FILO_IRIS_2021_DISP_CSV/BASE_TD_FILO_IRIS_2021_DISP.csv"
if [ ! -f "$FILO" ]; then
  echo "[3/5] INSEE Filosofi IRIS 2021 (DISP)…"
  curl -L --progress-bar \
    "https://www.insee.fr/fr/statistiques/fichier/8229323/BASE_TD_FILO_IRIS_2021_DISP_CSV.zip" \
    -o /tmp/filo_disp.zip
  unzip -q /tmp/filo_disp.zip -d data/raw/
  rm /tmp/filo_disp.zip
else
  echo "[3/5] Filosofi déjà présent, ignoré."
fi

# ─────────────────────────────────────────────────────────
# [4/5] INSEE RPLS 2024 — logements sociaux par IRIS
# ─────────────────────────────────────────────────────────
RPLS_IRIS="data/raw/RPLS_01-01-2024_Iris/data_RPLS2024_Iris.csv"
if [ ! -f "$RPLS_IRIS" ]; then
  echo "[4/5] INSEE RPLS 2024 (IRIS + commune)…"
  curl -L --progress-bar \
    "https://www.insee.fr/fr/statistiques/fichier/8736658/RPLS_01-01-2024_Iris.zip" \
    -o /tmp/rpls.zip
  unzip -q /tmp/rpls.zip -d data/raw/
  rm /tmp/rpls.zip
else
  echo "[4/5] RPLS déjà présent, ignoré."
fi

# ─────────────────────────────────────────────────────────
# [5/5] Contours IRIS — IGN / data.geopf.fr
# ─────────────────────────────────────────────────────────
IRIS_GPKG=$(find data/raw/ -maxdepth 6 -name "*.gpkg" -path "*/CONTOURS-IRIS*" 2>/dev/null | head -1 || true)
if [ -z "$IRIS_GPKG" ]; then
  _require_7z "CONTOURS-IRIS"
  echo "[5/5] Contours IRIS IGN (Lambert-93, ~27 MB extrait)…"
  curl -L --progress-bar \
    "https://data.geopf.fr/telechargement/download/CONTOURS-IRIS-PE/CONTOURS-IRIS-PE_3-0__GPKG_LAMB93_FXX_2025-01-01/CONTOURS-IRIS-PE_3-0__GPKG_LAMB93_FXX_2025-01-01.7z" \
    -o /tmp/iris.7z
  7z x /tmp/iris.7z -o"data/raw/" -y > /dev/null
  rm /tmp/iris.7z
else
  echo "[5/5] Contours IRIS déjà présents (${IRIS_GPKG}), ignoré."
fi

# ─────────────────────────────────────────────────────────
# [IDF] Admin-Express COG — IGN / data.geopf.fr  (--idf)
# ─────────────────────────────────────────────────────────
if $DOWNLOAD_IDF; then
  AE_GPKG=$(find data/raw/ -maxdepth 4 -name "*.gpkg" -path "*/ADMIN-EXPRESS-COG*" 2>/dev/null | head -1 || true)
  if [ -z "$AE_GPKG" ]; then
    _require_7z "Admin-Express COG"
    echo "[IDF] Admin-Express COG IGN (WGS84, ~582 MB compressé)…"
    curl -L --progress-bar \
      "https://data.geopf.fr/telechargement/download/ADMIN-EXPRESS-COG/ADMIN-EXPRESS-COG_4-0__GPKG_WGS84G_FRA-ED2025-01-01/ADMIN-EXPRESS-COG_4-0__GPKG_WGS84G_FRA-ED2025-01-01.7z" \
      -o /tmp/admin_express.7z
    7z x /tmp/admin_express.7z -o"data/raw/" -y > /dev/null
    rm /tmp/admin_express.7z
  else
    echo "[IDF] Admin-Express COG déjà présent (${AE_GPKG}), ignoré."
  fi
fi

# ─────────────────────────────────────────────────────────
# [OPT] Résultats 2020 + RP2021 individus  (--optional)
# ─────────────────────────────────────────────────────────
if $DOWNLOAD_OPTIONAL; then
  ELEC20="data/raw/premier_tour_resultat/municipales-2020-resultats-bv-t1-france.txt"
  if [ ! -f "$ELEC20" ]; then
    echo "[OPT] Résultats 2020 par bureau de vote (~64 MB)…"
    curl -L --progress-bar \
      "https://www.data.gouv.fr/api/1/datasets/r/248f6f21-68ad-45f3-82f5-53fffabce5f3" \
      -o "$ELEC20"
  else
    echo "[OPT] Résultats 2020 déjà présents, ignoré."
  fi

  RP21="data/raw/RP2021_indcvi.parquet"
  if [ ! -f "$RP21" ]; then
    echo "[OPT] RP2021 individus INSEE (~466 MB)…"
    curl -L --progress-bar \
      "https://www.insee.fr/fr/statistiques/fichier/8268848/RP2021_indcvi.parquet" \
      -o "$RP21"
  else
    echo "[OPT] RP2021 déjà présent, ignoré."
  fi
fi

echo ""
echo "Téléchargements terminés."
echo "Lancer ensuite : python scripts/process.py"
