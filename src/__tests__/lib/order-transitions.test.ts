import { isValidTransition, type OrderStatus } from "@/lib/order-transitions";

describe("isValidTransition", () => {
  describe("DRAFT → PENDING", () => {
    it("allows SALESMAN", () => expect(isValidTransition("DRAFT", "PENDING", "SALESMAN")).toBe(true));
    it("blocks DISTRIBUTOR", () => expect(isValidTransition("DRAFT", "PENDING", "DISTRIBUTOR")).toBe(false));
    it("blocks ADMIN", () => expect(isValidTransition("DRAFT", "PENDING", "ADMIN")).toBe(false));
  });

  describe("DRAFT → CANCELLED", () => {
    it("allows SALESMAN", () => expect(isValidTransition("DRAFT", "CANCELLED", "SALESMAN")).toBe(true));
    it("blocks DISTRIBUTOR", () => expect(isValidTransition("DRAFT", "CANCELLED", "DISTRIBUTOR")).toBe(false));
    it("blocks ADMIN", () => expect(isValidTransition("DRAFT", "CANCELLED", "ADMIN")).toBe(false));
  });

  describe("PENDING → APPROVED", () => {
    it("allows DISTRIBUTOR", () => expect(isValidTransition("PENDING", "APPROVED", "DISTRIBUTOR")).toBe(true));
    it("blocks SALESMAN", () => expect(isValidTransition("PENDING", "APPROVED", "SALESMAN")).toBe(false));
    it("blocks ADMIN", () => expect(isValidTransition("PENDING", "APPROVED", "ADMIN")).toBe(false));
  });

  describe("PENDING → CANCELLED", () => {
    it("allows DISTRIBUTOR", () => expect(isValidTransition("PENDING", "CANCELLED", "DISTRIBUTOR")).toBe(true));
    it("blocks SALESMAN", () => expect(isValidTransition("PENDING", "CANCELLED", "SALESMAN")).toBe(false));
    it("blocks ADMIN", () => expect(isValidTransition("PENDING", "CANCELLED", "ADMIN")).toBe(false));
  });

  describe("APPROVED → DELIVERED", () => {
    it("allows DISTRIBUTOR", () => expect(isValidTransition("APPROVED", "DELIVERED", "DISTRIBUTOR")).toBe(true));
    it("blocks SALESMAN", () => expect(isValidTransition("APPROVED", "DELIVERED", "SALESMAN")).toBe(false));
    it("blocks ADMIN", () => expect(isValidTransition("APPROVED", "DELIVERED", "ADMIN")).toBe(false));
  });

  describe("APPROVED → CANCELLED", () => {
    it("allows ADMIN", () => expect(isValidTransition("APPROVED", "CANCELLED", "ADMIN")).toBe(true));
    it("blocks SALESMAN", () => expect(isValidTransition("APPROVED", "CANCELLED", "SALESMAN")).toBe(false));
    it("blocks DISTRIBUTOR", () => expect(isValidTransition("APPROVED", "CANCELLED", "DISTRIBUTOR")).toBe(false));
  });

  describe("terminal states cannot transition", () => {
    const terminals: OrderStatus[] = ["DELIVERED", "CANCELLED"];
    const targets: OrderStatus[] = ["DRAFT", "PENDING", "APPROVED", "DELIVERED", "CANCELLED"];
    const roles = ["SALESMAN", "DISTRIBUTOR", "ADMIN"];

    terminals.forEach((from) => {
      targets.forEach((to) => {
        roles.forEach((role) => {
          it(`blocks ${from} → ${to} for ${role}`, () => {
            expect(isValidTransition(from, to, role)).toBe(false);
          });
        });
      });
    });
  });

  describe("backwards transitions are blocked", () => {
    it("blocks PENDING → DRAFT", () => expect(isValidTransition("PENDING", "DRAFT", "SALESMAN")).toBe(false));
    it("blocks APPROVED → PENDING", () => expect(isValidTransition("APPROVED", "PENDING", "DISTRIBUTOR")).toBe(false));
    it("blocks APPROVED → DRAFT", () => expect(isValidTransition("APPROVED", "DRAFT", "ADMIN")).toBe(false));
    it("blocks DELIVERED → APPROVED", () => expect(isValidTransition("DELIVERED", "APPROVED", "ADMIN")).toBe(false));
  });
});
