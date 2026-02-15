import { formatBlueth, VIGOR_KEYS } from '@blueth/core';
import type { VigorKey } from '@blueth/core';

export interface ActionDeltas {
  /** Positive = earned, negative = spent */
  moneyCents?: number;
  /** Positive = gained, negative = cost per dimension */
  vigorDelta?: Partial<Record<VigorKey, number>>;
}

/**
 * Normalize the heterogeneous action result shapes into a unified
 * { moneyCents, vigorDelta } structure for display.
 *
 * Result shapes vary per handler — see docs/QUEUE_UI.md for the full map.
 */
export function extractActionDeltas(
  type: string,
  result: Record<string, unknown> | null,
): ActionDeltas {
  if (!result) return {};

  switch (type) {
    case 'WORK_SHIFT':
    case 'GIG_JOB': {
      const moneyCents =
        typeof result.payCents === 'number' ? result.payCents : undefined;
      const vigorCost = result.vigorCost as
        | Partial<Record<VigorKey, number>>
        | undefined;
      const vigorDelta = vigorCost ? negateVigor(vigorCost) : undefined;
      return { moneyCents, vigorDelta };
    }

    case 'EAT_MEAL': {
      const costCents =
        typeof result.costCents === 'number' ? -result.costCents : undefined;
      const vigorDelta = (result.instantDelta as
        | Partial<Record<VigorKey, number>>
        | undefined) ?? undefined;
      return { moneyCents: costCents, vigorDelta };
    }

    case 'SLEEP': {
      // vigorGained is an audit object with per-dim values
      const vigorDelta = extractVigorFromAudit(result.vigorGained);
      return { vigorDelta };
    }

    case 'LEISURE': {
      const vigorDelta = (result.instantDelta as
        | Partial<Record<VigorKey, number>>
        | undefined) ?? undefined;
      return { vigorDelta };
    }

    case 'SOCIAL_CALL': {
      const vigorDelta = (result.vigorDelta as
        | Partial<Record<VigorKey, number>>
        | undefined) ?? undefined;
      return { vigorDelta };
    }

    case 'MARKET_PLACE_ORDER': {
      const fills = result.fills as
        | Array<{ priceCents?: number; qty?: number; feeCents?: number }>
        | undefined;
      if (fills && fills.length > 0) {
        let net = 0;
        for (const f of fills) {
          net += (f.priceCents ?? 0) * (f.qty ?? 0) - (f.feeCents ?? 0);
        }
        return { moneyCents: net };
      }
      return {};
    }

    case 'MARKET_DAY_TRADE_SESSION': {
      const vigorDelta: Partial<Record<VigorKey, number>> = {};
      if (typeof result.mvCost === 'number') vigorDelta.mv = -result.mvCost;
      if (typeof result.spvStress === 'number' && result.spvStress > 0)
        vigorDelta.spv = -result.spvStress;
      return { vigorDelta: Object.keys(vigorDelta).length > 0 ? vigorDelta : undefined };
    }

    default:
      return {};
  }
}

/**
 * Format deltas into a compact one-line summary.
 * Examples: "+B50.00", "-B5.00, +3 SV", "+12 PV +8 MV"
 */
export function formatDeltaSummary(deltas: ActionDeltas): string {
  const parts: string[] = [];

  if (deltas.moneyCents !== undefined && deltas.moneyCents !== 0) {
    const sign = deltas.moneyCents > 0 ? '+' : '';
    parts.push(`${sign}${formatBlueth(deltas.moneyCents)}`);
  }

  if (deltas.vigorDelta) {
    for (const key of VIGOR_KEYS) {
      const val = deltas.vigorDelta[key];
      if (val !== undefined && val !== 0) {
        const sign = val > 0 ? '+' : '';
        parts.push(`${sign}${Math.round(val)} ${key.toUpperCase()}`);
      }
    }
  }

  return parts.join(', ') || '';
}

function negateVigor(
  v: Partial<Record<VigorKey, number>>,
): Partial<Record<VigorKey, number>> {
  const out: Partial<Record<VigorKey, number>> = {};
  for (const key of VIGOR_KEYS) {
    const val = v[key];
    if (val !== undefined) out[key] = -val;
  }
  return out;
}

function extractVigorFromAudit(
  audit: unknown,
): Partial<Record<VigorKey, number>> | undefined {
  if (!audit || typeof audit !== 'object') return undefined;
  const out: Partial<Record<VigorKey, number>> = {};
  const a = audit as Record<string, unknown>;
  let hasAny = false;
  for (const key of VIGOR_KEYS) {
    const val = a[key];
    if (typeof val === 'number' && val !== 0) {
      out[key] = val;
      hasAny = true;
    }
  }
  return hasAny ? out : undefined;
}
