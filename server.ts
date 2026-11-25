import * as http from "node:http"
import { createRequestListener } from "remix/node-fetch-server"

import { auth } from "./app/lib/auth.ts"
import { initDb, purgeStale } from "./app/lib/db.ts"
import { resumeRuns } from "./app/lib/runner.ts"
import { assets } from "./app/assets.ts"
import { router } from "./app/router.ts"

const port = Number.parseInt(process.env.PORT ?? "", 10) || 5173
const PURGE_EVERY_MS = 60 * 60 * 1000

const purge = () => purgeStale().catch((error) => console.error("[purge] failed:", error))

// Postgres can lag behind the web service on cold starts; retry init so auth
// and runs recover without a manual restart.
async function boot() {
  for (let attempt = 1; attempt <= 10; attempt++) {
    try {
      await initDb()
      await purge()
      await resumeRuns()
      return
    } catch (error) {
      console.error(`[boot] init attempt ${attempt} failed:`, error)
      await new Promise((r) => setTimeout(r, 5000))
    }
  }
  console.error("[boot] giving up on database init; auth and runs will fail until restart")
}
void boot()
setInterval(purge, PURGE_EVERY_MS).unref()

const server = http.createServer(
  createRequestListener(async (request) => {
    if (new URL(request.url).pathname.startsWith("/api/auth/")) {
      return auth.handler(request)
    }
    return router.fetch(request)
  }),
)

server.on("error", (error) => {
  console.error(error)
  process.exit(1)
})

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`)
})

let shuttingDown = false

function shutdown() {
  if (shuttingDown) return
  shuttingDown = true
  // server.close() stops accepting and drops idle connections; give requests in flight a moment to finish,
  // then cut whatever is left. Don't hang forever on stuck connections.
  setTimeout(() => server.closeAllConnections(), 8_000).unref()
  setTimeout(() => process.exit(1), 10_000).unref()
  server.close(() => assets.close().finally(() => process.exit(0)))
}

process.on("SIGINT", shutdown)
process.on("SIGTERM", shutdown)
