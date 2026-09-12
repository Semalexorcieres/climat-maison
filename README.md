# 🌤️ Dashboard Climat — Netatmo

Dashboard perso qui exploite les données de ta station Netatmo :
conditions actuelles, **températures min/max jour / mois / année**, **vent**
(vitesse, rafales, direction sur une boussole), **pluie**, et un **graphe
d'évolution** des températures et précipitations.

- **Backend** : Python (bibliothèque standard uniquement → **rien à installer**).
- **Frontend** : page web autonome (HTML/CSS/JS, aucun CDN).
- **Auth** : OAuth Netatmo, tokens rafraîchis automatiquement.

---

## 1. Créer ton app Netatmo

1. Va sur **https://dev.netatmo.com** et connecte-toi avec ton compte Netatmo habituel.
2. Menu en haut à droite → **My apps** → **Create** (Create a new app).
3. Remplis le formulaire (nom : « Dashboard perso », le reste peu importe) puis **Save**.
4. Sur la page de l'app, note :
   - **client id**
   - **client secret**

### Générer le token (le plus simple pour un usage perso)

Toujours sur la page de ton app, section **Token generator** (en bas) :

1. Coche le scope **`read_station`**.
2. Clique **Generate Token**, autorise l'accès.
3. Copie le **Refresh token** affiché (c'est celui qui dure — l'access token, lui,
   sera régénéré tout seul par le dashboard).

> ℹ️ Netatmo fait « tourner » le refresh token : à chaque rafraîchissement il en
> émet un nouveau. Le dashboard s'en occupe et le stocke dans `.tokens.json`.
> Tu n'as à coller le refresh token qu'**une seule fois**.

---

## 2. Configurer

Dans le dossier du projet :

```bash
cp .env.example .env
```

Ouvre `.env` et colle tes 3 valeurs :

```
CLIENT_ID=ton_client_id
CLIENT_SECRET=ton_client_secret
REFRESH_TOKEN=ton_refresh_token
```

---

## 3. Lancer

```bash
python3 server.py
```

Puis ouvre **http://localhost:8000** dans ton navigateur.

- Bouton **↻** : rafraîchir les données maintenant.
- Bouton **◐** : basculer thème clair / sombre.
- Boutons **7 j / 30 j / 90 j / 1 an** : période du graphe.
- Les données se rafraîchissent aussi automatiquement toutes les 5 minutes.

Pour changer le port :

```bash
PORT=9000 python3 server.py
```

---

## Ce que montre le dashboard

| Bloc | Contenu |
|------|---------|
| **Extérieur** | température + tendance, humidité |
| **Vent** | vitesse, rafales, max du jour, direction (boussole) |
| **Pluie** | cumul du jour, intensité horaire |
| **Intérieur** | température, humidité, CO₂, pression |
| **Min / Max** | températures extrêmes : aujourd'hui, ce mois, cette année |
| **Graphe** | courbes min/max + barres de pluie sur la période choisie |

---

## Dépannage

- **« Configuration requise » / erreur OAuth** : vérifie les 3 valeurs dans `.env`.
  Si le refresh token a été invalidé (regénéré ailleurs, scope changé), supprime
  `.tokens.json`, régénère un token sur dev.netatmo.com et recolle-le dans `.env`.
- **« Serveur injoignable »** : le script `python3 server.py` doit tourner dans un
  terminal pendant que tu consultes la page.
- **Valeurs manquantes (vent/pluie « — »)** : le module concerné n'a pas encore
  remonté de mesure, ou n'est pas rattaché à la station principale.
- **Unités** : le dashboard affiche °C / km/h / mm / mbar. Netatmo renvoie les
  données selon les unités de ton compte — règle-les dans l'app Netatmo si besoin.

---

## Structure

```
Dashboard-Netatmo/
├── server.py          # serveur HTTP + routes API (stdlib)
├── netatmo.py         # OAuth + appels API + agrégation
├── .env.example       # modèle de config (à copier en .env)
├── public/
│   ├── index.html     # structure du dashboard
│   ├── style.css      # thème clair/sombre
│   └── app.js         # rendu + graphe SVG
└── README.md
```
