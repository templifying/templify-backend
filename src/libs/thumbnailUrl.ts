/**
 * Builds a public thumbnail URL from a thumbnail S3 key.
 * Thumbnails are served directly from S3 with public read access.
 */
export function buildThumbnailUrl(thumbnailKey?: string): string | null {
  if (!thumbnailKey || !process.env.ASSETS_BUCKET_URL) {
    return null;
  }
  return `${process.env.ASSETS_BUCKET_URL}/${thumbnailKey}`;
}

/**
 * Adds thumbnailUrl to a marketplace template object.
 */
export function withThumbnailUrl<T extends Record<string, unknown>>(
  template: T
): T & { thumbnailUrl: string | null } {
  const thumbnailKey = template.thumbnailKey as string | undefined;
  return {
    ...template,
    thumbnailUrl: buildThumbnailUrl(thumbnailKey)
  };
}
