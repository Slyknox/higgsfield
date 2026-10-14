// Fixed-window rate limit stored in Postgres (table rate_limits). One atomic
// upsert per hit, so concurrent requests can't both slip under the limit.

export type Queryable = {
  query: <R extends Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ) => Promise<{ rows: R[] }>
}

export type RateLimitResult = { allowed: boolean; count: number; limit: number }

export async function hitRateLimit(
  db: Queryable,
  key: string,
  limit: number,
  windowSeconds: number
): Promise<RateLimitResult> {
  const { rows } = await db.query<{ count: number }>(
    `insert into rate_limits (key, count, window_start)
     values ($1, 1, now())
     on conflict (key) do update set
       count = case when rate_limits.window_start < now() - make_interval(secs => $2)
                    then 1 else rate_limits.count + 1 end,
       window_start = case when rate_limits.window_start < now() - make_interval(secs => $2)
                           then now() else rate_limits.window_start end
     returning count`,
    [key, windowSeconds]
  )
  const count = Number(rows[0]?.count ?? 0)
  return { allowed: count <= limit, count, limit }
}
