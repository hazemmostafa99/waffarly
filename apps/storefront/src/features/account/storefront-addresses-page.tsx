'use client';

import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Pencil, Plus, Star, Trash2, X } from 'lucide-react';
import type {
  CreateStorefrontCustomerAddressRequest,
  StorefrontCustomerAddress,
  UpdateStorefrontCustomerAddressRequest,
} from '@waffarly/contracts';
import { Button, Input, Textarea, useLocale } from '@waffarly/ui';
import { useStorefrontSlug } from '../../components/storefront/storefront-link';
import { DeliveryAreaPicker } from '../delivery/delivery-area-picker';
import {
  restaurantDeliveryLocations,
  useRestaurantFulfillment,
} from '../delivery/restaurant-route-fields';
import { AccountShell } from './account-shell';
import { accountCopy } from './account-copy';
import { useStorefrontCustomer } from './hooks/use-storefront-customer';
import { StorefrontSignInLink } from './storefront-sign-in-link';
import { ApiError } from '@/lib/api-client';
import {
  createStorefrontCustomerAddress,
  deleteStorefrontCustomerAddress,
  loadStorefrontCustomerAddresses,
  storefrontCustomerAddressesKey,
  updateStorefrontCustomerAddress,
} from './data/storefront-customer-api';

type AddressSave =
  | { address: null; values: CreateStorefrontCustomerAddressRequest }
  | { address: StorefrontCustomerAddress; values: UpdateStorefrontCustomerAddressRequest };

function AddressEditor({
  address,
  busy,
  makeDefaultByDefault,
  error,
  onCancel,
  onSave,
}: {
  address?: StorefrontCustomerAddress;
  busy: boolean;
  makeDefaultByDefault: boolean;
  error: string;
  onCancel: () => void;
  onSave: (values: CreateStorefrontCustomerAddressRequest) => void;
}) {
  const { locale } = useLocale();
  const t = accountCopy(locale);
  const slug = useStorefrontSlug();
  const options = useRestaurantFulfillment(slug);
  const configuredLocations = options.data
    ? options.data.onlineBranches !== undefined
      ? restaurantDeliveryLocations(options.data.onlineBranches)
      : options.data.deliveryAreas.map((entry) => ({
          id: entry.id,
          governorate: '',
          locality: entry.name,
          area: '',
        }))
    : [];
  const locations =
    address && !configuredLocations.some((location) => location.id === address.deliveryAreaId)
      ? [
          ...configuredLocations,
          {
            id: address.deliveryAreaId,
            governorate: address.governorate,
            locality: address.locality,
            area: address.area,
          },
        ]
      : configuredLocations;
  const [label, setLabel] = useState(address?.label ?? '');
  const [deliveryAreaId, setDeliveryAreaId] = useState(address?.deliveryAreaId ?? '');
  const [streetAddress, setStreetAddress] = useState(address?.streetAddress ?? '');
  const [notes, setNotes] = useState(address?.notes ?? '');
  const [isDefault, setIsDefault] = useState(address?.isDefault ?? makeDefaultByDefault);
  const location = locations.find((entry) => entry.id === deliveryAreaId);

  return (
    <form
      className="grid gap-4 rounded-2xl border border-store-border bg-store-page p-4 sm:p-5"
      onSubmit={(event) => {
        event.preventDefault();
        if (!location) return;
        onSave({
          label: label.trim(),
          deliveryAreaId: location.id,
          governorate: location.governorate,
          locality: location.locality,
          area: location.area,
          streetAddress: streetAddress.trim(),
          notes: notes.trim(),
          isDefault,
        });
      }}
    >
      <label className="grid gap-1.5 text-sm font-bold text-store-ink">
        {t.addressLabel}
        <Input
          value={label}
          onChange={(event) => setLabel(event.currentTarget.value)}
          required
          maxLength={80}
          className="h-11 rounded-xl border-store-border bg-white"
        />
      </label>
      <div className="grid gap-2 text-sm font-bold text-store-ink">
        {t.chooseDeliveryArea}
        {options.isSuccess && locations.length === 0 ? (
          <p className="text-sm font-normal text-store-muted">{t.noDeliveryAreas}</p>
        ) : options.data?.onlineBranches !== undefined ? (
          <DeliveryAreaPicker
            locations={locations}
            value={deliveryAreaId}
            onSelect={setDeliveryAreaId}
          />
        ) : (
          <select
            value={deliveryAreaId}
            onChange={(event) => setDeliveryAreaId(event.currentTarget.value)}
            disabled={options.isPending || options.isError}
            required
            className="h-11 rounded-xl border border-store-border bg-white px-3"
          >
            <option value="">{t.chooseDeliveryArea}</option>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.area || location.locality || location.governorate}
              </option>
            ))}
          </select>
        )}
        {options.isPending && (
          <p role="status" className="text-sm text-store-muted">
            {t.loadingDeliveryAreas}
          </p>
        )}
        {options.isError && (
          <div role="alert" className="flex flex-wrap items-center gap-2 text-sm text-store-error">
            <span>{t.deliveryAreasError}</span>
            <button type="button" className="underline" onClick={() => void options.refetch()}>
              {t.retry}
            </button>
          </div>
        )}
      </div>
      <label className="grid gap-1.5 text-sm font-bold text-store-ink">
        {t.street}
        <Input
          value={streetAddress}
          onChange={(event) => setStreetAddress(event.currentTarget.value)}
          required
          minLength={5}
          maxLength={500}
          autoComplete="street-address"
          dir="auto"
          style={{ textAlign: locale === 'ar' ? 'right' : 'left' }}
          className="h-11 rounded-xl border-store-border bg-white"
        />
      </label>
      <label className="grid gap-1.5 text-sm font-bold text-store-ink">
        {t.addressNotes} <span className="font-normal text-store-muted">({t.optional})</span>
        <Textarea
          value={notes}
          onChange={(event) => setNotes(event.currentTarget.value)}
          maxLength={500}
          dir="auto"
          style={{ textAlign: locale === 'ar' ? 'right' : 'left' }}
          className="min-h-20 rounded-xl border-store-border bg-white"
        />
      </label>
      <label className="flex items-center gap-2 text-sm font-bold text-store-ink">
        <input
          type="checkbox"
          checked={isDefault}
          onChange={(event) => setIsDefault(event.currentTarget.checked)}
          className="size-4 accent-store-primary"
        />
        {t.makeDefault}
      </label>
      {error && (
        <p role="alert" className="text-sm font-bold text-store-error">
          {error}
        </p>
      )}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={busy}>
          <X className="me-2 size-4" aria-hidden="true" />
          {t.closeForm}
        </Button>
        <Button
          type="submit"
          disabled={busy || options.isPending || options.isError || !location}
          className="bg-store-primary text-white hover:bg-store-primary-dark"
        >
          <Plus className="me-2 size-4" aria-hidden="true" />
          {busy ? (locale === 'ar' ? 'جارٍ الحفظ…' : 'Saving…') : t.reviewAddress}
        </Button>
      </div>
    </form>
  );
}

export function StorefrontAddressesPage() {
  const { locale } = useLocale();
  const t = accountCopy(locale);
  const slug = useStorefrontSlug();
  const session = useStorefrontCustomer();
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<StorefrontCustomerAddress | null | 'new'>(null);
  const [feedback, setFeedback] = useState('');
  const addresses = useQuery({
    queryKey: storefrontCustomerAddressesKey(slug, session.data?.id),
    queryFn: () => loadStorefrontCustomerAddresses(slug),
    enabled: Boolean(session.data),
    retry: false,
  });
  const save = useMutation({
    mutationFn: ({ address, values }: AddressSave) => {
      if (!address) return createStorefrontCustomerAddress(slug, values);
      return updateStorefrontCustomerAddress(slug, address.id, values);
    },
    onSuccess: async (_address, variables) => {
      await queryClient.invalidateQueries({
        queryKey: storefrontCustomerAddressesKey(slug, session.data?.id),
      });
      setEditing(null);
      setFeedback(variables.address ? t.addressUpdated : t.addressAdded);
    },
  });
  const remove = useMutation({
    mutationFn: (address: StorefrontCustomerAddress) =>
      deleteStorefrontCustomerAddress(slug, address.id, { revision: address.revision }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({
        queryKey: storefrontCustomerAddressesKey(slug, session.data?.id),
      });
      setFeedback(t.addressDeleted);
    },
  });

  const mutationError = save.error ?? remove.error;
  const errorText =
    mutationError instanceof ApiError && mutationError.statusCode === 409
      ? t.profileConflict
      : mutationError instanceof ApiError &&
          mutationError.statusCode === 400 &&
          mutationError.message.includes('20 addresses')
        ? t.addressLimit
        : mutationError instanceof ApiError && mutationError.statusCode === 400
          ? t.addressInvalid
          : mutationError instanceof ApiError && mutationError.statusCode === 401
            ? t.sessionError
            : t.sessionConnectionError;

  return (
    <AccountShell active="addresses" title={t.addresses} description={t.addressesIntro}>
      {session.isPending ? (
        <p role="status">{t.loadingAccount}</p>
      ) : session.isError ? (
        <div className="grid gap-3" role="alert">
          <p>{t.sessionConnectionError}</p>
          <Button type="button" variant="outline" onClick={() => void session.refetch()}>
            {t.retry}
          </Button>
        </div>
      ) : !session.data ? (
        <div className="grid gap-3">
          <p>{t.guestDescription}</p>
          <Button asChild className="w-fit bg-store-primary text-white">
            <StorefrontSignInLink>{t.signIn}</StorefrontSignInLink>
          </Button>
        </div>
      ) : addresses.isPending ? (
        <p role="status">{locale === 'ar' ? 'جارٍ تحميل العناوين…' : 'Loading addresses…'}</p>
      ) : addresses.isError ? (
        <div className="grid gap-3" role="alert">
          <p>{t.addressLoadError}</p>
          <Button type="button" variant="outline" onClick={() => void addresses.refetch()}>
            {t.retry}
          </Button>
        </div>
      ) : (
        <section className="grid gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-store-muted">{addresses.data.length} / 20</p>
            {!editing && (
              <Button
                type="button"
                onClick={() => {
                  setFeedback('');
                  save.reset();
                  remove.reset();
                  setEditing('new');
                }}
                disabled={addresses.data.length >= 20}
                className="bg-store-primary text-white hover:bg-store-primary-dark"
              >
                <Plus className="me-2 size-4" aria-hidden="true" />
                {t.addAddress}
              </Button>
            )}
          </div>
          {feedback && (
            <p
              role="status"
              className="rounded-xl bg-store-info px-4 py-3 text-sm text-store-primary-deep"
            >
              {feedback}
            </p>
          )}
          {mutationError && (
            <p
              role="alert"
              className="rounded-xl bg-red-50 px-4 py-3 text-sm font-bold text-red-700"
            >
              {errorText}
            </p>
          )}
          {addresses.data.length === 0 && (
            <p className="rounded-xl border border-store-border bg-store-page p-4 text-store-secondary">
              {t.noAddressesDescription}
            </p>
          )}
          <ul className="grid gap-3 sm:grid-cols-2">
            {addresses.data.map((address) => (
              <li
                key={address.id}
                className="grid content-start gap-3 rounded-2xl border border-store-border bg-white p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2 font-heading font-extrabold text-store-ink">
                    <MapPin className="size-4 text-store-primary" aria-hidden="true" />
                    {address.label}
                  </div>
                  {address.isDefault && (
                    <span className="rounded-full bg-store-cream px-2 py-1 text-xs font-bold text-store-primary">
                      {t.defaultAddress}
                    </span>
                  )}
                </div>
                <p
                  className="m-0 text-sm leading-6 text-store-secondary"
                  dir="auto"
                  style={{ textAlign: locale === 'ar' ? 'right' : 'left' }}
                >
                  {[address.governorate, address.locality, address.area, address.streetAddress]
                    .filter(Boolean)
                    .join('، ')}
                </p>
                {address.notes && (
                  <p
                    className="m-0 text-sm text-store-muted"
                    dir="auto"
                    style={{ textAlign: locale === 'ar' ? 'right' : 'left' }}
                  >
                    {address.notes}
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      save.reset();
                      remove.reset();
                      setEditing(address);
                    }}
                  >
                    <Pencil className="me-2 size-4" aria-hidden="true" />
                    {t.editAddress}
                  </Button>
                  {!address.isDefault && (
                    <Button
                      type="button"
                      variant="outline"
                      disabled={save.isPending}
                      onClick={() =>
                        save.mutate({
                          address,
                          values: { revision: address.revision, isDefault: true },
                        })
                      }
                    >
                      <Star className="me-2 size-4" aria-hidden="true" />
                      {t.makeDefault}
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="outline"
                    disabled={remove.isPending}
                    aria-label={`${t.removeAddress}: ${address.label}`}
                    onClick={() => remove.mutate(address)}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
          {editing && (
            <AddressEditor
              key={editing === 'new' ? 'new' : editing.id}
              {...(editing === 'new' ? {} : { address: editing })}
              makeDefaultByDefault={addresses.data.length === 0}
              busy={save.isPending}
              error={save.isError ? errorText : ''}
              onCancel={() => setEditing(null)}
              onSave={(values) => {
                setFeedback('');
                remove.reset();
                if (editing === 'new') save.mutate({ address: null, values });
                else
                  save.mutate({
                    address: editing,
                    values: { ...values, revision: editing.revision },
                  });
              }}
            />
          )}
        </section>
      )}
    </AccountShell>
  );
}
