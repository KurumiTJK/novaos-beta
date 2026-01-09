// ═══════════════════════════════════════════════════════════════════════════════
// CLARIFY PHASE — Edit learning details
// User reviews and edits extracted information before plan generation
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useSwordDesignerStore } from '@/shared/stores/swordDesignerStore';

export function ClarifyPhase() {
  const {
    clarifyData,
    canFinalize,
    isLoading,
    updateField,
    updateConstraintsAction,
    finalizeClarify,
  } = useSwordDesignerStore();

  const [editingField, setEditingField] = useState<string | null>(null);

  if (!clarifyData) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-green-500 rounded-full animate-spin" />
      </div>
    );
  }

  const handleFinalize = async () => {
    if (isLoading) return;
    await finalizeClarify();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3">
        <h2 className="text-lg font-semibold text-white">Review Your Plan</h2>
        <p className="text-sm text-white/50 mt-1">
          Edit any details before we create your learning path
        </p>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-4">
        {/* Learning Goal */}
        <EditableField
          label="Learning Goal"
          value={clarifyData.learningGoal}
          placeholder="What do you want to achieve?"
          isEditing={editingField === 'learningGoal'}
          onStartEdit={() => setEditingField('learningGoal')}
          onSave={async (value) => {
            await updateField('learningGoal', value);
            setEditingField(null);
          }}
          onCancel={() => setEditingField(null)}
        />

        {/* Prior Knowledge */}
        <EditableField
          label="Your Experience"
          value={clarifyData.priorKnowledge}
          placeholder="What do you already know?"
          isEditing={editingField === 'priorKnowledge'}
          onStartEdit={() => setEditingField('priorKnowledge')}
          onSave={async (value) => {
            await updateField('priorKnowledge', value);
            setEditingField(null);
          }}
          onCancel={() => setEditingField(null)}
        />

        {/* Context */}
        <EditableField
          label="Additional Context"
          value={clarifyData.context}
          placeholder="Any other details?"
          isEditing={editingField === 'context'}
          onStartEdit={() => setEditingField('context')}
          onSave={async (value) => {
            await updateField('context', value);
            setEditingField(null);
          }}
          onCancel={() => setEditingField(null)}
        />

        {/* Constraints */}
        <div className="bg-[#1C1C1E] rounded-2xl p-4">
          <h3 className="text-sm font-medium text-white/70 mb-3">⏱️ Time Commitment</h3>
          
          <div className="space-y-4">
            {/* Daily Minutes */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Minutes per day</label>
              <div className="flex items-center gap-2">
                {[15, 30, 45, 60].map((mins) => (
                  <button
                    key={mins}
                    onClick={() => updateConstraintsAction({ dailyMinutes: mins })}
                    className={`
                      flex-1 py-2 rounded-xl text-sm font-medium transition-all
                      ${clarifyData.constraints.dailyMinutes === mins
                        ? 'bg-green-500 text-black'
                        : 'bg-white/5 text-white/70 active:bg-white/10'
                      }
                    `}
                  >
                    {mins}
                  </button>
                ))}
              </div>
            </div>

            {/* Total Weeks */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Weeks to complete</label>
              <div className="flex items-center gap-2">
                {[2, 4, 8, 12].map((weeks) => (
                  <button
                    key={weeks}
                    onClick={() => updateConstraintsAction({ totalWeeks: weeks })}
                    className={`
                      flex-1 py-2 rounded-xl text-sm font-medium transition-all
                      ${clarifyData.constraints.totalWeeks === weeks
                        ? 'bg-green-500 text-black'
                        : 'bg-white/5 text-white/70 active:bg-white/10'
                      }
                    `}
                  >
                    {weeks}
                  </button>
                ))}
              </div>
            </div>

            {/* Learning Style */}
            <div>
              <label className="text-xs text-white/50 mb-1 block">Preferred style</label>
              <div className="flex items-center gap-2">
                {[
                  { value: 'visual', label: '👁️ Visual' },
                  { value: 'reading', label: '📖 Reading' },
                  { value: 'hands-on', label: '🛠️ Hands-on' },
                ].map((style) => (
                  <button
                    key={style.value}
                    onClick={() => updateConstraintsAction({ preferredStyle: style.value })}
                    className={`
                      flex-1 py-2 rounded-xl text-sm font-medium transition-all
                      ${clarifyData.constraints.preferredStyle === style.value
                        ? 'bg-green-500 text-black'
                        : 'bg-white/5 text-white/70 active:bg-white/10'
                      }
                    `}
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Continue Button */}
      <div className="px-5 py-4 border-t border-white/5">
        <button
          onClick={handleFinalize}
          disabled={!canFinalize || isLoading}
          className="w-full py-3 bg-green-500 text-black font-medium rounded-full disabled:opacity-50 disabled:cursor-not-allowed active:opacity-80 transition-opacity"
        >
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <div className="w-4 h-4 border-2 border-black/30 border-t-black rounded-full animate-spin" />
              Generating capstone...
            </span>
          ) : (
            'Continue'
          )}
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────────
// EDITABLE FIELD COMPONENT
// ─────────────────────────────────────────────────────────────────────────────────

interface EditableFieldProps {
  label: string;
  value: string;
  placeholder: string;
  isEditing: boolean;
  onStartEdit: () => void;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
}

function EditableField({
  label,
  value,
  placeholder,
  isEditing,
  onStartEdit,
  onSave,
  onCancel,
}: EditableFieldProps) {
  const [editValue, setEditValue] = useState(value);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      await onSave(editValue);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStartEdit = () => {
    setEditValue(value);
    onStartEdit();
  };

  if (isEditing) {
    return (
      <div className="bg-[#1C1C1E] rounded-2xl p-4">
        <label className="text-xs text-white/50 mb-2 block">{label}</label>
        <textarea
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-white/5 rounded-xl p-3 text-white text-sm placeholder-white/30 resize-none outline-none focus:ring-1 focus:ring-green-500/50"
          rows={3}
          autoFocus
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={onCancel}
            disabled={isSaving}
            className="flex-1 py-2 bg-white/5 text-white/70 rounded-xl text-sm font-medium active:bg-white/10 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 py-2 bg-green-500 text-black rounded-xl text-sm font-medium active:opacity-80 transition-opacity disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : 'Save'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={handleStartEdit}
      className="w-full bg-[#1C1C1E] rounded-2xl p-4 text-left active:bg-[#2C2C2E] transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <label className="text-xs text-white/50 mb-1 block">{label}</label>
          <p className={`text-sm ${value ? 'text-white' : 'text-white/30'}`}>
            {value || placeholder}
          </p>
        </div>
        <span className="text-white/30 text-sm">Edit</span>
      </div>
    </button>
  );
}
