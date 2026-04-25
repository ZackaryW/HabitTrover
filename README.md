# HabitTrover

HabitTrover is a derivative work of the upstream HabitTrove project.

For the base product overview, standard setup, core feature documentation, and upstream release context, see the upstream repository:

- Upstream repo: https://github.com/dohsimpson/HabitTrove

This README only documents what this repository adds or changes on top of upstream.

## Local Additions

This repository currently adds or documents these fork-specific surfaces:

- API v1 under `/api/v1`
- bearer-token API authentication via `USERTOKEN_{username}`
- optional default admin API token via `API_ADMIN_TOKEN`
- per-user locale preferences with global fallback in `data/settings.json`
- Docker examples updated for API token testing
- reusable PowerShell smoke tests in `testscript/`
- derivative-work licensing notice in [NOTICE.md](NOTICE.md)

## API v1

Repository-specific API documentation lives here:

- Human-readable API guide: [docs/api-v1.md](docs/api-v1.md)
- OpenAPI spec: [docs/openapi-v1.yaml](docs/openapi-v1.yaml)

The API is exposed under `/api/v1` and uses bearer authentication.

Supported token sources:

- `USERTOKEN_{username}` environment variables
- optional `API_ADMIN_TOKEN` for a default admin bearer token

Example header:

```http
Authorization: Bearer your-token
```

## Docker Notes For This Fork

The local Docker examples in this repository include the optional admin API token used for API v1 testing.

Example environment values in [docker-compose.yaml](docker-compose.yaml):

```yaml
environment:
  - AUTH_SECRET=your-secret-key-here
  - API_ADMIN_TOKEN=your-admin-api-token-here
```

`API_ADMIN_TOKEN` is optional. When set, it authenticates as the first admin user in the HabitTrove user store.

## Per-User Locale

This fork stores language preference per user instead of treating it as a single shared setting for every account.

- `settings.system.language` remains the fallback default in [data/settings.json](data/settings.json)
- once a signed-in user chooses a language, that preference is stored on the user record
- locale resolution uses the user preference first and falls back to the shared setting only when the user has not chosen one yet

This keeps the existing settings shape for clients while avoiding one user's language change affecting everyone else.

## Quick Test Scripts

This repository includes quick local smoke tests under [testscript](testscript).

Current script:

- [testscript/api-smoke.ps1](testscript/api-smoke.ps1)

Run it against a local instance with:

```powershell
.\testscript\api-smoke.ps1
```

## Licensing

This repository is a derivative work of the upstream HabitTrove project.

- Full AGPL text: [LICENSE](LICENSE)
- Derivative-work notice: [NOTICE.md](NOTICE.md)

The GNU license text is kept verbatim. Repository-specific attribution and derivative-work notes are documented separately.
