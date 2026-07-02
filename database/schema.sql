CREATE TYPE user_role AS ENUM ('admin', 'customer_care');
CREATE TYPE upload_status AS ENUM ('success', 'failed');
CREATE TYPE audit_action AS ENUM ('login', 'logout', 'upload', 'backup', 'restore', 'search', 'user_change');

CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(160) NOT NULL,
  hashed_password VARCHAR(255) NOT NULL,
  role user_role NOT NULL DEFAULT 'customer_care',
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  order_no VARCHAR(80) NOT NULL,
  customer_name VARCHAR(180) NOT NULL,
  customer_phone_number VARCHAR(40) NOT NULL,
  alt_no VARCHAR(40),
  docket_number VARCHAR(80) NOT NULL,
  shipment VARCHAR(120) NOT NULL,
  remark TEXT,
  current_status VARCHAR(80) NOT NULL,
  expected_delivery DATE,
  delivery_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX ix_orders_order_no ON orders(order_no);
CREATE INDEX ix_orders_docket_number ON orders(docket_number);
CREATE INDEX ix_orders_customer_phone_number ON orders(customer_phone_number);
CREATE INDEX ix_orders_alt_no ON orders(alt_no);
CREATE INDEX ix_orders_status ON orders(current_status);
CREATE INDEX ix_orders_search_combo ON orders(order_no, docket_number, customer_phone_number, alt_no);

CREATE TABLE upload_history (
  id SERIAL PRIMARY KEY,
  filename VARCHAR(255) NOT NULL,
  uploaded_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  records INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  status upload_status NOT NULL,
  errors JSONB NOT NULL DEFAULT '[]',
  warnings JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE backups (
  id SERIAL PRIMARY KEY,
  label VARCHAR(180) NOT NULL,
  created_by_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  records INTEGER NOT NULL DEFAULT 0,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE search_history (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  query VARCHAR(160) NOT NULL,
  detected_type VARCHAR(40) NOT NULL,
  result_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE audit_logs (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action audit_action NOT NULL,
  ip_address VARCHAR(80),
  metadata_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE app_settings (
  key VARCHAR(80) PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
