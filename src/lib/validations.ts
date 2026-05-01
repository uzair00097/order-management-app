import { z } from "zod";

export const CreateOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive().max(9999),
      })
    )
    .min(1)
    .max(50),
  notes: z.string().max(500).trim().optional(),
  discountAmount: z.number().nonnegative().max(10_000_000).default(0),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "CANCELLED", "DELIVERED"]),
});

export const CreateProductSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  price: z.number().positive().max(10_000_000),
  stock: z.number().int().nonnegative().max(1_000_000),
  imageUrl: z.string().url().max(2048).optional(),
});

export const UpdateProductSchema = z.object({
  price: z.number().positive().max(10_000_000).optional(),
  stock: z.number().int().nonnegative().max(1_000_000).optional(),
  imageUrl: z.string().url().max(2048).nullable().optional(),
});

export const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(200).trim(),
  address: z.string().min(1).max(500).trim(),
  phone: z.string().max(20).trim().optional(),
  creditLimit: z.number().nonnegative().max(100_000_000).default(0),
});

export const UpdateCustomerSchema = z.object({
  name: z.string().min(1).max(200).trim().optional(),
  address: z.string().min(1).max(500).trim().optional(),
  phone: z.string().max(20).trim().optional(),
  creditLimit: z.number().nonnegative().max(100_000_000).optional(),
});

export const PaginationSchema = z.object({
  limit: z.coerce.number().int().positive().max(100).default(20),
  cursor: z.string().uuid().optional(),
  search: z.string().max(100).optional(),
  status: z.enum(["DRAFT", "PENDING", "APPROVED", "DELIVERED", "CANCELLED"]).optional(),
  from: z.string().datetime().optional(),
  to: z.string().datetime().optional(),
  customerId: z.string().uuid().optional(),
});
