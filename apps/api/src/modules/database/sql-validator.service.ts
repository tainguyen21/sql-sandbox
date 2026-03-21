import { Injectable, BadRequestException } from '@nestjs/common';

/**
 * Validates SQL before execution in sandbox.
 * Blocks dangerous operations that could escape workspace isolation.
 *
 * Note: Uses pattern matching instead of full parser (pgsql-parser)
 * to keep dependencies minimal. Can upgrade to AST-based validation later.
 */

/** Patterns that are blocked in sandbox SQL */
const BLOCKED_PATTERNS: { pattern: RegExp; reason: string }[] = [
  { pattern: /\bDROP\s+SCHEMA\b/i, reason: 'DROP SCHEMA is not allowed' },
  { pattern: /\bCREATE\s+DATABASE\b/i, reason: 'CREATE DATABASE is not allowed' },
  { pattern: /\bDROP\s+DATABASE\b/i, reason: 'DROP DATABASE is not allowed' },
  { pattern: /\bpg_read_file\b/i, reason: 'pg_read_file is not allowed' },
  { pattern: /\bpg_write_file\b/i, reason: 'pg_write_file is not allowed' },
  { pattern: /\bCOPY\s+.*\b(FROM|TO)\s+'/i, reason: 'COPY FROM/TO file paths is not allowed' },
  { pattern: /\bSET\s+ROLE\b/i, reason: 'SET ROLE is not allowed' },
  { pattern: /\bSET\s+SESSION\s+AUTHORIZATION\b/i, reason: 'SET SESSION AUTHORIZATION is not allowed' },
  { pattern: /\bCREATE\s+EXTENSION\b/i, reason: 'CREATE EXTENSION is not allowed' },
  { pattern: /\bALTER\s+SYSTEM\b/i, reason: 'ALTER SYSTEM is not allowed' },
  { pattern: /\bALTER\s+ROLE\b/i, reason: 'ALTER ROLE is not allowed' },
  { pattern: /\bSET\s+search_path\b/i, reason: 'SET search_path is not allowed (managed by system)' },
  { pattern: /\bCREATE\s+SCHEMA\b/i, reason: 'CREATE SCHEMA is not allowed (managed by system)' },
  { pattern: /\bDO\s+\$\$/i, reason: 'Anonymous PL/pgSQL blocks are not allowed' },
  { pattern: /\bCREATE\s+(OR\s+REPLACE\s+)?FUNCTION\b/i, reason: 'CREATE FUNCTION is not allowed' },
  { pattern: /\bCREATE\s+(OR\s+REPLACE\s+)?PROCEDURE\b/i, reason: 'CREATE PROCEDURE is not allowed' },
  { pattern: /\bCREATE\s+(OR\s+REPLACE\s+)?TRIGGER\b/i, reason: 'CREATE TRIGGER is not allowed' },
  { pattern: /\bGRANT\b/i, reason: 'GRANT is not allowed' },
  { pattern: /\bREVOKE\b/i, reason: 'REVOKE is not allowed' },
  { pattern: /\bLOAD\s+'/i, reason: 'LOAD is not allowed' },
  { pattern: /\bCREATE\s+(OR\s+REPLACE\s+)?RULE\b/i, reason: 'CREATE RULE is not allowed' },
];

@Injectable()
export class SqlValidatorService {
  /**
   * Validate SQL against blocklist.
   * Throws BadRequestException if blocked pattern found.
   */
  validate(sql: string): void {
    const trimmed = sql.trim();

    if (!trimmed) {
      throw new BadRequestException('SQL cannot be empty');
    }

    for (const { pattern, reason } of BLOCKED_PATTERNS) {
      if (pattern.test(trimmed)) {
        throw new BadRequestException(`Blocked SQL: ${reason}`);
      }
    }
  }

  /** Check if SQL is a DDL statement (CREATE, ALTER, DROP) */
  isDDL(sql: string): boolean {
    return /^\s*(CREATE|ALTER|DROP)\s/i.test(sql.trim());
  }

  /** Check if SQL is a DML write (INSERT, UPDATE, DELETE) */
  isDMLWrite(sql: string): boolean {
    return /^\s*(INSERT|UPDATE|DELETE)\s/i.test(sql.trim());
  }
}
