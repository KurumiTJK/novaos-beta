// ═══════════════════════════════════════════════════════════════════════════════
// SETTING TOGGLE — Boolean switch setting
// ═══════════════════════════════════════════════════════════════════════════════

interface SettingToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function SettingToggle({
  label,
  description,
  value,
  onChange,
  disabled = false,
}: SettingToggleProps) {
  const handleToggle = () => {
    if (!disabled) {
      // Haptic feedback
      if ('vibrate' in navigator) {
        navigator.vibrate(10);
      }
      onChange(!value);
    }
  };

  return (
    <button
      onClick={handleToggle}
      disabled={disabled}
      className={`
        w-full flex items-center justify-between p-4 bg-[#1C1C1E] rounded-xl
        active:bg-[#2C2C2E] transition-colors text-left
        ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <div className="flex-1 mr-4">
        <p className="text-white font-medium">{label}</p>
        {description && (
          <p className="text-white/40 text-sm mt-0.5">{description}</p>
        )}
      </div>
      
      {/* Toggle Switch */}
      <div
        className={`
          relative w-12 h-7 rounded-full transition-colors
          ${value ? 'bg-green-500' : 'bg-white/20'}
        `}
      >
        <div
          className={`
            absolute top-1 w-5 h-5 bg-white rounded-full shadow-md
            transition-transform
            ${value ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </div>
    </button>
  );
}
