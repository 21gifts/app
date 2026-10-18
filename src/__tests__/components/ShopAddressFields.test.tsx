import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopAddressFields } from '@/components/ShopAddressFields';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
});

function expectAssociated(labelText: string): HTMLElement {
  const control = screen.getByLabelText(labelText, { exact: true });
  const label = screen.getByText(labelText, { selector: 'label', exact: true });
  expect((label as HTMLLabelElement).htmlFor).toBe(control.id);
  expect(control.id.length).toBeGreaterThan(0);
  return control;
}

const ADDRESS = {
  street: 'Bahnhofstrasse',
  houseNumber: '12',
  postalCode: '8001',
  city: 'Zürich',
  country: 'CH',
};

describe('ShopAddressFields', () => {
  it('shows empty native fields when the value is null', () => {
    renderWithLocale(
      <ShopAddressFields value={null} disabled={false} onChange={() => undefined} />,
    );
    const street = expectAssociated('Street');
    expect(street.closest('[data-testid="shop-address-fields"]')).not.toBe(null);
    expect(street.parentElement?.tagName).toBe('DIV');
    expectAssociated('House number');
    expectAssociated('Postal code');
    expectAssociated('City');
    const country = expectAssociated('Country');
    expect(country.tagName).toBe('SELECT');
    expect(country.parentElement?.tagName).toBe('DIV');
    expect(street).toHaveProperty('value', '');
    expect(screen.getByLabelText('House number', { exact: true })).toHaveProperty('value', '');
    expect(screen.getByLabelText('Postal code', { exact: true })).toHaveProperty('value', '');
    expect(screen.getByLabelText('City', { exact: true })).toHaveProperty('value', '');
    expect(country).toHaveProperty('value', '');
    expect(screen.getByRole('option', { name: 'Choose a country' })).toHaveProperty('value', '');
    expect(screen.getByLabelText('Street').getAttribute('autocomplete')).toBe('off');
    expect(screen.getByLabelText('House number').getAttribute('autocomplete')).toBe('off');
    expect(screen.getByLabelText('Postal code').getAttribute('autocomplete')).toBe('postal-code');
    expect(screen.getByLabelText('City').getAttribute('autocomplete')).toBe('address-level2');
    expect(screen.getByLabelText('Country').getAttribute('autocomplete')).toBe('country');
  });

  it('prefills a stored address and patches one field at a time', () => {
    const onChange = vi.fn();
    renderWithLocale(<ShopAddressFields value={ADDRESS} disabled={false} onChange={onChange} />);
    expect(screen.getByLabelText('Street')).toHaveProperty('value', 'Bahnhofstrasse');
    expect(screen.getByLabelText('House number')).toHaveProperty('value', '12');
    expect(screen.getByLabelText('Postal code')).toHaveProperty('value', '8001');
    expect(screen.getByLabelText('City', { exact: true })).toHaveProperty('value', 'Zürich');
    expect(screen.getByLabelText('Country', { exact: true })).toHaveProperty('value', 'CH');
    fireEvent.change(screen.getByLabelText('Street'), { target: { value: 'Limmatquai' } });
    expect(onChange).toHaveBeenCalledWith({ ...ADDRESS, street: 'Limmatquai' });
    fireEvent.change(screen.getByLabelText('House number'), { target: { value: '1' } });
    expect(onChange).toHaveBeenCalledWith({ ...ADDRESS, houseNumber: '1' });
    fireEvent.change(screen.getByLabelText('Postal code'), { target: { value: '8002' } });
    expect(onChange).toHaveBeenCalledWith({ ...ADDRESS, postalCode: '8002' });
    fireEvent.change(screen.getByLabelText('City'), { target: { value: 'Bern' } });
    expect(onChange).toHaveBeenCalledWith({ ...ADDRESS, city: 'Bern' });
    fireEvent.change(screen.getByLabelText('Country'), { target: { value: 'DE' } });
    expect(onChange).toHaveBeenCalledWith({ ...ADDRESS, country: 'DE' });
  });

  it('disables every field when asked', () => {
    renderWithLocale(<ShopAddressFields value={ADDRESS} disabled onChange={() => undefined} />);
    expect(screen.getByLabelText('Street').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('House number').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Postal code').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('City').hasAttribute('disabled')).toBe(true);
    expect(screen.getByLabelText('Country', { exact: true }).hasAttribute('disabled')).toBe(true);
  });

  it('shows linked field errors and reports blur', () => {
    const onBlur = vi.fn();
    renderWithLocale(
      <ShopAddressFields
        value={ADDRESS}
        disabled={false}
        errors={{ houseNumber: 'Starts with a digit.', country: 'Choose a country.' }}
        onBlur={onBlur}
        onChange={() => undefined}
      />,
    );
    const house = screen.getByLabelText('House number');
    const country = screen.getByLabelText('Country');
    expect(house.getAttribute('aria-invalid')).toBe('true');
    expect(country.getAttribute('aria-invalid')).toBe('true');
    expect(document.getElementById(house.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Starts with a digit.',
    );
    expect(document.getElementById(country.getAttribute('aria-describedby')!)?.textContent).toBe(
      'Choose a country.',
    );
    fireEvent.blur(house);
    fireEvent.blur(country);
    expect(onBlur).toHaveBeenCalledWith('houseNumber');
    expect(onBlur).toHaveBeenCalledWith('country');
  });

  it('gives each instance distinct ids that match their own labels', () => {
    renderWithLocale(
      <>
        <ShopAddressFields value={null} disabled={false} onChange={() => undefined} />
        <ShopAddressFields value={ADDRESS} disabled={false} onChange={() => undefined} />
      </>,
    );
    const roots = screen.getAllByTestId('shop-address-fields');
    expect(roots).toHaveLength(2);
    const ids: string[] = [];
    for (const root of roots) {
      const labels = root.querySelectorAll('label');
      expect(labels).toHaveLength(5);
      for (const label of labels) {
        const htmlFor = (label as HTMLLabelElement).htmlFor;
        expect(htmlFor.length).toBeGreaterThan(0);
        const control = document.getElementById(htmlFor);
        expect(control).not.toBe(null);
        expect(root.contains(control)).toBe(true);
        ids.push(htmlFor);
      }
    }
    expect(ids).toHaveLength(10);
    expect(new Set(ids).size).toBe(10);
  });
});
