/**
 * Validation Schemas using Zod
 *
 * Define contracts for request/response payloads.
 * Centralized validation ensures data integrity at boundaries.
 */

import { z } from 'zod';

// ===== Command Domain Schemas =====

export const ExecuteCommandRequestSchema = z.object({
  command: z
    .string()
    .min(1, 'Command cannot be empty')
    .max(10000, 'Command too long'),
  timeout: z
    .number()
    .int()
    .positive()
    .optional()
    .default(30000),
  cwd: z
    .string()
    .optional()
    .default('/tmp'),
});

export type ExecuteCommandRequest = z.infer<typeof ExecuteCommandRequestSchema>;

export const BatchCommandRequestSchema = z.object({
  commands: z
    .array(ExecuteCommandRequestSchema)
    .min(1, 'At least one command required')
    .max(100, 'Maximum 100 commands per batch'),
});

export type BatchCommandRequest = z.infer<typeof BatchCommandRequestSchema>;

export const CommandResultResponseSchema = z.object({
  success: z.boolean(),
  result: z.object({
    exitCode: z.number().int().nonnegative(),
    stdout: z.string(),
    stderr: z.string(),
    duration: z.number().nonnegative(),
  }),
  timestamp: z.string().datetime(),
});

export type CommandResultResponse = z.infer<typeof CommandResultResponseSchema>;

// ===== Resources Domain Schemas =====

export const ProcessInfoSchema = z.object({
  pid: z.number().int().positive(),
  name: z.string(),
  user: z.string(),
  cpuPercent: z.number().nonnegative(),
  memoryMb: z.number().nonnegative(),
  command: z.string(),
});

export type ProcessInfo = z.infer<typeof ProcessInfoSchema>;

export const SystemResourcesResponseSchema = z.object({
  success: z.boolean(),
  data: z.object({
    cpu: z.object({
      cores: z.number().int().positive(),
      user: z.number().min(0).max(100),
      system: z.number().min(0).max(100),
      idle: z.number().min(0).max(100),
    }),
    memory: z.object({
      total: z.number().nonnegative(),
      used: z.number().nonnegative(),
      free: z.number().nonnegative(),
      available: z.number().nonnegative(),
    }),
    disk: z.object({
      total: z.number().nonnegative(),
      used: z.number().nonnegative(),
      available: z.number().nonnegative(),
    }),
  }),
  timestamp: z.string().datetime(),
});

export type SystemResourcesResponse = z.infer<typeof SystemResourcesResponseSchema>;

// ===== Services Domain Schemas =====

export const ServiceActionRequestSchema = z.object({
  name: z.string().min(1, 'Service name required'),
  action: z.enum(['start', 'stop', 'restart']),
});

export type ServiceActionRequest = z.infer<typeof ServiceActionRequestSchema>;

export const ServiceStatusResponseSchema = z.object({
  name: z.string(),
  status: z.enum(['active', 'inactive', 'failed', 'unknown']),
  enabled: z.boolean(),
  uptime: z.number().optional(),
});

export type ServiceStatusResponse = z.infer<typeof ServiceStatusResponseSchema>;

// ===== Auth Domain Schemas =====

export const TokenValidationSchema = z.object({
  token: z
    .string()
    .min(1, 'Token required')
    .regex(/^Bearer\s+\S+$|^\S+$/, 'Invalid token format'),
});

export type TokenValidation = z.infer<typeof TokenValidationSchema>;

// ===== Error Response Schema =====

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.record(z.string(), z.unknown()).optional(),
  }),
  timestamp: z.string().datetime(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;

// ===== Validation Helper =====

export function validateRequest<T>(schema: z.ZodSchema<T>, data: unknown): { valid: true; data: T } | { valid: false; error: z.ZodError } {
  const result = schema.safeParse(data);

  if (!result.success) {
    return { valid: false, error: result.error };
  }

  return { valid: true, data: result.data };
}
