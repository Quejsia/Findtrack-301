import { useEffect, useState } from 'react';
import { fetchContactInfo } from '../lib/contactApi';

/** Shows the private contact details for an item once the viewer is allowed to see them. */
export default function ContactInfoText({ itemId, legacy }: { itemId: string; legacy?: string }) {
  const [text, setText] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    setText(null);
    setFailed(false);
    fetchContactInfo(itemId)
      .then((value) => alive && setText(value))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [itemId]);

  if (text !== null) return <>{text || legacy || ''}</>;
  if (failed) return <>{legacy || 'Unavailable right now'}</>;
  return <span className="opacity-60">Loading…</span>;
}
