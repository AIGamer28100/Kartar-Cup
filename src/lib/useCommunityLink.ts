import { useEffect, useState } from 'react';
import { watchEventConfig } from './db';
import { safeWhatsappUrl } from '../guest/model';

/** Get the active event's WhatsApp community link from Firestore (live event settings).
 * Returns the URL string if available and valid, or empty string otherwise.
 * Unsubscribes on unmount. */
export function useCommunityLink(): string {
  const [whatsappUrl, setWhatsappUrl] = useState('');

  useEffect(() => {
    const unsub = watchEventConfig(
      (config) => {
        if (!config) {
          setWhatsappUrl('');
          return;
        }
        setWhatsappUrl(safeWhatsappUrl(config.whatsappUrl));
      },
      () => setWhatsappUrl(''),
    );
    return unsub;
  }, []);

  return whatsappUrl;
}
