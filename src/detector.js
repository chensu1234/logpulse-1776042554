/**
 * Anomaly Detector
 * 
 * Analyzes log lines to detect anomalies based on:
 * - Pattern matching (unusual error combinations)
 * - Frequency analysis (burst detection)
 * - Entropy detection (random/injection attempts)
 * - Rate of change (sudden spikes)
 */

'use strict';

const EventEmitter = require('events');

class Detector extends EventEmitter {
  /**
   * Create a new anomaly detector
   * @param {Object} options - Configuration options
   * @param {number} options.threshold - Score threshold for anomaly (0-100)
   * @param {Object} options.patterns - Log level patterns
   * @param {boolean} options.parseJson - Parse JSON logs
   */
  constructor(options = {}) {
    super();
    
    this.threshold = options.threshold || 70;
    this.patterns = options.patterns || {};
    this.parseJson = options.parseJson || false;
    
    // Detection state
    this.history = [];           // Recent lines for context
    this.historySize = 100;       // Keep last N lines
    this.errorBurst = 0;          // Consecutive error count
    this.errorBurstThreshold = 5; // Errors in a row = anomaly
    
    // Frequency tracking (sliding window)
    this.frequencyWindow = [];
    this.frequencyWindowSize = 60; // Track last 60 seconds
    this.lastTimestamp = Date.now();
    
    // Anomaly patterns (high score triggers)
    this.anomalyPatterns = [
      // SQL/NoSQL injection attempts
      { pattern: /(\b(union|select|insert|update|delete|drop)\b.*\b(from|into|where|table)\b)|(\b(or|and)\b\s+\d+\s*[=<>])/i, reason: 'Potential SQL injection', score: 90 },
      // Path traversal attempts
      { pattern: /(\.\.\/|\.\.\\|%2e%2e%2f|%2e%2e\/|\.\.%2f|\.\.%5c)/i, reason: 'Potential path traversal', score: 85 },
      // XSS attempts
      { pattern: /(<script|javascript:|onerror\s*=|onload\s*=|<iframe|<svg)/i, reason: 'Potential XSS attempt', score: 80 },
      // Command injection
      { pattern: /(\|\s*\w+|;\s*\w+|`[^`]+`|\$\([^)]+\))/i, reason: 'Potential command injection', score: 90 },
      // Memory/resource exhaustion
      { pattern: /(out of memory|memory leak|heap limit|allocation failed|fatal error|panic)/i, reason: 'Resource exhaustion detected', score: 95 },
      // Authentication failures
      { pattern: /(authentication failed|invalid token|unauthorized|access denied|permission denied|403|401)/i, reason: 'Auth failure pattern', score: 60 },
      // Connection issues
      { pattern: /(connection refused|connection timeout|connection reset|etimedout|econnrefused)/i, reason: 'Connection problem', score: 65 },
      // Unusual HTTP methods or paths
      { pattern: /\b(options|trace|connect)\s+/i, reason: 'Unusual HTTP method', score: 50 },
      // Large response times
      { pattern: /response time[:\s]+\d{5,}/i, reason: 'Extremely slow response', score: 70 },
      // Stack traces (usually important)
      { pattern: /(exception|stack trace|at\s+\w+\.\w+\(|traceback|panic:)/i, reason: 'Stack trace detected', score: 40 }
    ];
    
    // Warning patterns (medium score)
    this.warningPatterns = [
      { pattern: /\bdeprecated\b/i, reason: 'Deprecated feature usage', score: 30 },
      { pattern: /\bretry(ing)?\b/i, reason: 'Retries detected', score: 35 },
      { pattern: /\btimeout\b/i, reason: 'Timeout occurred', score: 40 },
      { pattern: /\bcache\s+(miss|expired)\b/i, reason: 'Cache problem', score: 30 }
    ];
  }
  
  /**
   * Analyze a log line for anomalies
   * @param {string} line - Log line to analyze
   * @param {number} lineNumber - Line number
   * @returns {Object} Analysis result with isAnomaly, score, and reason
   */
  analyze(line, lineNumber) {
    const result = {
      isAnomaly: false,
      score: 0,
      reason: null,
      lineNumber
    };
    
    // Add to history
    this.history.push({ line, lineNumber, timestamp: Date.now() });
    if (this.history.length > this.historySize) {
      this.history.shift();
    }
    
    // Parse JSON if enabled
    let parsedLine = line;
    if (this.parseJson) {
      try {
        parsedLine = JSON.parse(line);
        parsedLine = typeof parsedLine === 'object' ? JSON.stringify(parsedLine) : String(parsedLine);
      } catch (_) {}
    }
    
    // Check anomaly patterns
    for (const { pattern, reason, score } of this.anomalyPatterns) {
      if (pattern.test(parsedLine)) {
        result.score = Math.max(result.score, score);
        result.reason = reason;
      }
    }
    
    // Check warning patterns
    for (const { pattern, reason, score } of this.warningPatterns) {
      if (pattern.test(parsedLine)) {
        if (score > result.score) {
          result.score = Math.max(result.score, score);
          result.reason = reason;
        }
      }
    }
    
    // Burst detection for errors
    if (this.patterns.error?.test(parsedLine)) {
      this.errorBurst++;
      if (this.errorBurst >= this.errorBurstThreshold) {
        result.score = Math.max(result.score, 75);
        result.reason = `Error burst detected (${this.errorBurst} consecutive errors)`;
      }
    } else {
      this.errorBurst = Math.max(0, this.errorBurst - 2); // Decay
    }
    
    // Entropy check for random-looking strings (potential injection)
    const entropy = this.calculateEntropy(line);
    if (entropy > 4.5 && line.length > 50) {
      result.score = Math.max(result.score, 55);
      result.reason = result.reason || 'High entropy content (possible encoded data)';
    }
    
    // Determine if it's an anomaly
    result.isAnomaly = result.score >= this.threshold;
    
    // Update frequency tracking
    this.updateFrequency();
    
    // Emit event if anomaly
    if (result.isAnomaly) {
      this.emit('anomaly', result);
    }
    
    return result;
  }
  
  /**
   * Calculate Shannon entropy of a string
   * @param {string} str - String to analyze
   * @returns {number} Entropy value (0-8 for typical text)
   */
  calculateEntropy(str) {
    const frequencies = {};
    for (const char of str) {
      frequencies[char] = (frequencies[char] || 0) + 1;
    }
    
    const len = str.length;
    let entropy = 0;
    
    for (const char in frequencies) {
      const p = frequencies[char] / len;
      if (p > 0) {
        entropy -= p * Math.log2(p);
      }
    }
    
    return entropy;
  }
  
  /**
   * Update frequency tracking for rate analysis
   */
  updateFrequency() {
    const now = Date.now();
    const second = Math.floor(now / 1000);
    
    // Count lines in this second
    const entry = this.frequencyWindow.find(e => e.second === second);
    if (entry) {
      entry.count++;
    } else {
      this.frequencyWindow.push({ second, count: 1 });
    }
    
    // Clean old entries
    const cutoff = second - this.frequencyWindowSize;
    this.frequencyWindow = this.frequencyWindow.filter(e => e.second > cutoff);
    
    this.lastTimestamp = now;
  }
  
  /**
   * Get current log rate (lines per second)
   * @returns {number}
   */
  getLogRate() {
    if (this.frequencyWindow.length === 0) return 0;
    
    const total = this.frequencyWindow.reduce((sum, e) => sum + e.count, 0);
    return total / this.frequencyWindow.length;
  }
  
  /**
   * Get current error rate
   * @returns {number}
   */
  getErrorRate() {
    const recent = this.history.slice(-20);
    const errors = recent.filter(h => this.patterns.error?.test(h.line));
    return errors.length / Math.max(recent.length, 1);
  }
  
  /**
   * Reset detector state
   */
  reset() {
    this.history = [];
    this.errorBurst = 0;
    this.frequencyWindow = [];
  }
}

module.exports = Detector;
