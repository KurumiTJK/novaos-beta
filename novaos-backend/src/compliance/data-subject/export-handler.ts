// ═══════════════════════════════════════════════════════════════════════════════
// DATA EXPORT HANDLER — GDPR Data Export Service
// NovaOS Compliance Layer — Phase 16
// ═══════════════════════════════════════════════════════════════════════════════
//
// GDPR Article 15 (Right to Access) and Article 20 (Right to Portability):
//   - Export user data in machine-readable format
//   - Collect data from all stores
//   - Generate downloadable packages
//   - Track and manage export requests
//
// ═══════════════════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid';
import { ok, err, type AsyncAppResult } from '../../types/result.js';
import type { UserId, Timestamp } from '../../types/branded.js';
import { createTimestamp } from '../../types/branded.js';
import type {
  DataExportRequest,
  DataExport,
  ExportedCategory,
  ExportSummary,
  ExportCategory,
  ExportFormat,
  ExportRequestId,
  IDataExportService,
  UserProfile,
  UserPreferences,
  AuditLogEntry,
} from './types.js';
import {
  DataSubjectErrorCode,
  ALL_EXPORT_CATEGORIES,
  createExportRequestId,
} from './types.js';
import type { ExportRequestStore } from './export-store.js';
import type { Goal, Quest, Step, Spark, ReminderSchedule } from '../../services/spark-engine/types.js';
import type { ConsentRecord } from '../consent/types.js';

// ═══════════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Data collectors for each category.
 */
export interface DataCollectors {
  goals?: (userId: UserId) => AsyncAppResult<readonly Goal[]>;
  quests?: (userId: UserId) => AsyncAppResult<readonly Quest[]>;
  steps?: (userId: UserId) => AsyncAppResult<readonly Step[]>;
  sparks?: (userId: UserId) => AsyncAppResult<readonly Spark[]>;
  reminders?: (userId: UserId) => AsyncAppResult<readonly ReminderSchedule[]>;
  consent?: (userId: UserId) => AsyncAppResult<readonly ConsentRecord[]>;
  auditLog?: (userId: UserId) => AsyncAppResult<readonly AuditLogEntry[]>;
  profile?: (userId: UserId) => AsyncAppResult<UserProfile | null>;
  preferences?: (userId: UserId) => AsyncAppResult<UserPreferences | null>;
}

/**
 * Export handler configuration.
 */
export interface DataExportHandlerConfig {
  /** Version string for exports */
  version: string;

  /** Download URL base (e.g., 'https://api.example.com/exports') */
  downloadUrlBase?: string;

  /** How long download links are valid (seconds) */
  downloadExpirySeconds: number;

  /** Maximum concurrent exports per user */
  maxConcurrentExports: number;
}

/**
 * Default configuration.
 */
const DEFAULT_CONFIG: DataExportHandlerConfig = {
  version: '1.0.0',
  downloadExpirySeconds: 86400, // 24 hours
  maxConcurrentExports: 3,
};

// ═══════════════════════════════════════════════════════════════════════════════
// ERROR HELPER
// ═══════════════════════════════════════════════════════════════════════════════

function exportError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): { code: string; message: string; context?: Record<string, unknown> } {
  return { code, message, context };
}

// ═══════════════════════════════════════════════════════════════════════════════
// DATA EXPORT HANDLER
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Service for handling GDPR data export requests.
 */
export class DataExportHandler implements IDataExportService {
  private readonly requestStore: ExportRequestStore;
  private readonly collectors: DataCollectors;
  private readonly config: DataExportHandlerConfig;

  constructor(
    requestStore: ExportRequestStore,
    collectors: DataCollectors,
    config: Partial<DataExportHandlerConfig> = {}
  ) {
    this.requestStore = requestStore;
    this.collectors = collectors;
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // IDataExportService Implementation
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Create an export request.
   */
  async createExportRequest(
    userId: UserId,
    options?: {
      categories?: readonly ExportCategory[];
      format?: ExportFormat;
      ipAddress?: string;
    }
  ): AsyncAppResult<DataExportRequest> {
    // Check for too many concurrent requests
    const existingResult = await this.requestStore.getByUser(userId, { limit: 10 });
    if (existingResult.ok) {
      const pending = existingResult.value.filter(
        r => r.status === 'pending' || r.status === 'processing'
      );
      if (pending.length >= this.config.maxConcurrentExports) {
        return err(
          exportError(
            DataSubjectErrorCode.RATE_LIMITED,
            `Maximum ${this.config.maxConcurrentExports} concurrent export requests allowed`,
            { userId, pendingCount: pending.length }
          )
        );
      }
    }

    return this.requestStore.create(userId, options);
  }

  /**
   * Get export request status.
   */
  async getExportRequest(requestId: ExportRequestId): AsyncAppResult<DataExportRequest | null> {
    return this.requestStore.get(requestId);
  }

  /**
   * Process an export request (generate the export).
   */
  async processExportRequest(requestId: ExportRequestId): AsyncAppResult<DataExport> {
    // Get request
    const requestResult = await this.requestStore.get(requestId);
    if (!requestResult.ok) {
      return err(requestResult.error);
    }
    if (!requestResult.value) {
      return err(
        exportError(
          DataSubjectErrorCode.REQUEST_NOT_FOUND,
          `Export request not found: ${requestId}`,
          { requestId }
        )
      );
    }

    const request = requestResult.value;

    // Check status
    if (request.status === 'completed') {
      return err(
        exportError(
          DataSubjectErrorCode.ALREADY_COMPLETED,
          'Export request already completed',
          { requestId }
        )
      );
    }
    if (request.status === 'processing') {
      return err(
        exportError(
          DataSubjectErrorCode.ALREADY_PROCESSING,
          'Export request already processing',
          { requestId }
        )
      );
    }

    // Mark as processing
    const processingNow = createTimestamp();
    await this.requestStore.updateStatus(requestId, 'processing', {
      processingStartedAt: processingNow,
    });

    try {
      // Generate export
      const exportResult = await this.exportUserData(request.userId, request.categories);
      if (!exportResult.ok) {
        // Mark as failed
        await this.requestStore.updateStatus(requestId, 'failed', {
          errorMessage: exportResult.error.message,
        });
        return err(exportResult.error);
      }

      // Generate download token
      const token = uuidv4();
      await this.requestStore.createDownloadToken(
        requestId,
        token,
        this.config.downloadExpirySeconds
      );

      // Calculate download URL and expiry
      const downloadUrl = this.config.downloadUrlBase
        ? `${this.config.downloadUrlBase}/${token}`
        : `/api/exports/${token}`;
      
      const downloadExpiresAt = new Date(
        Date.now() + this.config.downloadExpirySeconds * 1000
      ).toISOString() as Timestamp;

      // Mark as completed
      await this.requestStore.updateStatus(requestId, 'completed', {
        completedAt: createTimestamp(),
        downloadUrl,
        downloadExpiresAt,
      });

      return ok({
        ...exportResult.value,
        requestId,
      });
    } catch (error) {
      // Mark as failed
      const errorMessage = error instanceof Error ? error.message : String(error);
      await this.requestStore.updateStatus(requestId, 'failed', {
        errorMessage,
      });
      return err(
        exportError(
          DataSubjectErrorCode.PROCESSING_FAILED,
          `Export processing failed: ${errorMessage}`,
          { requestId }
        )
      );
    }
  }

  /**
   * Get all export requests for a user.
   */
  async getUserExportRequests(userId: UserId): AsyncAppResult<readonly DataExportRequest[]> {
    return this.requestStore.getByUser(userId);
  }

  /**
   * Export user data immediately (synchronous).
   */
  async exportUserData(
    userId: UserId,
    categories?: readonly ExportCategory[]
  ): AsyncAppResult<DataExport> {
    const now = createTimestamp();
    const categoriesToExport = categories ?? [...ALL_EXPORT_CATEGORIES];

    // Use mutable object for building, then cast at the end
    const exportData: {
      goals?: ExportedCategory<Goal>;
      quests?: ExportedCategory<Quest>;
      steps?: ExportedCategory<Step>;
      sparks?: ExportedCategory<Spark>;
      reminders?: ExportedCategory<ReminderSchedule>;
      consent?: ExportedCategory<ConsentRecord>;
      auditLog?: ExportedCategory<AuditLogEntry>;
      profile?: ExportedCategory<UserProfile>;
      preferences?: ExportedCategory<UserPreferences>;
    } = {};
    const recordCounts: Record<ExportCategory, number> = {} as Record<ExportCategory, number>;
    let earliestTimestamp: Date | null = null;
    let latestTimestamp: Date | null = null;

    // Helper to track timestamps
    const trackTimestamp = (ts: string | undefined) => {
      if (!ts) return;
      const date = new Date(ts);
      if (!earliestTimestamp || date < earliestTimestamp) {
        earliestTimestamp = date;
      }
      if (!latestTimestamp || date > latestTimestamp) {
        latestTimestamp = date;
      }
    };

    // Export goals
    if (categoriesToExport.includes('goals') && this.collectors.goals) {
      const result = await this.collectors.goals(userId);
      if (result.ok) {
        const goals = result.value;
        exportData.goals = {
          category: 'goals',
          count: goals.length,
          data: goals,
          exportedAt: now,
        };
        recordCounts.goals = goals.length;
        goals.forEach(g => {
          trackTimestamp(g.createdAt);
          trackTimestamp(g.updatedAt);
        });
      }
    }

    // Export quests
    if (categoriesToExport.includes('quests') && this.collectors.quests) {
      const result = await this.collectors.quests(userId);
      if (result.ok) {
        const quests = result.value;
        exportData.quests = {
          category: 'quests',
          count: quests.length,
          data: quests,
          exportedAt: now,
        };
        recordCounts.quests = quests.length;
        quests.forEach(q => {
          trackTimestamp(q.createdAt);
          trackTimestamp(q.updatedAt);
        });
      }
    }

    // Export steps
    if (categoriesToExport.includes('steps') && this.collectors.steps) {
      const result = await this.collectors.steps(userId);
      if (result.ok) {
        const steps = result.value;
        exportData.steps = {
          category: 'steps',
          count: steps.length,
          data: steps,
          exportedAt: now,
        };
        recordCounts.steps = steps.length;
        steps.forEach(s => {
          trackTimestamp(s.createdAt);
          trackTimestamp(s.updatedAt);
        });
      }
    }

    // Export sparks
    if (categoriesToExport.includes('sparks') && this.collectors.sparks) {
      const result = await this.collectors.sparks(userId);
      if (result.ok) {
        const sparks = result.value;
        exportData.sparks = {
          category: 'sparks',
          count: sparks.length,
          data: sparks,
          exportedAt: now,
        };
        recordCounts.sparks = sparks.length;
        sparks.forEach(s => {
          trackTimestamp(s.createdAt);
          trackTimestamp(s.updatedAt);
        });
      }
    }

    // Export reminders
    if (categoriesToExport.includes('reminders') && this.collectors.reminders) {
      const result = await this.collectors.reminders(userId);
      if (result.ok) {
        const reminders = result.value;
        exportData.reminders = {
          category: 'reminders',
          count: reminders.length,
          data: reminders,
          exportedAt: now,
        };
        recordCounts.reminders = reminders.length;
        reminders.forEach(r => trackTimestamp(r.scheduledTime));
      }
    }

    // Export consent history
    if (categoriesToExport.includes('consent') && this.collectors.consent) {
      const result = await this.collectors.consent(userId);
      if (result.ok) {
        const consent = result.value;
        exportData.consent = {
          category: 'consent',
          count: consent.length,
          data: consent,
          exportedAt: now,
        };
        recordCounts.consent = consent.length;
        consent.forEach(c => trackTimestamp(c.timestamp));
      }
    }

    // Export audit log
    if (categoriesToExport.includes('auditLog') && this.collectors.auditLog) {
      const result = await this.collectors.auditLog(userId);
      if (result.ok) {
        const auditLog = result.value;
        exportData.auditLog = {
          category: 'auditLog',
          count: auditLog.length,
          data: auditLog,
          exportedAt: now,
        };
        recordCounts.auditLog = auditLog.length;
        auditLog.forEach(a => trackTimestamp(a.timestamp));
      }
    }

    // Export profile
    if (categoriesToExport.includes('profile') && this.collectors.profile) {
      const result = await this.collectors.profile(userId);
      if (result.ok && result.value) {
        const profile = result.value;
        exportData.profile = {
          category: 'profile',
          count: 1,
          data: [profile],
          exportedAt: now,
        };
        recordCounts.profile = 1;
        trackTimestamp(profile.createdAt);
        trackTimestamp(profile.lastActiveAt);
      }
    }

    // Export preferences
    if (categoriesToExport.includes('preferences') && this.collectors.preferences) {
      const result = await this.collectors.preferences(userId);
      if (result.ok && result.value) {
        const preferences = result.value;
        exportData.preferences = {
          category: 'preferences',
          count: 1,
          data: [preferences],
          exportedAt: now,
        };
        recordCounts.preferences = 1;
      }
    }

    // Calculate totals
    const totalRecords = Object.values(recordCounts).reduce((sum, count) => sum + (count || 0), 0);

    // Build summary (use explicit Date references to avoid closure narrowing issues)
    const earliestStr = earliestTimestamp ? earliestTimestamp.toISOString() : now;
    const latestStr = latestTimestamp ? latestTimestamp.toISOString() : now;
    
    const summary: ExportSummary = {
      totalRecords,
      recordsPerCategory: recordCounts,
      dataRange: {
        earliest: earliestStr as Timestamp,
        latest: latestStr as Timestamp,
      },
      fileSizeBytes: this.estimateExportSize(exportData),
    };

    const dataExport: DataExport = {
      requestId: createExportRequestId(), // Will be overwritten if part of a request
      userId,
      generatedAt: now,
      format: 'json',
      version: this.config.version,
      categories: exportData,
      summary,
    };

    return ok(dataExport);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // ADDITIONAL METHODS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Validate a download token and get the export.
   */
  async getExportByToken(token: string): AsyncAppResult<DataExportRequest | null> {
    const requestIdResult = await this.requestStore.validateDownloadToken(token);
    if (!requestIdResult.ok) {
      return err(requestIdResult.error);
    }
    if (!requestIdResult.value) {
      return ok(null); // Token not found or expired
    }

    return this.requestStore.get(requestIdResult.value);
  }

  /**
   * Get pending export requests for background processing.
   */
  async getPendingRequests(limit: number = 10): AsyncAppResult<readonly DataExportRequest[]> {
    return this.requestStore.getPending(limit);
  }

  /**
   * Convert export to CSV format.
   */
  exportToCsv(dataExport: DataExport): Map<ExportCategory, string> {
    const csvFiles = new Map<ExportCategory, string>();

    for (const [category, exported] of Object.entries(dataExport.categories)) {
      if (!exported || exported.count === 0) continue;

      const csv = this.arrayToCsv(exported.data as unknown as readonly Record<string, unknown>[]);
      csvFiles.set(category as ExportCategory, csv);
    }

    return csvFiles;
  }

  // ─────────────────────────────────────────────────────────────────────────────
  // PRIVATE HELPERS
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Estimate export size in bytes.
   */
  private estimateExportSize(categories: DataExport['categories']): number {
    try {
      return JSON.stringify(categories).length;
    } catch {
      return 0;
    }
  }

  /**
   * Convert array of objects to CSV string.
   */
  private arrayToCsv(data: readonly Record<string, unknown>[]): string {
    if (data.length === 0) return '';

    // Get all unique headers
    const headers = new Set<string>();
    for (const row of data) {
      Object.keys(row).forEach(key => headers.add(key));
    }
    const headerArray = Array.from(headers);

    // Build CSV
    const lines: string[] = [];
    
    // Header row
    lines.push(headerArray.map(h => this.escapeCsvValue(h)).join(','));

    // Data rows
    for (const row of data) {
      const values = headerArray.map(header => {
        const value = row[header];
        return this.escapeCsvValue(this.formatCsvValue(value));
      });
      lines.push(values.join(','));
    }

    return lines.join('\n');
  }

  /**
   * Format a value for CSV.
   */
  private formatCsvValue(value: unknown): string {
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    return String(value);
  }

  /**
   * Escape a CSV value.
   */
  private escapeCsvValue(value: string): string {
    if (value.includes(',') || value.includes('"') || value.includes('\n')) {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  }
}

// ═══════════════════════════════════════════════════════════════════════════════
// FACTORY
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Create a DataExportHandler instance.
 */
export function createDataExportHandler(
  requestStore: ExportRequestStore,
  collectors: DataCollectors,
  config?: Partial<DataExportHandlerConfig>
): DataExportHandler {
  return new DataExportHandler(requestStore, collectors, config);
}
