import { useState, type FormEvent } from 'react';
import { Button, Input } from '@waffarly/ui';
import type { PurchaseSupplier } from '@waffarly/contracts';
import { DashboardDialog } from '../../components/DashboardDialog.js';
import type { SupplierFields } from './purchasing.types.js';

export function SupplierEditor({
  supplier,
  busy,
  text,
  onClose,
  onSave,
}: {
  supplier: PurchaseSupplier | null;
  busy: boolean;
  text: (value: string) => string;
  onClose: () => void;
  onSave: (fields: SupplierFields, requestId?: string, revision?: number) => void;
}) {
  const [requestId] = useState(crypto.randomUUID());
  const [name, setName] = useState(supplier?.name ?? '');
  const [contactName, setContactName] = useState(supplier?.contactName ?? '');
  const [phone, setPhone] = useState(supplier?.phone ?? '');
  const [email, setEmail] = useState(supplier?.email ?? '');
  const [address, setAddress] = useState(supplier?.address ?? '');
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSave({ name, contactName, phone, email, address }, requestId, supplier?.revision);
  }
  return (
    <DashboardDialog
      title={text(supplier ? 'Edit supplier' : 'Create supplier')}
      closeLabel={text('Close')}
      onClose={onClose}
      busy={busy}
    >
      <form className="products-dialog-body inventory-editor" onSubmit={submit}>
        <label>
          {text('Supplier')}
          <Input
            required
            maxLength={160}
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label>
          {text('Contact name')}
          <Input
            maxLength={160}
            value={contactName}
            onChange={(event) => setContactName(event.target.value)}
          />
        </label>
        <label>
          {text('Phone')}
          <Input maxLength={32} value={phone} onChange={(event) => setPhone(event.target.value)} />
        </label>
        <label>
          {text('Email')}
          <Input
            type="email"
            maxLength={254}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label>
          {text('Address')}
          <Input
            maxLength={500}
            value={address}
            onChange={(event) => setAddress(event.target.value)}
          />
        </label>
        <footer className="products-dialog-footer">
          <Button type="button" variant="outline" disabled={busy} onClick={onClose}>
            {text('Close')}
          </Button>
          <Button type="submit" disabled={busy}>
            {text('Save supplier')}
          </Button>
        </footer>
      </form>
    </DashboardDialog>
  );
}
