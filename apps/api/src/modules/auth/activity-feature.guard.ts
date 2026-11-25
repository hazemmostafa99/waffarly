/**
 * Blocks owner and cashier requests for features their business activity does not use,
 * such as a clothing store calling the kitchen or dining-table endpoints directly.
 */
import {
  ForbiddenException,
  Inject,
  Injectable,
  SetMetadata,
  type CanActivate,
  type ExecutionContext,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { actorActivityFeatures, type ActivityFeature } from '@waffarly/contracts';
import type { ActorRequest } from './current-actor.js';

const REQUIRED_ACTIVITY_FEATURE = 'requiredActivityFeature';

/** Marks a controller or route as usable only when the merchant's activity has this feature on. */
export const RequireActivityFeature = (feature: ActivityFeature) =>
  SetMetadata(REQUIRED_ACTIVITY_FEATURE, feature);

/**
 * Must be listed after `OwnerGuard` or `PosEmployeeGuard`, which load the signed-in actor
 * together with the feature switches Super Admin saved for its activity.
 */
@Injectable()
export class ActivityFeatureGuard implements CanActivate {
  constructor(@Inject(Reflector) private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const feature = this.reflector.getAllAndOverride<ActivityFeature | undefined>(
      REQUIRED_ACTIVITY_FEATURE,
      [context.getHandler(), context.getClass()],
    );
    if (!feature) return true;
    const request = context.switchToHttp().getRequest<ActorRequest>();
    const actor = request.posEmployee ?? request.owner;
    if (!actor || !actorActivityFeatures(actor)[feature]) {
      throw new ForbiddenException('This feature is not available for this business activity.');
    }
    return true;
  }
}
