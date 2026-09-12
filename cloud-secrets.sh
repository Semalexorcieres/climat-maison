#!/bin/bash
# Envoie tes clés Netatmo (lues depuis .env) vers les "secrets" chiffrés du dépôt
# GitHub, pour que la synchro automatique dans le cloud puisse s'y connecter.
# À lancer une seule fois :  bash cloud-secrets.sh
set -e
cd "$(dirname "$0")"
REPO="Semalexorcieres/climat-maison"
export GH_CONFIG_DIR="$HOME/.config/gh"

get() { grep -E "^$1=" .env | head -1 | sed "s/^$1=//" | tr -d ' '; }

echo "Envoi des clés vers $REPO …"
tools/gh secret set NETATMO_CLIENT_ID     --body "$(get CLIENT_ID)"     -R "$REPO"
tools/gh secret set NETATMO_CLIENT_SECRET --body "$(get CLIENT_SECRET)" -R "$REPO"
tools/gh secret set NETATMO_REFRESH_TOKEN --body "$(get REFRESH_TOKEN)" -R "$REPO"
echo "✅ Secrets ajoutés. La synchro cloud peut maintenant tourner."
echo "   Déclenche-la : tools/gh workflow run 'Synchro & publication' -R $REPO"
