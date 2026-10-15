/** File bytes and delivery URLs; media metadata and business rules belong to media. */
export abstract class MediaStorage {
  abstract write(storageKey: string, bytes: Buffer): Promise<void>;
  abstract remove(storageKey: string): Promise<void>;
  abstract publicUrl(storageKey: string): string;
}
