# AI Acquisition Search Mobile

Expo SDK 57 app for Android and iOS.

## Product loop

URL → Research → Pain Points → Product Candidates → Ad Test

## Commands

```bash
npm install
npx expo start
npx expo start --web
```

For cloud builds:

```bash
npx eas build --platform android --profile preview
npx eas build --platform ios --profile preview
```

## Store identifiers

- Android: `com.ecpulse.aiacquisitionsearch`
- iOS: `com.ecpulse.aiacquisitionsearch`

## Branding

`assets/brand.svg` is the source artwork. GitHub Actions generates the required `assets/icon.png` and `assets/splash-icon.png` files on pushes to `main`.
