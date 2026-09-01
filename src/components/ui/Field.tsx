import type { InputHTMLAttributes, ReactElement, ReactNode, TextareaHTMLAttributes } from 'react';

const CONTROL_CLASS =
  'w-full min-h-11 rounded-2xl border border-app-border-strong bg-app-card px-4 py-2 text-sm text-app-fg transition disabled:opacity-50';

/** Shared props for labeled fields. */
interface FieldShellProps {
  /** Visible label text. */
  label: string;
  /** Optional id; generated from label when omitted. */
  id?: string;
  /** Extra classes on the outer label wrapper. */
  className?: string;
}

/** Props for a single-line {@link Field}. */
export interface FieldInputProps
  extends FieldShellProps, Omit<InputHTMLAttributes<HTMLInputElement>, 'id' | 'className'> {
  /** Renders an `<input>`. */
  multiline?: false;
}

/** Props for a multiline {@link Field}. */
export interface FieldTextareaProps
  extends FieldShellProps, Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id' | 'className'> {
  /** Renders a `<textarea>`. */
  multiline: true;
}

/** Props for {@link Field} (input or textarea). */
export type FieldProps = FieldInputProps | FieldTextareaProps;

/**
 * Labeled text input or textarea using shared app field tokens.
 *
 * @param props - Label plus native input or textarea attributes.
 * @returns The labeled field.
 */
export function Field(props: FieldProps): ReactElement {
  const { label, id, className, multiline, ...rest } = props;
  const fieldId =
    id ??
    `field-${label
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')}`;
  const extra = className === undefined || className === '' ? '' : ` ${className}`;
  let control: ReactNode;
  if (multiline === true) {
    const textareaProps = rest as TextareaHTMLAttributes<HTMLTextAreaElement>;
    control = (
      <textarea
        id={fieldId}
        className={`${CONTROL_CLASS} min-h-11 resize-none`}
        {...textareaProps}
      />
    );
  } else {
    const inputProps = rest as InputHTMLAttributes<HTMLInputElement>;
    control = <input id={fieldId} className={CONTROL_CLASS} {...inputProps} />;
  }
  return (
    <label
      htmlFor={fieldId}
      className={`flex flex-col gap-1 text-left text-sm text-app-fg${extra}`}
    >
      {label}
      {control}
    </label>
  );
}
