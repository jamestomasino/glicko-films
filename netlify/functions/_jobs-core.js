module.exports = {
  enqueueJob,
  getRecentJobs,
  processQueuedJobs,
  markJobRunning,
  markJobFinished,
  markJobFailed
}

async function enqueueJob (sql, { type, payload = {}, runAfter = null }) {
  const rows = await sql.query(
    `insert into admin_jobs (type, status, payload, run_after, created_at, updated_at)
     values ($1, 'queued', $2::jsonb, coalesce($3, now()), now(), now())
     returning *`,
    [type, JSON.stringify(payload), runAfter]
  )
  return rows[0]
}

async function getRecentJobs (sql, limit = 20) {
  return sql.query(
    `select *
     from admin_jobs
     order by id desc
     limit $1`,
    [Math.max(1, Math.min(100, Number(limit) || 20))]
  )
}

async function processQueuedJobs (sql, { handlers, limit = 1 }) {
  const processed = []

  for (let i = 0; i < limit; i += 1) {
    const [job] = await sql.query(
      `select *
       from admin_jobs
       where status = 'queued' and run_after <= now()
       order by id asc
       limit 1`
    )
    if (!job) break

    const claimed = await markJobRunning(sql, job.id)
    if (!claimed) continue

    const current = claimed
    const handler = handlers[current.type]
    if (!handler) {
      await markJobFailed(sql, current.id, new Error(`No handler for job type ${current.type}`))
      processed.push({ id: current.id, status: 'failed', type: current.type })
      continue
    }

    try {
      const payload = parseJson(current.payload, {})
      const result = await handler({ job: current, payload })
      await markJobFinished(sql, current.id, result)
      processed.push({ id: current.id, status: 'succeeded', type: current.type, result })
    } catch (error) {
      await markJobFailed(sql, current.id, error)
      processed.push({
        id: current.id,
        status: 'failed',
        type: current.type,
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  return processed
}

async function markJobRunning (sql, jobId) {
  const rows = await sql.query(
    `update admin_jobs
     set
      status = 'running',
      started_at = now(),
      attempts = attempts + 1,
      updated_at = now()
     where id = $1 and status = 'queued'
     returning *`,
    [jobId]
  )
  return rows[0] || null
}

async function markJobFinished (sql, jobId, result) {
  await sql.query(
    `update admin_jobs
     set
      status = 'succeeded',
      result = $2::jsonb,
      error = null,
      finished_at = now(),
      updated_at = now()
     where id = $1`,
    [jobId, JSON.stringify(result || {})]
  )
}

async function markJobFailed (sql, jobId, error) {
  const message = error instanceof Error ? error.message : String(error)
  await sql.query(
    `update admin_jobs
     set
      status = 'failed',
      error = $2,
      finished_at = now(),
      updated_at = now()
     where id = $1`,
    [jobId, message]
  )
}

function parseJson (value, fallback) {
  if (!value) return fallback
  if (typeof value === 'object') return value
  try {
    return JSON.parse(String(value))
  } catch {
    return fallback
  }
}
