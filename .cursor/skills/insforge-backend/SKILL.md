---
name: insforge-backend
description: Use InsForge as the backend platform. For backend and infrastructure tasks (database, storage, functions, schema, deployment), use the InsForge MCP server (user-insforge) via call_mcp_tool. Use fetch-docs before writing or changing InsForge SDK code.
---

# InsForge Backend

This project uses **InsForge** as the backend (BaaS). Application code uses `@insforge/sdk` and `lib/insforge.ts`. Backend and infrastructure work must go through the InsForge MCP server.

## When to use this skill

- Database: run SQL, inspect schema, migrations
- Storage: create/list/delete buckets
- Serverless: create, update, delete, or inspect edge functions
- Backend metadata or anon key
- Deploying frontend to InsForge hosting
- Writing or editing code that uses the InsForge SDK (auth, db, storage, functions)

## MCP server

- **Server**: `user-insforge`
- **Tool**: `call_mcp_tool` with `server: "user-insforge"` and the tool name + arguments below.

Always read the tool descriptor in `mcps/user-insforge/tools/<tool-name>.json` before calling to get the exact parameters.

## Backend tasks → MCP tools

| Task | Tool | Notes |
|------|------|--------|
| Run SQL (schema, data, migrations) | `run-raw-sql` | `query` (required), optional `params`, `apiKey` |
| Inspect table schema (columns, RLS, indexes) | `get-table-schema` | `tableName` required |
| Backend metadata / config | `get-backend-metadata` | Optional `apiKey` |
| Get anon key | `get-anon-key` | For client config |
| Create edge function | `create-function` | `name`, `codeFile` (path to JS); optional `slug`, `description`, `status` |
| Update edge function | `update-function` | Check descriptor for args |
| Get / list / delete function | `get-function`, (list via backend metadata or docs) `delete-function` | |
| Storage buckets | `create-bucket`, `list-buckets`, `delete-bucket` | |
| Bulk upsert data | `bulk-upsert` | Check descriptor for schema |
| Deploy frontend | `create-deployment` | Check descriptor for args |
| Container logs | `get-container-logs` | For debugging |

## Before writing SDK code

Before writing or changing code that uses the InsForge SDK (e.g. in `lib/insforge.ts` or any file that uses `client.auth`, `client.database`, `client.storage`, `client.functions`):

1. Call **fetch-docs** (or **fetch-sdk-docs**) via MCP with the right doc type:
   - `instructions` — start here for backend setup
   - `db-sdk-typescript` — database
   - `auth-sdk-typescript` — auth
   - `storage-sdk` — storage
   - `functions-sdk` — edge functions
   - `real-time` — WebSockets

2. Use the returned docs for API shape, options, and examples.

## Application client

- Config: `EXPO_PUBLIC_INSFORGE_URL`, `EXPO_PUBLIC_INSFORGE_ANON_KEY` (see `.env.example`).
- Client: `lib/insforge.ts` exports `client`, `databases`, `storage`, `functions`, `account`, and helpers like `listDocuments`, `getDocument`, `createDocument`, `updateDocument`, `deleteDocument`, `execFunction`.

Use the **SDK in app code** for auth, database, storage, and function calls. Use **MCP tools** for infrastructure (running SQL, managing functions/buckets, deployment).

## Optional CLI

For local or script-based backend tasks you can use the InsForge MCP from this project. A separate InsForge CLI (e.g. `npx @insforge/install` or project-specific CLI) may be documented in InsForge docs; when available, prefer MCP in Cursor for consistency.
