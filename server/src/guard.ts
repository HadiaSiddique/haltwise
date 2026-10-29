/**
 * The watchdog's kill switch, read by the model client and the web client before every call.
 * Kept in its own tiny module so the low-level clients don't import the watchdog (and its dependencies).
 */
export const guard = { level: 0 as 0 | 1 | 2 | 3 }

/** Level 3 DISCONNECT: no model calls; every agent falls back to its deterministic rules. */
export const aiAllowed = () => guard.level < 3
/** Level 2 CONTAIN and above: no outbound web calls from agents. */
export const webAllowed = () => guard.level < 2
