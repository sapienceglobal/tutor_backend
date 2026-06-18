import { z } from 'zod';

export const createBatchSchema = z.object({
  body: z.object({
    name: z.string({
      required_error: 'Name is required',
    }).min(1, 'Name is required'),
    courseId: z.string({
      required_error: 'Course ID is required',
    }).min(1, 'Course ID is required'),
    startDate: z.string({
      required_error: 'Start date is required',
    }).refine((val) => !isNaN(Date.parse(val)), {
      message: 'Invalid startDate format',
    }),
    endDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid endDate format',
    }),
    tutorId: z.string().optional(),
    scheduleDescription: z.string().optional(),
    grade: z.string().optional(),
    students: z.array(z.string()).optional(),
    instructors: z.array(z.string()).optional(),
  })
});

export const updateBatchSchema = z.object({
  body: z.object({
    name: z.string().optional(),
    courseId: z.string().optional(),
    startDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid startDate format',
    }),
    endDate: z.string().optional().refine((val) => !val || !isNaN(Date.parse(val)), {
      message: 'Invalid endDate format',
    }),
    tutorId: z.string().optional(),
    scheduleDescription: z.string().optional(),
    grade: z.string().optional(),
    students: z.array(z.string()).optional(),
    instructors: z.array(z.string()).optional(),
  })
});
