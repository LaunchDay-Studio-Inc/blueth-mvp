import crypto from 'crypto';
import { withTransaction } from '@blueth/db';

const GUEST_TOKEN_DURATION_DAYS = 30;

function hashToken(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

export interface TokenResetResult {
  token: string;
}

/**
 * Rotate a guest player's Bearer token.
 * Deletes all existing tokens for the player and issues a new one.
 */
export async function resetToken(playerId: string): Promise<TokenResetResult> {
  const rawToken = crypto.randomUUID();
  const tokenHash = hashToken(rawToken);

  await withTransaction(async (tx) => {
    await tx.query('DELETE FROM guest_tokens WHERE player_id = $1', [playerId]);
    await tx.query(
      `INSERT INTO guest_tokens (player_id, token_hash, expires_at)
       VALUES ($1, $2, NOW() + INTERVAL '${GUEST_TOKEN_DURATION_DAYS} days')`,
      [playerId, tokenHash]
    );
  });

  return { token: rawToken };
}
