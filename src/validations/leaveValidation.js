import { z } from 'zod';

export const applyLeaveSchema = z.object({
  body: z.object({
    startDate: z.string({
      required_error: 'Start date is required',
    }).min(1, 'Start date is required'),
    endDate: z.string({
      required_error: 'End date is required',
    }).min(1, 'End date is required'),
    reason: z.string({
      required_error: 'Reason is required',
    }).min(1, 'Reason is required'),
    documents: z.array(z.string()).optional(),
    substituteId: z.string().nullable().optional()
  })
});

export const updateLeaveStatusSchema = z.object({
  body: z.object({
    status: z.enum(['approved', 'rejected', 'pending'], {
      errorMap: () => ({ message: 'Invalid status. Status must be approved, rejected, or pending.' })
    }),
    adminComment: z.string().optional()
  })
});
