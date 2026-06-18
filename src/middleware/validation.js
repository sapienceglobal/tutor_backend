import { ZodError } from 'zod';

/**
 * Reusable validation middleware that validates incoming request parts
 * (body, query, params) against a Zod schema.
 * 
 * Supports two schema structures:
 * 1. A combined schema specifying shapes for body/query/params:
 *    z.object({ body: z.object({...}), query: z.object({...}) })
 * 2. A simple schema that directly represents the body:
 *    z.object({ field1: z.string(), ... })
 */
export const validate = (schema) => async (req, res, next) => {
  try {
    const dataToValidate = {};
    const hasKeys = schema.shape && (schema.shape.body || schema.shape.query || schema.shape.params);

    if (hasKeys) {
      if (schema.shape.body) dataToValidate.body = req.body;
      if (schema.shape.query) dataToValidate.query = req.query;
      if (schema.shape.params) dataToValidate.params = req.params;

      const parsed = await schema.parseAsync(dataToValidate);
      if (schema.shape.body) req.body = parsed.body;
      if (schema.shape.query) req.query = parsed.query;
      if (schema.shape.params) req.params = parsed.params;
    } else {
      req.body = await schema.parseAsync(req.body);
    }

    return next();
  } catch (error) {
    if (error instanceof ZodError) {
      const errors = error.errors.map(err => ({
        field: err.path.join('.').replace(/^(body|query|params)\./, ''),
        message: err.message
      }));

      return res.status(400).json({
        success: false,
        message: errors[0]?.message || 'Validation error',
        errors
      });
    }

    console.error('Validation middleware unexpected error:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Internal validation server error' 
    });
  }
};
