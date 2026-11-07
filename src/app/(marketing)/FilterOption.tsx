import { Check } from 'lucide-react';
import type { MouseEvent as ReactMouseEvent, ReactElement } from 'react';
import type { MenuOption } from './FilterMenu';

const ROW_CLASS =
  'flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-left text-sm font-inherit';

/**
 * One listbox row: swatch, label, and a check when it is the committed value.
 *
 * @param props - Option, indexes, committed value, id builder, and choose handler.
 * @returns The option button.
 */
export function FilterOption({
  option,
  index,
  activeIndex,
  value,
  optionDomId,
  onChoose,
}: {
  option: MenuOption;
  index: number;
  activeIndex: number;
  value: string;
  optionDomId: (index: number) => string;
  onChoose: (event: ReactMouseEvent<HTMLButtonElement>, next: string) => void;
}): ReactElement {
  const active = index === activeIndex;
  const selected = option.value === value;
  return (
    <button
      id={optionDomId(index)}
      type="button"
      role="option"
      tabIndex={-1}
      data-value={option.value}
      aria-selected={selected}
      className={
        active
          ? `${ROW_CLASS} is-active bg-home-why ${selected ? 'font-semibold' : ''}`
          : `${ROW_CLASS} hover:bg-home-why ${selected ? 'font-semibold' : ''}`
      }
      onClick={(event) => {
        event.stopPropagation();
        onChoose(event, option.value);
      }}
    >
      {option.swatch === null ? null : <span className={option.swatch} aria-hidden="true" />}
      <span className="min-w-0 flex-1 break-words">{option.label}</span>
      {selected ? <Check aria-hidden="true" className="h-4 w-4 shrink-0" /> : null}
    </button>
  );
}
