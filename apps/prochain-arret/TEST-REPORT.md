# Prochain arrêt 1.2.1 — améliorations du parcours

17 octobre 2026. Cette passe conserve le fonctionnement de rappel par destination et n’ajoute aucune prétention de couverture universelle.

- Favoris accessibles depuis l’accueil ; récents dédupliqués, destination correcte après filtrage.
- Choix de ligne et de direction visible sans ouvrir les réglages avancés.
- Changement de transport incompatible : suppression de l’ancienne ligne et de l’arrêt précédent, nouvelle confirmation ; passage train/TGV compatible conservé.
- Résumés des alertes synchronisés avec les distances réellement sélectionnées, sans déplacer le focus ; réglages avancés laissés ouverts lors des mises à jour de configuration.
- État GPS plus lisible ; précision insuffisante pour confirmer l’arrivée distinguée d’une position exploitable. Annonces d’état seulement lorsque le texte change.
- Bouton de relance de localisation conservé entre les actualisations, avec son focus.
- Version Android 1.2.1-pilot, versionCode 4 ; migration du cache web 1.2.0 vers 1.2.1.

Validation locale : 126 tests de logique/données/cache et 80 scénarios DOM, dont 8 nouvelles régressions ; parcours DOM complet réussi. Quatre des cinq premiers nouveaux scénarios reproduisaient des défauts sur 1.2.0 avant correction. Contrastes des nouveaux états calculés entre 5,74:1 et 7,14:1. Aucune capture ni validation visuelle dans un navigateur disponible ; les règles de disposition responsive n’ont pas été inspectées sur appareil réel. Le moteur GPS et le service natif restent identiques à 1.2.0. Compilation Android et publication de ce correctif : en cours, preuves à compléter.

Les limites terrain, de disponibilité des données et de localisation souterraine du bilan 1.2 ci-dessous restent applicables.

---

# Prochain arrêt 1.2 — bilan de validation

Audit du 15 octobre 2026. Ce document distingue les résultats automatisés, les essais natifs sur émulateur et les vérifications restant à faire sur téléphone réel. Il suit le [plan d’attaque et ses critères de livraison](AUDIT-PLAN.md).

- [Application en accès direct, sans compte](https://prochain-arret.thibautgiuseppi.chatgpt.site)
- [Démonstration sans GPS ni recherche réseau](https://prochain-arret.thibautgiuseppi.chatgpt.site/?demo=1)
- Source applicative examinée : `bb6ffd36df4914f0f9126abd619aca426bff1a2c`.
- Version Android : `1.2.0-pilot`, versionCode `3`.

## Résultats et portée des preuves

| Vérification | Périmètre | Résultat pour 1.2 |
|---|---|---|
| Syntaxe et ressources | JavaScript, manifeste, icônes, assets, permissions | Réussi localement et en CI |
| Logique, données, réseau, cache et accessibilité structurelle | 126 tests automatisés | Réussi localement et en CI |
| Interface DOM | 72 scénarios : 38 existants et 34 adversariaux, plus le parcours complet | Réussi localement et en CI |
| Trajectoires simulées | 453 trajectoires, 22 281 positions | Parité JavaScript/Java réussie sur les 453 trajectoires et 22 281 positions |
| Android 8 / API 26 | Service natif, notifications, cycle de vie sur émulateur | Réussi : quatre phases, 48 assertions |
| Android 15 / API 35 | Même scénario avec restrictions Android récentes | Réussi : quatre phases, 48 assertions |
| Services externes réels | Recherche Photon, CORS et proximité Overpass | Photon réussi en CI (3 résultats, CORS autorisé). Overpass principal : HTTP 406 localement et en CI ; aucun essai de secours après ce refus |
| Fichier distribué | Signature APK, SHA-256, assets embarqués | APK CI vérifié, 12 ressources identiques octet pour octet ; publication contrôlée séparément ci-dessous |
| Téléphones, véhicules et rendu visuel réels | Chrome, Safari, WebView, écran verrouillé, lecteur d’écran, trajets | Non validés dans cet environnement |

Les 22 281 positions sont des échantillons, pas autant de tests indépendants. Les 453 trajectoires comprennent 112 nouveaux cas combinant huit profils, sept régions géographiques et deux niveaux de précision, ainsi que les 100 trajectoires stationnaires bruitées déjà présentes. Ces simulations vérifient les calculs ; elles ne prouvent pas la disponibilité des données ou du GPS dans ces régions.

Les tests DOM contrôlent les interactions, états, libellés et événements. Ils ne mesurent ni le rendu dans un vrai navigateur ni l’audibilité d’une notification. Le service Android est testé séparément du navigateur embarqué. Les émulateurs ont fourni Chrome 69.0.3497.100 sur API 26 et Android WebView 124.0.6367.219 sur API 35. Le premier est volontairement refusé par la garde de compatibilité de l’interface : ses tests valident le service natif, pas l’exécution de l’interface. Le second dispose d’un moteur compatible, sans que son interface ait été pilotée ou son rendu inspecté. La garde WebView 108 minimum affiche une aide lorsque le composant détecté est trop ancien ; une API Android compatible ne suffit donc pas, à elle seule, à garantir la compatibilité de l’interface.

## Défauts corrigés et optimisations

1. **Modes trop uniformes.** Huit profils adaptent les rayons et la durée maximale au bus, tramway, métro, train, grande vitesse, ferry, câble et autre transport. Les réglages avancés restent accessibles.
2. **Approche trop tardive en grande vitesse.** Une tendance conservatrice issue de positions cohérentes peut anticiper le rappel. Elle ne fournit pas d’ETA et n’extrapole pas une progression en tunnel.
3. **Arrêt automatique trop court.** La limite est configurable de 1 à 72 heures ; le rappel doit la précéder. Les durées reposent sur une horloge monotone.
4. **Recherche de proximité incomplète.** Ajout des terminaux de ferry, stations de câble, gares routières, quais et positions d’arrêt. Correction de la requête `out tags`, qui omettait les coordonnées des nœuds.
5. **Confusion de direction et de desserte.** Le choix automatique d’un arrêt précédent exige une relation PTv2 explicite et non ambiguë. Boucles, membres manquants, rôles inconnus, destination réservée à la montée et services flexibles sont écartés.
6. **Doublons et noms internationaux.** Seules les paires arrêt/quai correspondantes sont regroupées. Identités OSM, alias linguistiques, noms Unicode et pays aident à distinguer les lieux homonymes.
7. **Requêtes de lignes trop lourdes.** Seuls les membres arrêt/quai sont demandés, au lieu de télécharger tous les sommets géographiques des longues lignes ferroviaires ou maritimes.
8. **Pannes et limitations externes.** Délais bornés, réponses malformées rejetées, temporisation après 406/429 et respect de `Retry-After`. Aucun changement de serveur pour contourner un refus explicite.
9. **Recherches répétées et suppression.** Cache mémoire limité à 32 entrées, avec expiration ; aucune persistance des réponses API. L’effacement empêche aussi une réponse déjà en attente de repeupler ce cache.
10. **Démarrage ou annulation bloqués.** Audio et maintien de l’écran ne doivent pas bloquer la localisation. Double clic, annulation et réponses GPS/réseau tardives sont contrôlés.
11. **Trajets concurrents.** Verrouillage entre onglets, mécanisme de secours et propagation des arrêts/effacements limitent les suivis et notifications contradictoires.
12. **Alertes masquées ou obsolètes.** Priorités explicites, dialogue fermé à l’arrivée, fond inerte, focus restauré, notifications associées au bon trajet et acquittements natifs distincts.
13. **Consommation après arrivée.** L’acquittement de l’arrivée arrête le GPS web ; sur Android, il libère aussi le service et le verrou CPU. Arrêt manuel, notification permanente et expiration bornent le cycle de vie.
14. **UX et accessibilité.** Repli manuel après échec, paramètres restaurés, confirmation d’un arrêt anticipé, cibles tactiles agrandies, contraste, noms accessibles, clavier et mouvements réduits.
15. **Mise à jour et compatibilité.** Activation du nouveau service worker au repos, protection d’un trajet en cours, contrôle des autres onglets et garde WebView 108+. L’installation web conserve sa limite de visibilité.

## Scénarios effectivement challengés

**Détection.** Départ loin de l’arrêt ou déjà dans la zone, trajet lent ou rapide, positions périmées/futures, bruit, précision invalide, mesures simultanées de plusieurs fournisseurs, doublons, ordre inversé, saut impossible, demi-tour, regain de GPS après tunnel, latitude élevée et changement de date géographique. L’incertitude entière doit entrer dans la zone d’arrivée ; une détection géographique ne prouve pas que le véhicule dessert l’arrêt.

**Données et réseau.** Onze modes fixes, noms dans plusieurs écritures, objet OSM nœud/chemin/relation, quais, répétitions et boucles, montée seule, séquence manquante, identité malformée, JSON incorrect, annulation, expiration et mutation du cache, 400/406/429/503, délais et `Retry-After`. Les services flexibles conservent le mode par distance sans inventer un arrêt précédent fixe.

**Interface et cycle de vie.** Permissions refusées ou révoquées, API absente, stockage corrompu/saturé, ancienne réponse après navigation, ancien trajet après nouveau départ, deux onglets, effacement inter-onglets, réglages pendant le trajet, notifications tardives, arrivée prioritaire, minuterie, démonstration et mise à jour au repos. Les tests d’accessibilité restent structurels et ne constituent pas une certification WCAG.

**Scénarios natifs réussis en CI.** Le véritable service, `LocationManager` et le système de notifications sont exercés avec des positions injectées : démarrage visible, arrière-plan, écran réellement éteint, perte/reprise GPS, rappel sans GPS, approche, arrivée, acquittement, arrêt, fermeture forcée, réouverture et refus de permission. Les résultats de la version précédente ne sont pas utilisés comme preuve de réussite de 1.2.

## Matrice de couverture : ce que « partout » signifie

Le calcul par coordonnées n’impose aucune restriction de pays. La recherche et l’ordre des arrêts dépendent toutefois des données disponibles et de leurs opérateurs. La présence d’un mode dans le code n’est pas une certification de chaque ligne dans le monde.

| Famille de transport | Utilisation disponible | Arrêt précédent automatique | Limites principales |
|---|---|---|---|
| Bus, car, trolleybus, minibus et navette | Profil bus ; point recherché, favori ou manuel | Si ligne fixe PTv2 exploitable | Variantes, déviations, arrêts à la demande et véhicule réellement emprunté non identifiés |
| Tramway et train léger | Profil tramway ou urbain | Même condition PTv2 | Sections souterraines, voies parallèles et arrêts proches |
| Métro, monorail et trains urbains | Profil urbain ; rappel de secours facultatif | Si ordre PTv2 disponible et position reçue | Aucun suivi des stations dans un tunnel sans localisation exploitable |
| Train régional, grandes lignes et nuit | Profil train ; durée allongée | Si séquence de cette desserte disponible | Train direct, arrêt sauté, quai éloigné, longues coupures de signal |
| Train à grande vitesse | Profil dédié, anticipation et zone de gare élargies | Condition PTv2 identique ; profil choisi explicitement | Pas d’identification du train, d’horaire temps réel ou d’arrêt effectif |
| Bateau-bus, navette fluviale et ferry | Profil bateau ; terminal recherché ou manuel | Si relation fixe PTv2 exploitable | Terminal étendu, cabine sans signal, détour, traversée et batterie longue durée |
| Funiculaire, téléphérique et télécabine | Profil câble ; point manuel possible | Si ligne fixe PTv2 exploitable | Des stations superposées ou très proches sont indiscernables en GPS horizontal |
| Taxi collectif, service flexible ou transport à la demande | Profil autre/bus et destination manuelle | Non garanti ; pas de prédécesseur fixe inventé | Arrêts et itinéraires variables, données souvent absentes |
| Avion, ascenseur et autres services atypiques | Aucun engagement de fonctionnement spécifique | Non pris en charge comme séquence certifiée | Hors périmètre de validation ; altitude, vitesse, réglementation et étapes incompatibles avec le modèle courant |

Sur Android, le service natif peut suivre un trajet en arrière-plan, sous réserve des permissions et du système. Sur le web et sur iPhone, la page doit rester visible et l’écran allumé. Une PWA installée n’acquiert pas le GPS en arrière-plan.

## Limites avant une distribution de production

- Essais physiques nécessaires : plusieurs constructeurs, Chrome/Safari/WebView, lecteur d’écran, casque/Bluetooth, volume, mode Ne pas déranger, économie d’énergie, Doze prolongé et révocation des permissions.
- Validation terrain nécessaire : tunnels, gares à étages, quais voisins, ports, câbles courts, grande vitesse, déviations et services sans arrêt à la destination choisie. Aucun algorithme de proximité ne détecte ici les portes ni l’identité du véhicule.
- Client iOS natif absent. Les restrictions du navigateur ne peuvent pas être supprimées par une amélioration de l’interface.
- Photon et Overpass n’offrent pas ici de disponibilité contractuelle. Le HTTP 406 observé n’a pas été masqué ; coordonnées et favoris restent les replis. Une exploitation à grande échelle nécessite une infrastructure de données adaptée et des conditions d’usage vérifiées.
- Pas d’intégration GTFS/GTFS-RT opérationnelle. Une couverture fiable exigerait, pour chaque flux, licence, fraîcheur, calendrier, variante, correspondance du trajet réel et gestion des arrêts sautés. Un catalogue mondial ne suffit pas.
- Signature APK pilote renouvelée à la compilation, hors Play Store. Une mise à jour peut nécessiter de désinstaller l’ancien pilote, avec perte des données locales. Une signature durable conservée dans un coffre et une chaîne de distribution sont encore nécessaires.
- Aucun chiffre d’autonomie, taux de réussite terrain ou garantie universelle n’est avancé.

## Reproduction et provenance de livraison

Lancer `npm run check`, puis `npm test`. Les scénarios DOM utilisent `happy-dom@20.0.11` via `DOM_TEST_MODULE` ; exécuter le parcours complet et les suites DOM existante/adversariale. Le workflow GitHub génère les fixtures de parité, compare JavaScript/Java, compile et vérifie l’APK, puis lance les essais instrumentés API 26 et 35. Les sondes externes doivent rester ponctuelles et respecter tout refus du fournisseur.

| Élément de livraison | Valeur |
|---|---|
| Commit applicatif testé | `bb6ffd36df4914f0f9126abd619aca426bff1a2c` |
| Exécution CI finale | [38704214822](https://github.com/ThithiLaCastagne/Chrono/actions/runs/38704214822) — réussi sur API 26 et API 35 |
| APK / SHA-256 | 75 057 octets ; `cc3316b0a3f14eed25ca2c7c6aa9f26c18d8ec873e296f963a59926861237adb` |
| Comparaison des assets embarqués | 12 fichiers identiques : HTML, JavaScript (dont profils et propriété du trajet), CSS, service worker, manifeste et icônes |
| Publication publique 1.2 | Publiée le 15 octobre 2026 à 08:22 UTC. 17 URL contrôlées sans compte, jeton ni cookies conservés : accueil, démo et 15 ressources. Réponses finales HTTP 200 et contenu identique ; index.html redirige vers / |

Les premiers essais ont également révélé un blocage dans la fixture Android : réutiliser une tâche existante ne satisfaisait pas l’attente de création d’Activity. La fixture crée désormais une nouvelle activité, journalise les jalons et borne chaque phase à 300 secondes. Une première exécution API 26 avait aussi échoué sur un téléchargement Maven HTTP 403 ; les deux exécutions finales ont téléchargé la dépendance et réussi. La sonde Overpass reste un échec externe informatif, même si la CI globale est verte.

Le déploiement Sites correspond au commit `a00450b5d2fbfc43ab15068168a436df1224d645` (version enregistrée 3, produit 1.2). Les 12 ressources embarquées dans l’APK et les fichiers publics correspondent à la source testée. Si l’ancienne PWA reste ouverte, fermer tous ses onglets avant de rouvrir le lien permet au nouveau service worker de prendre la main. Les versions suivantes disposent d’un bouton de mise à jour au repos.

## Références primaires

- [W3C — Geolocation](https://www.w3.org/TR/geolocation/) : mises à jour réservées aux documents actifs et visibles.
- [Android — services de premier plan et localisation](https://developer.android.com/develop/background-work/services/fgs/service-types) : conditions du suivi natif.
- [OpenStreetMap — transports publics](https://wiki.openstreetmap.org/wiki/Public_transport) : modes, terminaux, quais et ordre PTv2.
- [OpenStreetMap — taxis collectifs](https://wiki.openstreetmap.org/wiki/Tag:route%3Dshare_taxi) : desserte flexible.
- [Overpass QL](https://wiki.openstreetmap.org/wiki/Overpass_API/Overpass_QL) : sorties géographiques et sélection des membres par rôle.
- [Overpass — mutualisation et limites](https://dev.overpass-api.de/overpass-doc/en/preface/commons.html) : quotas, refus et disponibilité d’une infrastructure partagée.
- [Photon — projet et conditions du serveur de démonstration](https://github.com/komoot/photon) et [documentation API](https://github.com/komoot/photon/blob/master/docs/api-v1.md).
- [GTFS Schedule](https://gtfs.org/documentation/schedule/reference/), [GTFS Realtime](https://gtfs.org/documentation/realtime/reference/) et [MobilityDatabase](https://mobilitydatabase.org/faq) : formats, données de desserte et portée d’un catalogue de flux.
