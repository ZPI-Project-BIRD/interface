# BIRD frontend

This is the frontend for the BIRD project. It uses React, TypeScript, Ant Design and Vite. Bun is used to install packages and to run.

## Running it localy

You need Bun and Node.js.

You can use the [remote backend](#remote-backend), or run it locally at `http://localhost:8080`.

Then run these commands in the frontend folder:

```sh
bun install --frozen-lockfile
cp .env.example .env.local
bun run dev
```

## Connecting to the backend

Set these values in `.env.local`:

```dotenv
VITE_API_URL=/api
API_PROXY_TARGET=http://localhost:8080
```

Vite forwards `/api` requests to `API_PROXY_TARGET`. Don't include `/api` in the target address. Restart the frontend after changing these settings.

### Remote backend

For a remote server, use its address instead:

```dotenv
VITE_API_URL=https://api.example.com/api
```

Replace `api.example.com` with the real address. `API_PROXY_TARGET` is not used in this setup.

The backend must allow the exact frontend origin in CORS, with credentials, OPTIONS requests, and JSON/CSRF headers. For cross-site login, its cookies need `SameSite=None; Secure`.
