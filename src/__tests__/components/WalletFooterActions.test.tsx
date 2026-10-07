import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { WalletFooterActions } from '@/components/WalletFooterActions';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(cleanup);

describe('WalletFooterActions', () => {
  it('shows Receive left of Send with inward and outward arrows, a soft fade, and calls the handlers', () => {
    const onReceive = vi.fn();
    const onSend = vi.fn();
    const { container } = renderWithLocale(
      <WalletFooterActions onReceive={onReceive} onSend={onSend} sendDisabled={false} />,
    );
    const receive = screen.getByRole('button', { name: 'Receive' });
    const send = screen.getByRole('button', { name: 'Send' });
    expect(receive.compareDocumentPosition(send) & Node.DOCUMENT_POSITION_FOLLOWING).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
    expect(receive.querySelector('svg')?.getAttribute('class')).toContain(
      'lucide-arrow-down-right',
    );
    expect(send.querySelector('svg')?.getAttribute('class')).toContain('lucide-arrow-up-right');
    expect(receive.querySelector('svg')?.getAttribute('class')).toContain('max-[359px]:hidden');
    expect(receive.className).toContain('max-[359px]:px-2');
    const fade = container.querySelector('[aria-hidden="true"].bottom-full') as HTMLElement;
    expect(fade.className).toContain('h-[18px]');
    expect(fade.className).toContain('backdrop-blur-[1.5px]');
    expect(fade.className).toContain('pointer-events-none');
    fireEvent.click(receive);
    fireEvent.click(send);
    expect(onReceive).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledTimes(1);
  });

  it('disables Send when asked', () => {
    renderWithLocale(<WalletFooterActions onReceive={vi.fn()} onSend={vi.fn()} sendDisabled />);
    expect((screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Receive' }) as HTMLButtonElement).disabled).toBe(
      false,
    );
  });

  it('focuses the button of the view that just closed', () => {
    const view = renderWithLocale(
      <WalletFooterActions
        onReceive={vi.fn()}
        onSend={vi.fn()}
        sendDisabled={false}
        focus="send"
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Send' }));
    view.unmount();
    renderWithLocale(
      <WalletFooterActions
        onReceive={vi.fn()}
        onSend={vi.fn()}
        sendDisabled={false}
        focus="receive"
      />,
    );
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Receive' }));
  });
});
