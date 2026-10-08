export type Role = "admin" | "customer_care" | "shipping";

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

export interface NdrTrackingRecord {
  id: number;
  row_number: number;
  upload_filename: string;
  order_no: string | null;
  docket_number: string | null;
  phone: string | null;
  status: string | null;
  agent: string | null;
  remark: string | null;
  event_time: string | null;
  raw_data: Record<string, string | number | boolean | null>;
}

export interface PincodeService {
  id: number;
  s_no?: number | null;
  divided_by_10?: number | null;
  formula?: string | null;
  page_number?: number | null;
  row_on_page?: number | null;
  pincode: string;
  state: string | null;
  city: string | null;
  zone: string | null;
  active: boolean;
  warehouse: string | null;
  courier: string;
  service_date: string | null;
  source_file: string | null;
}

export interface PincodeSearchResponse {
  query: string;
  pincode: string;
  s_no?: number | null;
  divided_by_10?: number | null;
  formula?: string | null;
  page_number?: number | null;
  row_on_page?: number | null;
  was_divided_by_10: boolean;
  results: PincodeService[];
}

export interface PincodeBulkSearchResultItem {
  query: string;
  resolved_pincode: string;
  was_divided_by_10: boolean;
  results: PincodeService[];
}

export interface PincodeBulkSearchResponse {
  total_queries: number;
  matched_queries: number;
  items: PincodeBulkSearchResultItem[];
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
  pincode_total: number;
  pincode_unique: number;
  pincode_active: number;
  pincode_inactive: number;
  pincode_courier_wise: Array<{ name: string; value: number }>;
  pincode_state_wise: Array<{ name: string; value: number }>;
  pincode_warehouse_wise: Array<{ name: string; value: number }>;
}
