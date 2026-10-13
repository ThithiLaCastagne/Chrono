#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
if [ -z "$SDK_ROOT" ]; then echo 'Android SDK is required.' >&2; exit 1; fi
TOOLS_VERSION="35.0.0"
PLATFORM_API="35"
SDK_TOOLS="$SDK_ROOT/build-tools/$TOOLS_VERSION"
ANDROID_JAR="$SDK_ROOT/platforms/android-$PLATFORM_API/android.jar"
OUT_DIR="$PWD/android/build"
mkdir -p "$OUT_DIR/gen" "$OUT_DIR/classes" "$OUT_DIR/dex"
"$SDK_TOOLS/aapt2" compile --dir android/res -o "$OUT_DIR/resources.zip"
"$SDK_TOOLS/aapt2" link -o "$OUT_DIR/base.apk" -I "$ANDROID_JAR" --manifest android/AndroidManifest.xml --java "$OUT_DIR/gen" -A dist "$OUT_DIR/resources.zip"
javac -encoding UTF-8 -source 8 -target 8 -bootclasspath "$ANDROID_JAR" -d "$OUT_DIR/classes" "$OUT_DIR/gen/fr/prochainarret/app/R.java" android/src/fr/prochainarret/app/*.java
jar cf "$OUT_DIR/classes.jar" -C "$OUT_DIR/classes" .
"$SDK_TOOLS/d8" --lib "$ANDROID_JAR" --min-api 26 --output "$OUT_DIR/dex" "$OUT_DIR/classes.jar"
cp "$OUT_DIR/base.apk" "$OUT_DIR/unsigned.apk"
(cd "$OUT_DIR/dex" && zip -q -u "$OUT_DIR/unsigned.apk" classes.dex)
"$SDK_TOOLS/zipalign" -p -f 4 "$OUT_DIR/unsigned.apk" "$OUT_DIR/aligned.apk"
# A one-build pilot key: deliberately not represented as a production signing identity.
keytool -genkeypair -keystore "$OUT_DIR/pilot.keystore" -storepass android -keypass android -alias pilot -keyalg RSA -keysize 2048 -validity 3650 -dname 'CN=Prochain Arret Pilot' -noprompt
"$SDK_TOOLS/apksigner" sign --ks "$OUT_DIR/pilot.keystore" --ks-key-alias pilot --ks-pass pass:android --key-pass pass:android --out "$OUT_DIR/prochain-arret-android.apk" "$OUT_DIR/aligned.apk"
"$SDK_TOOLS/apksigner" verify --verbose "$OUT_DIR/prochain-arret-android.apk"
"$SDK_TOOLS/aapt2" dump badging "$OUT_DIR/prochain-arret-android.apk" | head -15
sha256sum "$OUT_DIR/prochain-arret-android.apk" > "$OUT_DIR/SHA256SUMS"
