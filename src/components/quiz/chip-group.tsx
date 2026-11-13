/** 라디오 칩 묶음 (폼 필드). 자바스크립트 없이도 동작한다. */
export function ChipGroup({
  name,
  legend,
  options,
  defaultValue,
}: {
  name: string;
  legend: string;
  options: { value: string; label: string }[];
  defaultValue: string;
}) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-2 text-sm font-semibold">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <label key={o.value} className="cursor-pointer">
            <input type="radio" name={name} value={o.value} defaultChecked={o.value === defaultValue} className="peer sr-only" />
            <span className="inline-flex h-9 items-center rounded-full border-2 px-3.5 text-sm transition-colors peer-checked:border-primary peer-checked:bg-accent peer-checked:text-foreground peer-focus-visible:ring-3 peer-focus-visible:ring-ring/50 hover:bg-muted">
              {o.label}
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
