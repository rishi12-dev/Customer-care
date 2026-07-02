# Folder Structure

- `backend/app/config`: environment and database setup.
- `backend/app/controllers`: FastAPI route modules.
- `backend/app/models`: SQLAlchemy database entities.
- `backend/app/schemas`: Pydantic request and response DTOs.
- `backend/app/services`: business logic for Excel, search, audit, bootstrap.
- `backend/app/middleware`: security headers and CSRF checks.
- `frontend/src/api`: API client and token refresh.
- `frontend/src/context`: authenticated user state.
- `frontend/src/layouts`: protected application shell.
- `frontend/src/pages`: dashboard, search, upload, admin workflows.
- `database`: PostgreSQL schema and migration scripts.
- `docs`: install, deployment, API, and structure documentation.
