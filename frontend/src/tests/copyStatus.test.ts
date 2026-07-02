import { describe, expect, it } from "vitest";
import { buildStatusMessage } from "../utils/copyStatus";
import type { Order } from "../types";

it("builds the customer care copy status message", () => {
  const order: Order = {
    id: 1,
    order_no: "ORD-1",
    customer_name: "Asha Rao",
    customer_phone_number: "9876543210",
    alt_no: null,
    docket_number: "DKT-1",
    shipment: "BlueDart",
    remark: "Reached hub",
    current_status: "In Transit",
    expected_delivery: "2026-07-05",
    delivery_date: null
  };
  expect(buildStatusMessage(order)).toContain("Hello Asha Rao");
  expect(buildStatusMessage(order)).toContain("Order No ORD-1");
  expect(buildStatusMessage(order)).toContain("In Transit");
});
