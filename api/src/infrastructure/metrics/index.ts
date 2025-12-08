/**
 * Metrics Collection Infrastructure
 * 
 * Supports counters, gauges, histograms with Prometheus-compatible export
 * Lightweight in-memory implementation without external dependencies
 * 
 * @module infrastructure/metrics
 */

/**
 * Metric types
 */
export enum MetricType {
  COUNTER = 'counter',
  GAUGE = 'gauge',
  HISTOGRAM = 'histogram',
}

/**
 * Base metric interface
 */
export interface Metric {
  name: string;
  type: MetricType;
  help: string;
  labels: Record<string, string>;
  timestamp: number;
}

/**
 * Counter metric - monotonically increasing value
 */
export interface CounterMetric extends Metric {
  type: MetricType.COUNTER;
  value: number;
}

/**
 * Gauge metric - value that can go up or down
 */
export interface GaugeMetric extends Metric {
  type: MetricType.GAUGE;
  value: number;
}

/**
 * Histogram metric - distribution of values
 */
export interface HistogramMetric extends Metric {
  type: MetricType.HISTOGRAM;
  buckets: Map<number, number>; // bucket upper bound -> count
  sum: number;
  count: number;
}

/**
 * Counter - monotonically increasing counter
 */
export class Counter {
  private value = 0;
  private readonly name: string;
  private readonly help: string;
  private readonly labels: Record<string, string>;

  constructor(name: string, help: string, labels: Record<string, string> = {}) {
    this.name = name;
    this.help = help;
    this.labels = labels;
  }

  /**
   * Increment counter by value (default 1)
   */
  inc(value: number = 1): void {
    if (value < 0) {
      throw new Error('Counter can only be incremented by non-negative values');
    }
    this.value += value;
  }

  /**
   * Get current value
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Get metric data
   */
  getMetric(): CounterMetric {
    return {
      name: this.name,
      type: MetricType.COUNTER,
      help: this.help,
      labels: this.labels,
      value: this.value,
      timestamp: Date.now(),
    };
  }

  /**
   * Reset counter to zero
   */
  reset(): void {
    this.value = 0;
  }
}

/**
 * Gauge - value that can go up or down
 */
export class Gauge {
  private value = 0;
  private readonly name: string;
  private readonly help: string;
  private readonly labels: Record<string, string>;

  constructor(name: string, help: string, labels: Record<string, string> = {}) {
    this.name = name;
    this.help = help;
    this.labels = labels;
  }

  /**
   * Set gauge to value
   */
  set(value: number): void {
    this.value = value;
  }

  /**
   * Increment gauge by value (default 1)
   */
  inc(value: number = 1): void {
    this.value += value;
  }

  /**
   * Decrement gauge by value (default 1)
   */
  dec(value: number = 1): void {
    this.value -= value;
  }

  /**
   * Get current value
   */
  getValue(): number {
    return this.value;
  }

  /**
   * Get metric data
   */
  getMetric(): GaugeMetric {
    return {
      name: this.name,
      type: MetricType.GAUGE,
      help: this.help,
      labels: this.labels,
      value: this.value,
      timestamp: Date.now(),
    };
  }
}

/**
 * Histogram - distribution of values
 */
export class Histogram {
  private readonly buckets: Map<number, number> = new Map();
  private sum = 0;
  private count = 0;
  private readonly name: string;
  private readonly help: string;
  private readonly labels: Record<string, string>;
  private readonly bucketBounds: number[];

  constructor(
    name: string,
    help: string,
    bucketBounds: number[] = [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
    labels: Record<string, string> = {}
  ) {
    this.name = name;
    this.help = help;
    this.labels = labels;
    this.bucketBounds = [...bucketBounds, Infinity].sort((a, b) => a - b);

    // Initialize buckets
    this.bucketBounds.forEach((bound) => {
      this.buckets.set(bound, 0);
    });
  }

  /**
   * Observe a value
   */
  observe(value: number): void {
    this.sum += value;
    this.count += 1;

    // Increment buckets
    for (const bound of this.bucketBounds) {
      if (value <= bound) {
        const currentCount = this.buckets.get(bound) || 0;
        this.buckets.set(bound, currentCount + 1);
      }
    }
  }

  /**
   * Get metric data
   */
  getMetric(): HistogramMetric {
    return {
      name: this.name,
      type: MetricType.HISTOGRAM,
      help: this.help,
      labels: this.labels,
      buckets: new Map(this.buckets),
      sum: this.sum,
      count: this.count,
      timestamp: Date.now(),
    };
  }

  /**
   * Get percentile value (p50, p95, p99)
   */
  getPercentile(percentile: number): number {
    if (this.count === 0) return 0;

    const targetCount = Math.ceil(this.count * percentile);
    let cumulativeCount = 0;

    for (const [bound, count] of this.buckets.entries()) {
      cumulativeCount += count;
      if (cumulativeCount >= targetCount) {
        return bound;
      }
    }

    return Infinity;
  }

  /**
   * Get average value
   */
  getAverage(): number {
    return this.count === 0 ? 0 : this.sum / this.count;
  }

  /**
   * Reset histogram
   */
  reset(): void {
    this.sum = 0;
    this.count = 0;
    this.buckets.forEach((_, key) => {
      this.buckets.set(key, 0);
    });
  }
}

/**
 * Metrics Registry - manages all metrics
 */
export class MetricsRegistry {
  private counters: Map<string, Counter> = new Map();
  private gauges: Map<string, Gauge> = new Map();
  private histograms: Map<string, Histogram> = new Map();

  /**
   * Register or get counter
   */
  getCounter(name: string, help: string, labels: Record<string, string> = {}): Counter {
    const key = this.getKey(name, labels);
    if (!this.counters.has(key)) {
      this.counters.set(key, new Counter(name, help, labels));
    }
    return this.counters.get(key)!;
  }

  /**
   * Register or get gauge
   */
  getGauge(name: string, help: string, labels: Record<string, string> = {}): Gauge {
    const key = this.getKey(name, labels);
    if (!this.gauges.has(key)) {
      this.gauges.set(key, new Gauge(name, help, labels));
    }
    return this.gauges.get(key)!;
  }

  /**
   * Register or get histogram
   */
  getHistogram(
    name: string,
    help: string,
    bucketBounds?: number[],
    labels: Record<string, string> = {}
  ): Histogram {
    const key = this.getKey(name, labels);
    if (!this.histograms.has(key)) {
      this.histograms.set(key, new Histogram(name, help, bucketBounds, labels));
    }
    return this.histograms.get(key)!;
  }

  /**
   * Get all metrics
   */
  getAllMetrics(): Metric[] {
    const metrics: Metric[] = [];

    this.counters.forEach((counter) => {
      metrics.push(counter.getMetric());
    });

    this.gauges.forEach((gauge) => {
      metrics.push(gauge.getMetric());
    });

    this.histograms.forEach((histogram) => {
      metrics.push(histogram.getMetric());
    });

    return metrics;
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    // Export counters
    this.counters.forEach((counter) => {
      const metric = counter.getMetric();
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} counter`);
      lines.push(`${metric.name}${this.formatLabels(metric.labels)} ${metric.value}`);
    });

    // Export gauges
    this.gauges.forEach((gauge) => {
      const metric = gauge.getMetric();
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} gauge`);
      lines.push(`${metric.name}${this.formatLabels(metric.labels)} ${metric.value}`);
    });

    // Export histograms
    this.histograms.forEach((histogram) => {
      const metric = histogram.getMetric();
      lines.push(`# HELP ${metric.name} ${metric.help}`);
      lines.push(`# TYPE ${metric.name} histogram`);

      // Buckets
      metric.buckets.forEach((count, bound) => {
        const boundStr = bound === Infinity ? '+Inf' : bound.toString();
        lines.push(
          `${metric.name}_bucket${this.formatLabels({ ...metric.labels, le: boundStr })} ${count}`
        );
      });

      // Sum and count
      lines.push(`${metric.name}_sum${this.formatLabels(metric.labels)} ${metric.sum}`);
      lines.push(`${metric.name}_count${this.formatLabels(metric.labels)} ${metric.count}`);
    });

    return lines.join('\n') + '\n';
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): string {
    return JSON.stringify(
      {
        timestamp: new Date().toISOString(),
        metrics: this.getAllMetrics().map((metric) => {
          if (metric.type === MetricType.HISTOGRAM) {
            const histMetric = metric as HistogramMetric;
            return {
              ...metric,
              buckets: Object.fromEntries(histMetric.buckets),
            };
          }
          return metric;
        }),
      },
      null,
      2
    );
  }

  /**
   * Clear all metrics
   */
  clear(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
  }

  /**
   * Generate key for metric with labels
   */
  private getKey(name: string, labels: Record<string, string>): string {
    const labelStr = Object.entries(labels)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    return labelStr ? `${name}{${labelStr}}` : name;
  }

  /**
   * Format labels for Prometheus export
   */
  private formatLabels(labels: Record<string, string>): string {
    const entries = Object.entries(labels);
    if (entries.length === 0) return '';

    const labelStr = entries
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
    return `{${labelStr}}`;
  }
}

/**
 * Global metrics registry
 */
let globalRegistry: MetricsRegistry | null = null;

/**
 * Initialize global metrics registry
 */
export function initializeMetrics(): MetricsRegistry {
  if (!globalRegistry) {
    globalRegistry = new MetricsRegistry();
  }
  return globalRegistry;
}

/**
 * Get global metrics registry
 */
export function getMetricsRegistry(): MetricsRegistry {
  if (!globalRegistry) {
    return initializeMetrics();
  }
  return globalRegistry;
}
