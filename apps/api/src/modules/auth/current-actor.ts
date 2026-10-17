import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { OwnerProfile, PosEmployeeSession } from '@waffarly/contracts';
import type { Request } from 'express';

export interface ActorRequest extends Request {
  owner?: OwnerProfile;
  administrator?: string;
  posEmployee?: PosEmployeeSession;
}

export const CurrentOwner = createParamDecorator(
  (_data: unknown, context: ExecutionContext): OwnerProfile => {
    const owner = context.switchToHttp().getRequest<ActorRequest>().owner;
    if (!owner) throw new UnauthorizedException('Sign in is required.');
    return owner;
  },
);

export const CurrentAdmin = createParamDecorator(
  (_data: unknown, context: ExecutionContext): string => {
    const administrator = context.switchToHttp().getRequest<ActorRequest>().administrator;
    if (!administrator) throw new UnauthorizedException('Sign in is required.');
    return administrator;
  },
);

export const CurrentPosEmployee = createParamDecorator(
  (_data: unknown, context: ExecutionContext): PosEmployeeSession => {
    const employee = context.switchToHttp().getRequest<ActorRequest>().posEmployee;
    if (!employee) throw new UnauthorizedException('Sign in is required.');
    return employee;
  },
);
