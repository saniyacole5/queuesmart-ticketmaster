import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { publicUserRow, serviceRow, historyRow, notificationRow } from '../src/db/mappers.js';
import { statementsFromFile } from '../scripts/sql-runner.js';

const schema = readFileSync(new URL('../sql/001_schema.sql', import.meta.url), 'utf8');
const tables = ['user_credentials','user_profiles','auth_sessions','services','queues',
  'queue_entries','history','notifications'];

test('A4 schema uses queuesmart_db and declares all eight required/extension tables', () => {
  assert.match(schema, /USE\s+queuesmart_db\s*;/i);
  for (const name of tables) assert.match(schema, new RegExp(`CREATE TABLE IF NOT EXISTS ${name} \\(`, 'i'));
  assert.equal(statementsFromFile(new URL('../sql/001_schema.sql', import.meta.url)).length, 9);
});

test('A4 schema defines primary/foreign keys and active user uniqueness', () => {
  assert.ok((schema.match(/PRIMARY KEY/g) || []).length >= tables.length);
  assert.ok((schema.match(/FOREIGN KEY/g) || []).length >= 8);
  assert.match(schema, /active_user_id.*?GENERATED ALWAYS AS/s);
  assert.match(schema, /UNIQUE KEY uq_queue_entries_active_user/);
  assert.match(schema, /UNIQUE KEY uq_notifications_event_once/);
});

test('mapper produces public user without credential materials', () => {
  assert.deepEqual(publicUserRow({ id: 101n, name: 'Jordan', email: 'j@example.com',
    role: 'user', password_salt: 'secret', password_digest: 'secret' }),
  { id: 101, name: 'Jordan', email: 'j@example.com', role: 'user' });
});

test('mapper converts service columns to API shape', () => {
  assert.deepEqual(serviceRow({ id: 2, name: 'Tickets', description: 'Queue',
    expected_duration: 12, priority: 'high', is_open: 0 }),
  { id: 2, name: 'Tickets', description: 'Queue', expectedDuration: 12,
    priority: 'high', isOpen: false });
});

test('mapper preserves history and notification timestamps and user scope', () => {
  const date = new Date('2026-10-27T12:00:00.000Z');
  const h = historyRow({ id: 1n, user_id: 2n, service_id: 3n, service_name: 'Concert',
    joined_at: date, ended_at: null, outcome: 'Waiting' });
  assert.equal(h.joinedAt, date.toISOString());
  assert.equal(h.serviceName, 'Concert');
  assert.equal(h.endedAt, null);
  const n = notificationRow({ id: 5, user_id: 2, entry_id: 1, event: 'joined',
    message: 'Welcome', type: 'info', is_read: 0, created_at: date });
  assert.equal(n.read, false);
  assert.equal(n.createdAt, date.toISOString());
});
