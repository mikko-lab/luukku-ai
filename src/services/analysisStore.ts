const TTL_MS = 30 * 60 * 1000 // 30 min

export const analysisStore = new Map<string, { data: unknown; expiresAt: number }>()

export function purgeExpired() {
  const now = Date.now()
  for (const [key, value] of analysisStore.entries()) {
    if (value.expiresAt < now) analysisStore.delete(key)
  }
}

export function storeAnalysis(sessionId: string, data: unknown) {
  purgeExpired()
  analysisStore.set(sessionId, { data, expiresAt: Date.now() + TTL_MS })
}

export function consumeAnalysis(sessionId: string): unknown | null {
  const stored = analysisStore.get(sessionId)
  if (!stored) return null
  analysisStore.delete(sessionId)
  return stored.data
}
