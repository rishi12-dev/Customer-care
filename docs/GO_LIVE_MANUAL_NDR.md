# Secure manual-only go-live

## 1. Push the prepared changes

From this folder, review the diff and push it to the repository connected to Render/Firebase:

```powershell
cd customer-care-live
git diff --check
git add backend frontend docs
git commit -m "Add manual NDR calling workspace"
git push origin main
```

## 2. Render backend variables

Set these in the Render service before the deploy finishes:

```text
ENVIRONMENT=production
APP_TIMEZONE=Asia/Kolkata
MANUAL_NDR_ONLY=true
DATABASE_URL=<Supabase pooled PostgreSQL URL>
CORS_ORIGINS=https://customercare-3795c.web.app,https://customercare-3795c.firebaseapp.com
JWT_SECRET_KEY=<long random secret>
JWT_REFRESH_SECRET_KEY=<different long random secret>
INITIAL_ADMIN_EMAIL=<existing admin email>
INITIAL_ADMIN_PASSWORD=<temporary strong password>
```

Do not put `DATABASE_URL` or JWT secrets in Firebase or frontend code. The production guard rejects placeholder secrets.

## 3. Firebase frontend variable

Use Node `22.23.4` for the frontend build. The repository pins this in `frontend/.nvmrc`; on Windows with nvm-windows run `nvm install 22.23.4` and `nvm use 22.23.4` before `npm ci`.

Set `VITE_API_URL` to the actual Render backend URL, for example:

```text
VITE_API_URL=https://<your-render-service>.onrender.com
```

Build and deploy the `frontend/` directory with the existing Firebase project.

## 4. Daily workflow

1. Admin logs in using the existing Supabase-backed user account.
2. Admin uploads the manual NDR from **Upload → NDR Tracking Upload**.
3. The backend keeps only current India-date call rows in **My Calls**.
4. Each agent logs in with the existing user ID/password and sees only their `Agent for NDR` rows.
5. Admin opens **My Calls** to see the complete queue, agent performance, and live feedback.

The legacy daily order upload endpoint is blocked while `MANUAL_NDR_ONLY=true`.
