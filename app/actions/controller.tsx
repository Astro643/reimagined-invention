import { createController } from "remix/router"

import { assets } from "../assets.ts"
import { routes } from "../routes.ts"
import { AboutPage, meta as aboutMeta } from "../pages/about.tsx"
import { DocsPage, meta as docsMeta } from "../pages/docs.tsx"
import { HomePage, meta as homeMeta } from "../pages/home.tsx"
import { NotFoundPage, meta as notFoundMeta } from "../pages/not-found.tsx"
import { PrivacyPage, meta as privacyMeta } from "../pages/privacy.tsx"
import { TermsPage, meta as termsMeta } from "../pages/terms.tsx"
import { Document } from "./document.tsx"
import * as serverActions from "./server.tsx"

export default createController(routes, {
  actions: {
    async assets(context) {
      return (await assets.fetch(context.request)) ?? new Response("Not Found", { status: 404 })
    },
    async agentPreview(context) {
      return serverActions.agentPreview(context)
    },
    async agentExecute(context) {
      return serverActions.agentExecute(context)
    },
    async agentStatus(context) {
      return serverActions.getStatus(context)
    },
    async agentCancel(context) {
      return serverActions.cancelRun(context)
    },
    async agentApprove(context) {
      return serverActions.approveRun(context)
    },
    async preview(context) {
      return serverActions.preview(context)
    },
    async execute(context) {
      return serverActions.execute(context)
    },
    async publicStatus(context) {
      return serverActions.publicStatus()
    },
    async supportChat(context) {
      return serverActions.supportChat(context)
    },
    home(context) {
      return context.render(<Document meta={homeMeta}><HomePage /></Document>)
    },
    privacy(context) {
      return context.render(<Document meta={privacyMeta}><PrivacyPage /></Document>)
    },
    terms(context) {
      return context.render(<Document meta={termsMeta}><TermsPage /></Document>)
    },
    docs(context) {
      return context.render(<Document meta={docsMeta}><DocsPage /></Document>)
    },
    about(context) {
      return context.render(<Document meta={aboutMeta}><AboutPage /></Document>)
    },
    notFound(context) {
      return context.render(<Document meta={notFoundMeta}><NotFoundPage /></Document>, { status: 404 })
    },
  },
})
