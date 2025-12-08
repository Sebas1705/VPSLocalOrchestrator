import type { ILogger } from '../logging/index.js';
import { LoggerFactory } from '../logging/index.js';
import { getAuditLogger } from '../audit/index.js';

/**
 * Threat Detection & Intrusion Prevention - v8.3.0
 * 
 * Provides security monitoring and threat response:
 * - Intrusion detection system (IDS)
 * - Anomaly scoring algorithms
 * - Rate-based attack detection
 * - IP blocking and whitelisting
 * - Alert management and notifications
 */

// ============================================================================
// THREAT TYPES
// ============================================================================

export enum ThreatType {
  BRUTE_FORCE = 'brute_force',
  DDoS = 'ddos',
  SQL_INJECTION = 'sql_injection',
  XSS = 'xss',
  COMMAND_INJECTION = 'command_injection',
  PATH_TRAVERSAL = 'path_traversal',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  RATE_LIMIT_ABUSE = 'rate_limit_abuse',
  SUSPICIOUS_ACTIVITY = 'suspicious_activity',
  MALWARE = 'malware'
}

export enum ThreatSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum IncidentStatus {
  OPEN = 'open',
  INVESTIGATING = 'investigating',
  CONTAINED = 'contained',
  RESOLVED = 'resolved',
  FALSE_POSITIVE = 'false_positive'
}

export interface ThreatIndicator {
  id: string;
  type: ThreatType;
  severity: ThreatSeverity;
  source: string; // IP address
  timestamp: Date;
  details: Record<string, any>;
  score: number; // 0-100
}

export interface SecurityIncident {
  id: string;
  type: ThreatType;
  severity: ThreatSeverity;
  status: IncidentStatus;
  indicators: string[]; // Indicator IDs
  source: string;
  detectedAt: Date;
  resolvedAt?: Date;
  assignedTo?: string;
  notes: string[];
  mitigation?: string[];
}

export interface IPReputation {
  ip: string;
  score: number; // 0-100, lower is worse
  blocked: boolean;
  whitelisted: boolean;
  threatCount: number;
  lastThreatAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface SecurityAlert {
  id: string;
  type: ThreatType;
  severity: ThreatSeverity;
  message: string;
  source: string;
  timestamp: Date;
  acknowledged: boolean;
  acknowledgedBy?: string;
  acknowledgedAt?: Date;
}

export interface AttackPattern {
  id: string;
  name: string;
  type: ThreatType;
  indicators: string[]; // Regex patterns or conditions
  threshold: number; // Occurrences before triggering
  timeWindow: number; // Milliseconds
  severity: ThreatSeverity;
  enabled: boolean;
}

// ============================================================================
// THREAT DETECTOR
// ============================================================================

export class ThreatDetector {
  private indicators: Map<string, ThreatIndicator> = new Map();
  private incidents: Map<string, SecurityIncident> = new Map();
  private ipReputations: Map<string, IPReputation> = new Map();
  private alerts: Map<string, SecurityAlert> = new Map();
  private patterns: Map<string, AttackPattern> = new Map();
  private logger: ILogger;
  private indicatorIdCounter = 0;
  private incidentIdCounter = 0;
  private alertIdCounter = 0;
  private patternIdCounter = 0;

  // Tracking for rate-based detection
  private requestCounts: Map<string, { count: number; firstSeen: number }> = new Map();

  constructor() {
    this.logger = LoggerFactory.getInstance().getLogger();
    this.initializeDefaultPatterns();
  }

  /**
   * Initialize default attack patterns
   */
  private initializeDefaultPatterns(): void {
    // Brute force pattern
    this.createPattern({
      name: 'Brute Force Authentication',
      type: ThreatType.BRUTE_FORCE,
      indicators: ['failed_login', 'invalid_token'],
      threshold: 5,
      timeWindow: 60000, // 1 minute
      severity: ThreatSeverity.HIGH,
      enabled: true
    });

    // DDoS pattern
    this.createPattern({
      name: 'Distributed Denial of Service',
      type: ThreatType.DDoS,
      indicators: ['high_request_rate'],
      threshold: 100,
      timeWindow: 10000, // 10 seconds
      severity: ThreatSeverity.CRITICAL,
      enabled: true
    });

    // Command injection pattern
    this.createPattern({
      name: 'Command Injection Attempt',
      type: ThreatType.COMMAND_INJECTION,
      indicators: ['command_with_pipe', 'command_with_redirect', 'shell_metacharacters'],
      threshold: 1,
      timeWindow: 60000,
      severity: ThreatSeverity.CRITICAL,
      enabled: true
    });

    this.logger.info('Default threat detection patterns initialized');
  }

  // ========================================
  // THREAT INDICATOR MANAGEMENT
  // ========================================

  recordIndicator(params: {
    type: ThreatType;
    severity: ThreatSeverity;
    source: string;
    details: Record<string, any>;
  }): ThreatIndicator {
    const indicator: ThreatIndicator = {
      id: `indicator-${++this.indicatorIdCounter}`,
      type: params.type,
      severity: params.severity,
      source: params.source,
      timestamp: new Date(),
      details: params.details,
      score: this.calculateThreatScore(params.severity, params.details)
    };

    this.indicators.set(indicator.id, indicator);
    this.logger.warn(`Threat indicator recorded: ${indicator.type} from ${indicator.source}`);

    // Update IP reputation
    this.updateIPReputation(params.source, indicator);

    // Check if should create incident
    this.evaluateIncidentCreation(indicator);

    // Create alert if severe
    if (params.severity === ThreatSeverity.HIGH || params.severity === ThreatSeverity.CRITICAL) {
      this.createAlert({
        type: params.type,
        severity: params.severity,
        message: `${params.type} detected from ${params.source}`,
        source: params.source
      });
    }

    return indicator;
  }

  private calculateThreatScore(severity: ThreatSeverity, details: Record<string, any>): number {
    let baseScore = 0;
    
    switch (severity) {
      case ThreatSeverity.LOW:
        baseScore = 25;
        break;
      case ThreatSeverity.MEDIUM:
        baseScore = 50;
        break;
      case ThreatSeverity.HIGH:
        baseScore = 75;
        break;
      case ThreatSeverity.CRITICAL:
        baseScore = 95;
        break;
    }

    // Adjust based on details
    if (details.repeated) baseScore += 5;
    if (details.automated) baseScore += 10;
    if (details.successful) baseScore += 15;

    return Math.min(100, baseScore);
  }

  getIndicator(id: string): ThreatIndicator | undefined {
    return this.indicators.get(id);
  }

  listIndicators(filter?: {
    type?: ThreatType;
    source?: string;
    minSeverity?: ThreatSeverity;
    since?: Date;
  }): ThreatIndicator[] {
    let results = Array.from(this.indicators.values());

    if (filter?.type) {
      results = results.filter(i => i.type === filter.type);
    }
    if (filter?.source) {
      results = results.filter(i => i.source === filter.source);
    }
    if (filter?.minSeverity) {
      const severityOrder = [ThreatSeverity.LOW, ThreatSeverity.MEDIUM, ThreatSeverity.HIGH, ThreatSeverity.CRITICAL];
      const minIndex = severityOrder.indexOf(filter.minSeverity);
      results = results.filter(i => severityOrder.indexOf(i.severity) >= minIndex);
    }
    if (filter?.since) {
      const sinceDate = filter.since;
      results = results.filter(i => i.timestamp >= sinceDate);
    }

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // ========================================
  // INCIDENT MANAGEMENT
  // ========================================

  createIncident(params: {
    type: ThreatType;
    severity: ThreatSeverity;
    indicators: string[];
    source: string;
  }): SecurityIncident {
    const incident: SecurityIncident = {
      id: `incident-${++this.incidentIdCounter}`,
      type: params.type,
      severity: params.severity,
      status: IncidentStatus.OPEN,
      indicators: params.indicators,
      source: params.source,
      detectedAt: new Date(),
      notes: []
    };

    this.incidents.set(incident.id, incident);
    this.logger.error(`Security incident created: ${incident.type} from ${incident.source}`);

    // Audit log
    const auditLogger = getAuditLogger();
    auditLogger.log({
      type: 'SECURITY_VIOLATION' as any,
      severity: 'CRITICAL' as any,
      actor: { type: 'system', id: 'threat-detector' },
      action: 'incident_created',
      status: 'success',
      metadata: { incident }
    });

    return incident;
  }

  private evaluateIncidentCreation(indicator: ThreatIndicator): void {
    // Check if there are multiple related indicators
    const recentIndicators = this.listIndicators({
      source: indicator.source,
      since: new Date(Date.now() - 300000) // Last 5 minutes
    });

    if (recentIndicators.length >= 3) {
      // Create incident if not already exists for this source
      const existingIncident = Array.from(this.incidents.values()).find(
        i => i.source === indicator.source && i.status === IncidentStatus.OPEN
      );

      if (!existingIncident) {
        this.createIncident({
          type: indicator.type,
          severity: indicator.severity,
          indicators: recentIndicators.map(i => i.id),
          source: indicator.source
        });
      }
    }
  }

  updateIncident(incidentId: string, updates: Partial<SecurityIncident>): SecurityIncident | undefined {
    const incident = this.incidents.get(incidentId);
    if (!incident) return undefined;

    const updated: SecurityIncident = {
      ...incident,
      ...updates,
      id: incident.id,
      detectedAt: incident.detectedAt
    };

    this.incidents.set(incidentId, updated);
    this.logger.info(`Incident updated: ${incidentId} - status: ${updated.status}`);

    return updated;
  }

  addIncidentNote(incidentId: string, note: string): boolean {
    const incident = this.incidents.get(incidentId);
    if (!incident) return false;

    incident.notes.push(`${new Date().toISOString()}: ${note}`);
    return true;
  }

  resolveIncident(incidentId: string, resolution: string): SecurityIncident | undefined {
    const incident = this.incidents.get(incidentId);
    if (!incident) return undefined;

    incident.status = IncidentStatus.RESOLVED;
    incident.resolvedAt = new Date();
    incident.notes.push(`RESOLVED: ${resolution}`);

    this.logger.info(`Incident resolved: ${incidentId}`);
    return incident;
  }

  listIncidents(filter?: {
    status?: IncidentStatus;
    type?: ThreatType;
    source?: string;
    severity?: ThreatSeverity;
  }): SecurityIncident[] {
    let results = Array.from(this.incidents.values());

    if (filter?.status) {
      results = results.filter(i => i.status === filter.status);
    }
    if (filter?.type) {
      results = results.filter(i => i.type === filter.type);
    }
    if (filter?.source) {
      results = results.filter(i => i.source === filter.source);
    }
    if (filter?.severity) {
      results = results.filter(i => i.severity === filter.severity);
    }

    return results.sort((a, b) => b.detectedAt.getTime() - a.detectedAt.getTime());
  }

  // ========================================
  // IP REPUTATION & BLOCKING
  // ========================================

  private updateIPReputation(ip: string, indicator: ThreatIndicator): void {
    let reputation = this.ipReputations.get(ip);

    if (!reputation) {
      reputation = {
        ip,
        score: 100,
        blocked: false,
        whitelisted: false,
        threatCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    }

    reputation.threatCount++;
    reputation.lastThreatAt = new Date();
    reputation.updatedAt = new Date();
    
    // Reduce score based on severity
    const scoreReduction = {
      [ThreatSeverity.LOW]: 5,
      [ThreatSeverity.MEDIUM]: 15,
      [ThreatSeverity.HIGH]: 30,
      [ThreatSeverity.CRITICAL]: 50
    };
    reputation.score = Math.max(0, reputation.score - scoreReduction[indicator.severity]);

    // Auto-block if score is too low
    if (reputation.score < 20 && !reputation.whitelisted) {
      reputation.blocked = true;
      this.logger.warn(`IP auto-blocked due to low reputation: ${ip}`);
    }

    this.ipReputations.set(ip, reputation);
  }

  blockIP(ip: string, reason: string): IPReputation {
    let reputation = this.ipReputations.get(ip);

    if (!reputation) {
      reputation = {
        ip,
        score: 0,
        blocked: true,
        whitelisted: false,
        threatCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } else {
      reputation.blocked = true;
      reputation.updatedAt = new Date();
    }

    this.ipReputations.set(ip, reputation);
    this.logger.warn(`IP manually blocked: ${ip} - ${reason}`);

    return reputation;
  }

  unblockIP(ip: string): boolean {
    const reputation = this.ipReputations.get(ip);
    if (!reputation) return false;

    reputation.blocked = false;
    reputation.updatedAt = new Date();
    this.logger.info(`IP unblocked: ${ip}`);

    return true;
  }

  whitelistIP(ip: string): boolean {
    let reputation = this.ipReputations.get(ip);

    if (!reputation) {
      reputation = {
        ip,
        score: 100,
        blocked: false,
        whitelisted: true,
        threatCount: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };
    } else {
      reputation.whitelisted = true;
      reputation.blocked = false;
      reputation.updatedAt = new Date();
    }

    this.ipReputations.set(ip, reputation);
    this.logger.info(`IP whitelisted: ${ip}`);

    return true;
  }

  getIPReputation(ip: string): IPReputation | undefined {
    return this.ipReputations.get(ip);
  }

  isIPBlocked(ip: string): boolean {
    const reputation = this.ipReputations.get(ip);
    return reputation?.blocked || false;
  }

  listBlockedIPs(): IPReputation[] {
    return Array.from(this.ipReputations.values()).filter(r => r.blocked);
  }

  // ========================================
  // ALERT MANAGEMENT
  // ========================================

  createAlert(params: {
    type: ThreatType;
    severity: ThreatSeverity;
    message: string;
    source: string;
  }): SecurityAlert {
    const alert: SecurityAlert = {
      id: `alert-${++this.alertIdCounter}`,
      type: params.type,
      severity: params.severity,
      message: params.message,
      source: params.source,
      timestamp: new Date(),
      acknowledged: false
    };

    this.alerts.set(alert.id, alert);
    this.logger.warn(`Security alert created: ${alert.message}`);

    return alert;
  }

  acknowledgeAlert(alertId: string, userId: string): boolean {
    const alert = this.alerts.get(alertId);
    if (!alert) return false;

    alert.acknowledged = true;
    alert.acknowledgedBy = userId;
    alert.acknowledgedAt = new Date();

    this.logger.info(`Alert acknowledged: ${alertId} by ${userId}`);
    return true;
  }

  listAlerts(filter?: {
    acknowledged?: boolean;
    type?: ThreatType;
    severity?: ThreatSeverity;
  }): SecurityAlert[] {
    let results = Array.from(this.alerts.values());

    if (filter?.acknowledged !== undefined) {
      results = results.filter(a => a.acknowledged === filter.acknowledged);
    }
    if (filter?.type) {
      results = results.filter(a => a.type === filter.type);
    }
    if (filter?.severity) {
      results = results.filter(a => a.severity === filter.severity);
    }

    return results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  // ========================================
  // ATTACK PATTERN MANAGEMENT
  // ========================================

  createPattern(params: Omit<AttackPattern, 'id'>): AttackPattern {
    const pattern: AttackPattern = {
      id: `pattern-${++this.patternIdCounter}`,
      ...params
    };

    this.patterns.set(pattern.id, pattern);
    this.logger.info(`Attack pattern created: ${pattern.name}`);

    return pattern;
  }

  listPatterns(): AttackPattern[] {
    return Array.from(this.patterns.values());
  }

  enablePattern(patternId: string): boolean {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return false;

    pattern.enabled = true;
    return true;
  }

  disablePattern(patternId: string): boolean {
    const pattern = this.patterns.get(patternId);
    if (!pattern) return false;

    pattern.enabled = false;
    return true;
  }

  // ========================================
  // STATISTICS
  // ========================================

  getStats(): {
    totalIndicators: number;
    totalIncidents: number;
    openIncidents: number;
    totalAlerts: number;
    unacknowledgedAlerts: number;
    blockedIPs: number;
    whitelistedIPs: number;
    indicatorsBySeverity: Record<ThreatSeverity, number>;
    incidentsByType: Record<ThreatType, number>;
  } {
    const indicatorsBySeverity: Record<ThreatSeverity, number> = {
      [ThreatSeverity.LOW]: 0,
      [ThreatSeverity.MEDIUM]: 0,
      [ThreatSeverity.HIGH]: 0,
      [ThreatSeverity.CRITICAL]: 0
    };

    for (const indicator of this.indicators.values()) {
      indicatorsBySeverity[indicator.severity]++;
    }

    const incidentsByType: Record<ThreatType, number> = {} as any;
    for (const incident of this.incidents.values()) {
      incidentsByType[incident.type] = (incidentsByType[incident.type] || 0) + 1;
    }

    return {
      totalIndicators: this.indicators.size,
      totalIncidents: this.incidents.size,
      openIncidents: this.listIncidents({ status: IncidentStatus.OPEN }).length,
      totalAlerts: this.alerts.size,
      unacknowledgedAlerts: this.listAlerts({ acknowledged: false }).length,
      blockedIPs: this.listBlockedIPs().length,
      whitelistedIPs: Array.from(this.ipReputations.values()).filter(r => r.whitelisted).length,
      indicatorsBySeverity,
      incidentsByType
    };
  }
}

// ============================================================================
// GLOBAL SINGLETON
// ============================================================================

let threatDetector: ThreatDetector | undefined;

export function initializeThreatDetector(): ThreatDetector {
  if (threatDetector) {
    return threatDetector;
  }

  threatDetector = new ThreatDetector();
  
  const logger = LoggerFactory.getInstance().getLogger();
  logger.info('Threat detector initialized');

  return threatDetector;
}

export function getThreatDetector(): ThreatDetector {
  if (!threatDetector) {
    return initializeThreatDetector();
  }
  return threatDetector;
}
