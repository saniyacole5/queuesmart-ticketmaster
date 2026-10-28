import { readFileSync } from 'node:fs';

// Strictly for reviewed SQL files bundled with this repository.
// Not a general-purpose SQL parser: scripts must not contain procedures,
// triggers, semicolons inside strings, or a DELIMITER directive.
export function statementsFromFile(path) {
  const sql = readFileSync(path, 'utf8');
  return sql.split(/;\s*(?:\r?\n|$)/).map((statement) => statement.trim()).filter(Boolean);
}
