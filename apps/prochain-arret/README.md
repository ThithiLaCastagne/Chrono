# Prochain arrêt

Application pilote en français : alertes d’approche et d’arrivée en transports.

- Web : page visible et écran allumé nécessaires, y compris après installation comme PWA.
- Android 8+ : interface embarquée, service natif de localisation `foregroundServiceType=location`, notification permanente, positions toutes les 2,5–3 secondes, verrou CPU borné à 6 heures. Le suivi commence seulement sur une action explicite de l’utilisateur et s’arrête sur demande. Pas de redémarrage caché après fermeture forcée ou reboot.
- GPS : distance orthodromique, positions périmées (>30 s), imprécises (>150 m), dupliquées ou incohérentes rejetées. Alerte à l’arrêt précédent quand une séquence OSM est connue ; distance de secours toujours conservée. Arrivée dans une zone de 130 m avec prise en compte de l’incertitude et confirmation. Aucun horaire/ETA inventé.
- Secours : avertissement de perte de signal, minuterie facultative, alertes Android répétées (maximum 4 notifications sur 24 secondes), arrêt explicite depuis la notification.
- Recherche : Photon et Overpass. Pas de compte requis dans l’application ; favoris/récents conservés localement. La page hébergée peut demander l’identification de son propriétaire.

## Utilisation

Ouvrir le lien publié, chercher l’arrêt avec sa ville, vérifier la destination et la direction, tester l’alerte, puis démarrer. Pour utiliser une autre app ou verrouiller l’écran sur Android, installer l’APK proposé via le bouton « Utiliser en arrière-plan sur Android ».

L’APK pilote est signé avec une clé de test générée par la compilation. Ce n’est pas une distribution Play Store. Une compilation ultérieure avec une autre clé nécessite de désinstaller l’ancienne app (perte des données locales). Une clé de production conservée dans un coffre/secret CI est nécessaire avant une distribution durable.

## Sources et arborescence

Ce projet est dans `apps/prochain-arret` sur la branche GitHub `prochain-arret` du dépôt `ThithiLaCastagne/Chrono`. Le `main` et l’application Chrono ne sont pas modifiés. La PR de travail n’est pas fusionnée automatiquement. Les sources de déploiement Sites sont aussi versionnées par son workflow.

- `dist/` : interface web et moteur JavaScript autonome ; aucune dépendance npm.
- `android/` : Activity WebView restreinte aux assets locaux, pont JavaScript, moteur Java équivalent et service natif.
- `tests/` : scénarios du moteur, validation d’assets et tests JVM Android.
- `.github/workflows/prochain-arret.yml` : CI à la racine du dépôt GitHub.

## Vérification

`npm run check` puis `npm test`. Pour Android, lancer `bash android/build.sh` avec Java 17, Android platform 35 et build-tools 35.0.0. Le pipeline compile, signe et vérifie la signature de l’APK.

Les tests de moteur ne remplacent pas des essais réels. La vérification visuelle dans un navigateur et les essais sur un téléphone réel n’étaient pas disponibles dans l’environnement de création. La version doit être testée sur appareil, en particulier : notification écran verrouillé, changement d’app, casques Bluetooth, volume et Ne pas déranger, révocation de permission, mode économie d’énergie, arrêt forcé, tunnel, regain GPS, arrêt à proximité d’une autre ligne, voyage en train rapide.

## Limites de fiabilité

Le GPS ne voit pas l’intérieur des tunnels. Le système détecte une perte de signal et l’indique ; il ne prétend pas suivre les stations sous terre. Le mode minuteur est un rappel arbitraire, pas une localisation. Une station proche d’une autre voie peut déclencher une alerte prématurée. Les arrêts/directions OpenStreetMap peuvent être incomplets ou obsolètes. Photon et Overpass sont des services publics sans engagement de disponibilité ; une recherche par coordonnées reste possible. Les OS, réglages de notification et restrictions batterie peuvent empêcher une alerte.

Le statut de suivi dépend d’une position récente et précise. Les alertes d’approche et d’arrivée sont distinctes et dédupliquées ; si la première position est déjà à destination, seule l’alerte d’arrivée est émise. Un trajet interrompu n’est jamais présenté comme actif ni repris silencieusement.

## Confidentialité

Le calcul est local. Aucun historique complet ni suivi publicitaire. Photon reçoit le texte des recherches. Overpass reçoit les coordonnées des recherches de proximité/de ligne. Les services externes voient l’adresse IP. Les sources cartographiques sont © contributeurs OpenStreetMap, sous ODbL ; leur attribution figure dans l’app. Le cache hors ligne ne contient que le shell applicatif et les choix stockés par l’utilisateur ; les appels API ne sont pas mis en cache par le service worker.

## Documentation technique de référence

- https://www.w3.org/TR/geolocation/ — visibilité et activité du document
- https://developer.android.com/develop/background-work/services/fgs/service-types — service de localisation Android
- https://photon.komoot.io/ — recherche et conditions d’utilisation
- https://www.openstreetmap.org/copyright — attribution et licence des données
