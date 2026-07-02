# CourierOps

CourierOps is a production-oriented courier tracking portal for customer care teams. Admins upload a fresh Excel file, the backend validates the exact template, creates a backup, replaces working order data only after validation, and customer care users search orders instantly.

## Stack

- Frontend: React 19, TypeScript, Vite, Tailwind CSS, React Router, React Query, React Hook Form-ready forms, Zod-ready validation, Lucide icons.
- Backend: FastAPI, SQLAlchemy, Pydantic, JWT, bcrypt, Pandas, OpenPyXL.
- Database: PostgreSQL.
- Hosting targets: Vercel, Render, Supabase PostgreSQL.

## Local Setup

1. Copy `backend/.env.example` to `backend/.env` and set strong JWT secrets.
2. Copy `frontend/.env.example` to `frontend/.env`.
3. Start PostgreSQL with `docker compose up database`.
4. From `backend`, install dependencies and run `uvicorn app.main:app --reload`.
5. From `frontend`, install dependencies and run `npm run dev`.

Initial admin credentials come from `INITIAL_ADMIN_EMAIL` and `INITIAL_ADMIN_PASSWORD`. The local default is `admin@courierops.com` / `ChangeMe@12345`.

## Excel Template

Headers must match exactly:

`ORDER NO`, `CUSTOMER NAME`, `CUSTOMER PHONE NUMBER`, `ALT NO`, `DOCKET NUMBER`, `SHIPMENT`, `REMARK`, `CURRENT STATUS`, `Expected Delivery`, `Delivery Date`

Wrong headers, duplicate columns, or empty files are rejected and existing working data remains untouched.

## Security

CourierOps uses hashed passwords, JWT access and refresh tokens, role-based routes, rate limiting, secure headers, input validation, SQLAlchemy query binding, CSRF validation for browser-originating unsafe requests, and audit logs for important actions.

## Documentation

- `docs/API.md`
- `docs/DEPLOYMENT.md`
- `docs/FOLDER_STRUCTURE.md`
- `database/schema.sql`
