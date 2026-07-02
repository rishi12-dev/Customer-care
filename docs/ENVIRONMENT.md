# Environment Variables

## Backend

- `APP_NAME`: Display and API application name.
- `ENVIRONMENT`: `development` or `production`.
- `DATABASE_URL`: SQLAlchemy PostgreSQL URL.
- `JWT_SECRET_KEY`: Access-token signing secret.
- `JWT_REFRESH_SECRET_KEY`: Refresh-token signing secret.
- `ACCESS_TOKEN_EXPIRE_MINUTES`: Session timeout window for access tokens.
- `REFRESH_TOKEN_EXPIRE_DAYS`: Refresh token lifetime.
- `CORS_ORIGINS`: Comma-separated frontend origins.
- `INITIAL_ADMIN_EMAIL`: First admin account email.
- `INITIAL_ADMIN_PASSWORD`: First admin account password.

## Frontend

- `VITE_API_URL`: Backend API base URL.
