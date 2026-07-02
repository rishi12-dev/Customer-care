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

## Vercel Frontend

1. Import `frontend/` as a Vercel project.
2. Set `VITE_API_URL` to the Render backend URL.
3. Deploy with the default Vite build.
