const SHIFT_REQUIRED_EN = "Open a cashier shift at this order's branch before changing its status.";
const SHIFT_REQUIRED_AR = 'افتح وردية كاشير في فرع الطلب قبل تغيير حالته.';

export function orderActionMessage(error: unknown): string {
  if (
    error &&
    typeof error === 'object' &&
    'errorCode' in error &&
    error.errorCode === 'ORDER_SHIFT_REQUIRED'
  )
    return SHIFT_REQUIRED_EN;
  return error instanceof Error ? error.message : 'The action could not be completed.';
}

export function formatOrderActionError(
  message: string,
  locale: string,
  fallback: (message: string) => string,
) {
  if (message === SHIFT_REQUIRED_EN || message === SHIFT_REQUIRED_AR)
    return locale === 'ar' ? SHIFT_REQUIRED_AR : SHIFT_REQUIRED_EN;
  return fallback(message);
}
