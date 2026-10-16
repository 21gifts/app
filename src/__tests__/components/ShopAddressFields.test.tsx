import { cleanup, fireEvent, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ShopAddressFields } from '@/components/ShopAddressFields';
import { renderWithLocale } from '@/__tests__/render-with-locale';

afterEach(() => {
  cleanup();
});

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
    const street = screen.getByLabelText('Street', { exact: true });
    expect(street.closest('[data-testid="shop-address-fields"]')).not.toBe(null);
    expect(street.parentElement?.tagName).toBe('DIV');
    expect(street.getAttribute('id')).toBe('field-street');
    expect(screen.getByLabelText('House number', { exact: true }).getAttribute('id')).toBe(
      'field-house-number',
    );
    expect(screen.getByLabelText('Postal code', { exact: true }).getAttribute('id')).toBe(
      'field-postal-code',
    );
    expect(screen.getByLabelText('City', { exact: true }).getAttribute('id')).toBe('field-city');
    const country = screen.getByLabelText('Country', { exact: true });
    expect(country.tagName).toBe('SELECT');
    expect(country.parentElement?.tagName).toBe('DIV');
    expect(country.getAttribute('id')).toBe('field-shop-address-country');
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
});
