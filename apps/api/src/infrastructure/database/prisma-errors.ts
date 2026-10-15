function hasCode(error: unknown, code: string): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === code;
}

export function isSerializationConflict(error: unknown): boolean {
  return hasCode(error, 'P2034');
}

export function isUniqueConstraintError(error: unknown): boolean {
  return hasCode(error, 'P2002');
}
