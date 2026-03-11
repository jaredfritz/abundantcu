import { writingSeed } from "@/data/writings.seed";
import { WritingItem } from "@/lib/content/types";

const SANITY_VERSION = "2025-10-01";
const rawWritingsRevalidate = Number(process.env.SANITY_REVALIDATE_SECONDS);
const WRITINGS_REVALIDATE_SECONDS =
  Number.isFinite(rawWritingsRevalidate) && rawWritingsRevalidate > 0
    ? Math.floor(rawWritingsRevalidate)
    : 3600;

export async function getWritings(): Promise<WritingItem[]> {
  const projectId = process.env.SANITY_PROJECT_ID;
  const dataset = process.env.SANITY_DATASET;

  if (!projectId || !dataset) {
    return writingSeed;
  }

  const query = encodeURIComponent(
    '*[_type == "writing"] | order(publishedAt desc) { "slug": slug.current, title, publicationName, publicationLogo, publishedAt, summary, externalUrl, featured }'
  );

  const url = `https://${projectId}.api.sanity.io/v${SANITY_VERSION}/data/query/${dataset}?query=${query}`;
  const response = await fetch(url, {
    headers: process.env.SANITY_READ_TOKEN
      ? { Authorization: `Bearer ${process.env.SANITY_READ_TOKEN}` }
      : undefined,
    next: { revalidate: WRITINGS_REVALIDATE_SECONDS },
  });

  if (!response.ok) {
    return writingSeed;
  }

  const payload = (await response.json()) as { result?: WritingItem[] };
  return payload.result?.length ? payload.result : writingSeed;
}
