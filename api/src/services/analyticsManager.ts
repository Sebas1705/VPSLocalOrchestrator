import type { Metric } from './metricsManager.js';

export type AggregationType = 'sum' | 'avg' | 'count' | 'min' | 'max';

export interface Aggregate {
  metric: string;
  type: AggregationType;
  value: number;
  periodStart: string;
  periodEnd: string;
  samplesCount: number;
}

export interface Snapshot {
  timestamp: string;
  metrics: Record<string, number>; // metric_name: latest_value
}

export interface Trend {
  metric: string;
  direction: 'up' | 'down' | 'stable';
  changePercent: number;
  periodStart: string;
  periodEnd: string;
}

export function filterMetricsByPeriod(metrics: Metric[], from: string, to: string): Metric[] {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  return metrics.filter(m => {
    const ts = new Date(m.timestamp).getTime();
    return ts >= fromMs && ts <= toMs;
  });
}

export function aggregateMetrics(
  metrics: Metric[],
  metricName: string,
  type: AggregationType,
  periodStart: string,
  periodEnd: string
): Aggregate {
  const filtered = filterMetricsByPeriod(metrics, periodStart, periodEnd).filter(m => m.name === metricName);

  if (filtered.length === 0) {
    return {
      metric: metricName,
      type,
      value: 0,
      periodStart,
      periodEnd,
      samplesCount: 0,
    };
  }

  const values = filtered.map(m => m.value);

  let value = 0;
  if (type === 'sum') {
    value = values.reduce((a, b) => a + b, 0);
  } else if (type === 'avg') {
    value = values.reduce((a, b) => a + b, 0) / values.length;
  } else if (type === 'count') {
    value = values.length;
  } else if (type === 'min') {
    value = Math.min(...values);
  } else if (type === 'max') {
    value = Math.max(...values);
  }

  return {
    metric: metricName,
    type,
    value,
    periodStart,
    periodEnd,
    samplesCount: filtered.length,
  };
}

export function createSnapshot(metrics: Metric[]): Snapshot {
  const record: Record<string, number> = {};
  const grouped = metrics.reduce((acc, m) => {
    if (!acc[m.name]) acc[m.name] = [];
    acc[m.name]!.push(m);
    return acc;
  }, {} as Record<string, Metric[]>);

  for (const [name, group] of Object.entries(grouped)) {
    const latest = group.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())[0];
    if (latest) record[name] = latest.value;
  }

  return {
    timestamp: new Date().toISOString(),
    metrics: record,
  };
}

export function detectTrend(
  metrics: Metric[],
  metricName: string,
  periodStart: string,
  periodEnd: string
): Trend {
  const filtered = filterMetricsByPeriod(metrics, periodStart, periodEnd)
    .filter(m => m.name === metricName)
    .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

  if (filtered.length < 2) {
    return {
      metric: metricName,
      direction: 'stable',
      changePercent: 0,
      periodStart,
      periodEnd,
    };
  }

  const first = filtered[0]!.value;
  const last = filtered[filtered.length - 1]!.value;
  const changePercent = first !== 0 ? ((last - first) / Math.abs(first)) * 100 : 0;

  let direction: 'up' | 'down' | 'stable' = 'stable';
  if (Math.abs(changePercent) > 5) {
    direction = changePercent > 0 ? 'up' : 'down';
  }

  return {
    metric: metricName,
    direction,
    changePercent: Math.round(changePercent * 100) / 100,
    periodStart,
    periodEnd,
  };
}
