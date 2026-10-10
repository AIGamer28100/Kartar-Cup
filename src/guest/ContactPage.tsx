import { ArrowRight } from '@phosphor-icons/react';
import Divider from '../components/Divider';
import { CONTACT } from '../config/contact';
import { usePageMeta } from '../lib/pageMeta';
import { useCommunityLink } from '../lib/useCommunityLink';
import { CardKerb, Eyebrow, PageTitle, Reveal, Shell, WhatsAppCta } from './parts';

const linkCls =
  'group press relative flex min-h-12 w-full items-center justify-between gap-3 overflow-hidden rounded-lg border border-line bg-raised px-4 py-3 text-ink transition-colors hover:border-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent';

function Arrow() {
  return <ArrowRight size={16} weight="regular" aria-hidden="true" className="shrink-0 transition-transform duration-150 group-hover:translate-x-1 motion-reduce:transition-none" />;
}

function Pending({ children }: { children: string }) {
  return <span className="text-muted">{children}</span>;
}

/** Public /contact. Real values come from src/config/contact.ts; blanks render as a clear
 * placeholder for the host to fill in rather than made-up details. The WhatsApp URL comes from
 * the active event's settings (src/lib/useCommunityLink). */
export default function ContactPage() {
  const communityUrl = useCommunityLink();

  usePageMeta({
    title: 'Contact',
    description: 'Reach The Karter Cup and The Karter Club on Instagram and WhatsApp.',
  });
  return (
    <Shell>
      <div className="max-w-[60ch]">
        <Reveal>
          <Eyebrow>Contact</Eyebrow>
          <h1 className={`mt-3 ${PageTitle}`}>Get in touch</h1>
          <p className="mt-4 text-muted md:text-lg">
            The quickest way to reach the team is on Instagram.
          </p>
        </Reveal>
      </div>

      <Divider className="mt-10" />

      <dl className="mt-8 grid max-w-[60ch] gap-6">
        {CONTACT.instagram.map((a, i) => (
          <Reveal key={a.handle} index={i + 1}>
            <dt className="font-mono text-xs uppercase tracking-widest text-muted">Instagram</dt>
            <dd className="mt-2">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className={linkCls}>
                <span className="break-all">{a.handle}</span>
                <Arrow />
                <CardKerb />
              </a>
              <p className="mt-2 text-sm text-muted">{a.role}</p>
            </dd>
          </Reveal>
        ))}
        <Reveal index={3}>
          <dt className="font-mono text-xs uppercase tracking-widest text-muted">WhatsApp community</dt>
          <dd className="mt-2">
            {communityUrl ? (
              <WhatsAppCta url={communityUrl} />
            ) : (
              <Pending>Link coming soon.</Pending>
            )}
          </dd>
        </Reveal>
        <Reveal index={4}>
          <dt className="font-mono text-xs uppercase tracking-widest text-muted">Email</dt>
          <dd className="mt-2">
            {CONTACT.email ? (
              <a href={`mailto:${CONTACT.email}`} className={linkCls}>
                <span className="break-all">{CONTACT.email}</span>
                <Arrow />
                <CardKerb />
              </a>
            ) : (
              <Pending>Email coming soon.</Pending>
            )}
          </dd>
        </Reveal>
        <Reveal index={5}>
          <dt className="font-mono text-xs uppercase tracking-widest text-muted">Phone</dt>
          <dd className="mt-2">
            {CONTACT.phone ? (
              <a href={`tel:${CONTACT.phone}`} className={linkCls}>
                <span>{CONTACT.phone}</span>
                <Arrow />
                <CardKerb />
              </a>
            ) : (
              <Pending>Phone number coming soon.</Pending>
            )}
          </dd>
        </Reveal>
      </dl>
    </Shell>
  );
}
