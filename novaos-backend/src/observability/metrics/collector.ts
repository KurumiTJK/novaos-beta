// ═══════════════════════════════════════════════════════════════════════════════
// METRICS COLLECTOR — Prometheus-Compatible Metrics Registry
// NovaOS Observability — Phase 3
// ═══════════════════════════════════════════════════════════════════════════════
//
// Lightweight Prometheus-compatible metrics collection without external deps.
// Can be enhanced with prom-client for production use.
//
// Usage:
//   const metrics = getMetricsCollector();
//   metrics.incrementCounter('http_requests_total', { method: 'GET', status: '200' });
//   metrics.observeHistogram('http_request_duration_seconds', 0.5, { method: 'GET' });
//
// ═══════════════════════════════════════════════════════════════════════════════

import {
  HTTP_METRICS,
  AUTH_METRICS,
  AUTHZ_METRICS,
  RATE_LIMIT_METRICS,
  LLM_METRICS,
  SWORD_METRICS,
  CACHE_METRICS,
  SECURITY_METRICS,
  SYSTEM_METRICS,
  HTTP_DURATION_BUCKETS,
  type MetricDefinition,
} from './definitions.js';

// ─────────────────────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Label set for metrics.
 */
export type Labels = Record<string, string>;

/**
 * Counter metric interface.
 */
export interface Counter {
  inc(labels?: Labels, value?: number): void;
  get(labels?: Labels): number;
  reset(): void;
}

/**
 * Gauge metric interface.
 */
export interface Gauge {
  set(labels: Labels | undefined, value: number): void;
  inc(labels?: Labels, value?: number): void;
  dec(labels?: Labels, value?: number): void;
  get(labels?: Labels): number;
  reset(): void;
}

/**
 * Histogram metric interface.
 */
export interface Histogram {
  observe(labels: Labels | undefined, value: number): void;
  get(labels?: Labels): HistogramValue;
  reset(): void;
}

/**
 * Histogram value structure.
 */
export interface HistogramValue {
  sum: number;
  count: number;
  buckets: Map<number, number>;
}

/**
 * Metrics collector configuration.
 */
export interface MetricsCollectorConfig {
  /** Prefix for all metric names */
  prefix?: string;
  
  /** Default labels added to all metrics */
  defaultLabels?: Labels;
  
  /** Enable/disable metrics collection */
  enabled?: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────────
// INTERNAL STORAGE
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Generate a label key for storage.
 */
function labelsToKey(labels: Labels | undefined): string {
  if (!labels || Object.keys(labels).length === 0) {
    return '';
  }
  return Object.entries(labels)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${k}="${v}"`)
    .join(',');
}

/**
 * Internal counter implementation.
 */
class CounterImpl implements Counter {
  private values = new Map<string, number>();
  
  inc(labels?: Labels, value: number = 1): void {
    const key = labelsToKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }
  
  get(labels?: Labels): number {
    return this.values.get(labelsToKey(labels)) ?? 0;
  }
  
  reset(): void {
    this.values.clear();
  }
  
  getAll(): Map<string, number> {
    return new Map(this.values);
  }
}

/**
 * Internal gauge implementation.
 */
class GaugeImpl implements Gauge {
  private values = new Map<string, number>();
  
  set(labels: Labels | undefined, value: number): void {
    this.values.set(labelsToKey(labels), value);
  }
  
  inc(labels?: Labels, value: number = 1): void {
    const key = labelsToKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) + value);
  }
  
  dec(labels?: Labels, value: number = 1): void {
    const key = labelsToKey(labels);
    this.values.set(key, (this.values.get(key) ?? 0) - value);
  }
  
  get(labels?: Labels): number {
    return this.values.get(labelsToKey(labels)) ?? 0;
  }
  
  reset(): void {
    this.values.clear();
  }
  
  getAll(): Map<string, number> {
    return new Map(this.values);
  }
}

/**
 * Internal histogram implementation.
 */
class HistogramImpl implements Histogram {
  private bucketBounds: number[];
  private data = new Map<string, { sum: number; count: number; buckets: number[] }>();
  
  constructor(buckets: readonly number[] = [...HTTP_DURATION_BUCKETS]) {
    this.bucketBounds = [...buckets].sort((a, b) => a - b);
  }
  
  observe(labels: Labels | undefined, value: number): void {
    const key = labelsToKey(labels);
    
    let data = this.data.get(key);
    if (!data) {
      data = {
        sum: 0,
        count: 0,
        buckets: new Array(this.bucketBounds.length).fill(0),
      };
      this.data.set(key, data);
    }
    
    data.sum += value;
    data.count += 1;
    
    // Increment all buckets where value <= bound
    for (let i = 0; i < this.bucketBounds.length; i++) {
      if (value <= this.bucketBounds[i]!) {
        data.buckets[i]!++;
      }
    }
  }
  
  get(labels?: Labels): HistogramValue {
    const key = labelsToKey(labels);
    const data = this.data.get(key);
    
    if (!data) {
      return {
        sum: 0,
        count: 0,
        buckets: new Map(this.bucketBounds.map(b => [b, 0])),
      };
    }
    
    return {
      sum: data.sum,
      count: data.count,
      buckets: new Map(this.bucketBounds.map((b, i) => [b, data.buckets[i]!])),
    };
  }
  
  reset(): void {
    this.data.clear();
  }
  
  getAll(): Map<string, { sum: number; count: number; buckets: number[] }> {
    return new Map(this.data);
  }
  
  getBucketBounds(): number[] {
    return [...this.bucketBounds];
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// METRICS COLLECTOR
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Metrics collector manages all application metrics.
 */
export class MetricsCollector {
  private counters = new Map<string, CounterImpl>();
  private gauges = new Map<string, GaugeImpl>();
  private histograms = new Map<string, HistogramImpl>();
  private definitions = new Map<string, MetricDefinition>();
  private config: Required<MetricsCollectorConfig>;
  
  constructor(config: MetricsCollectorConfig = {}) {
    this.config = {
      prefix: config.prefix ?? '',
      defaultLabels: config.defaultLabels ?? {},
      enabled: config.enabled ?? true,
    };
    
    // Register all predefined metrics
    this.registerPredefinedMetrics();
  }
  
  /**
   * Register all predefined metric definitions.
   */
  private registerPredefinedMetrics(): void {
    const allMetrics = [
      HTTP_METRICS,
      AUTH_METRICS,
      AUTHZ_METRICS,
      RATE_LIMIT_METRICS,
      LLM_METRICS,
      SWORD_METRICS,
      CACHE_METRICS,
      SECURITY_METRICS,
      SYSTEM_METRICS,
    ];
    
    for (const category of allMetrics) {
      for (const def of Object.values(category)) {
        this.registerMetric(def as MetricDefinition);
      }
    }
  }
  
  /**
   * Register a metric definition.
   */
  registerMetric(definition: MetricDefinition): void {
    const name = this.prefixName(definition.name);
    this.definitions.set(name, definition);
    
    switch (definition.type) {
      case 'counter':
        if (!this.counters.has(name)) {
          this.counters.set(name, new CounterImpl());
        }
        break;
      case 'gauge':
        if (!this.gauges.has(name)) {
          this.gauges.set(name, new GaugeImpl());
        }
        break;
      case 'histogram':
        if (!this.histograms.has(name)) {
          this.histograms.set(name, new HistogramImpl(definition.buckets));
        }
        break;
    }
  }
  
  /**
   * Apply prefix to metric name.
   */
  private prefixName(name: string): string {
    return this.config.prefix ? `${this.config.prefix}${name}` : name;
  }
  
  /**
   * Merge default labels with provided labels.
   */
  private mergeLabels(labels?: Labels): Labels {
    if (!labels && Object.keys(this.config.defaultLabels).length === 0) {
      return {};
    }
    return { ...this.config.defaultLabels, ...labels };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // COUNTER OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Increment a counter.
   */
  incrementCounter(name: string, labels?: Labels, value: number = 1): void {
    if (!this.config.enabled) return;
    
    const prefixedName = this.prefixName(name);
    let counter = this.counters.get(prefixedName);
    
    if (!counter) {
      counter = new CounterImpl();
      this.counters.set(prefixedName, counter);
    }
    
    counter.inc(this.mergeLabels(labels), value);
  }
  
  /**
   * Get counter value.
   */
  getCounter(name: string, labels?: Labels): number {
    const counter = this.counters.get(this.prefixName(name));
    return counter?.get(this.mergeLabels(labels)) ?? 0;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // GAUGE OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Set a gauge value.
   */
  setGauge(name: string, value: number, labels?: Labels): void {
    if (!this.config.enabled) return;
    
    const prefixedName = this.prefixName(name);
    let gauge = this.gauges.get(prefixedName);
    
    if (!gauge) {
      gauge = new GaugeImpl();
      this.gauges.set(prefixedName, gauge);
    }
    
    gauge.set(this.mergeLabels(labels), value);
  }
  
  /**
   * Increment a gauge.
   */
  incrementGauge(name: string, labels?: Labels, value: number = 1): void {
    if (!this.config.enabled) return;
    
    const prefixedName = this.prefixName(name);
    let gauge = this.gauges.get(prefixedName);
    
    if (!gauge) {
      gauge = new GaugeImpl();
      this.gauges.set(prefixedName, gauge);
    }
    
    gauge.inc(this.mergeLabels(labels), value);
  }
  
  /**
   * Decrement a gauge.
   */
  decrementGauge(name: string, labels?: Labels, value: number = 1): void {
    if (!this.config.enabled) return;
    
    const prefixedName = this.prefixName(name);
    let gauge = this.gauges.get(prefixedName);
    
    if (!gauge) {
      gauge = new GaugeImpl();
      this.gauges.set(prefixedName, gauge);
    }
    
    gauge.dec(this.mergeLabels(labels), value);
  }
  
  /**
   * Get gauge value.
   */
  getGauge(name: string, labels?: Labels): number {
    const gauge = this.gauges.get(this.prefixName(name));
    return gauge?.get(this.mergeLabels(labels)) ?? 0;
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // HISTOGRAM OPERATIONS
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Observe a histogram value.
   */
  observeHistogram(name: string, value: number, labels?: Labels): void {
    if (!this.config.enabled) return;
    
    const prefixedName = this.prefixName(name);
    let histogram = this.histograms.get(prefixedName);
    
    if (!histogram) {
      const def = this.definitions.get(prefixedName);
      histogram = new HistogramImpl(def?.buckets);
      this.histograms.set(prefixedName, histogram);
    }
    
    histogram.observe(this.mergeLabels(labels), value);
  }
  
  /**
   * Get histogram value.
   */
  getHistogram(name: string, labels?: Labels): HistogramValue {
    const histogram = this.histograms.get(this.prefixName(name));
    return histogram?.get(this.mergeLabels(labels)) ?? {
      sum: 0,
      count: 0,
      buckets: new Map(),
    };
  }
  
  /**
   * Time a function and record to histogram.
   */
  async timeHistogram<T>(
    name: string,
    fn: () => Promise<T>,
    labels?: Labels
  ): Promise<T> {
    const start = performance.now();
    try {
      return await fn();
    } finally {
      const duration = (performance.now() - start) / 1000; // Convert to seconds
      this.observeHistogram(name, duration, labels);
    }
  }
  
  /**
   * Create a timer for manual timing.
   */
  startTimer(name: string, labels?: Labels): () => number {
    const start = performance.now();
    return () => {
      const duration = (performance.now() - start) / 1000;
      this.observeHistogram(name, duration, labels);
      return duration;
    };
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // PROMETHEUS FORMAT EXPORT
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Export all metrics in Prometheus text format.
   */
  async getMetrics(): Promise<string> {
    const lines: string[] = [];
    
    // Add default Node.js metrics
    this.collectSystemMetrics();
    
    // Export counters
    for (const [name, counter] of this.counters) {
      const def = this.definitions.get(name);
      if (def) {
        lines.push(`# HELP ${name} ${def.help}`);
        lines.push(`# TYPE ${name} counter`);
      }
      
      for (const [labelKey, value] of counter.getAll()) {
        const labelStr = labelKey ? `{${labelKey}}` : '';
        lines.push(`${name}${labelStr} ${value}`);
      }
    }
    
    // Export gauges
    for (const [name, gauge] of this.gauges) {
      const def = this.definitions.get(name);
      if (def) {
        lines.push(`# HELP ${name} ${def.help}`);
        lines.push(`# TYPE ${name} gauge`);
      }
      
      for (const [labelKey, value] of gauge.getAll()) {
        const labelStr = labelKey ? `{${labelKey}}` : '';
        lines.push(`${name}${labelStr} ${value}`);
      }
    }
    
    // Export histograms
    for (const [name, histogram] of this.histograms) {
      const def = this.definitions.get(name);
      if (def) {
        lines.push(`# HELP ${name} ${def.help}`);
        lines.push(`# TYPE ${name} histogram`);
      }
      
      const bucketBounds = histogram.getBucketBounds();
      
      for (const [labelKey, data] of histogram.getAll()) {
        const baseLabels = labelKey ? `${labelKey},` : '';
        
        // Bucket values
        for (let i = 0; i < bucketBounds.length; i++) {
          const le = bucketBounds[i];
          const count = data.buckets[i];
          lines.push(`${name}_bucket{${baseLabels}le="${le}"} ${count}`);
        }
        lines.push(`${name}_bucket{${baseLabels}le="+Inf"} ${data.count}`);
        
        // Sum and count
        const labelStr = labelKey ? `{${labelKey}}` : '';
        lines.push(`${name}_sum${labelStr} ${data.sum}`);
        lines.push(`${name}_count${labelStr} ${data.count}`);
      }
    }
    
    return lines.join('\n');
  }
  
  /**
   * Collect system metrics.
   */
  private collectSystemMetrics(): void {
    // Memory usage
    const mem = process.memoryUsage();
    this.setGauge('process_memory_bytes', mem.heapUsed, { type: 'heap_used' });
    this.setGauge('process_memory_bytes', mem.heapTotal, { type: 'heap_total' });
    this.setGauge('process_memory_bytes', mem.external, { type: 'external' });
    this.setGauge('process_memory_bytes', mem.rss, { type: 'rss' });
    
    // Uptime
    this.setGauge('app_uptime_seconds', process.uptime());
    
    // App info (set once)
    this.setGauge('app_info', 1, {
      version: '10.0.0',
      environment: process.env.NODE_ENV ?? 'development',
      node_version: process.version,
    });
  }
  
  // ─────────────────────────────────────────────────────────────────────────────
  // RESET & UTILITIES
  // ─────────────────────────────────────────────────────────────────────────────
  
  /**
   * Reset all metrics.
   */
  reset(): void {
    for (const counter of this.counters.values()) {
      counter.reset();
    }
    for (const gauge of this.gauges.values()) {
      gauge.reset();
    }
    for (const histogram of this.histograms.values()) {
      histogram.reset();
    }
  }
  
  /**
   * Reset a specific metric.
   */
  resetMetric(name: string): void {
    const prefixedName = this.prefixName(name);
    this.counters.get(prefixedName)?.reset();
    this.gauges.get(prefixedName)?.reset();
    this.histograms.get(prefixedName)?.reset();
  }
  
  /**
   * Get metric definition.
   */
  getDefinition(name: string): MetricDefinition | undefined {
    return this.definitions.get(this.prefixName(name));
  }
  
  /**
   * List all registered metric names.
   */
  getRegisteredMetrics(): string[] {
    return [...this.definitions.keys()];
  }
  
  /**
   * Check if metrics are enabled.
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }
  
  /**
   * Enable/disable metrics collection.
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
  }
}

// ─────────────────────────────────────────────────────────────────────────────────
// SINGLETON
// ─────────────────────────────────────────────────────────────────────────────────

let collectorInstance: MetricsCollector | null = null;

/**
 * Get the global metrics collector instance.
 */
export function getMetricsCollector(config?: MetricsCollectorConfig): MetricsCollector {
  if (!collectorInstance) {
    collectorInstance = new MetricsCollector(config);
  }
  return collectorInstance;
}

/**
 * Reset the global metrics collector (for testing).
 */
export function resetMetricsCollector(): void {
  collectorInstance = null;
}

// ─────────────────────────────────────────────────────────────────────────────────
// CONVENIENCE FUNCTIONS
// ─────────────────────────────────────────────────────────────────────────────────

/**
 * Increment a counter (convenience function).
 */
export function incCounter(name: string, labels?: Labels, value?: number): void {
  getMetricsCollector().incrementCounter(name, labels, value);
}

/**
 * Set a gauge value (convenience function).
 */
export function setGauge(name: string, value: number, labels?: Labels): void {
  getMetricsCollector().setGauge(name, value, labels);
}

/**
 * Observe a histogram value (convenience function).
 */
export function observeHistogram(name: string, value: number, labels?: Labels): void {
  getMetricsCollector().observeHistogram(name, value, labels);
}

/**
 * Time a function and record to histogram (convenience function).
 */
export async function timeHistogram<T>(
  name: string,
  fn: () => Promise<T>,
  labels?: Labels
): Promise<T> {
  return getMetricsCollector().timeHistogram(name, fn, labels);
}

/**
 * Start a timer (convenience function).
 */
export function startTimer(name: string, labels?: Labels): () => number {
  return getMetricsCollector().startTimer(name, labels);
}
