import { useState } from 'react';
import { initials } from '../../guest/profileModel';

/** Same img/fallback pattern as guest/ProfilePage's Avatar (referrerPolicy=no-referrer, initials
 * fallback) — reused here for the big-screen podium/standings instead of duplicating it, just with
 * a size prop for projector-scale faces. */
export default function Avatar({
  photoUrl,
  name,
  className = '',
}: {
  photoUrl?: string | null;
  name: string;
  className?: string;
}) {
  const [broken, setBroken] = useState(false);
  if (photoUrl && !broken) {
    return (
      <img
        src={photoUrl}
        alt=""
        referrerPolicy="no-referrer"
        onError={() => setBroken(true)}
        className={`shrink-0 rounded-full border border-line object-cover ${className}`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-full border border-line bg-raised font-mono text-muted ${className}`}
    >
      {initials(name)}
    </span>
  );
}
