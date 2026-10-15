# Prochain arrêt 1.2 — plan d’attaque et critères de livraison

Audit du 15 octobre 2026. Objectif : réduire les alertes manquées et les faux signaux, rendre les limites visibles, et conserver un essai immédiat sans compte. Les critères ci-dessous séparent un calcul vérifié, une donnée communautaire disponible et un fonctionnement réellement observé sur téléphone.

| Facette | Challenge | Réponse et vérification |
|---|---|---|
| Promesse produit | Peut-on réellement garantir tous les transports, partout ? | Non. Position manuelle mondiale et huit profils ; absence de GPS, étages, desserte réelle et plateforme restent des limites explicites. |
| Moteur géographique | Grande vitesse, précision, sauts, doublons, proximité sans arrêt | Rayons adaptés, tendance conservatrice, incertitude entière dans la zone d’arrivée, événements dédupliqués. Tests indépendants + parité JS/Java. |
| Trajets longs | Le suivi s’arrête-t-il au milieu d’un train de nuit ? | Durée choisie de 1 à 72 h, profils train24h/ferry48h, rappel nécessairement antérieur à l’expiration. Horloges monotones. |
| Réseau de transport | Sens opposé, boucle, quai dupliqué, entrée seule, arrêt absent | Ordre PTv2 explicite, identité/alias, barrières sur données manquantes, pas d’arrêt précédent fabriqué. Données communautaires sans temps réel. |
| Couverture | Ferries, câble, minibus, trolleybus, monorail, noms internationaux | Recherche élargie, pays affiché, onze modes de lignes fixes, coordonnées/favoris utilisables sans catalogue. Tests de formes et langues, pas certification de chaque opérateur. |
| Démarrage | Son ou maintien écran bloqué ; double clic ; permission tardive | Audio/écran ne bloquent pas GPS ; une seule activation ; annulation et contrôle des réponses tardives. |
| Permissions | Refus initial, révocation en trajet, GPS coupé | Message actionnable ; pas de faux état actif ; rappel web préservé après révocation ; possibilité de réessayer. |
| Alertes | Fenêtre qui masque l’arrivée ; notifications obsolètes ; mauvais acquittement | Priorités, fermeture du dialogue, focus et fond inerte, notifications nettoyées, identité native unique des actions. |
| Arrière-plan | Écran éteint, service arrêté, redémarrage, notifications bloquées | Service Android explicite, état réel, aucune reprise silencieuse ; essais natifs API26/35. Web exige page visible. |
| Batterie | GPS oublié après arrivée, traversée longue | Acquittement de l’arrivée native libère GPS/verrou CPU ; arrêt manuel/permanent et durée maximale. Aucun chiffre d’autonomie inventé. |
| Concurrence | Deux onglets concurrents ou effacement dans un autre onglet | Web Locks, bail de secours, arrêt/effacement inter-onglets ; notifications liées au trajet. |
| Hors connexion | Perte réseau après installation, cache partiel, API indisponible | Interface précachée atomiquement ; calcul local ; API jamais dans cache persistant ; fallback manuel explicite. |
| Disponibilité externe | 429/406, réponse lente ou malformée | Délai borné, cooldown respecté, aucun contournement, cache mémoire borné, annulation et effacement des requêtes pendantes. |
| UX | Échec de recherche, paramètres perdus, arrêt involontaire | Repli manuel accessible, paramètres restaurés, confirmation avant arrêt anticipé, démonstration directe. |
| UI mobile | Petits boutons, paysage, longs noms, écran étroit | Cibles44px, contrastes corrigés, alertes défilantes, mise en page flexible et détails avancés repliables. Vérification structurelle ; rendu réel non validé ici. |
| Accessibilité | Clavier, lecteur d’écran, contraste, mouvement réduit | Libellés, focus, états sélectionnés, inert/aria-hidden, liens d’évitement et reduced-motion. Vérifications DOM/CSS ; audit assistif réel restant. |
| Sécurité | Injection de noms, navigation WebView, surface de service | Échappement, coordonnées validées, CSP/origine locale, service non exporté, aucune clé/API privée embarquée. |
| Confidentialité | Traces GPS, données envoyées, suppression | Calcul local, aucun analytics ; recherches explicites Photon/Overpass détaillées ; suppression cache/stockage/notifications/activité dans les onglets. |
| Compatibilité | Ancien Android avec ancien WebView, vibration absente | Garde native WebView108+, modalités utilisables ; API native et moteur testés séparément de l’interface WebView. |
| Mise à jour | Ancien service worker, remplacement au milieu d’un trajet | Activation explicite au repos et dans un seul onglet ; nouvelle version annoncée ; refus pendant suivi/activation. |
| Distribution | APK différent de la source testée | CI, APK signé, hash et assets embarqués comparés. Signature pilote renouvelée : pas une chaîne de mises à jour de production. |
| Maintenance | Régression silencieuse, confusion entre tests et terrain | Suites reproductibles, PR isolée, provenance de release, bilan séparant simulation/émulateur/téléphone réel. |

## Critères bloquants

- Syntaxe, tests de logique/données/cache/DOM et parité Java/JavaScript réussis.
- Build Android et scénarios instrumentés réussis sur les deux API configurées.
- APK distribué issu du commit testé ; fichiers web embarqués comparés.
- Publication publique vérifiée, avec accès démo sans compte ni géolocalisation.
- Pas de promesse de couverture universelle, de GPS souterrain ni d’audibilité garantie.

## Ce qui exige des essais supplémentaires sur le terrain

Téléphones iPhone/Android réels, WebView et navigateurs réels, lecteur d’écran, niveaux sonores, mode Ne pas déranger, restrictions batterie Samsung/Pixel/autres, Doze prolongé, tunnels, ferries couverts, gares à plusieurs étages, quais voisins, déviations et véhicules ne desservant pas l’arrêt. Les tests simulés ne remplacent pas ces essais. Le pilote n’a ni client iOS natif, ni correspondance avec un véhicule identifié, ni horaires/GTFS-RT intégrés, ni service de données mondial avec disponibilité contractuelle.
