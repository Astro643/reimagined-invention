// Vercel Serverless Function: Remix App Handler
// Wraps the Remix router for Vercel deployment

import { router } from "../app/router.ts"

export default async function handler(request: Request): Promise<Response> {
  return router.fetch(request)
}
