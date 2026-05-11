// INLINED COPY — source of truth: TSGCFO/NexFortis-Website-Design-pro
// When this type changes in the main repo, manually re-sync here.
// Last synced: 2026-05-10

import type { Pillar } from './pillar.js';

export interface Article {
  id: string;
  slug: string;
  title: string;
  pillar: Pillar;
  authorId: string;
  publishedAt: string | null;
}
