# Deployment Guide

## Supabase PostgreSQL

1. Create a Supabase project.
2. Copy the pooled PostgreSQL connection string.
3. Use the SQL editor to run `database/schema.sql` if you prefer manual schema creation. The backend also creates tables on startup.

## Render Backend

1. Create a Render Web Service from `backend/`.
2. Set build command: `pip install -r requirements.txt`.
3. Set start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
4. Add environment variables from `backend/.env.example`.
5. Set `CORS_ORIGINS` to your Vercel frontend URL.
6. For the current manual-only workflow, set `MANUAL_NDR_ONLY=true` and `APP_TIMEZONE=Asia/Kolkata`.
7. Set `JWT_SECRET_KEY` and `JWT_REFRESH_SECRET_KEY` to different long random values. Do not use the example values.
8. Set `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD` only for first bootstrap; rotate the password after first login.

## Vercel Frontend

1. Import `frontend/` as a Vercel project.
2. Set `VITE_API_URL` to the Render backend URL.
3. Deploy with the default Vite build.

## Firebase frontend already in use

For `customercare-3795c.web.app`, build the `frontend/` directory with `VITE_API_URL` set to the Render backend URL, then run `firebase deploy --only hosting`. Keep the Supabase connection string and JWT secrets only in Render environment variables; never put them in Firebase or frontend code.

## Manual NDR calling behavior

The existing `/upload/ndr` upload remains the single source of truth. After an upload completes, `/ndr/calls` exposes only records whose manual NDR date equals the India current date. The assigned agent is matched to the existing user by full name or email local-part. Agents see only their calls; admins see the complete current-date queue and feedback performance. The legacy daily order upload endpoint is disabled while `MANUAL_NDR_ONLY=true`.
