interface FilterChipsProps {
  options: { label: string; value: string }[];
  selected: string;
  onChange: (value: string) => void;
}

export default function FilterChips({ options, selected, onChange }: FilterChipsProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isActive = opt.value === selected;
        return (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              isActive
                ? 'bg-primary-600 text-white dark:bg-primary-500'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700'
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
