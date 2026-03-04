export interface WritingItem {
  slug: string;
  title: string;
  publicationName: string;
  publicationLogo?: string;
  publishedAt: string;
  summary: string;
  externalUrl: string;
  featured?: boolean;
  thumbnailSrc?: string;
}
