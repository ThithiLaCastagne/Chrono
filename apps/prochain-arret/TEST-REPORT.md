# Prochain arrêt 1.1 — bilan de validation

Date : 13 octobre 2026. Cette validation concerne le pilote, pas une certification de fonctionnement sur tous les téléphones et réseaux de transport.

## Accès rapide

- Démo sans compte et sans permission GPS : https://prochain-arret.thibautgiuseppi.chatgpt.site/?demo=1
- Application : https://prochain-arret.thibautgiuseppi.chatgpt.site
- Android : téléchargement proposé dans l’application. La version web nécessite une page visible et un écran allumé ; ajouter la PWA à l’écran d’accueil ne donne pas de GPS en arrière-plan.

## Version contrôlée

Commit applicatif : `06b05f649fddfc98305b35bd98ceaa4ce5202790`.

Pipeline : https://github.com/ThithiLaCastagne/Chrono/actions/runs/38433454187

| Vérification | Périmètre | Résultat |
|---|---|---|
| JavaScript et ressources | Syntaxe, icônes, manifeste, permissions natives | Réussi localement et en CI |
| Tests moteur, données, réseau, cache, accessibilité | 60 tests automatisés | Réussi localement et en CI |
| Parcours d’interface DOM | 38 scénarios isolés, plus un parcours complet | Réussi localement et en CI |
| Simulation de trajets | 240 trajets bus/métro/train, 100 positions stationnaires bruitées | Réussi |
| Parité JavaScript / Java | 341 trajectoires, 17 647 positions ; événements, état et distance comparés | Réussi en CI |
| Android 8 / API 26 | Service réel sur émulateur | Réussi — 4 phases, 25 vérifications |
| Android 15 / API 35 | Service réel sur émulateur | Réussi — 4 phases, 25 vérifications |
| Services de recherche réels | Photon, Overpass, entêtes CORS | Photon + CORS : réussi. Overpass principal : HTTP 406 ; secours : HTTP 429. Disponibilité dégradée, non masquée. |
| Publication anonyme | HTML, scripts et APK sans session ni cookie | HTML anonyme : HTTP 200, aucune redirection de connexion. APK et ressources embarquées vérifiés avant publication. |

Les 17 647 positions sont des échantillons de trajectoires, pas autant de tests indépendants. Les scénarios DOM ne remplacent pas un navigateur réel.

## Scénarios challengés

**Détection.** Départ loin de l’arrêt ou déjà à destination ; approche puis arrivée ; déduplication ; précision négative, absente, modérée ou mauvaise ; positions anciennes, futures, dupliquées et désordonnées ; saut GPS impossible ; reprise après tunnel ; deux fournisseurs donnant presque simultanément la même position ; limites de zone ; changement de sens ; passage de la ligne de changement de date ; latitudes élevées. Les trajectoires générées font varier quatre directions, cinq lieux, trois vitesses (environ 29, 72 et 158 km/h), bruit et coupures.

**Données de transport.** Coordonnées invalides ; JSON malformé ; noms Unicode ; stop et quai dupliqués ; arrêt intermédiaire inconnu ; membre absent ; station proche portant un autre nom ; destination présente deux fois sur une boucle ; destination au premier arrêt. Une séquence incomplète ou ambiguë ne doit pas produire un faux arrêt précédent.

**Interface et concurrence.** Annulation pendant la demande GPS ou audio ; double activation ; verrou d’écran reçu après l’arrêt ; anciennes positions reçues après un nouveau trajet ; recherche A répondant après recherche B ; recherche de proximité après changement d’écran ; recherche de ligne répondant après ouverture d’une autre fenêtre ; refus et révocation de permission ; délai GPS dépassé ; réglages modifiés pendant un trajet ; préservation d’un trajet interrompu lors de la démo ; stockage corrompu et quota dépassé ; favoris utilisables hors réseau.

**Alertes et minuterie.** Arrivée prioritaire sur perte de signal ou rappel ; acquittement ; arrêt des répétitions ; réglages du trajet figés au départ ; prévention d’une désactivation de tous les moyens disponibles ; changement de l’horloge système sans expiration ou rappel immédiat. L’accès direct à la démo est testé sans API de géolocalisation et sans requête de recherche.

**Cache hors ligne.** Installation complète ou rejetée ; utilisation de la version du cache attendue ; suppression limitée aux anciens caches de l’application ; aucun stockage des requêtes Photon/Overpass ; exclusion de l’APK et des métadonnées de version des interceptions ; ouverture ou réutilisation de la fenêtre depuis une notification.

**Accessibilité.** Noms des boutons et liens, étiquettes des champs, langue du document, nom des fenêtres, focus des alertes et touche Échap, animation réduite, contraste calculé d’au moins 4,5:1 sur les principales palettes de texte. Les petites commandes tactiles et plusieurs textes secondaires ont été agrandis. Cela ne constitue pas un audit WCAG complet dans un navigateur ou avec lecteur d’écran.

## Vérification Android instrumentée

Le test utilise le véritable `TripService`, `LocationManager`, le système de notifications et des positions GPS injectées sur des émulateurs propres. Il n’évalue ni ne pilote le navigateur embarqué.

1. Lancer le service depuis une activité visible ; vérifier la notification permanente et une première position valide.
2. Passer l’activité en arrière-plan puis éteindre l’écran ; vérifier que l’écran est réellement éteint.
3. Couper les positions ; vérifier l’avertissement de perte de signal et la minuterie de secours sans fausse arrivée.
4. Réinjecter une position d’approche, puis d’arrivée ; vérifier les notifications et le service toujours actif.
5. Acquitter ; vérifier l’arrêt des répétitions et l’absence de nouvelle alerte GPS/minuteur après l’arrivée.
6. Arrêter le suivi ; vérifier la destruction du service, la disparition des notifications et l’effacement du trajet actif.
7. Interrompre le processus / forcer l’arrêt ; rouvrir l’application et vérifier l’absence de reprise silencieuse.
8. Refuser la localisation ; vérifier une erreur explicite et l’absence de service ou notification permanente résiduels.

## Défauts corrigés grâce à l’audit

- Arrivée auparavant confirmée par deux mesures à quelques millisecondes d’intervalle : intervalle minimal de 1,5 seconde pour une précision modérée.
- Incertitude GPS auparavant plafonnée à 50 m dans le calcul d’arrivée : prise en compte de l’incertitude entière.
- Faux arrêt précédent possible lorsqu’un membre de ligne manquait : conservation des ruptures de séquence et rejet des ambiguïtés.
- Activation GPS et résultats réseau tardifs : annulation et contrôle de l’identité du trajet/de la requête avant application.
- Verrou d’écran reçu après l’arrêt : libération immédiate.
- Ancienne erreur native pouvant perturber un nouveau départ : identifiant de trajet vérifié.
- Réglages sonores modifiés en plein trajet : conservation des réglages choisis au départ.
- Minuteries sensibles au changement d’heure : utilisation d’un temps monotone.
- Alerte d’arrivée écrasée par un avertissement moins prioritaire : priorité explicite et suppression des rappels postérieurs à l’arrivée.
- Contrastes faibles, fenêtres sans nom accessible et petites cibles tactiles : corrections de lisibilité et de sémantique.
- Indisponibilité réelle d’Overpass pendant l’audit : bascule bornée vers un second opérateur en cas de panne, sans contournement des réponses de limitation 429.

## Limites restant à vérifier sur le terrain

Aucun essai dans un vrai véhicule ou sur un téléphone physique n’a été réalisé. Aucune vérification visuelle dans Safari/Chrome/WebView ni avec lecteur d’écran réel n’était disponible dans cet environnement. Le service natif a ses propres tests ; les notifications présentes sur émulateur ne prouvent pas que le son sera audible avec tous les volumes, casques, modes Ne pas déranger ou réglages constructeur.

Le GPS ne permet pas de suivre les stations dans un tunnel sans signal. Le système prévient de cette perte et fournit un rappel facultatif ; il n’invente pas une progression souterraine. Une voie voisine, une direction mal choisie, une déviation ou des données OSM obsolètes peuvent produire une alerte prématurée. L’arrêt géographique n’est pas une détection d’ouverture des portes. Batterie épuisée, fermeture forcée, restrictions de batterie et suspension par le système peuvent empêcher les alertes.

Photon et les serveurs Overpass n’offrent pas de garantie de disponibilité. Les défaillances affichent une solution par coordonnées ; la détection GPS d’un trajet déjà configuré ne dépend pas de leurs réponses. Il n’y a ni horaire temps réel ni calcul d’ETA.

L’APK est un pilote hors Play Store avec une clé de signature de test propre à la compilation. Pour remplacer l’ancien pilote, il faut le désinstaller, ce qui efface ses données locales. Une identité de signature durable et des essais physiques restent nécessaires avant une distribution de production.

## Reproduction

- `npm run check` puis `npm test`.
- Installer `happy-dom@20.0.11` dans un répertoire de test ; définir `DOM_TEST_MODULE` vers son `lib/index.js`, puis lancer `node tests/ui-smoke.mjs` et `node --test tests/ui.audit.mjs`.
- Le workflow GitHub compile le moteur Java, génère les fixtures de parité, construit et vérifie les APK, puis exécute les tests instrumentés sur API 26 et 35.
- `scripts/probe-services.mjs` teste une gare publique connue et les entêtes CORS ; il ne transmet aucune position utilisateur.

## Fichier Android publié

Version 1.1.0-pilot, versionCode 2. SHA-256 : `7ab473f3db77d3f28cee4f57de0b3744556a6afb589a24b174fa43ddf9db6670`. Les fichiers embarqués `app.js`, `engine.js`, `data.js`, `style.css`, `index.html`, `sw.js` et le manifeste web ont été comparés octet par octet aux sources publiées.
