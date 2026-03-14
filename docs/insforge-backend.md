# InsForge Backend (MCP & SDK)

This project uses **InsForge** as the backend. Backend tasks are done via the InsForge MCP server in Cursor; app code uses the InsForge SDK.

## InsForge MCP (backend “CLI” in Cursor)

The InsForge MCP server (`user-insforge`) is the main way to perform backend and infrastructure tasks from Cursor:

- **Database**: run SQL (`run-raw-sql`), inspect schema (`get-table-schema`)
- **Storage**: create/list/delete buckets
- **Edge functions**: create, update, delete, get functions
- **Metadata**: `get-backend-metadata`, `get-anon-key`
- **Deployment**: `create-deployment` for frontend hosting

The agent should use `call_mcp_tool` with `server: "user-insforge"`. Tool schemas live in `mcps/user-insforge/tools/*.json` — check the schema before calling.

Project skill: `.cursor/skills/insforge-backend/SKILL.md` (when to use which tool, and to call `fetch-docs` before writing SDK code).

## InsForge SDK (app code)

- **Package**: `@insforge/sdk` (see `package.json`)
- **Client**: `lib/insforge.ts` — `createClient()` with `EXPO_PUBLIC_INSFORGE_URL` and `EXPO_PUBLIC_INSFORGE_ANON_KEY`
- **Exports**: `client`, `databases`, `storage`, `functions`, `account`, plus helpers like `listDocuments`, `getDocument`, `createDocument`, `updateDocument`, `deleteDocument`, `execFunction`

Use the SDK for all runtime behavior (auth, DB, storage, function invocations). Use MCP only for infra (SQL, function deploy, buckets, deployment).

## Env and config

- `EXPO_PUBLIC_INSFORGE_URL` — InsForge API base URL (e.g. `https://<app>.us-east.insforge.app`)
- `EXPO_PUBLIC_INSFORGE_ANON_KEY` — anon key (from backend metadata or `get-anon-key` MCP)

See `.env.example` for placeholders.

## Installing / reconnecting InsForge MCP

If the InsForge MCP server is not available in Cursor:

```bash
npx @insforge/install --client cursor --env API_KEY=<your-key> --env API_BASE_URL=<your-insforge-api-url>
```

Follow Cursor’s MCP setup to point it at the configured server. The project’s `mcps/user-insforge/` descriptors are used when the server is enabled.
