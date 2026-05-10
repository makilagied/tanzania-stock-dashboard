import { NextResponse } from "next/server"
import { z } from "zod"
import { resolveChartAssistantProvider, runChartAgentAssistant } from "@/lib/ai-chart-agent"

export const maxDuration = 60

const deviceMemorySchema = z
  .object({
    chartSnapshot: z.record(z.string(), z.unknown()).optional(),
    lastDashboardPatch: z.record(z.string(), z.unknown()).optional(),
  })
  .strict()

const bodySchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(16_000),
      }),
    )
    .min(1)
    .max(40),
  pageContext: z.record(z.string(), z.unknown()).optional(),
  deviceMemory: deviceMemorySchema.optional(),
})

export async function POST(req: Request) {
  try {
    const provider = resolveChartAssistantProvider()
    if (!provider) {
      return NextResponse.json(
        {
          error:
            "Chart assistant is not configured. Set OPENAI_API_KEY or ANTHROPIC_API_KEY (optional: AI_CHART_PROVIDER=openai|anthropic, OPENAI_MODEL, ANTHROPIC_MODEL).",
        },
        { status: 503 },
      )
    }

    const json = await req.json()
    const parsed = bodySchema.safeParse(json)
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body", details: parsed.error.flatten() }, { status: 400 })
    }

    const { reply, dashboardPatch, navigationPath } = await runChartAgentAssistant({
      provider,
      userMessages: parsed.data.messages,
      pageContext: parsed.data.pageContext,
      deviceMemory: parsed.data.deviceMemory,
    })

    return NextResponse.json({
      reply,
      dashboardPatch,
      provider,
      ...(navigationPath ? { navigationPath } : {}),
    })
  } catch (e) {
    const message = e instanceof Error ? e.message : "Assistant failed"
    return NextResponse.json({ error: message }, { status: 502 })
  }
}
