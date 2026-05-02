import {
  CreateOrderSchema,
  UpdateOrderStatusSchema,
  CreateProductSchema,
  UpdateProductSchema,
  CreateCustomerSchema,
  UpdateCustomerSchema,
  PaginationSchema,
} from "@/lib/validations";

const UUID = "550e8400-e29b-41d4-a716-446655440000";

describe("CreateOrderSchema", () => {
  const base = { customerId: UUID, items: [{ productId: UUID, quantity: 1 }] };

  it("accepts a valid order", () => {
    expect(CreateOrderSchema.safeParse(base).success).toBe(true);
  });

  it("defaults discountAmount to 0", () => {
    const r = CreateOrderSchema.safeParse(base);
    expect(r.success && r.data.discountAmount).toBe(0);
  });

  it("rejects non-UUID customerId", () => {
    expect(CreateOrderSchema.safeParse({ ...base, customerId: "bad" }).success).toBe(false);
  });

  it("rejects empty items array", () => {
    expect(CreateOrderSchema.safeParse({ ...base, items: [] }).success).toBe(false);
  });

  it("rejects more than 50 items", () => {
    const items = Array.from({ length: 51 }, () => ({ productId: UUID, quantity: 1 }));
    expect(CreateOrderSchema.safeParse({ ...base, items }).success).toBe(false);
  });

  it("accepts exactly 50 items", () => {
    const items = Array.from({ length: 50 }, () => ({ productId: UUID, quantity: 1 }));
    expect(CreateOrderSchema.safeParse({ ...base, items }).success).toBe(true);
  });

  it("rejects quantity of 0", () => {
    expect(CreateOrderSchema.safeParse({ ...base, items: [{ productId: UUID, quantity: 0 }] }).success).toBe(false);
  });

  it("rejects quantity over 9999", () => {
    expect(CreateOrderSchema.safeParse({ ...base, items: [{ productId: UUID, quantity: 10000 }] }).success).toBe(false);
  });

  it("rejects negative discountAmount", () => {
    expect(CreateOrderSchema.safeParse({ ...base, discountAmount: -1 }).success).toBe(false);
  });

  it("rejects discountAmount over 10_000_000", () => {
    expect(CreateOrderSchema.safeParse({ ...base, discountAmount: 10_000_001 }).success).toBe(false);
  });

  it("rejects latitude out of range", () => {
    expect(CreateOrderSchema.safeParse({ ...base, lat: 91 }).success).toBe(false);
    expect(CreateOrderSchema.safeParse({ ...base, lat: -91 }).success).toBe(false);
  });

  it("rejects longitude out of range", () => {
    expect(CreateOrderSchema.safeParse({ ...base, lng: 181 }).success).toBe(false);
    expect(CreateOrderSchema.safeParse({ ...base, lng: -181 }).success).toBe(false);
  });

  it("rejects notes over 500 characters", () => {
    expect(CreateOrderSchema.safeParse({ ...base, notes: "a".repeat(501) }).success).toBe(false);
  });

  it("accepts notes at exactly 500 characters", () => {
    expect(CreateOrderSchema.safeParse({ ...base, notes: "a".repeat(500) }).success).toBe(true);
  });
});

describe("UpdateOrderStatusSchema", () => {
  ["PENDING", "APPROVED", "CANCELLED", "DELIVERED"].forEach((status) => {
    it(`accepts ${status}`, () => {
      expect(UpdateOrderStatusSchema.safeParse({ status }).success).toBe(true);
    });
  });

  it("rejects DRAFT (not a valid target status)", () => {
    expect(UpdateOrderStatusSchema.safeParse({ status: "DRAFT" }).success).toBe(false);
  });

  it("rejects unknown statuses", () => {
    expect(UpdateOrderStatusSchema.safeParse({ status: "SHIPPED" }).success).toBe(false);
  });

  it("rejects missing status", () => {
    expect(UpdateOrderStatusSchema.safeParse({}).success).toBe(false);
  });
});

describe("CreateProductSchema", () => {
  const base = { name: "Cola", price: 100, stock: 50 };

  it("accepts a valid product", () => {
    expect(CreateProductSchema.safeParse(base).success).toBe(true);
  });

  it("rejects empty name", () => {
    expect(CreateProductSchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });

  it("rejects name over 200 characters", () => {
    expect(CreateProductSchema.safeParse({ ...base, name: "a".repeat(201) }).success).toBe(false);
  });

  it("rejects zero price", () => {
    expect(CreateProductSchema.safeParse({ ...base, price: 0 }).success).toBe(false);
  });

  it("rejects negative price", () => {
    expect(CreateProductSchema.safeParse({ ...base, price: -1 }).success).toBe(false);
  });

  it("rejects price over 10_000_000", () => {
    expect(CreateProductSchema.safeParse({ ...base, price: 10_000_001 }).success).toBe(false);
  });

  it("rejects negative stock", () => {
    expect(CreateProductSchema.safeParse({ ...base, stock: -1 }).success).toBe(false);
  });

  it("rejects non-integer stock", () => {
    expect(CreateProductSchema.safeParse({ ...base, stock: 1.5 }).success).toBe(false);
  });

  it("accepts zero stock (out of stock)", () => {
    expect(CreateProductSchema.safeParse({ ...base, stock: 0 }).success).toBe(true);
  });

  it("rejects invalid imageUrl", () => {
    expect(CreateProductSchema.safeParse({ ...base, imageUrl: "not-a-url" }).success).toBe(false);
  });

  it("accepts valid imageUrl", () => {
    expect(CreateProductSchema.safeParse({ ...base, imageUrl: "https://example.com/img.jpg" }).success).toBe(true);
  });
});

describe("UpdateProductSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expect(UpdateProductSchema.safeParse({}).success).toBe(true);
  });

  it("accepts price-only update", () => {
    expect(UpdateProductSchema.safeParse({ price: 200 }).success).toBe(true);
  });

  it("accepts stock-only update", () => {
    expect(UpdateProductSchema.safeParse({ stock: 10 }).success).toBe(true);
  });

  it("accepts null imageUrl to remove the image", () => {
    expect(UpdateProductSchema.safeParse({ imageUrl: null }).success).toBe(true);
  });

  it("rejects negative price", () => {
    expect(UpdateProductSchema.safeParse({ price: -5 }).success).toBe(false);
  });
});

describe("CreateCustomerSchema", () => {
  const base = { name: "Ahmed Store", address: "123 Main St" };

  it("accepts a valid customer", () => {
    expect(CreateCustomerSchema.safeParse(base).success).toBe(true);
  });

  it("defaults creditLimit to 0", () => {
    const r = CreateCustomerSchema.safeParse(base);
    expect(r.success && r.data.creditLimit).toBe(0);
  });

  it("rejects empty name", () => {
    expect(CreateCustomerSchema.safeParse({ ...base, name: "" }).success).toBe(false);
  });

  it("rejects empty address", () => {
    expect(CreateCustomerSchema.safeParse({ ...base, address: "" }).success).toBe(false);
  });

  it("rejects negative creditLimit", () => {
    expect(CreateCustomerSchema.safeParse({ ...base, creditLimit: -1 }).success).toBe(false);
  });

  it("accepts creditLimit of 0 (no limit)", () => {
    expect(CreateCustomerSchema.safeParse({ ...base, creditLimit: 0 }).success).toBe(true);
  });

  it("rejects creditLimit over 100_000_000", () => {
    expect(CreateCustomerSchema.safeParse({ ...base, creditLimit: 100_000_001 }).success).toBe(false);
  });
});

describe("UpdateCustomerSchema", () => {
  it("accepts empty object (all optional)", () => {
    expect(UpdateCustomerSchema.safeParse({}).success).toBe(true);
  });

  it("accepts phone-only update", () => {
    expect(UpdateCustomerSchema.safeParse({ phone: "0300-1234567" }).success).toBe(true);
  });

  it("rejects phone over 20 characters", () => {
    expect(UpdateCustomerSchema.safeParse({ phone: "1".repeat(21) }).success).toBe(false);
  });
});

describe("PaginationSchema", () => {
  it("applies default limit of 20", () => {
    const r = PaginationSchema.safeParse({});
    expect(r.success && r.data.limit).toBe(20);
  });

  it("coerces string limit to number", () => {
    const r = PaginationSchema.safeParse({ limit: "10" });
    expect(r.success && r.data.limit).toBe(10);
  });

  it("rejects limit over 100", () => {
    expect(PaginationSchema.safeParse({ limit: "101" }).success).toBe(false);
  });

  it("rejects limit of 0", () => {
    expect(PaginationSchema.safeParse({ limit: "0" }).success).toBe(false);
  });

  it("rejects non-UUID cursor", () => {
    expect(PaginationSchema.safeParse({ cursor: "not-a-uuid" }).success).toBe(false);
  });

  it("accepts valid UUID cursor", () => {
    expect(PaginationSchema.safeParse({ cursor: UUID }).success).toBe(true);
  });

  ["DRAFT", "PENDING", "APPROVED", "DELIVERED", "CANCELLED"].forEach((status) => {
    it(`accepts status filter: ${status}`, () => {
      expect(PaginationSchema.safeParse({ status }).success).toBe(true);
    });
  });

  it("rejects unknown status filter", () => {
    expect(PaginationSchema.safeParse({ status: "UNKNOWN" }).success).toBe(false);
  });

  it("rejects search over 100 characters", () => {
    expect(PaginationSchema.safeParse({ search: "a".repeat(101) }).success).toBe(false);
  });
});
