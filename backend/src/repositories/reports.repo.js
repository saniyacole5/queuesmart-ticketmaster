// Member work area - Reporting API and coverage.

/**
 * @typedef {Object} FinalReport
 * @property {string} generatedAt UTC ISO timestamp
 * @property {Array<{
*   id:number,name:string,email:string,participationCount:number
* }>} customers
* @property {Array<{
*   entryId:number,userId:number,customerName:string,serviceId:number,
*   serviceName:string,joinedAt:string,endedAt:string|null,
*   outcome:string,waitMinutes:number|null
* }>} participations
* @property {Array<{
*   id:number,name:string,description:string,isOpen:boolean,
*   expectedDuration:number,waitingCount:number,participationCount:number,
*   servedVisits:number,distinctCustomersServed:number,
*   averageWaitMinutes:number|null
* }>} services
* @property {{
*   customerCount:number,participationCount:number,servedVisits:number,
*   distinctCustomersServed:number,averageWaitMinutes:number|null
* }} totals
*/

import { pool } from '../db/pool.js';
import { withTransaction } from '../db/transaction.js';

const iso = value =>
 value == null ? null : new Date(value).toISOString();

const nullableNumber = value =>
 value == null ? null : Number(value);

/** @returns {Promise<FinalReport>} */
export async function generateReport(connectionPool = pool) {
 // MySQL's default REPEATABLE READ keeps these SELECTs
 // on the same snapshot during concurrent queue changes.
 return withTransaction(async connection => {
   const [customerRows] = await connection.execute(`
     SELECT u.id, p.name, u.email,
            COALESCE(h.participation_count, 0) AS participation_count
     FROM user_credentials u
     LEFT JOIN user_profiles p ON p.user_id = u.id
     LEFT JOIN (
       SELECT user_id, COUNT(*) AS participation_count
       FROM history
       GROUP BY user_id
     ) h ON h.user_id = u.id
     WHERE u.role = 'user'
     ORDER BY u.id
   `);

   const [historyRows] = await connection.execute(`
     SELECT h.id, h.user_id, p.name AS customer_name,
            h.service_id, h.service_name,
            h.joined_at, h.ended_at, h.outcome,
            TIMESTAMPDIFF(MICROSECOND, h.joined_at, h.ended_at)
              / 60000000.0 AS wait_minutes
     FROM history h
     LEFT JOIN user_profiles p ON p.user_id = h.user_id
     ORDER BY h.joined_at DESC, h.id DESC
   `);

   // Aggregate history and active queues separately so joins
   // cannot multiply participation counts or served totals.
   const [serviceRows] = await connection.execute(`
     SELECT s.id, s.name, s.description,
            s.is_open, s.expected_duration,
            COALESCE(q.waiting_count, 0) AS waiting_count,
            COALESCE(h.participation_count, 0) AS participation_count,
            COALESCE(h.served_visits, 0) AS served_visits,
            COALESCE(h.distinct_customers_served, 0)
              AS distinct_customers_served,
            h.average_wait_minutes
     FROM services s
     LEFT JOIN (
       SELECT q.service_id, COUNT(*) AS waiting_count
       FROM queues q
       JOIN queue_entries e ON e.queue_id = q.id
       WHERE e.status = 'waiting'
       GROUP BY q.service_id
     ) q ON q.service_id = s.id
     LEFT JOIN (
       SELECT service_id,
              COUNT(*) AS participation_count,
              SUM(outcome = 'Served') AS served_visits,
              COUNT(DISTINCT CASE
                WHEN outcome = 'Served' THEN user_id
              END) AS distinct_customers_served,
              AVG(CASE WHEN outcome = 'Served' THEN
                TIMESTAMPDIFF(MICROSECOND, joined_at, ended_at)
                  / 60000000.0
              END) AS average_wait_minutes
       FROM history
       GROUP BY service_id
     ) h ON h.service_id = s.id
     ORDER BY s.id
   `);

   const customers = customerRows.map(row => ({
     id: Number(row.id),
     name: row.name,
     email: row.email,
     participationCount: Number(row.participation_count),
   }));

   const participations = historyRows.map(row => ({
     entryId: Number(row.id),
     userId: Number(row.user_id),
     customerName: row.customer_name,
     serviceId: Number(row.service_id),
     serviceName: row.service_name,
     joinedAt: iso(row.joined_at),
     endedAt: iso(row.ended_at),
     outcome: row.outcome,
     waitMinutes: nullableNumber(row.wait_minutes),
   }));

   const services = serviceRows.map(row => ({
     id: Number(row.id),
     name: row.name,
     description: row.description,
     isOpen: Number(row.is_open) === 1,
     expectedDuration: Number(row.expected_duration),
     waitingCount: Number(row.waiting_count),
     participationCount: Number(row.participation_count),
     servedVisits: Number(row.served_visits),
     distinctCustomersServed: Number(row.distinct_customers_served),
     averageWaitMinutes: nullableNumber(row.average_wait_minutes),
   }));

   const served = participations.filter(
     row => row.outcome === 'Served',
   );

   const waits = served.filter(
     row => row.waitMinutes !== null,
   );

   return {
     generatedAt: new Date().toISOString(),
     customers,
     participations,
     services,
     totals: {
       customerCount: customers.length,
       participationCount: participations.length,
       servedVisits: served.length,
       distinctCustomersServed: new Set(
         served.map(row => row.userId),
       ).size,
       averageWaitMinutes: waits.length
         ? waits.reduce(
             (sum, row) => sum + row.waitMinutes,
             0,
           ) / waits.length
         : null,
     },
   };
 }, connectionPool);
}