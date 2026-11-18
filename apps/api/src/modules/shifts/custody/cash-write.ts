/** Saves related cash custody changes together and reports conflicting updates consistently. */
import { ConflictException } from '@nestjs/common';

import type { Prisma } from '@waffarly/database';
import { PrismaService } from '../../../infrastructure/database/prisma.service.js';
import {
  isSerializationConflict,
  isUniqueConstraintError,
} from '../../../infrastructure/database/prisma-errors.js';

export async function runCashCustodyTransaction<T>(
  prisma: PrismaService,
  run: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> {
  try {
    return await prisma.$transaction(run, { isolationLevel: 'Serializable' });
  } catch (error) {
    if (isSerializationConflict(error) || isUniqueConstraintError(error)) {
      throw new ConflictException(
        'Cash records changed. Refresh and retry the same saved request.',
      );
    }
    throw error;
  }
}
