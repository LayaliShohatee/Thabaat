# Thabaat backend

Express API for registration push confirmations. Authentication and the event database use Supabase. The mobile app lives in `../thabaat-mobile`.

## Local setup

```bash
npm ci
cp .env.example .env
# Fill in the backend-only Supabase URL and service-role key.
npm run dev
```

The publishable key used by the mobile app is not a service-role key. Keep the service-role key on the backend only. `.env` is ignored by Git.

Without credentials the server still starts and `/health` returns `notificationsConfigured: false`. Authenticated notification requests return 503 until configured; a healthy process alone does not prove push delivery.

## Checks

```bash
npm test
npm run build
npm start
```

`GET /health` checks the process. `POST /notify` requires `Authorization: Bearer <Supabase access token>` and JSON `{ "eventId": "<uuid>" }`. The server verifies the session, looks up the caller's registration, and only sends to that caller's stored Expo push token. Callers cannot select another recipient. The endpoint is rate limited to 10 requests per minute per IP.

The response `{ "success": true, "status": "accepted" }` means Expo accepted the push ticket; it does not prove device delivery. Push receipts, scheduled reminders, preferences, and admin broadcasts are not implemented.

## Database and device prerequisites

Review `../thabaat-mobile/database/migrations/20260921_prototype_integrity.sql` in staging first. The inspected hosted prototype lacks `profiles.expo_push_token`. The migration was tested in isolated PostgreSQL, not applied to the hosted project. Existing permissive RLS policies need owner review.

For actual delivery, configure an Expo project ID and APNs/FCM credentials, build the app for a physical device, and use Profile → Enable Notifications. Set the mobile `EXPO_PUBLIC_BACKEND_URL` to a reachable backend address. `localhost` on a phone points to the phone itself. If Expo push access-token security is enabled, set `EXPO_ACCESS_TOKEN` on this backend.
