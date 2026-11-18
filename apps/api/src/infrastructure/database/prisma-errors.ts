function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

/** Only database connectivity/capacity errors; never validation or transaction conflicts. */
export function isDatabaseUnavailable(error: unknown): boolean {
  // pg 8.16 emits these acquisition/handshake timeouts without an error code.
  if (
    error instanceof Error &&
    [
      'Connection terminated due to connection timeout',
      'timeout exceeded when trying to connect',
    ].includes(error.message)
  )
    return true;
  if (typeof error !== 'object' || error === null) return false;
  const record = error as Record<string, unknown>;
  if (['P1001', 'P1002', 'P1017', 'P2024'].includes(String(record.code))) return true;
  const meta = record.meta as Record<string, unknown> | undefined;
  if (meta && typeof meta === 'object') {
    if (['57P01', '57P02', '57P03', '53300'].includes(String(meta.code))) return true;
    const adapter = meta.driverAdapterError as Record<string, unknown> | undefined;
    if (adapter && typeof adapter === 'object' && isUnavailableCause(adapter.cause)) return true;
  }
  return record.name === 'DriverAdapterError' && isUnavailableCause(record.cause);
}

function isUnavailableCause(cause: unknown): boolean {
  if (typeof cause !== 'object' || cause === null) return false;
  const record = cause as Record<string, unknown>;
  return (
    ['DatabaseNotReachable', 'ConnectionClosed', 'SocketTimeout'].includes(String(record.kind)) ||
    ['57P01', '57P02', '57P03', '53300'].includes(String(record.originalCode))
  );
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
