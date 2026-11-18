/** Stores private uploaded files outside the API's public media directory. */
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path';
import { AppConfiguration } from '../../config/app-configuration.js';

@Injectable()
export class PrivateMediaStorage {
  constructor(@Inject(AppConfiguration) private readonly config: AppConfiguration) {}

  async write(key: string, bytes: Buffer): Promise<void> {
    const path = this.resolvePath(key);
    await mkdir(dirname(path), { recursive: true, mode: 0o750 });
    await writeFile(path, bytes, { flag: 'wx', mode: 0o640 });
  }

  async read(key: string): Promise<Buffer> {
    return readFile(this.resolvePath(key));
  }

  async remove(key: string): Promise<void> {
    await unlink(this.resolvePath(key));
  }

  private resolvePath(key: string): string {
    const root = resolve(this.config.privateMediaStorageDirectory);
    const path = resolve(root, ...key.split('/'));
    const child = relative(root, path);
    if (!child || child === '..' || child.startsWith(`..${sep}`) || isAbsolute(child))
      throw new BadRequestException('Invalid private file path.');
    return path;
  }
}
