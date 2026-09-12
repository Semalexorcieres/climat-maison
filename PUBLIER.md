# 📲 Publier le dashboard en ligne (lien public + webapp iPhone)

Le dossier `docs/` est un **site statique** prêt à héberger gratuitement sur
**GitHub Pages**. Une fois en ligne, tu auras un lien public que tu peux
installer comme une app sur ton téléphone.

> Le site montre les données de la **dernière synchro** (le serveur sur ton Mac
> pousse les mises à jour automatiquement, toutes les 6 h, quand il tourne).

---

## Étape 1 — Mettre le projet sur GitHub (une seule fois)

Le plus simple, sans ligne de commande : **GitHub Desktop**.

1. Télécharge **GitHub Desktop** : https://desktop.github.com — installe-le et
   connecte-toi avec ton compte GitHub.
2. Menu **File → Add Local Repository…**
3. Choisis le dossier :
   `/Users/alexboss/Desktop/Projet/Dashboard-Netatmo`
4. Clique **Publish repository** (en haut à droite).
   - Nomme-le par ex. `climat-maison`
   - ⚠️ **Décoche « Keep this code private »** → le dépôt doit être **public**
     pour que GitHub Pages gratuit fonctionne.
   - Clique **Publish**.

> Tes secrets (`.env`, tokens, base de données) sont **exclus automatiquement**
> et ne partent jamais sur GitHub. Seuls le code et les données météo publiques
> sont envoyés.

---

## Étape 2 — Activer GitHub Pages

1. Va sur ton dépôt sur **github.com** (bouton « View on GitHub » dans GitHub Desktop).
2. Onglet **Settings** → menu de gauche **Pages**.
3. Section **Build and deployment** :
   - **Source** : *Deploy from a branch*
   - **Branch** : `main`  —  dossier : **`/docs`**
   - Clique **Save**.
4. Attends ~1 minute puis recharge la page : GitHub affiche ton lien, du type
   **https://TON-PSEUDO.github.io/climat-maison/**

C'est ton lien public. 🎉

---

## Étape 3 — L'installer comme app sur ton iPhone

1. Ouvre le lien dans **Safari** sur ton iPhone.
2. Bouton **Partager** (carré avec une flèche) → **Sur l'écran d'accueil**.
3. Une icône « Climat » apparaît : elle s'ouvre en plein écran, comme une vraie app.

(Sur Android : Chrome → menu ⋮ → *Ajouter à l'écran d'accueil*.)

---

## Ensuite : mises à jour automatiques

Une fois l'étape 1 faite (GitHub Desktop connecté), **tu n'as plus rien à faire** :
quand le serveur tourne sur ton Mac, après chaque synchro il régénère `docs/` et
pousse les nouvelles données sur GitHub. Le site public se met à jour tout seul.

Pour forcer une mise à jour tout de suite :

```bash
python3 /Users/alexboss/Desktop/Projet/Dashboard-Netatmo/export.py
```

puis, dans GitHub Desktop, clique **Push origin** (ou attends la prochaine synchro).

---

## Bon à savoir

- Le lien est **public** : toute personne qui l'a voit tes données météo et le
  nom de tes stations (Collet D'Ancelle, etc.). Pas de mot de passe, pas de
  données perso sensibles, pas de position GPS exacte.
- Ce n'est **pas du temps réel à la seconde** : c'est la photo de la dernière
  synchro. Parfait pour du suivi climatique.
- Si un jour tu veux du **live en temps réel**, il faudra un vrai hébergement
  (autre chantier).
