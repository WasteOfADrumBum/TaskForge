// A 24-character hex string, the only id format MongoDB ObjectIds use in this API.
// (mongoose.isValidObjectId also accepts any 12-character string, which is too loose for
// validating ids that come from request input.)
export const isObjectIdString = (value: unknown): value is string =>
  typeof value === 'string' && /^[a-f\d]{24}$/i.test(value);
