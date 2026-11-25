import { ApiError } from './errors.js';

export function validateBody(schema) {
  return (req, _res, next) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return next(new ApiError(400, 'Please check the submitted fields.', parsed.error.flatten().fieldErrors));
    req.body = parsed.data;
    next();
  };
}
