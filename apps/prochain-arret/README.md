# Prochain arrêt

Pilote de rappel de descente, version1.3.0. Application publique sans compte : https://prochain-arret.thibautgiuseppi.chatgpt.site — essai immédiat : https://prochain-arret.thibautgiuseppi.chatgpt.site/?demo=1

## Fonctionnement

- Parcours rapide : « Lignes autour de moi » → ligne et direction → arrêt de descente. Recherche autour des arrêts et des tracés à 700 m ; jusqu’à 60 lignes fixes PTv2, selon les données OpenStreetMap disponibles. Le transport et l’arrêt précédent exploitable sont préremplis. La localisation ne choisit ni le véhicule ni le sens à votre place.
- Web/PWA : page visible et écran allumé. Le GPS en arrière-plan n’est pas garanti par le navigateur. L’interface peut fonctionner hors connexion après un premier chargement réussi.
- Android8+ avec Android System WebView108+ : interface embarquée, service natif de localisation lancé à la demande, notification permanente, positions toutes les2,5–3secondes. Durée bornée par le réglage choisi (1–72h). Aucun redémarrage caché après fermeture forcée ou reboot.
- Huit profils : bus/car, tram, métro/urbain, train, grande vitesse, bateau/ferry, funiculaire/câble, autre. L’approche utilise un rayon minimal et, si les mesures sont cohérentes, une marge conservatrice liée à la vitesse observée. Ce n’est pas un horaire d’arrivée.
- Arrivée : le disque d’incertitude GPS doit tenir dans la zone choisie (75–1000m). Les mesures trop anciennes, imprécises, dupliquées, désordonnées ou physiquement incohérentes sont rejetées.
- Alerte à l’arrêt précédent uniquement si une séquence OpenStreetMap PTv2 fixe et non ambiguë est disponible. La distance reste un secours. L’app ne connaît pas les arrêts sautés, déviations, étages ou quais réels.
- Le rappel programmé est une minuterie. Sans GPS, aucune progression n’est inventée. Acquitter l’arrivée native arrête le service et libère les ressources.
- Recherche explicite Photon/Overpass, cache mémoire court, quotas respectés ; calcul du trajet local, sans compte ni analytics. Un point saisi manuellement et les favoris évitent toute dépendance à un catalogue de transport.

## Vérifier

```sh
npm run check
npm test
DOM_TEST_MODULE=/chemin/vers/happy-dom/lib/index.js node tests/ui-smoke.mjs
DOM_TEST_MODULE=/chemin/vers/happy-dom/lib/index.js node --test tests/ui.audit.mjs tests/rechallenge-ui.mjs
```

La CI compile le moteur Java, compare les trajectoires JS/Java, construit et vérifie l’APK, puis exécute les scénarios natifs API26 et API35. Le contrôle des services publics est informatif : il ne transforme pas une indisponibilité externe en couverture validée.

Le [plan d’audit](AUDIT-PLAN.md) décrit les risques et les critères de livraison. Le [bilan de validation](TEST-REPORT.md) donne les résultats, les versions et les limites réellement observées.

## Distribution et limites

L’APK est un pilote signé avec une clé de compilation éphémère. Une mise à jour peut exiger la désinstallation et effacer les données locales. Une signature de production durable et une publication sur les stores restent à préparer ; aucune clé privée n’est versionnée.

Aucune promesse de fonctionnement sur tous les transports ou tous les téléphones. Le GPS peut manquer en tunnel, en intérieur ou entre des stations superposées. L’application ne sait pas identifier le véhicule réellement emprunté. Le suivi web ne remplace pas une app iOS native pour l’arrière-plan. Les essais de terrain, d’audibilité et d’autonomie restent indispensables avant un usage de confiance.
