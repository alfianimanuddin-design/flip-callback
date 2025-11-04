import { z } from "zod";

/**
 * Input validation schemas using Zod
 */

// Create Payment Request
export const createPaymentSchema = z.object({
  amount: z.number().int().min(1000).max(10000000, "Amount too large"),
  discounted_amount: z.number().int().min(0).max(10000000).optional(),
  email: z.string().email("Invalid email format").max(255),
  product_name: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  title: z.string().max(200).optional(),
  sender_bank_type: z.string().max(50).optional(),
});

export type CreatePaymentRequest = z.infer<typeof createPaymentSchema>;

// Use Voucher Request
export const useVoucherSchema = z.object({
  product_name: z.string().min(1).max(100),
  user_email: z.string().email("Invalid email format").max(255),
  transaction_id: z.string().max(100).optional(),
  name: z.string().max(100).optional(),
});

export type UseVoucherRequest = z.infer<typeof useVoucherSchema>;

// Test Email Request
export const testEmailSchema = z.object({
  email: z.string().email("Invalid email format").max(255),
});

export type TestEmailRequest = z.infer<typeof testEmailSchema>;

// Flip Callback Data
export const flipCallbackSchema = z.object({
  id: z.string(),
  bill_link_id: z.number().optional(),
  amount: z.number(),
  status: z.string(),
  sender_email: z.string().email(),
  payment_method: z.string().optional(),
});

export type FlipCallbackData = z.infer<typeof flipCallbackSchema>;

/**
 * Safely parse and validate request body
 */
export async function validateRequest<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): Promise<{ success: true; data: T } | { success: false; error: string }> {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstError = error.errors[0];
      return {
        success: false,
        error: `${firstError.path.join(".")}: ${firstError.message}`,
      };
    }
    return { success: false, error: "Validation failed" };
  }
}