export class Database {
  private static instance: Database | undefined;
  private rows: unknown[] = [];

  private constructor() {}

  static getInstance(): Database {
    if (!Database.instance) Database.instance = new Database();
    return Database.instance;
  }

  save(row: unknown): void {
    this.rows.push(row);
  }
}
