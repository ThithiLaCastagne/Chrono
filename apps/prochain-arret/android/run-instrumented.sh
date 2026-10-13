#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
adb install -r android/build/prochain-arret-android.apk
adb install -r android/build/service-tests.apk
adb shell pm grant fr.prochainarret.app android.permission.ACCESS_FINE_LOCATION
adb shell pm grant fr.prochainarret.app android.permission.ACCESS_COARSE_LOCATION
API_LEVEL=$(adb shell getprop ro.build.version.sdk | tr -d '\r')
if [ "$API_LEVEL" -ge 33 ]; then adb shell pm grant fr.prochainarret.app android.permission.POST_NOTIFICATIONS; fi
adb shell appops set fr.prochainarret.app android:mock_location allow
adb shell settings put secure location_mode 3
run_phase() {
  adb shell am instrument -w -e phase "$1" fr.prochainarret.test/fr.prochainarret.test.ServiceScenarios | tee "android/build/instrumentation-$1.txt"
  python3 -c 'import sys; text=open(sys.argv[1]).read(); assert "PROCHAIN_ARRET_TESTS_PASSED" in text and "FAILED" not in text, text' "android/build/instrumentation-$1.txt"
}
run_phase background
run_phase prepare-interruption
adb shell am force-stop fr.prochainarret.app
run_phase recovery
adb shell pm revoke fr.prochainarret.app android.permission.ACCESS_FINE_LOCATION
adb shell pm revoke fr.prochainarret.app android.permission.ACCESS_COARSE_LOCATION
run_phase denied
