# CourierOps API

Base URL is the deployed Render backend URL or `http://localhost:8000`.

Authentication uses Bearer JWT access tokens and refresh tokens.

## Auth

- `POST /auth/login` accepts `{ "email": "...", "password": "..." }`.
- `POST /auth/logout` invalidates the browser CSRF cookie and records an audit log.
- `GET /auth/profile` returns the active user.
- `POST /auth/refresh` accepts `{ "refresh_token": "..." }`.

## Operations

- `POST /upload/preview` validates Excel headers and returns the first 20 rows.
- `POST /upload` creates a backup, replaces working orders, records upload history.
- `GET /dashboard` returns counts, courier aggregation, status aggregation, latest upload.
- `GET /search?q=value` searches order number, docket number, phone, and alternate phone.
- `GET /orders/{id}` returns one order.
- `GET /recent-search` returns the current user's latest searches.
- `GET /upload-history` returns admin upload history.
- `POST /backup` creates a manual backup.
- `GET /backup` lists backups.
- `POST /restore/{backup_id}` restores a previous backup.
- `GET /users`, `POST /users`, `PUT /users/{id}`, `DELETE /users/{id}` manage users.
