// What this key may do, learned from real calls (never from probes that would create a voice).
export type Tri = 'yes' | 'no' | 'unknown';

export const capabilityState: { voiceDesign: Tri; replication: Tri } = {
  voiceDesign: 'unknown',
  replication: 'unknown',
};
