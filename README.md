# FraisPilot — notes de frais (application web installable)

Une seule base de code pour **Android, iPhone/iPad, tablette, PC et Mac** (PWA), emballable pour le Play Store.

## Contenu
| Fichier | Rôle |
|---|---|
| `index.html`, `app.js` | L'application (interface, calculs, stockage sur l'appareil) |
| `manifest.webmanifest`, `sw.js`, `icons/` | Installation et fonctionnement hors connexion |
| `serveur/worker.js`, `serveur/wrangler.toml` | Serveur relais Cloudflare : clé Mistral cachée, quotas de scans, mail de récupération, paiement Stripe |

## Fonctions
- Connexion par code à 4 chiffres ou mot de passe ; récupération par code envoyé par mail (serveur relais) ou par code de secours.
- Onglets *Dépenses pro* (liés à la GMAO), *Dépenses perso* (non liés), et onglets personnalisés ; chaque onglet verrouillable (code 4 chiffres ou mot de passe).
- Photo de ticket, **ticket long** (plusieurs photos assemblées en une image), import de photos et PDF (un ou plusieurs), saisie manuelle ou vocale.
- Remplissage automatique par **Mistral OCR** (commerçant, date, TTC, TVA, catégorie, quantité).
- **Plafonds de remboursement** par catégorie (par dépense × quantité, par jour, mois ou an) : seul le montant dans la limite est remboursable, le reste apparaît « hors limite » dans le récapitulatif. Par défaut : repas 20 €, hôtel 85 € / nuit.
- **Objectifs de dépenses** jour / mois / an sur les onglets sélectionnés, projection de fin de mois.
- **Commande et recherche vocales** (fr-FR) : « Ajoute 18,50 € de repas chez Paul pour l'intervention 2026-S041 », « Cherche hôtel », « Total du mois », « Scanne un ticket », « Synchronise la GMAO ».
- Export CSV (Excel), PDF / impression, sauvegarde JSON (avec ou sans photos), import CSV / sauvegarde.
- Synchronisation GMAO par n° d'intervention (format AAAA-Snnn).
- Plans Gratuit (10 scans + pubs), Solo 200, Pro 500, Business 1 000 scans ; option GMAO ; mensuel ou annuel.
- Personnalisation : nom de l'appli, couleur, thème clair / sombre / auto.

## Mise en ligne (≈ 1 h)
1. **Appli** : déposer le dossier (sans `serveur/`) dans un dépôt GitHub, activer GitHub Pages. L'adresse obtenue (https) est installable.
2. **Serveur relais** : compte Cloudflare gratuit → `npm i -g wrangler` → `wrangler kv namespace create FP` (copier l'id dans `wrangler.toml`) → `wrangler secret put MISTRAL_API_KEY` (clé créée sur console.mistral.ai, rubrique API Keys) → `wrangler secret put BREVO_API_KEY` → `wrangler deploy`.
3. Dans l'appli : Réglages › Lecture automatique › coller l'adresse du serveur relais, puis « Tester la connexion ».

> L'abonnement Le Chat Pro ne donne pas accès à l'API : la lecture des tickets utilise l'API Mistral (facturée à l'usage sur la console Mistral).

## Contrat d'échange avec la GMAO

**GMAO SSTI (weld-loaner-ledger)** : la réception est en place. Adresse : `https://weld-loaner-ledger.lovable.app/api/public/notes-de-frais` ; jeton `fp_…` créé dans la GMAO, Notes de frais → « Recevoir les dépenses de FraisPilot ». La GMAO répond `{ ok, recues, mises_a_jour, ignorees: [{ id, raison }] }` ; FraisPilot ne marque « synchronisées » que les dépenses reçues.

`POST <adresse GMAO>` (en-tête `Authorization: Bearer <jeton>`)
```json
{ "source": "FraisPilot", "version": 1, "appareil": "…", "utilisateur": "mail", "envoye_le": "ISO",
  "interventions": [ { "numero": "2026-S041", "client": "…", "total_ttc": 183.7, "total_remboursable": 169.2, "total_hors_limite": 14.5,
    "depenses": [ { "id": "…", "date": "2026-11-24", "commercant": "…", "categorie": "Repas", "quantite": 1,
      "montant_ttc": 27.5, "tva": 2.5, "remboursable": 20, "hors_limite": 7.5, "paiement": "Carte pro", "note": "", "justificatif": "data:image/jpeg;base64,…" } ] } ] }
```
`GET <adresse GMAO>?interventions=1` → `[{ "numero": "2026-S041", "client": "…", "libelle": "…" }]`

Pour une autre GMAO : un service qui vérifie le jeton, enregistre les dépenses liées à l'intervention, range les justificatifs et autorise l'origine de l'appli (CORS).

## Stores
- **Play Store** : emballer avec Bubblewrap (Trusted Web Activity). Abonnements obligatoirement via Google Play Billing (déjà prévu dans `app.js` : Digital Goods API) ; la vérification serveur `/billing/google` reste à brancher avec un compte de service Play Console.
- **App Store (iPhone / Mac)** : emballer avec Capacitor et utiliser les achats intégrés Apple. En attendant, l'appli s'installe depuis Safari.
- **Web** : liens de paiement Stripe (`STRIPE_LINK_*`) + webhook `/billing/stripe-webhook` (renseigner `metadata.plan` et `metadata.period` sur chaque lien).

## Limites connues (v1.0)
- Les données restent sur l'appareil (sauvegarde JSON pour changer d'appareil). Synchronisation multi-appareils et comptes entreprise : v2 (Supabase).
- Le verrou d'onglet protège l'accès dans l'appli ; les données ne sont pas chiffrées sur l'appareil.
- Commande vocale : Chrome, Edge, Safari récents (pas Firefox).
- Sans paiement branché, les plans payants s'activent en « mode démonstration » sur l'appareil ; le serveur relais, lui, applique toujours le quota réel du plan payé.
