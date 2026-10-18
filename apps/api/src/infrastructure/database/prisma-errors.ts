function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

export function isSerializationConflict(error: unknown): boolean {
  if (hasCode(error, 'P2034')) return true;
  if (!hasCode(error, 'P2010')) return false;
  if (typeof error !== 'object' || error === null || !('meta' in error)) return false;

  const meta = error.meta;
  if (typeof meta !== 'object' || meta === null) return false;
  if ('code' in meta && meta.code === '40001') return true;
  if (!('driverAdapterError' in meta)) return false;

  const adapterError = meta.driverAdapterError;
  if (typeof adapterError !== 'object' || adapterError === null || !('cause' in adapterError))
    return false;
  const cause = adapterError.cause;
  return (
    typeof cause === 'object' &&
    cause !== null &&
    'kind' in cause &&
    cause.kind === 'TransactionWriteConflict'
  );
}

export function isUniqueConstraintError(error: unknown): boolean {
  return hasCode(error, 'P2002');
}
