import { Client, type QueryResultRow } from "pg";

export type DatabaseResult<T = Record<string, unknown>> = {
  results: T[];
  success: boolean;
  meta: { changes: number };
};

export interface PreparedStatement {
  readonly sql: string;
  readonly values: unknown[];
  bind(...values: unknown[]): PreparedStatement;
  run<T = Record<string, unknown>>(): Promise<DatabaseResult<T>>;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<DatabaseResult<T>>;
}

export interface Database {
  prepare(sql: string): PreparedStatement;
  batch<T = Record<string, unknown>>(statements: PreparedStatement[]): Promise<DatabaseResult<T>[]>;
}

type RuntimeEnv = {
  DB?: D1Database;
  HYPERDRIVE?: Hyperdrive;
  DATABASE_URL?: string;
};

class D1StatementAdapter implements PreparedStatement {
  private readonly statement: D1PreparedStatement;
  readonly sql: string;
  readonly values: unknown[];

  constructor(statement: D1PreparedStatement, sql: string, values: unknown[] = []) {
    this.statement = statement;
    this.sql = sql;
    this.values = values;
  }

  bind(...values: unknown[]): PreparedStatement {
    return new D1StatementAdapter(this.statement.bind(...values), this.sql, values);
  }

  async run<T>(): Promise<DatabaseResult<T>> {
    const result = await this.statement.run<T>();
    return result as unknown as DatabaseResult<T>;
  }

  first<T>(column?: string): Promise<T | null> {
    return column ? this.statement.first<T>(column) : this.statement.first<T>();
  }

  async all<T>(): Promise<DatabaseResult<T>> {
    const result = await this.statement.all<T>();
    return result as unknown as DatabaseResult<T>;
  }

  get d1(): D1PreparedStatement {
    return this.statement;
  }
}

class D1DatabaseAdapter implements Database {
  private readonly database: D1Database;

  constructor(database: D1Database) {
    this.database = database;
  }

  prepare(sql: string): PreparedStatement {
    return new D1StatementAdapter(this.database.prepare(sql), sql);
  }

  async batch<T>(statements: PreparedStatement[]): Promise<DatabaseResult<T>[]> {
    const prepared = statements.map((statement) => {
      if (!(statement instanceof D1StatementAdapter)) throw new Error("Cannot mix database drivers in a batch.");
      return statement.d1;
    });
    return await this.database.batch<T>(prepared) as unknown as DatabaseResult<T>[];
  }
}

class PostgresStatement implements PreparedStatement {
  private readonly connectionString: string;
  readonly sql: string;
  readonly values: unknown[];

  constructor(connectionString: string, sql: string, values: unknown[] = []) {
    this.connectionString = connectionString;
    this.sql = sql;
    this.values = values;
  }

  bind(...values: unknown[]): PreparedStatement {
    return new PostgresStatement(this.connectionString, this.sql, values);
  }

  async run<T>(): Promise<DatabaseResult<T>> {
    return withClient(this.connectionString, async (client) => execute<T>(client, this));
  }

  async first<T>(column?: string): Promise<T | null> {
    const result = await this.all<T>();
    const row = result.results[0];
    if (!row) return null;
    return column ? ((row as Record<string, unknown>)[column] as T ?? null) : row;
  }

  async all<T>(): Promise<DatabaseResult<T>> {
    return withClient(this.connectionString, async (client) => execute<T>(client, this));
  }
}

class PostgresDatabase implements Database {
  private readonly connectionString: string;

  constructor(connectionString: string) {
    this.connectionString = connectionString;
  }

  prepare(sql: string): PreparedStatement {
    return new PostgresStatement(this.connectionString, sql);
  }

  async batch<T>(statements: PreparedStatement[]): Promise<DatabaseResult<T>[]> {
    return withClient(this.connectionString, async (client) => {
      await client.query("BEGIN");
      try {
        const results: DatabaseResult<T>[] = [];
        for (const statement of statements) {
          if (!(statement instanceof PostgresStatement)) throw new Error("Cannot mix database drivers in a batch.");
          results.push(await execute<T>(client, statement));
        }
        await client.query("COMMIT");
        return results;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      }
    });
  }
}

export async function getDatabase(message = "Database storage is unavailable."): Promise<Database> {
  const { env } = await import("cloudflare:workers") as { env: RuntimeEnv };
  const connectionString = env.HYPERDRIVE?.connectionString || env.DATABASE_URL;
  if (connectionString) return new PostgresDatabase(connectionString);
  if (env.DB) return new D1DatabaseAdapter(env.DB);
  throw new Error(message);
}

export async function databaseHealthcheck(): Promise<boolean> {
  try {
    return Boolean(await (await getDatabase()).prepare("SELECT 1 AS ok").first());
  } catch {
    return false;
  }
}

async function withClient<T>(connectionString: string, operation: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    return await operation(client);
  } finally {
    await client.end();
  }
}

async function execute<T>(client: Client, statement: PostgresStatement): Promise<DatabaseResult<T>> {
  const sql = translateSql(statement.sql);
  const result = await client.query<QueryResultRow>(sql, statement.values);
  const rows = result.rows.map(normaliseRow) as T[];
  return {
    results: rows,
    success: true,
    meta: { changes: result.rowCount ?? 0 },
  };
}

function normaliseRow(row: QueryResultRow): Record<string, unknown> {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString().replace("T", " ").replace("Z", "") : value]));
}

export function translateSql(source: string): string {
  let sql = source;
  sql = sql.replace(/SELECT name FROM sqlite_master WHERE type='table'/gi, "SELECT table_name AS name FROM information_schema.tables WHERE table_schema='public'");
  sql = sql.replace(/INSERT\s+OR\s+IGNORE\s+INTO/gi, "INSERT INTO");
  if (/INSERT\s+INTO/i.test(sql) && /\bOR\s+IGNORE\b/i.test(source) && !/ON\s+CONFLICT/i.test(sql)) sql += " ON CONFLICT DO NOTHING";
  sql = sql.replace(/datetime\(\s*'now'\s*,\s*'start of month'\s*\)/gi, "date_trunc('month', CURRENT_TIMESTAMP)");
  sql = sql.replace(/datetime\(\s*'now'\s*,\s*'([+-]\d+\s+(?:second|minute|hour|day|month|year)s?)'\s*\)/gi, "(CURRENT_TIMESTAMP + INTERVAL '$1')");
  sql = sql.replace(/datetime\(\s*'now'\s*,\s*\?\s*\|\|\s*' days'\s*\)/gi, "(CURRENT_TIMESTAMP + (? || ' days')::interval)");
  sql = sql.replace(/datetime\(\s*'now'\s*,\s*\?\s*\)/gi, "(CURRENT_TIMESTAMP + ?::interval)");
  sql = sql.replace(/date\(\s*'now'\s*\)/gi, "CURRENT_DATE");
  sql = sql.replace(/date\(\s*valid_until\s*\)/gi, "CAST(valid_until AS DATE)");
  sql = sql.replace(/strftime\(\s*'%Y-%m'\s*,\s*created_at\s*\)/gi, "to_char(created_at, 'YYYY-MM')");
  sql = sql.replace(/strftime\(\s*'%Y-%m'\s*,\s*'now'\s*\)/gi, "to_char(CURRENT_TIMESTAMP, 'YYYY-MM')");
  sql = sql.replace(/lower\(hex\(randomblob\(16\)\)\)/gi, "md5(random()::text || clock_timestamp()::text)");
  sql = sql.replace(/json_object\(\s*'validUntil'\s*,\s*valid_until\s*\)/gi, "json_build_object('validUntil', valid_until)::text");
  sql = translateCreateTable(sql);
  return translatePlaceholders(sql);
}

function translateCreateTable(source: string): string {
  if (!/^\s*CREATE\s+TABLE/i.test(source)) return source;
  return source
    .replace(/\bINTEGER\s+PRIMARY\s+KEY\s+AUTOINCREMENT\b/gi, "BIGSERIAL PRIMARY KEY")
    .replace(/\bBLOB\b/gi, "BYTEA")
    .replace(/\bREAL\b/gi, "DOUBLE PRECISION")
    .replace(/\b([a-z_]*(?:_at|_after|_until|_from|_end|_started))\s+TEXT\b/gi, "$1 TIMESTAMPTZ");
}

function translatePlaceholders(source: string): string {
  let index = 0;
  let quote: "'" | '"' | null = null;
  let result = "";
  for (let cursor = 0; cursor < source.length; cursor += 1) {
    const character = source[cursor];
    if (quote) {
      result += character;
      if (character === quote) {
        if (source[cursor + 1] === quote) {
          result += source[cursor + 1];
          cursor += 1;
        } else quote = null;
      }
      continue;
    }
    if (character === "'" || character === '"') {
      quote = character;
      result += character;
    } else if (character === "?") {
      index += 1;
      result += `$${index}`;
    } else result += character;
  }
  return result;
}
