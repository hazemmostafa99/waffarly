import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { AppConfiguration } from '../../config/app-configuration.js';
import { MediaStorage } from './media-storage.js';

@Injectable()
export class LocalMediaStorage extends MediaStorage {
  constructor(@Inject(AppConfiguration) private readonly config: AppConfiguration) {
    super();
  }

  async write(storageKey: string, bytes: Buffer): Promise<void> {
    const filePath = this.resolvePath(storageKey);
    await mkdir(dirname(filePath), { recursive: true, mode: 0o750 });
    await writeFile(filePath, bytes, { flag: 'wx', mode: 0o640 });
  }

  async remove(storageKey: string): Promise<void> {
    await unlink(this.resolvePath(storageKey));
  }

  publicUrl(storageKey: string): string {
    return new URL(
      `/media/${storageKey.split('/').map(encodeURIComponent).join('/')}`,
      this.config.publicApiBaseUrl,
    ).toString();
  }

  private resolvePath(storageKey: string): string {
    const storageRoot = resolve(this.config.mediaStorageDirectory);
    const filePath = resolve(storageRoot, ...storageKey.split('/'));
    const relativePath = relative(storageRoot, filePath);
    if (
      !relativePath ||
      relativePath === '..' ||
      relativePath.startsWith(`..${sep}`) ||
      isAbsolute(relativePath)
    ) {
      throw new BadRequestException('Invalid upload path.');
    }
    return filePath;
  }
}
