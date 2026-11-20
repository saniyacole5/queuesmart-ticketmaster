// Member work area - Reporting API and coverage.
/**
 * @typedef {Object} FinalReport
 * @property {string} generatedAt UTC ISO timestamp
 * @property {Array<{id:number,name:string,email:string,participationCount:number}>} customers
 * @property {Array<{
 *   entryId:number,userId:number,customerName:string,serviceId:number,
 *   serviceName:string,joinedAt:string,endedAt:string|null,
 *   outcome:string,waitMinutes:number|null
 * }>} participations
 * @property {Array<{
 *   id:number,name:string,description:string,isOpen:boolean,expectedDuration:number,
 *   waitingCount:number,participationCount:number,servedVisits:number,
 *   distinctCustomersServed:number,averageWaitMinutes:number|null
 * }>} services
 * @property {{
 *   customerCount:number,participationCount:number,servedVisits:number,
 *   distinctCustomersServed:number,averageWaitMinutes:number|null
 * }} totals
 */
import { fail } from '../shared/errors.js';

/** @returns {Promise<FinalReport>} */
export async function generateReport() {
  // TODO(REPORT-1) Read one consistent MySQL snapshot using withTransaction.
  // Query all role='user' customers from user_credentials + user_profiles,
  // including customers with no history. Never select password or session fields.
  // Query history with customer names and its stored service_name snapshot.
  // Include current services and queues, even when a service has no history.
  //
  // TODO(REPORT-2) Build the object documented above. Example values are in
  // test/fixtures/final-report.example.json. Convert MySQL numeric strings.
  // servedVisits counts outcome='Served'; distinctCustomersServed counts
  // distinct user_id among those visits. averageWaitMinutes averages
  // (ended_at - joined_at) / 60000 for Served records. Use null for no samples.
  // Averages in totals use all served visits, weighted by their visit counts.
  // Return ISO UTC dates. Keep waitingCount separate from servedVisits.
  fail(501, 'REPORT_NOT_IMPLEMENTED', 'Report generation is awaiting implementation.');
}
