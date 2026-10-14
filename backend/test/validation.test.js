// MEMBER 1 + MEMBER 2: extend boundary cases as described in TEAM_PLAN.
import test from 'node:test';
import assert from 'node:assert/strict';
import * as v from '../src/shared/validation.js';
const invalid = fn => assert.throws(fn, e => e.status === 400 && e.code === 'VALIDATION_ERROR');
test('object validation rejects null, arrays, scalars and unknown keys', () => {
  for (const input of [null, [], true, 4, 'x', { role: 'admin' }]) invalid(() => v.object(input, ['name']));
  assert.deepEqual(v.object({ name: 'x' }, ['name']), { name: 'x' });
});
test('strings enforce type, required values, length and optional trimming', () => {
  for (const name of [undefined, null, 8, false, '', ' ', 'abcd']) invalid(() => v.text({ name }, 'name', 1, 3));
  assert.equal(v.text({ name: ' ab ' }, 'name', 1, 3), 'ab');
  assert.equal(v.text({ password: ' a ' }, 'password', 1, 3, false), ' a ');
});
test('email syntax and canonicalization', () => {
  for (const email of ['x', 'a@', 'a b@c.com', 'x'.repeat(255)]) invalid(() => v.email({ email }));
  assert.equal(v.email({ email: ' TEST@Example.COM ' }), 'test@example.com');
});
test('numeric types, whole numbers, bounded duration', () => {
  for (const n of [null, '12', true, 1.5, 0, 481, NaN]) invalid(() => v.integer({ n }, 'n', 1, 480));
  for (const n of [1, 480]) assert.equal(v.integer({ n }, 'n', 1, 480), n);
});
test('enum, boolean and path ID rules', () => {
  invalid(() => v.choice({ p: 'urgent' }, 'p', ['low']));
  assert.equal(v.choice({ p: 'low' }, 'p', ['low']), 'low');
  for (const b of ['true', 1, null]) invalid(() => v.boolean({ b }, 'b'));
  assert.equal(v.boolean({ b: false }, 'b'), false);
  for (const value of ['0', '-1', '1.5', '01', '1abc', '9999999999999999', 1]) invalid(() => v.id(value));
  assert.equal(v.id('123'), 123);
});
