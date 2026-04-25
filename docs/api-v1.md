# API v1

HabitTrove exposes a versioned HTTP API under `/api/v1`.

The machine-readable OpenAPI document lives in `docs/openapi-v1.yaml`.

## Authentication

Send a bearer token in the `Authorization` header:

```http
Authorization: Bearer <token>
```

Tokens are discovered from environment variables whose names start with `USERTOKEN_`.

You can also define `API_ADMIN_TOKEN` to create one default bearer token that authenticates as the first admin user found in the HabitTrove user store.

Examples:

```env
API_ADMIN_TOKEN=super-secret-default-admin-token
USERTOKEN_admin=super-secret-admin-token
USERTOKEN_alice=mobile-client-token
```

The suffix after `USERTOKEN_` is matched to the HabitTrove username case-insensitively. Each token acts as that user and reuses the same permission model as the web app. `API_ADMIN_TOKEN` bypasses username mapping and acts as the first admin user.

## Response Envelope

Successful responses:

```json
{
  "ok": true,
  "data": {}
}
```

Error responses:

```json
{
  "ok": false,
  "error": {
    "code": "forbidden",
    "message": "You do not have access to this resource"
  }
}
```

## List Limits

Collection endpoints accept `limit` and clamp it to `1-100`.

- Default: `100`
- Maximum: `100`
- Ordering: the endpoint's natural stored order

## Admin Targeting

Admin-authenticated requests may target another user.

- Read endpoints use `?userId=<id>`
- Action endpoints use `{"userId": "<id>"}` in the JSON body

Non-admin requests that target another user return `403`.

## Endpoints

### Habits

- `GET /api/v1/habits?limit=100&userId=<id>`
- `POST /api/v1/habits`
- `PATCH /api/v1/habits/{id}`
- `DELETE /api/v1/habits/{id}`
- `POST /api/v1/habits/{id}/complete`
- `POST /api/v1/habits/{id}/undo`

Create or update body fields:

```json
{
  "name": "Read",
  "description": "20 minutes",
  "frequency": "daily",
  "coinReward": 5,
  "targetCompletions": 1,
  "isTask": false,
  "archived": false,
  "pinned": true,
  "drawing": "{...}",
  "userIds": ["user-id"]
}
```

`POST /complete` and `POST /undo` accept an optional body:

```json
{
  "userId": "user-id"
}
```

## Coins

- `GET /api/v1/coins?userId=<id>`
- `GET /api/v1/coins/transactions?limit=100&userId=<id>`
- `POST /api/v1/coins/add`
- `POST /api/v1/coins/remove`
- `PATCH /api/v1/coins/transactions/{id}`

Coin action body:

```json
{
  "amount": 10,
  "description": "Allowance",
  "note": "Weekly bonus",
  "userId": "user-id"
}
```

Transaction note body:

```json
{
  "note": "Updated note"
}
```

## Wishlist

- `GET /api/v1/wishlist?limit=100&userId=<id>`
- `POST /api/v1/wishlist`
- `PATCH /api/v1/wishlist/{id}`
- `DELETE /api/v1/wishlist/{id}`
- `POST /api/v1/wishlist/{id}/redeem`
- `POST /api/v1/wishlist/{id}/archive`
- `POST /api/v1/wishlist/{id}/unarchive`

Create or update body fields:

```json
{
  "name": "Movie night",
  "description": "Choose a movie",
  "coinCost": 20,
  "archived": false,
  "targetCompletions": 3,
  "link": "https://example.com",
  "drawing": "{...}",
  "userIds": ["user-id"]
}
```

Redeem accepts an optional body:

```json
{
  "userId": "user-id"
}
```

## Settings

- `GET /api/v1/settings`
- `PATCH /api/v1/settings`

Patch body uses the existing settings shape and may be partial.

## Users

- `GET /api/v1/users?limit=100`

This endpoint is admin-only and returns sanitized users.

## Freshness

- `POST /api/v1/freshness/check`

Body:

```json
{
  "clientToken": "sha256-token",
  "userId": "user-id",
  "includeUsers": false
}
```

`includeUsers` is admin-only.