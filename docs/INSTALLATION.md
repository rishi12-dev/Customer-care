# Installation Guide

## Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
uvicorn app.main:app --reload
```

Set real values in `.env` before production use.

## Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Database

For local development, run:

```bash
docker compose up database
```

The backend creates tables on startup. You can also run `database/schema.sql` directly in PostgreSQL or Supabase.
