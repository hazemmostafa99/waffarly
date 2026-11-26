/** Finds the active online branches and checks their operating hours. */
import type { PublicRestaurantBranch, RestaurantSettingsInput } from '@waffarly/contracts';
import type { Prisma } from '@waffarly/database';
import { restaurantOperatingState, type RestaurantOrderChannel } from './restaurant-hours.js';

export async function restaurantOnlineBranches(
  db: Prisma.TransactionClient,
  merchantId: string,
  settings: RestaurantSettingsInput,
  now = new Date(),
  channel: RestaurantOrderChannel = 'marketplace',
): Promise<PublicRestaurantBranch[]> {
  const configured = settings.branchFulfillment ?? [];
  if (!configured.length) return [];
  const branches = await db.branch.findMany({
    where: { merchantId, archivedAt: null, id: { in: configured.map((entry) => entry.branchId) } },
    select: { id: true, name: true, address: true },
  });
  const open = restaurantOperatingState(settings, now, channel).acceptingOrders;
  return branches.flatMap(({ id, name, address }) => {
    const branch = configured.find((entry) => entry.branchId === id);
    if (!branch) return [];
    const scheduleOpen = !branch.dailyHours || restaurantOperatingState({
      ...settings,
      alwaysOpen: false,
      scheduleExceptions: [],
      openingHours: Array.from({ length: 7 }, (_, day) => ({ day, periods: [branch.dailyHours!] })),
    }, now).isOpen;
    return [{
      ...branch,
      delivery: settings.deliveryEnabled && branch.delivery,
      pickup: settings.pickupEnabled && branch.pickup,
      name,
      address,
      acceptingOrders: open && scheduleOpen && !branch.paused,
    }];
  });
}
