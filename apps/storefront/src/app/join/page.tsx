import type { Metadata } from 'next';
import { JoinContent } from './join-content';

export const metadata: Metadata = {
  title: 'Apply to join Waffarly',
  description: 'Apply to set up your business with Waffarly.',
};

export default function JoinPage() {
  return <JoinContent />;
}
