/**
 * LogPulse - Real-time Log Monitoring & Anomaly Detection
 * 
 * A powerful CLI tool for monitoring log files in real-time,
 * detecting anomalies, and providing beautiful terminal output.
 */

'use strict';

const fs = require('fs');
const path = require('path');
const EventEmitter = require('events');
const Monitor = require('./monitor.js');
const Detector = require('./detector.js');
const UI = require('./ui.js');

class LogPulse extends EventEmitter {
  /**
   * Create a new LogPulse instance
   * @param {Object} options - Configuration options
   * @param {string} options.logFile - Path to the log file to monitor
   * @param {Object} options.config - Configuration object
   * @param {number} options.interval - Check interval in ms
   * @param {number} options.threshold - Anomaly detection threshold (0-100)
   * @param {number} options.showLines - Number of recent lines to show
   * @param {boolean} options.parseJson - Parse JSON logs
   * @param {boolean} options.color - Enable colored output
   * @param {boolean} options.debug - Enable debug mode
   * @param {boolean} options.statsMode - Show stats only, no live tail
   */
  constructor(options = {}) {
    super();
    
    this.options = {
      logFile: options.logFile,
      config: options.config || {},
      interval: options.interval || 1000,
      threshold: options.threshold || 70,
      showLines: options.showLines || 50,
      parseJson: options.parseJson || false,
      color: options.color !== false,
      debug: options.debug || false,
      statsMode: options.statsMode || false
    };
    
    // Internal state
    this.monitor = null;
    this.detector = null;
    this.ui = null;
    this.isRunning = false;
    this.stats = {
      totalLines: 0,
      errorCount: 0,
      warningCount: 0,
      infoCount: 0,
      anomalyCount: 0,
      startTime: null,
      lastUpdate: null
    };
    
    // Log level patterns for detection
    this.levelPatterns = {
      error: /\b(error|err|fatal|critical|crit)\b/i,
      warning: /\b(warn|warning)\b/i,
      info: /\b(info|notice)\b/i,
      debug: /\b(debug|trace)\b/i
    };
  }
  
  /**
   * Start the log monitoring
   */
  start() {
    if (this.isRunning) {
      this.log('⚠️  LogPulse is already running');
      return;
    }
    
    this.log('🚀 Starting LogPulse...');
    this.log(`📄 Monitoring: ${this.options.logFile}`);
    
    // Initialize components
    this.monitor = new Monitor({
      file: this.options.logFile,
      interval: this.options.interval,
      debug: this.options.debug
    });
    
    this.detector = new Detector({
      threshold: this.options.threshold,
      patterns: this.levelPatterns,
      parseJson: this.options.parseJson
    });
    
    this.ui = new UI({
      color: this.options.color,
      debug: this.options.debug,
      statsMode: this.options.statsMode
    });
    
    // Wire up event handlers
    this.monitor.on('line', (line, lineNumber) => this.handleLine(line, lineNumber));
    this.monitor.on('error', (err) => this.handleError(err));
    this.detector.on('anomaly', (anomaly) => this.handleAnomaly(anomaly));
    
    // Start monitoring
    this.stats.startTime = Date.now();
    this.isRunning = true;
    this.monitor.start();
    
    // Show initial lines if not in stats mode
    if (!this.options.statsMode) {
      this.showInitialLines();
    }
    
    // Start UI
    this.ui.start(this.stats, this.options.statsMode);
    
    this.log('✅ LogPulse is running. Press Ctrl+C to stop.');
  }
  
  /**
   * Stop the log monitoring
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    
    if (this.monitor) {
      this.monitor.stop();
    }
    
    if (this.ui) {
      this.ui.stop();
    }
    
    this.stats.lastUpdate = Date.now();
    this.log('\n📊 Final Statistics:');
    this.log(this.formatStats());
  }
  
  /**
   * Handle a new log line
   * @param {string} line - The log line
   * @param {number} lineNumber - Line number in file
   */
  handleLine(line, lineNumber) {
    this.stats.totalLines++;
    this.stats.lastUpdate = Date.now();
    
    // Classify log level
    const level = this.classifyLevel(line);
    if (level === 'error') this.stats.errorCount++;
    else if (level === 'warning') this.stats.warningCount++;
    else if (level === 'info') this.stats.infoCount++;
    
    // Detect anomalies
    const anomaly = this.detector.analyze(line, lineNumber);
    if (anomaly.isAnomaly) {
      this.stats.anomalyCount++;
      this.emit('anomaly', anomaly);
    }
    
    // Update UI (if not in stats mode, print the line)
    if (!this.options.statsMode) {
      this.ui.printLine(line, level, anomaly.isAnomaly, anomaly.score);
    } else {
      // In stats mode, just update the display periodically
      this.ui.updateStats(this.stats);
    }
  }
  
  /**
   * Classify the log level of a line
   * @param {string} line - Log line
   * @returns {string} Level: 'error', 'warning', 'info', 'debug', or 'unknown'
   */
  classifyLevel(line) {
    // Try JSON parsing first
    if (this.options.parseJson) {
      try {
        const parsed = JSON.parse(line);
        if (parsed.level) return parsed.level.toLowerCase();
        if (parsed.severity) return parsed.severity.toLowerCase();
      } catch (_) {}
    }
    
    // Pattern matching
    if (this.levelPatterns.error.test(line)) return 'error';
    if (this.levelPatterns.warning.test(line)) return 'warning';
    if (this.levelPatterns.info.test(line)) return 'info';
    if (this.levelPatterns.debug.test(line)) return 'debug';
    
    return 'unknown';
  }
  
  /**
   * Handle detected anomalies
   * @param {Object} anomaly - Anomaly data
   */
  handleAnomaly(anomaly) {
    if (this.options.debug) {
      this.log(`🚨 Anomaly detected (score: ${anomaly.score}): ${anomaly.reason}`);
    }
  }
  
  /**
   * Handle monitor errors
   * @param {Error} err - Error object
   */
  handleError(err) {
    this.log(`❌ Monitor error: ${err.message}`);
  }
  
  /**
   * Show initial lines from the log file
   */
  showInitialLines() {
    try {
      const content = fs.readFileSync(this.options.logFile, 'utf8');
      const lines = content.split('\n').filter(l => l.trim());
      const recentLines = lines.slice(-this.options.showLines);
      
      this.ui.printHeader(`Last ${recentLines.length} lines from log file`);
      
      recentLines.forEach((line, idx) => {
        const level = this.classifyLevel(line);
        this.ui.printLine(line, level, false, 0);
      });
      
      this.ui.printSeparator();
    } catch (err) {
      this.log(`⚠️  Could not read initial lines: ${err.message}`);
    }
  }
  
  /**
   * Format statistics for display
   * @returns {string}
   */
  formatStats() {
    const duration = this.stats.lastUpdate - this.stats.startTime;
    const mins = Math.floor(duration / 60000);
    const secs = Math.floor((duration % 60000) / 1000);
    
    return `
  Total Lines:    ${this.stats.totalLines.toLocaleString()}
  Errors:         ${this.stats.errorCount.toLocaleString()}
  Warnings:       ${this.stats.warningCount.toLocaleString()}
  Info:           ${this.stats.infoCount.toLocaleString()}
  Anomalies:      ${this.stats.anomalyCount.toLocaleString()}
  Duration:       ${mins}m ${secs}s
    `.trim();
  }
  
  /**
   * Internal logging
   * @param {string} msg - Message to log
   */
  log(msg) {
    if (this.options.debug) {
      console.log(`[LogPulse] ${msg}`);
    }
  }
  
  /**
   * Get current statistics
   * @returns {Object} Statistics object
   */
  getStats() {
    return { ...this.stats };
  }
}

module.exports = LogPulse;
