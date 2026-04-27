import { z } from "zod";

export const CreateOrderSchema = z.object({
  customerId: z.string().uuid(),
  items: z
    .array(
      z.object({
        productId: z.string().uuid(),
        quantity: z.number().int().positive(),
      })
    )
    .min(1),
  notes: z.string().max(500).optional(),
  lat: z.number().min(-90).max(90).optional(),
  lng: z.number().min(-180).max(180).optional(),
});

export const UpdateOrderStatusSchema = z.object({
  status: z.enum(["PENDING", "APPROVED", "CANCELLED", "DELIVERED"]),
});

export const CreateProductSchema = z.object({
  name: z.string().min(1).max(200),
  price: z.number().positive(),
  stock: z.number().int().nonnegative(),
});

export const UpdateProductSchema = z.object({
  price: z.number().positive().optional(),
  stock: z.number().int().nonnegative().optional(),
});

export const CreateCustomerSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  phone: z.string().max(20).optional(),
  creditLimit: z.number().nonnegative().default(0),
});

export const UpdateCustomerSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  address: z.string().min(1).max(500).optional(),
  phone: z.string().max(20).optional(),
  creditLimit: z.number().nonnegative().optional(),
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
