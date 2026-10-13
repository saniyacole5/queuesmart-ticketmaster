import { fail } from './errors.js';
export function object(body, allowed) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) fail(400, 'VALIDATION_ERROR', 'A JSON object is required.');
  const unknown = Object.keys(body).filter(key => !allowed.includes(key));
  if (unknown.length) fail(400, 'VALIDATION_ERROR', 'Unknown fields.', Object.fromEntries(unknown.map(k => [k, 'Not allowed.'])));
  return body;
}
function invalid(key, message) { fail(400, 'VALIDATION_ERROR', 'Invalid input.', { [key]: message }); }
export function text(body, key, min, max, trim = true) {
  if (typeof body[key] !== 'string') invalid(key, 'Must be a string.');
  const value = trim ? body[key].trim() : body[key];
  if (value.length < min || value.length > max) invalid(key, `Length must be ${min}-${max}.`);
  return value;
}
export function choice(body, key, values) {
  if (!values.includes(body[key])) invalid(key, `Choose ${values.join(', ')}.`);
  return body[key];
}
export function integer(body, key, min, max) {
  const value = body[key];
  if (!Number.isInteger(value) || value < min || value > max) invalid(key, `Must be a whole number ${min}-${max}.`);
  return value;
}
export function boolean(body, key) {
  if (typeof body[key] !== 'boolean') invalid(key, 'Must be a boolean.');
  return body[key];
}
export function id(value) {
  if (typeof value !== 'string' || !/^[1-9]\d{0,14}$/.test(value)) invalid('id', 'Must be a positive integer ID.');
  const result = Number(value);
  if (!Number.isSafeInteger(result)) invalid('id', 'ID out of range.');
  return result;
}
export function email(body) {
  const value = text(body, 'email', 3, 254).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) invalid('email', 'Enter a valid email address.');
  return value;
}
