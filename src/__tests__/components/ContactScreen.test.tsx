import { cleanup, fireEvent, screen } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ContactScreen } from '@/components/ContactScreen';
import { CONTACT_MESSAGE_MAX_LENGTH } from '@/lib/api-types';
import { renderWithLocale } from '@/__tests__/render-with-locale';

vi.mock('next/link', () => ({
  default: ({ href, children }: { href: string; children: ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

afterEach(cleanup);

describe('ContactScreen', () => {
  it('shows the heading, lead, rules link, and Send button', () => {
    renderWithLocale(
      <ContactScreen
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        formError={null}
        success={false}
      />,
    );
    expect(screen.getByRole('heading', { name: 'Contact' })).toBeTruthy();
    expect(
      screen.getByText(
        'Write to 21.gifts here — there is no email address. This is the only way to reach us.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Living room rules' }).getAttribute('href')).toBe(
      '/rules',
    );
    expect(screen.getByLabelText('Your message')).toBeTruthy();
    expect(screen.getByPlaceholderText('Write a message')).toBeTruthy();
    const field = screen.getByLabelText('Your message');
    const button = screen.getByRole('button', { name: 'Send' });
    expect(button).toBeTruthy();
    expect(field.nextElementSibling).toBe(button);
    expect(field.getAttribute('maxLength')).toBe(String(CONTACT_MESSAGE_MAX_LENGTH));
  });

  it('shows success copy and hides the form', () => {
    renderWithLocale(
      <ContactScreen
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        formError={null}
        success={true}
      />,
    );
    expect(
      screen.getByText('Received — thank you. We read every message here in the app.'),
    ).toBeTruthy();
    expect(screen.queryByLabelText('Your message')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Send' })).toBeNull();
    expect(screen.getByRole('link', { name: 'Living room rules' })).toBeTruthy();
  });

  it('shows formError empty alert', () => {
    renderWithLocale(
      <ContactScreen
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        formError="empty"
        success={false}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Enter a message');
  });

  it('shows formError tooLong alert', () => {
    renderWithLocale(
      <ContactScreen
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        formError="tooLong"
        success={false}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Keep it to 500 characters');
  });

  it('shows formError request alert', () => {
    renderWithLocale(
      <ContactScreen
        posting={false}
        draft=""
        onDraftChange={() => undefined}
        onPost={() => undefined}
        formError="request"
        success={false}
      />,
    );
    expect(screen.getByRole('alert').textContent).toBe('Could not send your message');
  });

  it('disables submit and shows a spinner while posting', () => {
    renderWithLocale(
      <ContactScreen
        posting={true}
        draft="Hi"
        onDraftChange={() => undefined}
        onPost={() => undefined}
        formError={null}
        success={false}
      />,
    );
    const button = screen.getByRole('button', { name: 'Send' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    expect(button.querySelector('.animate-spin')).toBeTruthy();
  });

  it('calls onDraftChange when typing and onPost on submit', () => {
    const onDraftChange = vi.fn();
    const onPost = vi.fn();
    renderWithLocale(
      <ContactScreen
        posting={false}
        draft=""
        onDraftChange={onDraftChange}
        onPost={onPost}
        formError={null}
        success={false}
      />,
    );
    fireEvent.change(screen.getByLabelText('Your message'), { target: { value: 'Hi' } });
    expect(onDraftChange).toHaveBeenCalledWith('Hi');
    fireEvent.click(screen.getByRole('button', { name: 'Send' }));
    expect(onPost).toHaveBeenCalledTimes(1);
  });
});
