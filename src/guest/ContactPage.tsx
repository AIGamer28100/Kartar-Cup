import Divider from '../components/Divider';
import { CONTACT } from '../config/contact';
import { usePageMeta } from '../lib/pageMeta';
import { Eyebrow, PageTitle, Reveal, Shell, WhatsAppCta } from './parts';

const linkCls = '-mx-2 inline-flex min-h-11 items-center px-2 text-ink underline underline-offset-4 hover:text-accent-text';

function Pending({ children }: { children: string }) {
  return <span className="text-muted">{children}</span>;
}

/** Public /contact. Real values come from src/config/contact.ts; blanks render as a clear
 * placeholder for the host to fill in rather than made-up details. */
export default function ContactPage() {
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
            <dd className="mt-1">
              <a href={a.url} target="_blank" rel="noopener noreferrer" className={linkCls}>
                {a.handle}
              </a>
              <p className="mt-1 text-sm text-muted">{a.role}</p>
            </dd>
          </Reveal>
        ))}
        <Reveal index={3}>
          <dt className="font-mono text-xs uppercase tracking-widest text-muted">WhatsApp community</dt>
          <dd className="mt-2">
            {CONTACT.whatsappUrl ? (
              <WhatsAppCta url={CONTACT.whatsappUrl} />
            ) : (
              <Pending>Link coming soon.</Pending>
            )}
          </dd>
        </Reveal>
        <Reveal index={4}>
          <dt className="font-mono text-xs uppercase tracking-widest text-muted">Email</dt>
          <dd className="mt-1">
            {CONTACT.email ? (
              <a href={`mailto:${CONTACT.email}`} className={linkCls}>
                {CONTACT.email}
              </a>
            ) : (
              <Pending>Email coming soon.</Pending>
            )}
          </dd>
        </Reveal>
        <Reveal index={5}>
          <dt className="font-mono text-xs uppercase tracking-widest text-muted">Phone</dt>
          <dd className="mt-1">
            {CONTACT.phone ? (
              <a href={`tel:${CONTACT.phone}`} className={linkCls}>
                {CONTACT.phone}
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
