# APK Packaging — Oracle Board (TWA)

Wrap the Oracle Board PWA as a native Android `.apk` using Trusted Web Activity
(TWA). The app is a thin shell that opens `ssh.example.com/go` in a Chrome
Custom Tab with no browser chrome — it looks and feels like a native app.

## Prerequisites

- Node.js 18+
- Java 17+ (for Android SDK / signing)
- Android SDK (or use PWABuilder web UI which bundles everything)

## Option A: PWABuilder (recommended — no local tooling)

1. Go to https://www.pwabuilder.com
2. Enter `https://ssh.example.com`
3. Click **"Package for stores"** → **Android**
4. Configure:
   - Package name: your real Android application ID, for example
     `com.yourcompany.oracleboard` (do not ship the placeholder
     `com.example.oracleboard`)
   - App name: `Oracle Board`
   - Launcher name: `Oracle Board`
   - Theme color: `#0e0e10`
   - Background color: `#0e0e10`
   - Start URL: `/go`
   - Display mode: `standalone`
   - Signing key: generate new (save the `.keystore` file securely)
5. Download the generated `.apk` + `.aab`
6. The download includes `assetlinks.json` — deploy it (see below)

## Option B: Bubblewrap CLI

```bash
npm i -g @nicolo-ribaudo/bubblewrap

bubblewrap init --manifest="https://ssh.example.com/manifest.webmanifest"
# Edit twa-manifest.json:
#   packageId: your real Android application ID, e.g. com.yourcompany.oracleboard
#   host: ssh.example.com
#   startUrl: /go
#   themeColor: #0e0e10
#   backgroundColor: #0e0e10

bubblewrap build
# Outputs: app-release-signed.apk + app-release-bundle.aab
```

## Digital Asset Links (required)

For the TWA to open full-screen (no browser bar), Chrome verifies ownership via
`/.well-known/assetlinks.json` on the host domain.

### 1. Collect the real Android values

Do not invent or reuse placeholder values. The deployed
`static/.well-known/assetlinks.json` needs both of these production values:

- `package_name`: the real Android application ID used in PWABuilder or
  `twa-manifest.json` (for example `com.yourcompany.oracleboard`, not
  `com.example.oracleboard`).
- `sha256_cert_fingerprints`: the SHA-256 certificate fingerprint for the exact
  signing key used to sign the APK/AAB distributed to users.

Get the fingerprint from your signing keystore:

```bash
keytool -list -v -keystore /path/to/release-keystore.jks -alias release-alias \
  | grep 'SHA256:'
```

If Play App Signing is enabled, use the Play Console **App signing key
certificate** SHA-256 fingerprint for store builds, not the local upload key.

### 2. Create the file

Replace both placeholders below with the real values collected above:

```json
[
  {
    "relation": ["delegate_permission/common.handle_all_urls"],
    "target": {
      "namespace": "android_app",
      "package_name": "com.yourcompany.oracleboard",
      "sha256_cert_fingerprints": ["AA:BB:CC:...:REAL:SIGNING:SHA256"]
    }
  }
]
```

### 3. Deploy

Place at `static/.well-known/assetlinks.json` in this repo. The sshx server
serves `static/` (via `ServeDir`), so it will be available at:

```
https://ssh.example.com/.well-known/assetlinks.json
```

Verify: `curl https://ssh.example.com/.well-known/assetlinks.json`

The file must be served with `Content-Type: application/json`.

## Testing

```bash
# Install on connected device
adb install app-release-signed.apk

# Verify asset links
adb shell am start -a android.intent.action.VIEW \
  -d "https://ssh.example.com/.well-known/assetlinks.json"
```

## Play Store submission

Use the `.aab` (Android App Bundle) for Play Store upload. The `.apk` is for
direct sideloading / testing. Play Store requires:

- Screenshots (phone + tablet)
- Privacy policy URL
- Content rating questionnaire
- Target API level 34+

## Notes

- TWA requires Chrome 72+ on the device (covers 99%+ of Android)
- If asset links aren't verified, the app falls back to a Custom Tab (shows URL
  bar)
- Updates are automatic — the TWA always loads the latest web content from the
  server
- Offline support comes from the service worker (`sw.js`)
