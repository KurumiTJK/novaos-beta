// ═══════════════════════════════════════════════════════════════════════════════
// CLARIFY PHASE — Edit learning details
// User reviews and edits extracted information before plan generation
// Constraints are now a string[] array
// ═══════════════════════════════════════════════════════════════════════════════

import { useState } from 'react';
import { useSwordDesignerStore } from '@/shared/stores/swordDesignerStore';

// Predefined constraint options
const CONSTRAINT_PRESETS = [
  '15 minutes per day',
  '30 minutes per day',
  '45 minutes per day',
  '1 hour per day',
  'Weekends only',
  '2 weeks to complete',
  '4 weeks to complete',
  '8 weeks to complete',
  '12 weeks to complete',
  'Visual learning preferred',
  'Hands-on learning preferred',
  'Reading-based learning',
];

export function ClarifyPhase() {
  const {
    clarifyData,
    fieldSources,
    canFinalize,
    isLoading,
    updateField,
    updateConstraintsAction,
    finalizeClarify,
  } = useSwordDesignerStore();

  const [editingField, setEditingField] = useState<string | null>(null);
  const [newConstraint, setNewConstraint] = useState('');

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

  const handleAddConstraint = (constraint: string) => {
    if (!constraint.trim()) return;
    const currentConstraints = clarifyData.constraints || [];
    if (!currentConstraints.includes(constraint)) {
      updateConstraintsAction([...currentConstraints, constraint]);
    }
    setNewConstraint('');
  };

  const handleRemoveConstraint = (constraint: string) => {
    const currentConstraints = clarifyData.constraints || [];
    updateConstraintsAction(currentConstraints.filter(c => c !== constraint));
  };

  // Get available presets (not already added)
  const availablePresets = CONSTRAINT_PRESETS.filter(
    p => !(clarifyData.constraints || []).includes(p)
  );

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-5 py-3">
        <h2 className="text-lg font-semibold text-white">Clarify Your Learning</h2>
        <p className="text-sm text-white/50 mt-1">
          Fill in the details so we can create your personalized learning path
        </p>
      </div>

      {/* Fields */}
      <div className="flex-1 overflow-y-auto px-5 space-y-4 pb-4">
        {/* Learning Goal */}
        <EditableField
          label="Learning Goal"
          value={clarifyData.learningGoal}
          placeholder="What do you want to achieve?"
          source={fieldSources?.learningGoal}
          isEditing={editingField === 'learningGoal'}
          isRequired={true}
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
          source={fieldSources?.priorKnowledge}
          isEditing={editingField === 'priorKnowledge'}
          isRequired={true}
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
          placeholder="Any other details? (career, school, hobby, etc.)"
          source={fieldSources?.context}
          isEditing={editingField === 'context'}
          isRequired={false}
          onStartEdit={() => setEditingField('context')}
          onSave={async (value) => {
            await updateField('context', value);
            setEditingField(null);
          }}
          onCancel={() => setEditingField(null)}
        />

        {/* Constraints */}
        <div className="bg-[#1C1C1E] rounded-2xl p-4">
          <h3 className="text-sm font-medium text-white/70 mb-3">⏱️ Constraints</h3>
          
          {/* Current constraints */}
          {clarifyData.constraints && clarifyData.constraints.length > 0 && (
            <div className="flex flex-wrap gap-2 mb-3">
              {clarifyData.constraints.map((constraint, index) => (
                <div
                  key={index}
                  className="flex items-center gap-1 bg-green-500/20 text-green-400 px-3 py-1.5 rounded-full text-sm"
                >
                  <span>{constraint}</span>
                  <button
                    onClick={() => handleRemoveConstraint(constraint)}
                    className="ml-1 hover:text-green-200"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Add constraint input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={newConstraint}
              onChange={(e) => setNewConstraint(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAddConstraint(newConstraint)}
              placeholder="Add a constraint..."
              className="flex-1 bg-white/5 rounded-xl px-3 py-2 text-white text-sm placeholder-white/30 outline-none focus:ring-1 focus:ring-green-500/50"
            />
            <button
              onClick={() => handleAddConstraint(newConstraint)}
              disabled={!newConstraint.trim()}
              className="px-4 py-2 bg-green-500/20 text-green-400 rounded-xl text-sm font-medium disabled:opacity-50"
            >
              Add
            </button>
          </div>

          {/* Preset buttons */}
          {availablePresets.length > 0 && (
            <div>
              <p className="text-xs text-white/40 mb-2">Quick add:</p>
              <div className="flex flex-wrap gap-2">
                {availablePresets.slice(0, 6).map((preset) => (
                  <button
                    key={preset}
                    onClick={() => handleAddConstraint(preset)}
                    className="px-3 py-1.5 bg-white/5 text-white/70 rounded-full text-xs hover:bg-white/10 transition-colors"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>
          )}
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
              Generating plan...
            </span>
          ) : (
            'Continue'
          )}
        </button>
        {!canFinalize && (
          <p className="text-center text-white/40 text-xs mt-2">
            Fill in <span className="text-white/60">Learning Goal</span> and <span className="text-white/60">Your Experience</span> to continue
          </p>
        )}
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
  source?: string;
  isEditing: boolean;
  isRequired?: boolean;
  onStartEdit: () => void;
  onSave: (value: string) => Promise<void>;
  onCancel: () => void;
}

function EditableField({
  label,
  value,
  placeholder,
  source,
  isEditing,
  isRequired = false,
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

  const isEmpty = !value || value.trim() === '';
  const showRequiredBadge = isRequired && isEmpty;

  if (isEditing) {
    return (
      <div className="bg-[#1C1C1E] rounded-2xl p-4">
        <div className="flex items-center gap-2 mb-2">
          <label className="text-xs text-white/50">{label}</label>
          {isRequired && <span className="text-[10px] text-red-400">*</span>}
        </div>
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
      className={`w-full bg-[#1C1C1E] rounded-2xl p-4 text-left active:bg-[#2C2C2E] transition-colors ${
        showRequiredBadge ? 'ring-1 ring-red-500/30' : ''
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <label className="text-xs text-white/50">{label}</label>
            {showRequiredBadge && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">
                Required
              </span>
            )}
            {source && !showRequiredBadge && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                source === 'extracted' ? 'bg-blue-500/20 text-blue-400' : 'bg-green-500/20 text-green-400'
              }`}>
                {source === 'extracted' ? 'AI extracted' : 'Edited'}
              </span>
            )}
          </div>
          <p className={`text-sm ${value ? 'text-white' : 'text-white/30 italic'}`}>
            {value || placeholder}
          </p>
        </div>
        <span className="text-white/30 text-sm">{value ? 'Edit' : 'Add'}</span>
      </div>
    </button>
  );
}
