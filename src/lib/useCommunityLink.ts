import { useEffect, useRef, useState } from 'react';
import { watchActiveEventId, watchEventConfig } from './db';
import { safeWhatsappUrl } from '../guest/model';

/** Get the active event's WhatsApp community link from Firestore (live event settings).
 * Returns the URL string if available and valid, or empty string otherwise.
 * Unsubscribes on unmount. */
export function useCommunityLink(): string {
  const [whatsappUrl, setWhatsappUrl] = useState('');
  const configUnsubRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    const unsubbId = watchActiveEventId((eventId) => {
      // Unsubscribe from previous config watch
      if (configUnsubRef.current) configUnsubRef.current();

      if (!eventId) {
        setWhatsappUrl('');
        return;
      }

      configUnsubRef.current = watchEventConfig(
        eventId,
        (config) => {
          if (!config) {
            setWhatsappUrl('');
            return;
          }
          setWhatsappUrl(safeWhatsappUrl(config.whatsappUrl));
        },
        () => setWhatsappUrl(''),
      );
    });

    return () => {
      unsubbId();
      if (configUnsubRef.current) configUnsubRef.current();
    };
  }, []);

  return whatsappUrl;
}
