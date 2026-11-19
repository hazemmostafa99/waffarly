'use client';

import { useState, useSyncExternalStore } from 'react';
import { deliveryLocations, type DeliveryLocation } from '@waffarly/contracts';

const storageKey = 'waffarly-delivery-area';
const changeEvent = 'waffarly-delivery-area-changed';
let currentArea: string | undefined;

function subscribe(notify: () => void) {
  const sync = (event: StorageEvent) => {
    if (event.key !== storageKey && event.key !== null) return;
    currentArea = undefined;
    notify();
  };
  window.addEventListener('storage', sync);
  window.addEventListener(changeEvent, notify);
  return () => {
    window.removeEventListener('storage', sync);
    window.removeEventListener(changeEvent, notify);
  };
}

function getArea() {
  if (currentArea !== undefined) return currentArea;
  try {
    return window.localStorage.getItem(storageKey) ?? '';
  } catch {
    return '';
  }
}

function selectArea(id: string) {
  currentArea = id;
  try {
    window.localStorage.setItem(storageKey, id);
  } catch {
    /* Keep the selection in memory. */
  }
  window.dispatchEvent(new Event(changeEvent));
}

export function useDeliveryArea() {
  return useSyncExternalStore(subscribe, getArea, () => '');
}

export function DeliveryAreaPicker({
  onChange,
  locations = deliveryLocations,
  value,
  onSelect,
}: {
  onChange?: () => void;
  locations?: readonly DeliveryLocation[];
  value?: string | undefined;
  onSelect?: ((id: string) => void) | undefined;
}) {
  const sharedSelection = useDeliveryArea();
  const selected = value ?? sharedSelection;
  const location = locations.find((entry) => entry.id === selected);
  if (!locations.length && !selected) return <p>مفيش وجهات توصيل متاحة للمطعم.</p>;
  return (
    <AreaFields
      selected={selected}
      locations={locations}
      initialGovernorate={location?.governorate ?? ''}
      initialLocality={location?.locality ?? ''}
      onChange={onChange}
      onSelect={onSelect ?? selectArea}
    />
  );
}

function AreaFields({
  selected,
  locations,
  initialGovernorate,
  initialLocality,
  onChange,
  onSelect,
}: {
  selected: string;
  locations: readonly DeliveryLocation[];
  initialGovernorate: string;
  initialLocality: string;
  onChange?: (() => void) | undefined;
  onSelect: (id: string) => void;
}) {
  const [draft, setDraft] = useState<{ governorate: string; locality: string } | null>(null);
  const governorate = draft?.governorate ?? initialGovernorate;
  const locality = draft?.locality ?? initialLocality;
  const localities = locations.filter((entry) => entry.governorate === governorate);
  const destinations = localities.filter((entry) => entry.locality === locality);
  const selectClass = 'w-full rounded-lg border border-current/20 bg-white p-2 text-sm';
  function changeArea(id: string) {
    onSelect(id);
    onChange?.();
  }
  return (
    <div className="grid gap-2 sm:grid-cols-3">
      <label className="grid gap-1">
        محافظة التوصيل
        <select
          className={selectClass}
          value={governorate}
          onChange={(event) => {
            setDraft({ governorate: event.target.value, locality: '' });
            changeArea('');
          }}
        >
          <option value="">اختار المحافظة</option>
          {[...new Set(locations.map((entry) => entry.governorate))].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        المدينة أو الحي
        <select
          className={selectClass}
          value={locality}
          disabled={!governorate}
          onChange={(event) => {
            setDraft({ governorate, locality: event.target.value });
            changeArea('');
          }}
        >
          <option value="">اختار المدينة أو الحي</option>
          {[...new Set(localities.map((entry) => entry.locality))].map((name) => (
            <option key={name}>{name}</option>
          ))}
        </select>
      </label>
      <label className="grid gap-1">
        منطقة التوصيل
        <select
          className={selectClass}
          value={governorate === initialGovernorate && locality === initialLocality ? selected : ''}
          disabled={!locality}
          onChange={(event) => {
            changeArea(event.target.value);
            setDraft(null);
          }}
        >
          <option value="">اختار المنطقة</option>
          {destinations.map((entry) => (
            <option key={entry.id} value={entry.id}>
              {entry.area ||
                (destinations.some((option) => option.area)
                  ? 'منطقة تانية داخل المدينة'
                  : entry.locality)}
            </option>
          ))}
        </select>
      </label>
      {selected && (
        <button
          className="justify-self-start text-sm underline"
          type="button"
          onClick={() => {
            changeArea('');
            setDraft(null);
          }}
        >
          امسح اختيار المنطقة
        </button>
      )}
    </div>
  );
}
