// ═══════════════════════════════════════════════════════════════════════════════
// SETTING SECTION — Container for grouped settings
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReactNode } from 'react';

interface SettingSectionProps {
  title: string;
  icon?: string;
  children: ReactNode;
}

export function SettingSection({ title, icon, children }: SettingSectionProps) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon && <span className="text-lg">{icon}</span>}
        <h2 className="text-sm font-medium text-white/50 uppercase tracking-wide">
          {title}
        </h2>
      </div>
      <div className="space-y-3">
        {children}
      </div>
    </div>
  );
}
