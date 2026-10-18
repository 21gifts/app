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
  /** Supporting copy shown under the input. */
  hint?: string;
  /** Validation copy shown under the input. */
  error?: string;
};

/**
 * Sibling `<label htmlFor>` plus input so the accessible name is the label text.
 *
 * @param props - Label, id, and native input attributes (except `id` and `className`).
 * @returns The labeled input.
 */
export function ShopLabeledInput(props: ShopLabeledInputProps): ReactElement {
  const { label, id, hint, error, ...rest } = props;
  const hintId = hint === undefined ? null : `${id}-hint`;
  const errorId = error === undefined ? null : `${id}-error`;
  const describedBy =
    [rest['aria-describedby'], hintId, errorId].filter(Boolean).join(' ') || undefined;
  return (
    <div className={LABEL_WRAP_CLASS}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        className={CONTROL_CLASS}
        {...rest}
        {...(describedBy === undefined ? {} : { 'aria-describedby': describedBy })}
        {...(error === undefined ? {} : { 'aria-invalid': true })}
      />
      {hint === undefined ? null : (
        <p id={hintId!} className="text-sm text-app-muted">
          {hint}
        </p>
      )}
      {error === undefined ? null : (
        <p id={errorId!} className="text-sm text-app-danger">
          {error}
        </p>
      )}
    </div>
  );
}
