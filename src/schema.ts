import { z } from 'zod';

export const eventTypeSchema = z.enum(['competition', 'promotion', 'open_mat', 'seminar']);

export const scrapedEventSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: eventTypeSchema,
  date: z.string().min(1), // display PT-BR
  location: z.string(),
  ctaLabel: z.string().min(1),
  icon: z.string().min(1),
  dateISO: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'dateISO deve ser YYYY-MM-DD'),
  source: z.string().min(1),
  // Restringe a http(s): z.url() sozinho aceitaria "javascript:..." e outros
  // schemes perigosos, que poderiam virar href no app (defesa em profundidade).
  sourceUrl: z
    .string()
    .url()
    .refine((u) => /^https?:\/\//i.test(u), 'sourceUrl deve usar http(s)'),
  scrapedAt: z.string().datetime(),
});

export const outputSchema = z.array(scrapedEventSchema);

export type ScrapedEventParsed = z.infer<typeof scrapedEventSchema>;
