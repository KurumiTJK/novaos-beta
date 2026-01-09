// ═══════════════════════════════════════════════════════════════════════════════
// STORES EXPORTS — NovaOS
// ═══════════════════════════════════════════════════════════════════════════════

export { useAuthStore } from './authStore';
export { 
  useChatStore, 
  selectLastMessage, 
  selectHasMessages, 
  selectIsShieldActive,
  type Message,
  type ChatState,
} from './chatStore';
export { useUIStore } from './uiStore';

export { 
  useLessonStore,
  selectHasActivePlan,
  selectCurrentLesson,
  selectAvailableLessons,
  selectCompletedLessons,
  selectOverallProgress,
  type LessonStatus,
  type Spark,
  type Lesson,
  type Milestone,
  type LearningPath,
  type LearningStats,
} from './lessonStore';

export { 
  useSwordDesignerStore,
  selectPhaseIndex,
  selectIsPhaseComplete,
  selectPhaseLabel,
  type DesignerPhase,
  type OrientMessage,
} from './swordDesignerStore';

export {
  useSettingsStore,
  selectTheme,
  selectDefaultStance,
  selectHapticFeedback,
  selectNotifications,
  type Settings,
  type SettingsUpdate,
  type Theme,
  type DefaultStance,
  type NotificationSettings,
} from './settingsStore';
