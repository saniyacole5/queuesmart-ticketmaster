// Expected duration is per user. Service priority is metadata; entry priority orders people.
export function estimateWait(position, expectedDuration) {
  if (!Number.isInteger(position) || position < 1 || !Number.isInteger(expectedDuration) || expectedDuration < 1 || expectedDuration > 480) {
    throw new RangeError('Position and expected duration must be positive whole numbers (duration <=480).');
  }
  return (position - 1) * expectedDuration;
}
export function orderEntries(entries) {
  return [...entries].sort((a, b) => Number(b.priority === 'priority') - Number(a.priority === 'priority') || a.order - b.order || a.id - b.id);
}
