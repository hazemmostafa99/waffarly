# Demo address book

The active demo account at `/account` shows two fictional address
examples. Choosing one updates the provider-scoped `selectedDemoAddressId`; no
typed name, phone number or real address is collected by this address book.

When a demo account is active, checkout resolves the selected ID against the local
examples and prefills the delivery address field. The shopper can edit that field
for the current checkout. Pickup clears the field, and checkout drafts are discarded
when the route unmounts, the page reloads or the local confirmation completes.

The selected address ID is only in in-memory Zustand state and resets with the
Marketplace provider. The sample addresses are explicitly fictional and are not
part of the extracted reference data or a production address contract.

## Files

- `account/model/demo-addresses.ts` contains the fictional examples and lookup.
- `account/state/account-slice.ts` owns the selected example ID.
- `account/components/account-page.tsx` renders the accessible radio selection.
- `checkout/components/checkout-page.tsx` resolves the active demo selection.
- `checkout/hooks/use-local-checkout.ts` initializes only the transient checkout draft.

Manual review remains pending: select both examples in the demo account, enter
delivery checkout and confirm the matching sample is prefilled. Verify it can be
edited, pickup clears it, and an inactive guest account does not receive the
demo-account selection. No tests, typecheck, build or browser review were run for
this slice, per the user's instruction.
