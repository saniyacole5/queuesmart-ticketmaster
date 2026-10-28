import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';

// Aiven: DB_SSL_CA_PATH=./certs/ca.pem; rejectUnauthorized MUST remain true.
// Local/CI MySQL service can omit DB_SSL_CA_PATH when no TLS CA is configured.
// Never omit DB_SSL_CA_PATH for the public Aiven database.
const ssl = process.env.DB_SSL_CA_PATH
  ? { ca: readFileSync(process.env.DB_SSL_CA_PATH), rejectUnauthorized: true }
  : undefined;

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  ...(ssl ? { ssl } : {}),
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 5),
  queueLimit: 0,
});
