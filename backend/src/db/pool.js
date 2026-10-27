import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';

export const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,

  ssl: {
    ca: readFileSync(process.env.DB_SSL_CA_PATH),
    rejectUnauthorized: true,
  },

  waitForConnections: true,
  connectionLimit: 5,
});