import { auth } from '../firebase';

/**
 * Claims are created by the server (Admin SDK), because the Firestore rules only let
 * clients write a tiny claim document and never an "approved" one.
 *  - manual: false -> the server checks the answer and, on a match, creates an approved claim.
 *  - manual: true  -> the server creates a pending claim for the finder to review.
 */
export interface ClaimResult {
  match: boolean;
  pending?: boolean;
  claimId?: string;
  reason?: string;
  /** HTTP status of the response, so callers can react to 409 (no secret answer set). */
  status: number;
}

export async function submitClaim(
  itemId: string,
  answer: string,
  manual: boolean,
): Promise<ClaimResult> {
  const token = await auth.currentUser?.getIdToken();
  const response = await fetch('/api/verify-claim', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ itemId, claimerAnswer: answer.trim(), manual }),
  });
  let data: any = {};
  try {
    data = await response.json();
  } catch {
    /* non-JSON error body */
  }
  if (!response.ok && response.status !== 409) {
    throw new Error(data?.error || `Claim request failed (${response.status}).`);
  }
  return {
    match: data?.match === true,
    pending: data?.pending === true,
    claimId: typeof data?.claimId === 'string' ? data.claimId : undefined,
    reason: typeof data?.reason === 'string' ? data.reason : data?.error,
    status: response.status,
  };
}
