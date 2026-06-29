# User Identity and Cloud Sync

World Forge uses a local-first profile model backed by the existing studio identity service.

This is a public open-source repository. Do not commit personal identifiers, production service URLs, OAuth client secrets, database URLs, API tokens, deployment credentials, or real Google account ids here. Private deployment notes and credentials belong outside the repo, such as the non-public Google Drive `TWS References` folder.

## Current Boundary

- The app creates a stable local profile and defaults `Keep data synced` to on.
- The app stores generation settings, content library configuration/assets, and hex export settings in local browser/Tauri storage.
- Generated/opened worlds are remembered as a bounded saved-map library and included in the sync envelope.
- Cloud sync is active when `Keep data synced` is on, a service URL is configured, and the user has a service identity.
- The client uses the same lightweight identity shape as EcoMoguls: `playerId`, `authToken`, `displayName`, and `externalIds.googleId`.

## Cloud Contract

The app sends one user-data JSON envelope:

- `format: world-forge-user-sync`
- `formatVersion: 1`
- `identity`
- `workspace`
- `updatedAt`

Expected thin-service endpoints after identity registration/authentication:

- `GET /api/world-forge/user-sync/{profileId}`
- `PUT /api/world-forge/user-sync/{profileId}`

Both requests use the existing service headers:

- `X-Player-Id: <playerId>`
- `X-Player-Token: <authToken>`

The hosted service should verify that `{profileId}` matches the authenticated player id, then store the envelope as opaque JSON. Later account, premium, audit, quota, conflict-resolution, or asset-blob systems should layer around this envelope instead of making generator/content code depend on a provider SDK.

## Minimum Backend Delta

Use the existing `tws_identity` database and `studio_player` / `studio_player_external_identity` tables for user awareness and Google external id storage.

Add one table to the World Forge remote database:

```sql
CREATE TABLE IF NOT EXISTS world_forge_user_sync (
  player_id TEXT PRIMARY KEY,
  sync_payload JSONB NOT NULL,
  payload_version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

Add two routes to the existing Flask service pattern:

- `GET /api/world-forge/user-sync/<player_id>`: authenticate with `X-Player-Id` / `X-Player-Token`, reject mismatched player ids, return the stored envelope or `404`.
- `PUT /api/world-forge/user-sync/<player_id>`: authenticate the same way, reject mismatches, upsert `sync_payload`, and return the saved envelope.

This is sufficient for the current user-light path: hosted builds can preconfigure `VITE_WORLD_FORGE_SERVICE_URL`, the app can silently register/refresh identity when sync is on, and local changes will autosync after login. The public repo should only contain placeholder service URLs; real deployment values should stay in private TWS References material or deployment secrets.

## Prior Art

This follows the lightweight pattern used in `D:\Apps\EcoMoguls\app\player-identity.js`: local storage first, service-backed identity/sync only when configured, and platform-neutral service primitives.
