# Database Schema

CourierOps stores normalized operational tables:

- `users`: authenticated users, role, active status, bcrypt password hash.
- `orders`: current working courier order data imported from the daily Excel file.
- `upload_history`: upload audit trail, row count, duration, status, errors, warnings.
- `backups`: JSON snapshots of orders before every replace or restore operation.
- `search_history`: latest searches by user.
- `audit_logs`: login, logout, upload, backup, restore, search, and user-change events.
- `app_settings`: company name and theme settings.

Search indexes are created on `order_no`, `docket_number`, `customer_phone_number`, `alt_no`, and `current_status`.
