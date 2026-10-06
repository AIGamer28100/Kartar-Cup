import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { DEVELOPER, OPERATOR, missing } from '../config/legal';
import { usePageMeta } from '../lib/pageMeta';
import { Eyebrow, H3, PageTitle, Reveal, Shell } from './parts';

/* /terms and /privacy. Drafting aid only - the operator must have a lawyer review these before the site
 * takes real bookings. Facts below describe what the app actually does today (mock payments, Google
 * sign-in, Firebase). Anything the operator must supply is rendered as a marked placeholder, never invented. */

/** A value the operator must fill in (src/config/legal.ts); shows a visible marker until they do. */
function Op({ value, label }: { value: string; label: string }) {
  return missing(value) ? (
    <mark className="rounded bg-raised px-1.5 font-mono text-xs text-accent-text">[operator to complete: {label}]</mark>
  ) : (
    <span>{value}</span>
  );
}

const who = (
  <>
    <Op value={OPERATOR.legalName} label="legal name" />
  </>
);

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="mt-8">
      <h2 id={id} className={H3}>{title}</h2>
      <div className="mt-2 grid max-w-[68ch] gap-3 text-pretty text-muted [&_strong]:font-semibold [&_strong]:text-ink [&_ul]:grid [&_ul]:list-disc [&_ul]:gap-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}

function Doc({ eyebrow, title, intro, children }: { eyebrow: string; title: string; intro: ReactNode; children: ReactNode }) {
  return (
    <Shell>
      <Reveal>
        <Eyebrow>{eyebrow}</Eyebrow>
        <h1 className={`mt-3 ${PageTitle}`}>{title}</h1>
        <p className="mt-3 max-w-[68ch] text-pretty text-muted">{intro}</p>
        <p className="mt-2 font-mono text-xs text-muted">Last reviewed {OPERATOR.lastReviewed}</p>
      </Reveal>
      <Reveal index={1}>{children}</Reveal>
      <Reveal index={2} className="mt-10">
        <p className="text-sm text-muted">
          See also <Link to="/terms" className="text-accent-text underline underline-offset-4">Terms</Link> and{' '}
          <Link to="/privacy" className="text-accent-text underline underline-offset-4">Privacy</Link>.
        </p>
      </Reveal>
    </Shell>
  );
}

export function TermsPage() {
  usePageMeta({ title: 'Terms and conditions', description: 'The terms for using the Kartar CUP website, bookings and prediction game.' });
  return (
    <Doc
      eyebrow="Legal"
      title="Terms and conditions"
      intro={<>These terms apply when you use this website. The site is run by {who}, called "the operator" below. By using it you agree to these terms.</>}
    >
      <Section id="who" title="Who runs this site">
        <p>The operator runs this site and is the party you deal with for events, tickets, prizes, support and your data. Operator details: <strong>Name</strong> {who}; <strong>Address</strong> <Op value={OPERATOR.address} label="address" />; <strong>Email</strong> <Op value={OPERATOR.email} label="contact email" />.</p>
        <p>The software was designed and built by {DEVELOPER.name}. {DEVELOPER.name} does <strong>not</strong> operate the site, host it, sell tickets, run events, hold or see user data, or decide how the site is used. It is not a party to any booking, prediction or other dealing between you and the operator.</p>
      </Section>

      <Section id="use" title="Using the site">
        <ul>
          <li>You must be old enough to agree to these terms. If you are under 18, use the site only with a parent or guardian who agrees to them for you.</li>
          <li>Sign-in is with a Google account. Keep your account secure; you are responsible for what happens under it.</li>
          <li>Do not misuse the site: no attempts to break, overload or scrape it, to see other people's data, or to cheat the prediction game.</li>
          <li>The operator may change, pause or end any part of the site, and may remove accounts that break these terms.</li>
        </ul>
      </Section>

      <Section id="events" title="Events, bookings and tickets">
        <ul>
          <li>Events, venues, dates, prices and capacity are set by the operator and can change. Seats are limited and are held only once a booking is confirmed.</li>
          <li>At the time of writing the site does <strong>not</strong> process real payments: the payment step is a placeholder. Any payment is arranged directly with the operator, who will tell you how.</li>
          <li>Cancellations and refunds follow the policy shown on each event. A ticket is for the named booking only and may not be resold unless the operator allows it.</li>
          <li>VIP passes and Play cards are physical items handed out at some events. Their rules, including how Play-card points count towards the prediction score, are set by the operator.</li>
        </ul>
      </Section>

      <Section id="game" title="Prediction game and prizes">
        <ul>
          <li>The prediction game is a free fan activity. You pay nothing to play and stake nothing; there is no cash-out.</li>
          <li>Scores, rankings, tie-breaks and winners are decided by the operator and are final. Prizes, if any, are given and described by the operator at its own discretion and responsibility, including any legal requirements that apply to them.</li>
          <li>Race results and F1 information shown on the site come from third parties and may be late, incomplete or wrong.</li>
        </ul>
      </Section>

      <Section id="ip" title="Ownership and third-party content">
        <ul>
          <li>The software, design and original text of this site are copyright {DEVELOPER.year} {DEVELOPER.name}. All rights reserved. You may use the site; you may not copy or reuse its code or design.</li>
          <li>The Karter Cup and Karter Club names and marks belong to the operator.</li>
          <li>Formula 1, team and driver names, logos and photographs belong to their owners. This is an independent fan site and is not affiliated with, endorsed by or sponsored by Formula 1, any team or any driver.</li>
          <li>Race data comes from OpenF1 (CC BY-NC-SA 4.0) and Open-Meteo, and track facts from public sources such as formula1.com and Wikipedia. These remain the property of their owners and are used under their own terms.</li>
        </ul>
      </Section>

      <Section id="liability" title="No warranty and limits on liability">
        <ul>
          <li>The site is provided "as is" and "as available", without promises that it will always work, be accurate or be free of errors.</li>
          <li>To the fullest extent the law allows, neither the operator nor {DEVELOPER.name} is liable for indirect or consequential loss, or for loss caused by outages, data errors, third-party services, or events beyond their control. Nothing here limits liability that cannot lawfully be limited.</li>
          <li>{DEVELOPER.name} has no responsibility for the operation, content, data, events, payments, prizes or legal compliance of the site. The operator is solely responsible for these and for any claim arising from them, and will answer for them to users and to authorities.</li>
        </ul>
      </Section>

      <Section id="law" title="Changes, law and disputes">
        <p>The operator may update these terms; the date above shows when they were last reviewed. These terms are governed by the laws of India. Disputes belong to the courts at <Op value={OPERATOR.jurisdiction} label="court location" />, unless the law gives you a right to go elsewhere.</p>
        <p>Questions about these terms: <Op value={OPERATOR.email} label="contact email" />.</p>
      </Section>
    </Doc>
  );
}

export function PrivacyPage() {
  usePageMeta({ title: 'Privacy policy', description: 'What personal data the Kartar CUP website collects, why, who sees it and your choices.' });
  return (
    <Doc
      eyebrow="Legal"
      title="Privacy policy"
      intro={<>This explains what personal data this website handles. The operator, {who}, decides why and how your data is used and is responsible for it.</>}
    >
      <Section id="roles" title="Who is responsible">
        <p><strong>Operator (decides how your data is used):</strong> {who}. Contact: <Op value={OPERATOR.email} label="contact email" />. Address: <Op value={OPERATOR.address} label="address" />.</p>
        <p><strong>Grievance officer:</strong> <Op value={OPERATOR.grievanceOfficer} label="name and contact of the grievance officer" />.</p>
        <p>The software was built by {DEVELOPER.name}, which does not run the site, does not store or see your data, and does not decide how it is used.</p>
      </Section>

      <Section id="collect" title="What we collect">
        <ul>
          <li><strong>Account:</strong> your name, email address and profile photo from Google when you sign in, plus a user id and any role the operator gives you.</li>
          <li><strong>Prediction game:</strong> your name, your picks, the time you submitted, and a phone number only if you choose to give one.</li>
          <li><strong>Bookings:</strong> your name, email, ticket type and quantity, price, booking status, a ticket code (it contains no personal details), and, at events, your VIP pass number and Play card.</li>
          <li><strong>Payments:</strong> none are processed through the site today, so we hold no card or bank details. If that changes, this page will say so before it does.</li>
          <li><strong>Staff activity:</strong> actions by hosts and admins (for example check-ins and changes) are logged with the staff member's email and the time.</li>
          <li><strong>On your device:</strong> the site saves small items in your browser (a draft of your picks, cached race data, a note that you have seen the intro animation) and a service worker so the site can be installed. It does not use advertising or analytics trackers.</li>
        </ul>
      </Section>

      <Section id="why" title="Why we use it">
        <ul>
          <li>To let you sign in, book events, check in at the door and take part in the prediction game.</li>
          <li>To show you your own tickets, cards, scores and history.</li>
          <li>To run events: contacting winners, sending the community invite, preventing fraud and keeping the site secure.</li>
        </ul>
        <p>We use it only for these purposes, based on your consent when you sign in or submit your details. You can withdraw consent at any time (see your rights).</p>
      </Section>

      <Section id="share" title="Who else is involved">
        <ul>
          <li><strong>Google Firebase</strong> (Authentication, Firestore database and Hosting) stores and serves the site's data on behalf of the operator. Google may process data on servers outside India.</li>
          <li><strong>Hosts and admins</strong> of the operator can see entries and bookings for their events. Other guests cannot see your data.</li>
          <li><strong>Public data services.</strong> Your browser fetches race information directly from OpenF1, Open-Meteo and Jolpica, driver photos from Formula 1's media servers, and, on some pages, an embedded Google Map. These services can see your IP address and basic browser details, as with any website you visit.</li>
          <li>We do not sell your data. We may disclose it if the law requires.</li>
        </ul>
      </Section>

      <Section id="keep" title="How long we keep it">
        <p>The operator keeps account, booking and entry records while they are needed to run events and meet legal duties, then deletes or anonymises them. You can ask for earlier deletion at any time. Retention period set by the operator: <Op value="" label="retention period, e.g. 24 months after your last event" />.</p>
      </Section>

      <Section id="rights" title="Your rights and choices">
        <ul>
          <li>Ask to see the personal data we hold about you, to correct it, or to delete it.</li>
          <li>Withdraw your consent, or object to a use of your data.</li>
          <li>Nominate someone to act for you, and complain to the grievance officer above. If you are not satisfied, you may approach the Data Protection Board of India under the Digital Personal Data Protection Act, 2023.</li>
        </ul>
        <p>Write to <Op value={OPERATOR.email} label="contact email" />. The operator will respond within a reasonable time and in line with the law.</p>
      </Section>

      <Section id="children" title="Children">
        <p>If you are under 18, please use the site only with a parent or guardian who agrees to this policy. The operator will not knowingly keep a child's data without that consent and will delete it on request.</p>
      </Section>

      <Section id="security" title="Security and changes">
        <p>Data is protected by Google's infrastructure and by access rules that stop guests reading each other's data. No system is perfectly secure. If a breach affects you, the operator will tell you and the authorities as the law requires.</p>
        <p>The operator may update this policy; the date above shows the last review.</p>
      </Section>
    </Doc>
  );
}
