// Member work area - Required smart feature.
import { estimateWait } from './waitTime.js';

export function estimateSmartWait(position, expectedDuration, servedHistory = []) {
  const fallback = estimateWait(position, expectedDuration);

  // TODO(SMART-1) Sort a copy of servedHistory by endedAt, then id.
  // For each adjacent pair, accept the interval only when the later record
  // joinedAt <= the earlier record endedAt. Reject invalid or non-positive
  // intervals. This removes gaps when the service had nobody waiting.
  //
  // TODO(SMART-2) With at least 3 usable intervals, take their median in
  // minutes and return Math.ceil((position - 1) * medianMinutes).
  // With fewer samples, return fallback. Preserve position 1 => 0.
  // Keep the original input array unchanged.
  return fallback;
}
