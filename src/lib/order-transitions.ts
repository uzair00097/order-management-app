export type OrderStatus = "DRAFT" | "PENDING" | "APPROVED" | "DELIVERED" | "CANCELLED";

type Transition = { from: OrderStatus; to: OrderStatus; roles: string[] };

export const ALLOWED_TRANSITIONS: Transition[] = [
  { from: "DRAFT",    to: "PENDING",   roles: ["SALESMAN"] },
  { from: "DRAFT",    to: "CANCELLED", roles: ["SALESMAN"] },
  { from: "PENDING",  to: "APPROVED",  roles: ["DISTRIBUTOR"] },
  { from: "PENDING",  to: "CANCELLED", roles: ["DISTRIBUTOR"] },
  { from: "APPROVED", to: "DELIVERED", roles: ["DISTRIBUTOR"] },
  { from: "APPROVED", to: "CANCELLED", roles: ["ADMIN"] },
];

export function isValidTransition(from: OrderStatus, to: OrderStatus, role: string): boolean {
  return ALLOWED_TRANSITIONS.some((t) => t.from === from && t.to === to && t.roles.includes(role));
}
