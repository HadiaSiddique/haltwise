import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import { config } from './config.ts'

mkdirSync(dirname(config.dbPath), { recursive: true })
export const db = new DatabaseSync(config.dbPath)

db.exec(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS cases (
  id TEXT PRIMARY KEY, kind TEXT, status TEXT, risk INTEGER, title TEXT,
  customer TEXT, lang TEXT, country TEXT, data TEXT, created_at INTEGER, updated_at INTEGER);
CREATE TABLE IF NOT EXISTS transfers (
  id TEXT PRIMARY KEY, case_id TEXT, session TEXT, status TEXT, rail TEXT, amount REAL, currency TEXT,
  payee_code TEXT, payee_masked TEXT, risk INTEGER, decision TEXT, data TEXT, created_at INTEGER);
CREATE TABLE IF NOT EXISTS trace (
  id INTEGER PRIMARY KEY AUTOINCREMENT, session TEXT, case_id TEXT, agent TEXT, step TEXT,
  model TEXT, ms INTEGER, status TEXT, detail TEXT, ts INTEGER);
CREATE TABLE IF NOT EXISTS audit (
  id INTEGER PRIMARY KEY AUTOINCREMENT, session TEXT, actor TEXT, action TEXT, target TEXT,
  result TEXT, reason TEXT, ts INTEGER);
CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT, channel TEXT, category TEXT, text TEXT, country TEXT,
  indicator TEXT, ts INTEGER);
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY, customer TEXT, kind TEXT, text TEXT, sig TEXT, valid_from INTEGER, valid_to INTEGER);
CREATE TABLE IF NOT EXISTS credits (
  id TEXT PRIMARY KEY, account TEXT, sender_hash TEXT, sender_label TEXT, amount REAL, currency TEXT,
  reference TEXT, ts INTEGER, out_ts INTEGER, out_amount REAL, out_dest TEXT);
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT, ts INTEGER);
`)

export function kvGet<T>(key: string, maxAgeMs = Infinity): T | undefined {
  const row = db.prepare('SELECT value, ts FROM kv WHERE key = ?').get(key) as { value: string; ts: number } | undefined
  if (!row || Date.now() - row.ts > maxAgeMs) return undefined
  return JSON.parse(row.value) as T
}

export function kvSet(key: string, value: unknown) {
  db.prepare('INSERT OR REPLACE INTO kv (key, value, ts) VALUES (?, ?, ?)').run(key, JSON.stringify(value), Date.now())
}

export const newId = (prefix: string) =>
  `${prefix}-${Date.now().toString(36).toUpperCase().slice(-5)}${Math.random().toString(36).slice(2, 5).toUpperCase()}`
