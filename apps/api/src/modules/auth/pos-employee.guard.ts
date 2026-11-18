import {
  ForbiddenException,
  Inject,
  Injectable,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { AuthService } from './auth.service.js';
import type { ActorRequest } from './current-actor.js';

@Injectable()
export class PosEmployeeGuard implements CanActivate {
  constructor(@Inject(AuthService) private readonly auth: AuthService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<ActorRequest>();
    const employee = await this.auth.requirePosEmployee(request);
    const path = request.path.replace(/\/+$/, '');
    const registerSetupRequest =
      (request.method === 'GET' && path.endsWith('/pos/registers')) ||
      (request.method === 'POST' && path.endsWith('/pos/registers/bind'));

    if (!employee.deviceRegister && !registerSetupRequest) {
      throw new ForbiddenException('Pair this browser with a POS register before continuing.');
    }

    if (employee.deviceRegister) {
      const body = request.body as
        | { registerId?: unknown; request?: { registerId?: unknown } }
        | undefined;
      const requestedRegisterIds = [request.query.registerId, body?.registerId, body?.request?.registerId];
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
