import type { Order } from "../types";

export function buildStatusMessage(order: Order) {
  return `Hello ${order.customer_name},\n\nYour shipment through ${order.shipment}\n\n(Order No ${order.order_no})\n\nis currently\n\n${order.current_status}.\n\nExpected Delivery\n\n${order.expected_delivery ?? "Not available"}.\n\nThank you.`;
}
