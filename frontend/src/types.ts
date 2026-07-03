export type Role = "admin" | "customer_care";

export interface User {
  id: number;
  email: string;
  full_name: string;
  avatar_data_url?: string | null;
  role: Role;
  is_active: boolean;
  created_at: string;
}

export interface Order {
  id: number;
  order_no: string;
  customer_name: string;
  customer_phone_number: string;
  alt_no: string | null;
  docket_number: string;
  shipment: string;
  remark: string | null;
  current_status: string;
  expected_delivery: string | null;
  delivery_date: string | null;
}

export interface Dashboard {
  total_orders: number;
  delivered: number;
  pending: number;
  in_transit: number;
  ofd: number;
  ndr: number;
  rto: number;
  delayed: number;
  latest_upload: { date: string; records: number; status: string } | null;
  database_status: string;
  courier_wise: Array<{ name: string; value: number }>;
  status_wise: Array<{ name: string; value: number }>;
  daily_upload_trend: Array<{ date: string; records: number }>;
}
