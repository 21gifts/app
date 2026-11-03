import { describe, expect, it } from 'vitest';
import { useRecoveryStore } from '@/stores/recovery-store';

describe('useRecoveryStore', () => {
  it('starts on the start view and shows the view it is given', () => {
    expect(useRecoveryStore.getState().view).toEqual({ step: 'start' });
    useRecoveryStore.getState().setView({ step: 'opening', waiting: true });
    expect(useRecoveryStore.getState().view).toEqual({ step: 'opening', waiting: true });
    useRecoveryStore.getState().setView({ step: 'done', balanceMissing: false });
    expect(useRecoveryStore.getState().view).toEqual({ step: 'done', balanceMissing: false });
  });
});
