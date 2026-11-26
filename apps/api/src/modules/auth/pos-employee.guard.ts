import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { ActorRequest } from './current-actor.js';

const PAIR_REGISTER_MESSAGE = 'Pair this browser with a POS register before continuing.';

/**
 * Requests an unpaired browser may still make. Reads let staff browse orders,
 * catalog and inventory right after sign-in; the pairing prompt appears only when
 * they start register work. Price quotes are reads sent as POST and change nothing.
 */
function isAllowedWithoutRegister(method: string, path: string): boolean {
  if (method === 'GET') return true;
  if (method !== 'POST') return false;
  return path.endsWith('/pos/registers/bind') || path.endsWith('/pos/orders/quote');
}

@Injectable()
export class PosEmployeeGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ActorRequest>();
    const employee = await this.auth.requirePosEmployee(request);
    const path = request.path.replace(/\/+$/, '');
    const body = request.body as
      | { registerId?: unknown; request?: { registerId?: unknown } }
      | undefined;
    const requestedRegisterIds = [request.query.registerId, body?.registerId, body?.request?.registerId];

    if (!employee.deviceRegister) {
      // An unpaired browser must not read or act on any one register's data.
      const namesRegister = requestedRegisterIds.some((id) => typeof id === 'string');
      if (namesRegister || !isAllowedWithoutRegister(request.method, path)) {
        throw new ForbiddenException(PAIR_REGISTER_MESSAGE);
      }
    } else {
      for (const registerId of requestedRegisterIds) {
        if (typeof registerId === 'string' && registerId !== employee.deviceRegister.id) {
          throw new ForbiddenException('This browser can only use its paired POS register.');
        }
      }
    }

    request.posEmployee = employee;
    return true;
  }
}
