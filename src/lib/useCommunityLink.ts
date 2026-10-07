import { useEffect, useState } from 'react';
import { watchActiveEventConfig } from './db';
import { safeWhatsappUrl } from '../guest/model';

/** The live event's WhatsApp community link from the event settings (R11).
 * Follows the active event (watchActiveEventId -> watchEventConfig), validated with
 * safeWhatsappUrl; '' when there is no live event, no link, or the read fails. */
export function useCommunityLink(): string {
  const [whatsappUrl, setWhatsappUrl] = useState('');

  useEffect(() => {
    try {
      return watchActiveEventConfig(
        (config) => setWhatsappUrl(safeWhatsappUrl(config?.whatsappUrl)),
        () => setWhatsappUrl(''),
      );
    } catch {
      return undefined;
    }
  }, []);

  return whatsappUrl;
}
