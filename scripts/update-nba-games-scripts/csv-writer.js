/**
 * CSV export helper for inspecting data before DB write
 */

import { stringify } from 'csv-stringify/sync';
import { writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';

/**
 * Write rows to a CSV file
 * @param {Array<Object>} rows - Array of row objects
 * @param {string} filepath - Output file path
 * @param {Array<string>} [columns] - Optional column order (if omitted, uses keys from first row)
 */
export function writeToCsv(rows, filepath, columns = null) {
  if (!rows || rows.length === 0) return;

  const cols = columns || Object.keys(rows[0]);
  const csv = stringify(rows, {
    header: true,
    columns: cols,
  });

  mkdirSync(dirname(filepath), { recursive: true });
  writeFileSync(filepath, csv, 'utf8');
}
