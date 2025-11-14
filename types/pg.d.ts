declare module "pg" {
  export interface QueryResult<Row = any> {
    rows: Row[];
    rowCount: number;
    command: string;
    oid: number;
    fields: Array<{ name: string }>;
  }

  export interface PoolClient {
    query<Row = any>(text: string, params?: any[]): Promise<QueryResult<Row>>;
    release(): void;
  }

  export interface PoolConfig {
    connectionString?: string;
    max?: number;
  }

  export class Pool {
    constructor(config?: PoolConfig);
    query<Row = any>(text: string, params?: any[]): Promise<QueryResult<Row>>;
    connect(): Promise<PoolClient>;
    end(): Promise<void>;
  }
}
