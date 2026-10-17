import type { InputHTMLAttributes, ReactElement } from 'react';

const CONTROL_CLASS = [
  'w-full min-h-11 rounded-2xl border border-app-border-strong bg-app-card',
  'px-4 py-2 text-base text-app-fg placeholder:text-app-subtle transition focus-visible:border-app-fg disabled:opacity-50',
].join(' ');

const LABEL_WRAP_CLASS = 'flex flex-col gap-1 text-left text-sm text-app-fg';

/** Props for {@link ShopLabeledInput}. */
export type ShopLabeledInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'id' | 'className'
> & {
  /** Visible label text; also the accessible name. */
  label: string;
  /** Control id; must match the label's `htmlFor`. */
  id: string;
};

/**
 * Sibling `<label htmlFor>` plus input so the accessible name is the label text.
 *
 * @param props - Label, id, and native input attributes (except `id` and `className`).
 * @returns The labeled input.
 */
export function ShopLabeledInput(props: ShopLabeledInputProps): ReactElement {
  const { label, id, ...rest } = props;
  return (
    <div className={LABEL_WRAP_CLASS}>
      <label htmlFor={id}>{label}</label>
      <input id={id} className={CONTROL_CLASS} {...rest} />
    </div>
  );
}
