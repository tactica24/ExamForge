# Mobile Wrapper (Capacitor)

This project ships a native iOS/Android wrapper around the Next.js web app using Capacitor.

## 1) Configure the app URL

Set the hosted URL the mobile app should load:

```bash
npm run mobile:url:set -- https://ace-naija.com
```

This updates `capacitor.config.json` and must be an `https://` URL.

## 2) Prepare the platform

Android:

```bash
npm run mobile:android:prepare
npm run mobile:android:add
npm run mobile:android:sync
npm run mobile:android:assets
```

iOS (macOS required):

```bash
npm run mobile:ios:prepare
npm run mobile:ios:add
npm run mobile:ios:sync
npm run mobile:ios:assets
```

## 3) Open the native projects

```bash
npm run mobile:android:open
npm run mobile:ios:open
```

## 4) Store notes

- The mobile app uses the hosted web app via `server.url`.
- For store submissions, keep the web app stable and fast.
- Apple/Google require privacy policy links and accurate data collection disclosures.
