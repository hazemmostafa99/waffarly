# Restaurant branch fulfillment

The Marketplace header and restaurant Storefront let customers select the area where they want to receive an order. The browser remembers only the area ID. Customers enter the detailed address during delivery checkout. Pickup uses the chosen branch.

Owners configure existing branches from **Restaurant settings → Online branch operations**. Each branch has a location, fulfillment switches, a pause switch, an optional daily schedule and explicit covered areas. Each area sets its fee, minimum, ETA and priority. Lower priority numbers win. Ties are resolved by branch ID. The restaurant schedule, publication, pause and fulfillment switches apply to every branch. A branch schedule can narrow those hours. Coverage is restricted to the configured branch governorate. Branch street addresses are maintained on the Branches screen.

The shared delivery-area directory starts with five service areas in Cairo and Mansoura. Extend it with verified areas before onboarding more locations. Customers confirm their service area themselves. The system cannot verify that a free-text street address belongs to the selected area.

An empty branch configuration preserves legacy single-branch routing and fees. Once configured, only active branches in the new configuration can receive web orders. To disable the last branch, pause it or turn off its fulfillment methods. Legacy area names are not automatically mapped to verified locations.

Storefront owns the fulfillment configuration and eligibility decision. Orders asks that policy during quote and again during creation. The quote includes the selected branch, area label and a review key derived from the current routing and its terms. Creation rejects changed routing or totals and saves the assigned branch and fulfillment snapshot with the order. The existing branch queue reads that assignment. The catalog and base pricing are shared by the business. Existing inventory commitments and branch warehouse accounting continue at their respective stages.

Apply the additive restaurant branch fulfillment migration before starting the updated API. Generate the Prisma client and refresh the shared contracts with the standard project setup. The migration defaults existing profiles to legacy behavior and does not configure operational branches.

Manual acceptance:

1. Configure two existing branches in different governorates and a third overlapping branch in one governorate. Confirm the owner cannot save cross-governorate coverage.
2. Browse without selecting an area. Select one from the header and confirm the restaurant list and branch preview reflect coverage. Pause the preferred branch and check that the backup appears. Repeat outside all covered areas.
3. Add a meal, change area, and confirm the cart stays intact until you choose how to proceed. Review the branch and new charges. Try a basket below the minimum.
4. Configure Pickup and review the selected branch address. Switch to another branch and check that the previous quote is invalidated.
5. On both storefront surfaces, change or archive the eligible branch after quoting. Confirm that the first submit is rejected even when the other branch has the same fee. Review again and confirm the order appears only in the selected branch queue. Check order details for the assigned branch.
6. Repeat an identical uncertain submit and verify it yields one order. Repeat legacy single-branch checkout and local non-restaurant demonstration checkout.
