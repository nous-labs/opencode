import { BusEvent } from "@/bus/bus-event"
import { Bus } from "@/bus"
import z from "zod"

export namespace SessionRatelimit {
  const Info = z.object({
    sessionID: z.string(),
    providerID: z.string(),
    modelID: z.string(),
    requests: z.object({
      remaining: z.number().optional(),
      limit: z.number().optional(),
      reset: z.string().optional(),
    }),
    tokens: z.object({
      remaining: z.number().optional(),
      limit: z.number().optional(),
      reset: z.string().optional(),
    }),
    raw: z.record(z.string(), z.string()),
  })
  export type Info = z.infer<typeof Info>

  export const Event = {
    Updated: BusEvent.define("provider.ratelimit", Info),
  }

  const HEADER_MAP: Record<string, [string, string]> = {
    "x-ratelimit-remaining-requests": ["requests", "remaining"],
    "x-ratelimit-limit-requests": ["requests", "limit"],
    "x-ratelimit-reset-requests": ["requests", "reset"],
    "x-ratelimit-remaining-tokens": ["tokens", "remaining"],
    "x-ratelimit-limit-tokens": ["tokens", "limit"],
    "x-ratelimit-reset-tokens": ["tokens", "reset"],
    "anthropic-ratelimit-requests-remaining": ["requests", "remaining"],
    "anthropic-ratelimit-requests-limit": ["requests", "limit"],
    "anthropic-ratelimit-requests-reset": ["requests", "reset"],
    "anthropic-ratelimit-tokens-remaining": ["tokens", "remaining"],
    "anthropic-ratelimit-tokens-limit": ["tokens", "limit"],
    "anthropic-ratelimit-tokens-reset": ["tokens", "reset"],
    "anthropic-ratelimit-input-tokens-remaining": ["tokens", "remaining"],
    "anthropic-ratelimit-input-tokens-limit": ["tokens", "limit"],
    "anthropic-ratelimit-input-tokens-reset": ["tokens", "reset"],
  }

  export function emit(input: {
    sessionID: string
    providerID: string
    modelID: string
    headers: Record<string, string> | undefined
  }) {
    if (!input.headers) return

    const raw: Record<string, string> = {}
    const requests: Info["requests"] = {}
    const tokens: Info["tokens"] = {}
    let found = false

    for (const [key, value] of Object.entries(input.headers)) {
      const lower = key.toLowerCase()
      const mapping = HEADER_MAP[lower]
      if (mapping) {
        found = true
        raw[lower] = value
        const [bucket, field] = mapping
        const target = bucket === "requests" ? requests : tokens
        if (field === "remaining" || field === "limit") {
          const num = parseInt(value, 10)
          if (!isNaN(num)) (target as Record<string, unknown>)[field] = num
        } else {
          (target as Record<string, unknown>)[field] = value
        }
      } else if (lower.includes("ratelimit") || lower.includes("rate-limit")) {
        found = true
        raw[lower] = value
      }
    }

    if (!found) return

    Bus.publish(Event.Updated, {
      sessionID: input.sessionID,
      providerID: input.providerID,
      modelID: input.modelID,
      requests,
      tokens,
      raw,
    })
  }
}
