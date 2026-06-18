import { z } from 'zod';

export const markAttendanceSchema = z.object({
  body: z.object({
    batchId: z.string({
      required_error: 'Batch ID is required',
    }).min(1, 'Batch ID is required'),
    date: z.string({
      required_error: 'Date is required',
    }).min(1, 'Date is required'),
    records: z.array(
      z.object({
        studentId: z.string({
          required_error: 'Student ID is required',
        }).min(1, 'Student ID is required'),
        status: z.enum(['present', 'absent', 'late', 'excused'], {
          errorMap: () => ({ message: 'Status must be present, absent, late, or excused' })
        }),
        remarks: z.string().optional()
      }),
      {
        required_error: 'Records array is required',
      }
    ).min(1, 'At least one student record is required')
  })
});

export const getBatchAttendanceSchema = z.object({
  params: z.object({
    batchId: z.string({
      required_error: 'Batch ID is required',
    }).min(1, 'Batch ID is required'),
  })
});
