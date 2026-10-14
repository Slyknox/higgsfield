/** Applies db/migrations/*.sql once each, in name order. */
export function migrate(connectionString: string, log?: (message: string) => void): Promise<void>
