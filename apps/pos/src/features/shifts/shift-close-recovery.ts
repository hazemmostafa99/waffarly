import { ApiError } from '../../lib/api-client.js';

/** Only explicit pre-commit business rejections allow the saved command to be edited. */
export function isCorrectableShiftCloseRejection(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    ((error.statusCode === 403 &&
      error.message ===
        'Choose a different active cashier or supervisor assigned to this branch.') ||
      (error.statusCode === 409 &&
        [
          'Enter a reason for the cash variance.',
          'There are no pending deliveries to hand over. Refresh the shift.',
        ].includes(error.message)))
  );
}
