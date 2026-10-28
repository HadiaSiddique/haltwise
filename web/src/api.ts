import { useEffect, useRef, useState } from 'react'

export const SESSION = (() => {
  try {
    const k = 'haltwise-session'
    const v = sessionStorage.getItem(k) ?? `cust-${Math.random().toString(36).slice(2, 8)}`
    sessionStorage.setItem(k, v)
    return v
  } catch {
    return `cust-${Math.random().toString(36).slice(2, 8)}`
  }
})()

export async function post<T = any>(path: string, body: Record<string, unknown> = {}): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session: SESSION, ...body }),
  })
  if (!res.ok) throw new Error(`${res.status} ${await res.text()}`)
  return res.json()
}

export async function get<T = any>(path: string): Promise<T> {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${res.status}`)
  return res.json()
}

export interface TraceEvent {
  id: number
  session: string
  caseId?: string
  agent: string
  step: string
  model?: string
  ms?: number
  status: 'ok' | 'fallback' | 'blocked' | 'error' | 'info'
  detail?: any
  ts: number
}

export interface AuditEvent {
  id: number
  session: string
  actor: string
  action: string
  target: string
  result: 'ALLOWED' | 'BLOCKED' | 'DONE'
  reason: string
  ts: number
}

type Handler = (type: string, data: any) => void

/** Subscribe to the server's live SSE stream (agent trace, audit, cases, radar). */
export function useStream(handler: Handler) {
  const ref = useRef(handler)
  ref.current = handler
  useEffect(() => {
    const es = new EventSource('/api/stream')
    for (const t of ['trace', 'audit', 'case', 'radar', 'notice', 'reset']) {
      es.addEventListener(t, e => ref.current(t, JSON.parse((e as MessageEvent).data)))
    }
    return () => es.close()
  }, [])
}

export function useFetch<T>(path: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | undefined>()
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let alive = true
    get<T>(path)
      .then(d => alive && setData(d))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [path, tick, ...deps])
  return [data, () => setTick(t => t + 1)] as const
}

/** Downscale an image file to a JPEG data URL so uploads stay small. */
export function fileToDataUrl(file: File, max = 1280): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * s)
      c.height = Math.round(img.height * s)
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
      resolve(c.toDataURL('image/jpeg', 0.85))
      URL.revokeObjectURL(img.src)
    }
    img.onerror = reject
    img.src = URL.createObjectURL(file)
  })
}

export const money = (n: number, currency: string) => {
  try {
    return new Intl.NumberFormat(undefined, { style: 'currency', currency, maximumFractionDigits: 2 }).format(n)
  } catch {
    return `${n.toLocaleString()} ${currency}`
  }
}

export const timeAgo = (ts: number) => {
  const s = Math.round((Date.now() - ts) / 1000)
  if (s < 60) return `${s}s ago`
  if (s < 3600) return `${Math.round(s / 60)}m ago`
  if (s < 86400) return `${Math.round(s / 3600)}h ago`
  return `${Math.round(s / 86400)}d ago`
}
