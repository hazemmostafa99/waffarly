/**
 * Website "pickup" orders are collected at the counter exactly like takeaway,
 * so the cashier sees one type for both: pickup → takeaway, others unchanged.
 */
export function posOrderTypeKey(fulfillmentType: string): string {
  return fulfillmentType === 'pickup' ? 'takeaway' : fulfillmentType;
}
