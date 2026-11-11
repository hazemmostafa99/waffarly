export type DemoAddressId = 'sample-address-one' | 'sample-address-two';

export interface DemoAddress {
  id: DemoAddressId;
  label: string;
  address: string;
}

/** Fictional address examples for the local Marketplace walkthrough. */
export const demoAddresses: DemoAddress[] = [
  {
    id: 'sample-address-one',
    label: 'عنوان تجريبي أول',
    address: 'شارع تجريبي 1، دمياط الجديدة',
  },
  {
    id: 'sample-address-two',
    label: 'عنوان تجريبي ثانٍ',
    address: 'شارع تجريبي 2، دمياط الجديدة',
  },
];

export function findDemoAddress(id: DemoAddressId) {
  return demoAddresses.find((address) => address.id === id);
}
