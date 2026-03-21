import { Injectable, BadRequestException } from '@nestjs/common';
import { SandboxPoolService } from '../database/sandbox-pool.service';
import { WorkspaceService } from '../workspace/workspace.service';

/** Inferred column type from CSV sampling */
type InferredType = 'integer' | 'numeric' | 'boolean' | 'timestamptz' | 'text';

/** Result of CSV import */
export interface ImportResult {
  tableName: string;
  rowsInserted: number;
  columns: Array<{ name: string; type: InferredType }>;
}

/**
 * Parses a single CSV line respecting double-quoted fields.
 * Handles embedded commas and escaped quotes ("").
 */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/** Infer a column type from a sample of string values */
function inferType(samples: string[]): InferredType {
  const nonEmpty = samples.filter((s) => s.trim() !== '' && s.toLowerCase() !== 'null');
  if (nonEmpty.length === 0) return 'text';

  const isBoolean = nonEmpty.every((v) => /^(true|false|yes|no|0|1)$/i.test(v.trim()));
  if (isBoolean) return 'boolean';

  const isInteger = nonEmpty.every((v) => /^-?\d+$/.test(v.trim()));
  if (isInteger) return 'integer';

  const isNumeric = nonEmpty.every((v) => /^-?\d+(\.\d+)?([eE][+-]?\d+)?$/.test(v.trim()));
  if (isNumeric) return 'numeric';

  // ISO 8601 date/datetime heuristic
  const isDate = nonEmpty.every((v) =>
    /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/.test(v.trim()),
  );
  if (isDate) return 'timestamptz';

  return 'text';
}

/** Sanitize a CSV header to a valid PG identifier */
function sanitizeColumnName(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '_')
    .replace(/^(\d)/, '_$1')
    .slice(0, 63) || 'col';
}

/** Escape identifier */
function esc(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

@Injectable()
export class ImportExportService {
  constructor(
    private sandbox: SandboxPoolService,
    private workspaceService: WorkspaceService,
  ) {}

  /**
   * Import CSV buffer into a new table in the workspace schema.
   * Infers column types from first 100 data rows.
   */
  async importCsv(workspaceId: string, tableName: string, csvBuffer: Buffer): Promise<ImportResult> {
    const workspace = await this.workspaceService.findOne(workspaceId);
    const schema = workspace.schemaName;

    const content = csvBuffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 2) {
      throw new BadRequestException('CSV must have at least a header row and one data row');
    }

    const headers = parseCsvLine(lines[0]).map(sanitizeColumnName);
    if (headers.length === 0) {
      throw new BadRequestException('CSV header row is empty');
    }

    // Ensure unique column names
    const uniqueHeaders = headers.map((h, i) => {
      const count = headers.slice(0, i).filter((x) => x === h).length;
      return count > 0 ? `${h}_${count}` : h;
    });

    // Sample first 100 data rows for type inference
    const dataRows = lines.slice(1).map(parseCsvLine);
    const sampleRows = dataRows.slice(0, 100);

    const columnTypes: InferredType[] = uniqueHeaders.map((_, colIdx) => {
      const samples = sampleRows.map((row) => row[colIdx] ?? '');
      return inferType(samples);
    });

    const columns = uniqueHeaders.map((name, i) => ({ name, type: columnTypes[i] }));

    // Build CREATE TABLE SQL
    const colDefs = columns
      .map((c) => `${esc(c.name)} ${c.type}`)
      .join(', ');
    const safeTable = tableName.replace(/[^a-z0-9_]/gi, '_').slice(0, 63) || 'imported_table';

    await this.sandbox.executeInWorkspace(
      schema,
      `CREATE TABLE IF NOT EXISTS ${esc(safeTable)} (${colDefs})`,
    );

    // Insert data in batches of 500
    const BATCH_SIZE = 500;
    let rowsInserted = 0;

    for (let i = 0; i < dataRows.length; i += BATCH_SIZE) {
      const batch = dataRows.slice(i, i + BATCH_SIZE);
      if (batch.length === 0) continue;

      const valuePlaceholders: string[] = [];
      const params: any[] = [];
      let paramIdx = 1;

      for (const row of batch) {
        const rowPlaceholders = columns.map((col, colIdx) => {
          const raw = (row[colIdx] ?? '').trim();
          if (raw === '' || raw.toLowerCase() === 'null') {
            params.push(null);
          } else if (col.type === 'boolean') {
            params.push(/^(true|yes|1)$/i.test(raw));
          } else if (col.type === 'integer') {
            params.push(parseInt(raw, 10));
          } else if (col.type === 'numeric') {
            params.push(parseFloat(raw));
          } else {
            params.push(raw);
          }
          return `$${paramIdx++}`;
        });
        valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
      }

      const insertSql = `INSERT INTO ${esc(safeTable)} (${columns.map((c) => esc(c.name)).join(', ')}) VALUES ${valuePlaceholders.join(', ')}`;
      await this.sandbox.executeInWorkspace(schema, insertSql, params);
      rowsInserted += batch.length;
    }

    return { tableName: safeTable, rowsInserted, columns };
  }

  /**
   * Export a table as CSV string.
   * Returns CSV content with headers.
   */
  async exportTableCsv(workspaceId: string, tableName: string): Promise<string> {
    const workspace = await this.workspaceService.findOne(workspaceId);
    const schema = workspace.schemaName;

    const safeTable = tableName.replace(/[^a-z0-9_]/gi, '_').slice(0, 63);

    // Get column names
    const { rows: colRows } = await this.sandbox.executeInWorkspace(
      schema,
      `SELECT column_name FROM information_schema.columns
       WHERE table_schema = current_schema() AND table_name = $1
       ORDER BY ordinal_position`,
      [safeTable],
    );

    if (colRows.length === 0) {
      throw new BadRequestException(`Table "${tableName}" not found`);
    }

    const colNames = colRows.map((r: any) => r.column_name as string);

    // Fetch all rows
    const { rows } = await this.sandbox.executeInWorkspace(
      schema,
      `SELECT ${colNames.map(esc).join(', ')} FROM ${esc(safeTable)}`,
    );

    // Build CSV
    const csvLines: string[] = [colNames.map(quoteCsvField).join(',')];
    for (const row of rows) {
      csvLines.push(colNames.map((col) => quoteCsvField(row[col])).join(','));
    }

    return csvLines.join('\n');
  }

  /**
   * Export all tables in workspace as SQL dump (CREATE TABLE + INSERTs).
   */
  async exportWorkspaceSql(workspaceId: string): Promise<string> {
    const workspace = await this.workspaceService.findOne(workspaceId);
    const schema = workspace.schemaName;

    // Get all user tables in schema
    const { rows: tableRows } = await this.sandbox.executeInWorkspace(
      schema,
      `SELECT tablename FROM pg_tables WHERE schemaname = current_schema() ORDER BY tablename`,
    );

    const parts: string[] = [
      `-- SQL Export for workspace: ${workspace.name}`,
      `-- Schema: ${schema}`,
      `-- Generated: ${new Date().toISOString()}`,
      '',
    ];

    for (const { tablename } of tableRows) {
      // Get column definitions
      const { rows: cols } = await this.sandbox.executeInWorkspace(
        schema,
        `SELECT
           column_name,
           data_type,
           character_maximum_length,
           is_nullable,
           column_default
         FROM information_schema.columns
         WHERE table_schema = current_schema() AND table_name = $1
         ORDER BY ordinal_position`,
        [tablename],
      );

      const colDefs = cols.map((c: any) => {
        let typeDef = c.data_type;
        if (c.character_maximum_length) typeDef += `(${c.character_maximum_length})`;
        const nullable = c.is_nullable === 'NO' ? ' NOT NULL' : '';
        const defaultVal = c.column_default ? ` DEFAULT ${c.column_default}` : '';
        return `  ${esc(c.column_name)} ${typeDef}${nullable}${defaultVal}`;
      });

      parts.push(`CREATE TABLE IF NOT EXISTS ${esc(tablename)} (`);
      parts.push(colDefs.join(',\n'));
      parts.push(');');
      parts.push('');

      // Get all rows for INSERT statements
      const colNames = cols.map((c: any) => c.column_name as string);
      const { rows: dataRows } = await this.sandbox.executeInWorkspace(
        schema,
        `SELECT ${colNames.map(esc).join(', ')} FROM ${esc(tablename)}`,
      );

      if (dataRows.length > 0) {
        for (const row of dataRows) {
          const values = colNames.map((col) => {
            const val = row[col];
            if (val === null || val === undefined) return 'NULL';
            if (typeof val === 'number' || typeof val === 'boolean') return String(val);
            return `'${String(val).replace(/'/g, "''")}'`;
          });
          parts.push(
            `INSERT INTO ${esc(tablename)} (${colNames.map(esc).join(', ')}) VALUES (${values.join(', ')});`,
          );
        }
        parts.push('');
      }
    }

    return parts.join('\n');
  }

  /**
   * Return inferred schema preview from a CSV buffer without inserting.
   */
  previewCsvSchema(csvBuffer: Buffer): Array<{ name: string; type: InferredType }> {
    const content = csvBuffer.toString('utf-8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim() !== '');
    if (lines.length < 1) return [];

    const headers = parseCsvLine(lines[0]).map(sanitizeColumnName);
    const dataRows = lines.slice(1, 101).map(parseCsvLine);

    return headers.map((name, i) => {
      const samples = dataRows.map((row) => row[i] ?? '');
      return { name, type: inferType(samples) };
    });
  }
}

/** Wrap a CSV field value in quotes if it contains commas, quotes, or newlines */
function quoteCsvField(value: any): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
