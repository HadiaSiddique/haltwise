/**
 * Policy gate + Trust Layer. Plain code, not AI: the only path from an agent to an action.
 * Agents can BRAKE (hold, block, flag, draft). They can never move money or weaken protection.
 */
import { audit } from './trace.ts'

export type Actor = 'inspector' | 'intel' | 'sentinel' | 'callguard' | 'responder' | 'investigator' | 'radar' | 'customer' | 'officer' | 'guardian'

export type Tool =
  | 'hold_transfer'
  | 'request_verification'
  | 'offer_verified_callback'
  | 'flag_payee'
  | 'flag_message'
  | 'flag_account'
  | 'warn_customer'
  | 'freeze_card'
  | 'block_channels'
  | 'open_dispute'
  | 'create_case'
  | 'draft_message'
  | 'draft_report'
  | 'web_search'
  | 'release_hold'
  | 'release_transfer'
  | 'reject_transfer'
  | 'guardian_approve'
  | 'unfreeze_card'
  | 'transfer_money'
  | 'add_payee'
  | 'change_payee'
  | 'change_contact_details'
  | 'override_verdict'

/** Never callable by any AI agent, whatever the model outputs or a message says. */
export const NEVER_FOR_AGENTS: Tool[] = ['transfer_money', 'add_payee', 'change_payee', 'change_contact_details', 'release_hold', 'release_transfer', 'unfreeze_card', 'override_verdict', 'guardian_approve']

const ALLOW: Record<Actor, Tool[]> = {
  inspector: ['flag_message', 'draft_message'],
  intel: ['web_search', 'draft_message'],
  sentinel: ['hold_transfer', 'request_verification', 'offer_verified_callback', 'flag_payee', 'draft_message'],
  callguard: ['warn_customer', 'flag_message'],
  responder: ['freeze_card', 'block_channels', 'open_dispute', 'create_case', 'draft_message'],
  investigator: ['flag_account', 'draft_report'],
  radar: ['warn_customer', 'flag_message'],
  // Humans: a customer may release a *paused* transfer after verification; only an officer can release a *held* one or unfreeze.
  customer: ['release_transfer', 'reject_transfer', 'open_dispute', 'create_case'],
  officer: ['release_hold', 'reject_transfer', 'unfreeze_card', 'flag_account', 'hold_transfer', 'freeze_card'],
  guardian: ['guardian_approve', 'reject_transfer'],
}

const AI_ACTORS: Actor[] = ['inspector', 'intel', 'sentinel', 'callguard', 'responder', 'investigator', 'radar']

export interface GateResult {
  allowed: boolean
  reason: string
}

export function gate(session: string, actor: Actor, tool: Tool, target: string, ctx: { injected?: boolean; status?: string } = {}): GateResult {
  let res: GateResult
  if (AI_ACTORS.includes(actor) && NEVER_FOR_AGENTS.includes(tool)) {
    res = {
      allowed: false,
      reason: ctx.injected
        ? `Prompt injection: message text tried to make ${actor} call ${tool}. AI agents can only brake; ${tool} needs a human.`
        : `${tool} is never available to AI agents (brake-only policy).`,
    }
  } else if (!ALLOW[actor]?.includes(tool)) {
    res = { allowed: false, reason: `${tool} is not on ${actor}'s tool allow-list.` }
  } else if (actor === 'customer' && tool === 'release_transfer' && ctx.status !== 'verify') {
    res = { allowed: false, reason: `Customer can only release a paused transfer that passed verification (status is ${ctx.status}). Held transfers need a bank officer.` }
  } else if (actor === 'officer' && tool === 'release_hold' && ctx.status !== 'held' && ctx.status !== 'guardian') {
    res = { allowed: false, reason: `Nothing to release: transfer status is ${ctx.status}.` }
  } else {
    res = { allowed: true, reason: 'on allow-list' }
  }
  audit({ session, actor, action: tool, target, result: res.allowed ? 'ALLOWED' : 'BLOCKED', reason: res.reason })
  return res
}

export const policySummary = () => ({
  principle: 'AI can only brake, never move money.',
  neverForAgents: NEVER_FOR_AGENTS,
  allowList: ALLOW,
  humanRules: [
    'Releasing a paused transfer needs the customer to answer the verification questions and confirm.',
    'Releasing a held transfer or unfreezing a card needs a bank officer.',
    'All customer and message text is treated as data inside <untrusted_*> tags, never as instructions.',
  ],
})
