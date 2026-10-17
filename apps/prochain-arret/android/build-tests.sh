#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
SDK_ROOT="${ANDROID_HOME:-${ANDROID_SDK_ROOT:-}}"
SDK_TOOLS="$SDK_ROOT/build-tools/35.0.0"
ANDROID_JAR="$SDK_ROOT/platforms/android-35/android.jar"
OUT_DIR="$PWD/android/build"
mkdir -p "$OUT_DIR/test-classes" "$OUT_DIR/test-dex"
"$SDK_TOOLS/aapt2" link -o "$OUT_DIR/test-base.apk" -I "$ANDROID_JAR" --manifest android/test/AndroidManifest.xml
javac -encoding UTF-8 --release 8 -classpath "$ANDROID_JAR:$OUT_DIR/classes.jar" -d "$OUT_DIR/test-classes" android/test/fr/prochainarret/test/*.java
jar cf "$OUT_DIR/test-classes.jar" -C "$OUT_DIR/test-classes" .
"$SDK_TOOLS/d8" --lib "$ANDROID_JAR" --classpath "$OUT_DIR/classes.jar" --min-api 26 --output "$OUT_DIR/test-dex" "$OUT_DIR/test-classes.jar"
cp "$OUT_DIR/test-base.apk" "$OUT_DIR/test-unsigned.apk"
(cd "$OUT_DIR/test-dex" && zip -q -u "$OUT_DIR/test-unsigned.apk" classes.dex)
"$SDK_TOOLS/zipalign" -p -f 4 "$OUT_DIR/test-unsigned.apk" "$OUT_DIR/test-aligned.apk"
"$SDK_TOOLS/apksigner" sign --ks "$OUT_DIR/pilot.keystore" --ks-key-alias pilot --ks-pass pass:android --key-pass pass:android --out "$OUT_DIR/service-tests.apk" "$OUT_DIR/test-aligned.apk"
