# Chez nous ?

Application de recherche d'appartement à deux, avec synchronisation temps réel (Firebase Firestore) et connexion Google.

Suivi des biens (tri, avis croisés, agences, visites), fiche de visite, comparaison, et invitations Google Agenda.

---

## Ce qu'il te faut

- [Node.js](https://nodejs.org) 18+ installé (pour builder localement — sinon le déploiement GitHub Actions builde pour toi).
- Un compte Google et un compte GitHub.

---

## 1) Créer le projet Firebase

1. Va sur [console.firebase.google.com](https://console.firebase.google.com) → **Ajouter un projet**.
2. Dans le projet, ouvre **Build → Authentication → Get started → Sign-in method →** active **Google**.
3. Ouvre **Build → Firestore Database → Créer une base** → mode **production** → choisis une région (europe-west par ex.).
4. Récupère la config web : **⚙ Paramètres du projet → Tes applications →** icône Web `</>` → enregistre l'app → copie l'objet `firebaseConfig`.

## 2) Renseigner tes infos dans le code

- **`src/firebase.js`** :
  - Colle ta `firebaseConfig`.
  - Remplis `MEMBERS` avec vos deux e-mails Google et leur rôle :
    ```js
    export const MEMBERS = {
      "anais@gmail.com": "anais",
      "audrey@gmail.com": "copine",
    };
    ```
- **`firestore.rules`** : remplace les deux e-mails par les vôtres, puis copie tout le fichier dans la console Firebase (**Firestore → Règles → Publier**).
- **`vite.config.js`** : mets `base` = `"/<nom-de-ton-dépôt>/"` (ex. `"/chez-nous/"`).

## 3) Tester en local

```bash
npm install
npm run dev
```
Ouvre l'URL affichée (souvent http://localhost:5173). `localhost` est déjà autorisé par Firebase.

Une fois connectée, ouvre le **⚙** en haut → **« Charger des exemples »** pour remplir l'app avec des données de démonstration (bouton visible tant que l'app est vide).

## 4) Déployer sur GitHub Pages

1. Crée un dépôt GitHub (public), pousse le projet :
   ```bash
   git init
   git add .
   git commit -m "Chez nous - version Firebase"
   git branch -M main
   git remote add origin https://github.com/<pseudo>/<dépôt>.git
   git push -u origin main
   ```
2. Sur GitHub : **Settings → Pages → Build and deployment → Source : GitHub Actions**.
   Le workflow `.github/workflows/deploy.yml` builde et publie à chaque push sur `main`.
3. **Autorise le domaine de production dans Firebase** : **Authentication → Settings → Authorized domains → Add domain** → `<pseudo>.github.io`.
   (Sans ça, la connexion Google échoue en ligne.)

Ton app sera sur `https://<pseudo>.github.io/<dépôt>/`. Ouvre-la sur vos téléphones, « Ajouter à l'écran d'accueil » pour l'effet appli.

---

## Comment ça marche (en bref)

- **Connexion** : chacune se connecte avec son compte Google. L'e-mail détermine automatiquement qui est « Anaïs » et qui est « Audrey » (via `MEMBERS`). Les autres comptes sont refusés (écran « accès non autorisé »), et les règles Firestore bloquent tout accès non autorisé côté serveur.
- **Données** : collection Firestore `biens` (un document par appartement) + documents `shared/criteria`, `shared/checklist`, `shared/settings`. Tout est en temps réel : une modif d'un téléphone apparaît sur l'autre.
- **Champs texte** (commentaires, infos clés, réponses de visite, critères) : enregistrés quand tu quittes le champ, pour éviter d'écrire à chaque frappe.

## Notes

- Tailwind est chargé via CDN (dans `index.html`) : aucun build CSS à configurer. Un avertissement « not for production » peut apparaître en console, sans conséquence à cette échelle.
- Le bouton « Ajouter au Google Agenda » ouvre un événement pré-rempli avec vos deux e-mails en invités ; il suffit d'enregistrer côté Google pour envoyer les invitations.
- L'aperçu automatique d'annonce (bouton « Récupérer l'aperçu ») est encore **simulé** : brancher la vraie récupération demande une petite fonction serveur (Cloud Function) qui lira les balises Open Graph de l'annonce. À ajouter dans un second temps si tu le souhaites.

## Dépannage rapide

- **Page blanche en ligne** : vérifie que `base` dans `vite.config.js` correspond exactement au nom du dépôt.
- **Connexion Google qui échoue en ligne** : ajoute `<pseudo>.github.io` dans les domaines autorisés (étape 4.3).
- **« Missing or insufficient permissions »** : les règles Firestore ne contiennent pas ton e-mail, ou il diffère de celui de `MEMBERS`.
- **« accès non autorisé »** : ton e-mail n'est pas dans `MEMBERS` (`src/firebase.js`).
