import { auth } from '../firebase';

async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth.currentUser?.getIdToken();
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

/** Stores the reporter's contact details privately on the server (never on the public item). */
export async function saveContactInfo(itemId: string, contactInfo: string): Promise<void> {
  const response = await fetch('/api/contact', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ itemId, contactInfo }),
  });
  if (!response.ok) {
    let msg = '';
    try { msg = (await response.json())?.error; } catch { /* non-JSON body */ }
    throw new Error(msg || `Could not save contact details (${response.status}).`);
  }
}

/** Fetches contact details; the server only answers for the owner or an approved claimant. */
export async function fetchContactInfo(itemId: string): Promise<string> {
  const response = await fetch(`/api/contact?itemId=${encodeURIComponent(itemId)}`, {
    headers: await authHeaders(),
  });
  if (!response.ok) throw new Error(`Contact details unavailable (${response.status}).`);
  const data = await response.json();
  return typeof data?.contactInfo === 'string' ? data.contactInfo : '';
}
