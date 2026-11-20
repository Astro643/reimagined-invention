import { get, route } from "remix/routes"

export const routes = route({
  assets: get("/assets/*path"),
  agentPreview: "/api/controller/agent/preview",
  agentExecute: "/api/controller/agent/execute",
  agentStatus: get("/api/controller/agent/status/:id"),
  agentCancel: "/api/controller/agent/cancel/:id",
  agentApprove: "/api/controller/agent/approve/:id",
  preview: "/api/preview",
  execute: "/api/execute",
  publicStatus: get("/api/public/status"),
  supportChat: "/api/support/chat",
  home: "/",
  privacy: "/privacy",
  terms: "/terms",
  docs: "/docs",
  about: "/about",
  notFound: get("/*path"),
})
