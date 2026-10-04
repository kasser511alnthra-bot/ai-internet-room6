# AI Internet Room — attendance app

## Stack
- Frontend: React 18 + Vite 5 (dev server on container port 5173 → host port 3000)
- Backend: Express (`server/index.mjs`, container port 4000) — login throttling + `/api/config`
- Database: the user's real Supabase project (Postgres + auth). Schema lives in `supabase/schema.sql`.

## Running
- `docker compose -f docker-compose.base44.yml up -d` (single `app` service runs both Vite and the Express API with watchers).
- Secrets (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY) come from `/run/base44/app.env`. The browser gets the URL + anon key via `GET /api/config`; the service_role key never leaves the server.

## Supabase setup (manual, one-time)
1. Run `supabase/schema.sql` once in the Supabase SQL Editor as postgres.
2. Sign up a user in the app, then bootstrap the first admin in the SQL Editor:
   `update public.members set role='admin', is_active=true where username='<u_...>';`
   (Admins are needed to activate other accounts.)

## Verify
- `curl http://localhost:3000/api/health` → `{"ok":true,"configured":true|false}`
- `curl http://localhost:3000/` → served Vite dev page.
- Login goes through `POST /api/login`, which calls the service-role-only `consume_login_attempt` RPC (15 attempts / 15 min per HMAC(email|ip)) before signing in against Supabase auth.

## Quirks
- All business dates are Asia/Riyadh (enforced in the DB schema and in date pickers via `todayRiyadh()`).
- All writes go through the SQL RPCs defined in the schema — no client-side table writes (RLS blocks them anyway).
- Supabase error codes surface as messages; `src/lib/util.js` maps them to friendly text.
