import { useId } from 'react';
import { Icon } from '../../Icons.js';

export function SettingsChoices<Value extends string>({
  label,
  hideLabel = false,
  options,
  value,
  onChange,
}: {
  label: string;
  hideLabel?: boolean;
  options: readonly { value: Value; label: string; icon?: string }[];
  value: Value;
  onChange: (value: Value) => void;
}) {
  const name = useId();
  return (
    <fieldset className="settings-choices">
      <legend className={hideLabel ? 'sr-only' : undefined}>{label}</legend>
      <div className="settings-choice-list">
        {options.map((option) => (
          <label key={option.value} className="settings-choice">
            <input
              type="radio"
              name={name}
              className="sr-only"
              checked={option.value === value}
              onChange={() => onChange(option.value)}
              value={option.value}
            />
            <span>
              {option.icon && <Icon name={option.icon} />}
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
