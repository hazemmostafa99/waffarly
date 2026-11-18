# Restaurant branch fulfillment

The Marketplace header and restaurant Storefront let customers select the area where they want to receive an order. The browser remembers only the area ID. Customers enter the detailed address during delivery checkout. Pickup uses the chosen branch.

Owners configure existing branches from **Restaurant settings → Online branch operations**. First they choose the governorate and city or district of the branch. They can add several local areas with one set of terms, edit an area individually, or add a whole external city or a specific area within it. A city rule supplies the default fee, minimum, ETA and priority within that city. An exact area rule overrides it on the same branch. Across branches, lower priority numbers win and ties are resolved by branch ID. The restaurant schedule, publication, pause and fulfillment switches apply to every branch. A branch schedule can narrow those hours. Branch street addresses are maintained on the Branches screen.

The shared starter catalog contains 23 governorates and 72 cities or districts, with more detailed options in New Damietta and Mansoura. It lives in `packages/contracts/src/restaurant-place-seed.ts`; existing area IDs remain stable. This is an initial place directory. It does not enable delivery for any restaurant. Restaurant checkout lists configured destinations and customers confirm their service area themselves. The system cannot verify that a free-text street address belongs to the selected area.

An empty branch configuration preserves legacy single-branch routing and fees. Once configured, only active branches in the new configuration can receive web orders. To disable the last branch, pause it or turn off its fulfillment methods. Legacy area names are not automatically mapped to verified locations.

Storefront owns the fulfillment configuration and eligibility decision. Orders asks that policy during quote and again during creation. The quote includes the selected branch, area label and a review key derived from the current routing and its terms. Creation rejects changed routing or totals and saves the assigned branch and fulfillment snapshot with the order. The existing branch queue reads that assignment. The catalog and base pricing are shared by the business. Existing inventory commitments and branch warehouse accounting continue at their respective stages.

Apply the additive restaurant branch fulfillment migration before starting the updated API. Generate the Prisma client and refresh the shared contracts with the standard project setup. The migration defaults existing profiles to legacy behavior and does not configure operational branches.

Manual acceptance:

1. Set a branch in New Damietta. Add two local districts with the same terms, change one district's fee, then add an external city. Verify the saved destinations, city fallback, and individual fees at checkout. Repeat with a Mansoura branch and confirm a catalog destination outside the configured coverage is rejected.
2. Browse without selecting an area. Select one from the header and confirm the restaurant list and branch preview reflect coverage. Pause the preferred branch and check that the backup appears. Repeat outside all covered areas.
3. Add a meal, change area, and confirm the cart stays intact until you choose how to proceed. Review the branch and new charges. Try a basket below the minimum.
4. Configure Pickup and review the selected branch address. Switch to another branch and check that the previous quote is invalidated.
5. On both storefront surfaces, change or archive the eligible branch after quoting. Confirm that the first submit is rejected even when the other branch has the same fee. Review again and confirm the order appears only in the selected branch queue. Check order details for the assigned branch.
6. Repeat an identical uncertain submit and verify it yields one order. Repeat legacy single-branch checkout and local non-restaurant demonstration checkout.
