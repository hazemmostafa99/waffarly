import type { PosEmployeeSession } from '@waffarly/contracts';
import { Dialog, useLocale } from '@waffarly/ui';
import { useEffect } from 'react';
import { create } from 'zustand';
import { ApiError } from '../../lib/api-client.js';
import { PosRegisterPairing } from './pos-register-pairing.js';

const PAIR_REGISTER_MESSAGE = 'Pair this browser with a POS register before continuing.';

interface PairingPromptState {
  open: boolean;
  show: () => void;
  hide: () => void;
}

/** One app-wide pairing prompt, opened by register actions on an unpaired browser. */
export const usePairingPromptStore = create<PairingPromptState>((set) => ({
  open: false,
  show: () => set({ open: true }),
  hide: () => set({ open: false }),
}));

/** True for the API's rejection of register work from an unpaired browser. */
export function isRegisterPairingError(error: unknown): boolean {
  return (
    error instanceof ApiError && error.statusCode === 403 && error.message === PAIR_REGISTER_MESSAGE
  );
}

/**
 * Call before starting register work. Returns false and opens the pairing card
 * when this browser has no register, so the action is not sent at all.
 */
export function requirePairedRegister(
  employee: Pick<PosEmployeeSession, 'deviceRegister'> | undefined,
): boolean {
  if (!employee || employee.deviceRegister) return true;
  usePairingPromptStore.getState().show();
  return false;
}

export function PosRegisterPairingDialog({ employee }: { employee: PosEmployeeSession }) {
  const { t } = useLocale();
  const open = usePairingPromptStore((state) => state.open);
  const hide = usePairingPromptStore((state) => state.hide);
  const paired = Boolean(employee.deviceRegister);

  // The session refetch after binding brings the register; the card has done its job.
  useEffect(() => {
    if (paired) hide();
  }, [paired, hide]);

  if (!open || paired) return null;
  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next) hide();
      }}
      title={t('Connect this browser to a register')}
      closeLabel={t('Close')}
    >
      <div className="p-4 sm:p-5">
        <PosRegisterPairing employee={employee} framed={false} />
      </div>
    </Dialog>
  );
}
