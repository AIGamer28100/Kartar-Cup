import { QUIZ_RESULTS, QUIZ_TABS, quizPath } from '../nav';
import { LinkTabs } from './Tabs';

/** Sub-navigation shared by a booking event's quiz pages: the four editor tabs plus Results. Absolute links,
 * so it works from the editor layout and from the sibling results route alike. */
export function QuizTabs({ eventId }: { eventId: string }) {
  const tabs = [...QUIZ_TABS, QUIZ_RESULTS].map((t) => ({ ...t, to: quizPath(eventId, t.id) }));
  return <LinkTabs tabs={tabs} label="Quiz sections" />;
}
