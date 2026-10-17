# Dinice.X Pizza — Cloudflare (fichiers à la racine)

Tous les fichiers du projet sont placés dans un seul dossier, sans sous-dossiers.

## Déploiement depuis le navigateur
1. Téléverse les fichiers de ce ZIP (après extraction) dans un dépôt GitHub.
2. Cloudflare Dashboard → Compute → Workers & Pages → Create → connecte le dépôt GitHub.
3. Crée une base D1 dans Storage & databases → D1 SQL Database, nomme-la `dinicex-db`.
4. Dans la console SQL D1, exécute le contenu du fichier `schema.sql`.
5. Copie le Database ID et remplace `REMPLACER_PAR_ID_D1` dans `wrangler.jsonc`.
6. Dans les paramètres du Worker, ajoute `ADMIN_PATH` (un chemin secret long, sans slash) et `SESSION_SECRET` (une longue clé aléatoire).
7. Build command : `npm install`; deploy command : `npx wrangler deploy`.
8. Déploie, puis teste `/api/health`.

## URL
- Jeu public : `https://NOM-DU-WORKER.SOUS-DOMAINE.workers.dev/`
- Administration : même domaine + `/<ADMIN_PATH>`
- Export Excel : `/<ADMIN_PATH>/export.xlsx`

Attention : l'administration est accessible à toute personne possédant son lien secret. Le stockage des participations est assuré par D1. Les fichiers de configuration sont dans le même dossier que les fichiers du site pour respecter la demande, mais le dossier racine des assets peut exposer des fichiers non destinés au public selon la configuration Cloudflare; vérifie les fichiers servis avant la mise en production.
