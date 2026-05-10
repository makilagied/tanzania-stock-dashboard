import {
  CHART_AGENT_OPENAI_TOOLS,
  executeChartAgentTool,
  mergeDashboardPatches,
  toAnthropicToolSpecs,
  type ChartDashboardPatch,
  type ToolName,
} from "@/lib/ai-chart-agent-tools"

export type ChartAssistantClientMessage = { role: "user" | "assistant"; content: string }

export type ChartAssistantDeviceMemory = {
  chartSnapshot?: Record<string, unknown>
  lastDashboardPatch?: Record<string, unknown>
}

const MAX_AGENT_STEPS = 10

const SYSTEM_PROMPT = `You are Jolene, the in-app assistant for Uwekezaji Online: Tanzania DSE stocks, mutual funds/ETFs (NAV), and the compare tool. Answer using tools only—never invent prices, NAVs, volumes, or dates. Use TZS unless a fund is explicitly USD-denominated. Speak in first person as Jolene when natural (brief, professional).

UI control tools (only when the user asks to change what is on screen):
- Stocks home (route "stocks"): set_chart_view — symbol, analytics period, line vs candlesticks.
- Funds page (route "funds"): set_fund_page_view — switches the NAV chart to another fund (fund_id = catalog id or scheme name) and/or changes analytics_period for that chart.
- Compare page (route "compare"): set_compare_page_view — switches the left and/or right series on the indexed chart: left_stock/right_stock for DSE tickers, left_fund/right_fund for funds (id or name). Set period for the compare window. Omit left_kind/right_kind when obvious from which fields you set.

Use list_funds_catalog / get_fund_period_metrics / get_compare_pair_metrics for fund and cross-instrument questions.

Time windows for get_stock_period_metrics, get_fund_period_metrics, and get_compare_pair_metrics: use the preset period enum (1w, 1m, 1y, qtd, mtd, ytd, all) OR pass range_start and range_end together as YYYY-MM-DD for any inclusive calendar span (example: all of 2025 → range_start 2025-01-01, range_end 2025-12-31). Never pass a bare calendar year as period. If a tool result includes guidance (parameter hint), explain briefly in plain language—do not paste JSON, schema text, or raw validator output to the user.

When the user asks to open another section of the app (stocks home, funds, compare), call navigate_to_page with path "/" (stocks), "/funds", or "/compare". You may combine navigation with the matching set_* tool in the same turn; the app will apply view changes after the route change.

Be concise. Use bullet lists for multi-part numbers. If data is missing or the feed is out, say so clearly.`

function buildSystemMessage(
  pageContext: Record<string, unknown> | undefined,
  deviceMemory?: ChartAssistantDeviceMemory,
): string {
  const parts: string[] = [SYSTEM_PROMPT]

  if (pageContext && Object.keys(pageContext).length > 0) {
    parts.push(`\n\nCurrent UI context (may be stale vs tools):\n${JSON.stringify(pageContext)}`)
  }

  const snap = deviceMemory?.chartSnapshot
  const patch = deviceMemory?.lastDashboardPatch
  const snapKeys = snap && typeof snap === "object" ? Object.keys(snap) : []
  const patchKeys = patch && typeof patch === "object" ? Object.keys(patch) : []
  if (snapKeys.length > 0 || patchKeys.length > 0) {
    parts.push(
      `\n\nDevice-stored chart memory (same browser; continuity hints only — live page context above and tools override if they disagree):\n${JSON.stringify({
        rememberedChartSnapshot: snapKeys.length ? snap : {},
        rememberedAssistantViewPatches: patchKeys.length ? patch : {},
      })}`,
    )
  }

  return parts.join("")
}

function isToolName(s: string): s is ToolName {
  return (
    s === "get_live_stocks" ||
    s === "get_stock_snapshot" ||
    s === "get_stock_period_metrics" ||
    s === "get_market_indices" ||
    s === "get_top_movers" ||
    s === "get_order_book_levels" ||
    s === "set_chart_view" ||
    s === "list_funds_catalog" ||
    s === "get_fund_period_metrics" ||
    s === "get_compare_pair_metrics" ||
    s === "set_fund_page_view" ||
    s === "set_compare_page_view" ||
    s === "navigate_to_page"
  )
}

type OpenAIMessage =
  | { role: "system"; content: string }
  | { role: "user" | "assistant"; content: string | null }
  | {
      role: "assistant"
      content: string | null
      tool_calls: { id: string; type: "function"; function: { name: string; arguments: string } }[]
    }
  | { role: "tool"; tool_call_id: string; content: string }

async function openaiChat(
  apiKey: string,
  model: string,
  messages: OpenAIMessage[],
): Promise<{
  message: {
    role: string
    content: string | null
    tool_calls?: { id: string; type: string; function: { name: string; arguments: string } }[]
  }
}> {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages,
      tools: CHART_AGENT_OPENAI_TOOLS,
      tool_choice: "auto",
    }),
  })
  const json = (await res.json()) as {
    error?: { message?: string }
    choices?: { message?: OpenAIMessage }[]
  }
  if (!res.ok) {
    throw new Error(json.error?.message || `OpenAI HTTP ${res.status}`)
  }
  const message = json.choices?.[0]?.message
  if (!message || typeof message !== "object") {
    throw new Error("OpenAI returned no assistant message")
  }
  return { message: message as OpenAIMessage }
}

async function anthropicMessages(
  apiKey: string,
  model: string,
  system: string,
  messages: unknown[],
  tools: ReturnType<typeof toAnthropicToolSpecs>,
): Promise<{
  stop_reason: string
  content: Array<
    | { type: "text"; text: string }
    | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
  >
}> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system,
      tools,
      messages,
    }),
  })
  const json = (await res.json()) as {
    error?: { message?: string }
    stop_reason?: string
    content?: Array<{ type: string; id?: string; name?: string; input?: Record<string, unknown>; text?: string }>
  }
  if (!res.ok) {
    throw new Error(json.error?.message || `Anthropic HTTP ${res.status}`)
  }
  const content = json.content ?? []
  return {
    stop_reason: json.stop_reason ?? "end_turn",
    content: content as Array<
      { type: "text"; text: string } | { type: "tool_use"; id: string; name: string; input: Record<string, unknown> }
    >,
  }
}

export async function runChartAgentAssistant(opts: {
  provider: "openai" | "anthropic"
  userMessages: ChartAssistantClientMessage[]
  pageContext?: Record<string, unknown>
  deviceMemory?: ChartAssistantDeviceMemory
}): Promise<{
  reply: string
  dashboardPatch: ChartDashboardPatch
  provider: string
  navigationPath?: string
}> {
  const { provider, userMessages, pageContext, deviceMemory } = opts
  const system = buildSystemMessage(pageContext, deviceMemory)
  const patchAccum: ChartDashboardPatch[] = []
  let lastNavigationPath: string | undefined

  if (provider === "openai") {
    const apiKey = process.env.OPENAI_API_KEY
    if (!apiKey) throw new Error("OPENAI_API_KEY is not set")
    const model = process.env.OPENAI_MODEL?.trim() || "gpt-4o-mini"

    const messages: OpenAIMessage[] = [
      { role: "system", content: system },
      ...userMessages.map((m) => ({ role: m.role, content: m.content })),
    ]

    for (let step = 0; step < MAX_AGENT_STEPS; step++) {
      const { message } = await openaiChat(apiKey, model, messages)
      const toolCalls = message.tool_calls
      if (toolCalls && toolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: message.content,
          tool_calls: toolCalls,
        } as OpenAIMessage)
        for (const tc of toolCalls) {
          const name = tc.function.name
          let args: unknown = {}
          try {
            args = tc.function.arguments ? JSON.parse(tc.function.arguments) : {}
          } catch {
            args = {}
          }
          if (!isToolName(name)) {
            messages.push({
              role: "tool",
              tool_call_id: tc.id,
              content: JSON.stringify({ error: `Unknown tool: ${name}` }),
            })
            continue
          }
          const { result, dashboardPatch, navigationPath } = await executeChartAgentTool(name, args)
          if (dashboardPatch) patchAccum.push(dashboardPatch)
          if (navigationPath) lastNavigationPath = navigationPath
          messages.push({ role: "tool", tool_call_id: tc.id, content: JSON.stringify(result) })
        }
        continue
      }
      const reply = (message.content ?? "").trim() || "I could not produce a reply."
      return {
        reply,
        dashboardPatch: mergeDashboardPatches(patchAccum),
        provider: "openai",
        ...(lastNavigationPath ? { navigationPath: lastNavigationPath } : {}),
      }
    }
    throw new Error("OpenAI agent exceeded max tool rounds")
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set")
  const model = process.env.ANTHROPIC_MODEL?.trim() || "claude-sonnet-4-20250514"
  const tools = toAnthropicToolSpecs()

  const messages: unknown[] = userMessages.map((m) => ({
    role: m.role,
    content: [{ type: "text", text: m.content }],
  }))

  for (let step = 0; step < MAX_AGENT_STEPS; step++) {
    const { stop_reason, content } = await anthropicMessages(apiKey, model, system, messages, tools)
    const toolUses = content.filter((b): b is { type: "tool_use"; id: string; name: string; input: Record<string, unknown> } => b.type === "tool_use")
    const textParts = content.filter((b): b is { type: "text"; text: string } => b.type === "text").map((b) => b.text)

    if (toolUses.length > 0) {
      messages.push({ role: "assistant", content })
      const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = []
      for (const tu of toolUses) {
        if (!isToolName(tu.name)) {
          toolResults.push({
            type: "tool_result",
            tool_use_id: tu.id,
            content: JSON.stringify({ error: `Unknown tool: ${tu.name}` }),
          })
          continue
        }
        const { result, dashboardPatch, navigationPath } = await executeChartAgentTool(tu.name, tu.input)
        if (dashboardPatch) patchAccum.push(dashboardPatch)
        if (navigationPath) lastNavigationPath = navigationPath
        toolResults.push({ type: "tool_result", tool_use_id: tu.id, content: JSON.stringify(result) })
      }
      messages.push({ role: "user", content: toolResults })
      continue
    }

    const reply = textParts.join("\n").trim() || "I could not produce a reply."
    if (stop_reason === "end_turn" || stop_reason === "max_tokens") {
      return {
        reply,
        dashboardPatch: mergeDashboardPatches(patchAccum),
        provider: "anthropic",
        ...(lastNavigationPath ? { navigationPath: lastNavigationPath } : {}),
      }
    }
    return {
      reply,
      dashboardPatch: mergeDashboardPatches(patchAccum),
      provider: "anthropic",
      ...(lastNavigationPath ? { navigationPath: lastNavigationPath } : {}),
    }
  }

  throw new Error("Anthropic agent exceeded max tool rounds")
}

export function resolveChartAssistantProvider(): "openai" | "anthropic" | null {
  const explicit = process.env.AI_CHART_PROVIDER?.trim().toLowerCase()
  if (explicit === "openai" && process.env.OPENAI_API_KEY) return "openai"
  if (explicit === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic"
  if (explicit === "openai" || explicit === "anthropic") return null
  if (process.env.OPENAI_API_KEY) return "openai"
  if (process.env.ANTHROPIC_API_KEY) return "anthropic"
  return null
}
