import { createParamDecorator, UnauthorizedException, type ExecutionContext } from '@nestjs/common';
import type { OwnerProfile } from '@waffarly/contracts';
import type { Request } from 'express';

export interface ActorRequest extends Request {
  owner?: OwnerProfile;
  administrator?: string;
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
