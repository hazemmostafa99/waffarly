import { test } from 'node:test';
import assert from 'node:assert/strict';
import { orderActionMessage, formatOrderActionError } from './order-action-errors.js';

test('shift rejection displays actionable Arabic even with an outdated shared translation bundle', () => {
  const message = orderActionMessage({ errorCode: 'ORDER_SHIFT_REQUIRED' });
  assert.equal(
    formatOrderActionError(message, 'ar', () => 'حدث خطأ غير متوقع.'),
    'افتح وردية كاشير في فرع الطلب قبل تغيير حالته.',
  );
});
test('older servers returning the Arabic shift message remain readable', () => {
  const message = 'افتح وردية كاشير في فرع الطلب قبل تغيير حالته.';
  assert.equal(
    formatOrderActionError(message, 'ar', () => 'generic'),
    message,
  );
});
test('unknown errors retain existing fallback handling', () => {
  assert.equal(
    formatOrderActionError('Internal server error', 'ar', () => 'generic'),
    'generic',
  );
});
