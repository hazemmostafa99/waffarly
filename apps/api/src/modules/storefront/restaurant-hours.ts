import type { RestaurantSettingsInput, RestaurantOperatingState } from '@waffarly/contracts';
export function restaurantOperatingState(
  settings: Pick<
    RestaurantSettingsInput,
    'timezone' | 'openingHours' | 'scheduleExceptions' | 'alwaysOpen' | 'ordersPaused' | 'published'
  >,
  now = new Date(),
): RestaurantOperatingState {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: settings.timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)!.value;
  const date = `${get('year')}-${get('month')}-${get('day')}`;
  const today = new Date(`${date}T12:00:00Z`);
  const yesterday = new Date(today.getTime() - 86400000);
  const previousDate = yesterday.toISOString().slice(0, 10);
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  const toMinutes = (clock: string) => Number(clock.slice(0, 2)) * 60 + Number(clock.slice(3));
  const exception = settings.scheduleExceptions.find((entry) => entry.date === date);
  const periods = (day: number, key: string) =>
    settings.scheduleExceptions.find((entry) => entry.date === key)?.periods ??
    settings.openingHours.find((entry) => entry.day === day)?.periods ??
    [];
  const inPeriod = periods(today.getUTCDay(), date).some((period) => {
    const start = toMinutes(period.open),
      end = toMinutes(period.close);
    return end > start ? minutes >= start && minutes < end : minutes >= start;
  });
  // A dated closure overrides spillover from the previous day.
  const spillover =
    !exception &&
    periods(yesterday.getUTCDay(), previousDate).some(
      (period) =>
        toMinutes(period.close) < toMinutes(period.open) && minutes < toMinutes(period.close),
    );
  const isOpen = (settings.alwaysOpen && !exception) || inPeriod || spillover;
  return {
    isOpen,
    acceptingOrders: settings.published && isOpen && !settings.ordersPaused,
    reason: !settings.published
      ? 'unpublished'
      : settings.ordersPaused
        ? 'paused'
        : isOpen
          ? 'open'
          : 'closed',
  };
}
