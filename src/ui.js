/**
 * Terminal UI Renderer
 * 
 * Handles all terminal output with colors, formatting,
 * and a clean dashboard-like interface.
 */

'use strict';

// ANSI color codes for cross-platform compatibility
const c = {
  red: (s) => `\x1b[31m${s}\x1b[0m`,
  yellow: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  cyan: (s) => `\x1b[36m${s}\x1b[0m`,
  gray: (s) => `\x1b[90m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  magenta: (s) => `\x1b[35m${s}\x1b[0m`,
  bgRed: (s) => `\x1b[41m${s}\x1b[0m`,
  bgYellow: (s) => `\x1b[43m${s}\x1b[0m`,
  reset: () => `\x1b[0m`
};

class UI {
  /**
   * Create a new UI renderer
   * @param {Object} options - Configuration options
   * @param {boolean} options.color - Enable colors
   * @param {boolean} options.debug - Enable debug output
   * @param {boolean} options.statsMode - Show stats dashboard
   */
  constructor(options = {}) {
    this.color = options.color !== false;
    this.debug = options.debug || false;
    this.statsMode = options.statsMode || false;
    
    // Terminal dimensions
    this.width = process.stdout.columns || 80;
    this.height = process.stdout.rows || 24;
    
    // State
    this.lineCount = 0;
    this.lastStatsUpdate = 0;
    this.updateInterval = 1000; // Update stats every second
    
    // Statistics
    this.stats = null;
  }
  
  /**
   * Start the UI
   * @param {Object} stats - Initial statistics
   * @param {boolean} statsMode - Stats dashboard mode
   */
  start(stats, statsMode) {
    this.stats = stats;
    
    if (!statsMode) {
      this.printHeader('LogPulse Monitor');
    }
  }
  
  /**
   * Stop the UI
   */
  stop() {
    // Nothing to clean up for now
  }
  
  /**
   * Update displayed statistics
   * @param {Object} stats - Statistics object
   */
  updateStats(stats) {
    this.stats = stats;
    
    const now = Date.now();
    if (now - this.lastStatsUpdate < this.updateInterval) {
      return;
    }
    this.lastStatsUpdate = now;
    
    // Move cursor to top and redraw stats
    process.stdout.write('\x1b[H');
    process.stdout.write(this.renderStatsDashboard(stats));
  }
  
  /**
   * Render the stats dashboard
   * @param {Object} stats - Statistics
   * @returns {string}
   */
  renderStatsDashboard(stats) {
    const duration = stats.lastUpdate 
      ? Math.floor((stats.lastUpdate - stats.startTime) / 1000)
      : 0;
    const mins = Math.floor(duration / 60);
    const secs = duration % 60;
    
    const errorRate = stats.totalLines > 0 
      ? ((stats.errorCount / stats.totalLines) * 100).toFixed(1)
      : '0.0';
    
    const anomalyRate = stats.totalLines > 0
      ? ((stats.anomalyCount / stats.totalLines) * 100).toFixed(1)
      : '0.0';
    
    const linesPerSec = duration > 0 
      ? (stats.totalLines / duration).toFixed(1)
      : '0.0';
    
    let output = '';
    output += c.cyan('╔' + '═'.repeat(60) + '╗') + '\n';
    output += c.cyan('║') + c.bold('                    LogPulse Statistics                      ') + c.cyan('║') + '\n';
    output += c.cyan('╠' + '═'.repeat(60) + '╣') + '\n';
    
    const row = (label, value, color = c.green) => {
      const padded = label.padEnd(30);
      const colored = color(value.toString().padStart(30));
      return c.cyan('║') + `  ${padded}` + colored + c.cyan('  ║') + '\n';
    };
    
    output += row('Total Lines', stats.totalLines.toLocaleString());
    output += row('Errors', stats.errorCount.toLocaleString(), stats.errorCount > 0 ? c.red : c.green);
    output += row('Warnings', stats.warningCount.toLocaleString(), stats.warningCount > 0 ? c.yellow : c.green);
    output += row('Info Messages', stats.infoCount.toLocaleString());
    output += row('Anomalies Detected', stats.anomalyCount.toLocaleString(), stats.anomalyCount > 0 ? c.magenta : c.green);
    output += c.cyan('╠' + '═'.repeat(60) + '╣') + '\n';
    output += row('Duration', `${mins}m ${secs}s`);
    output += row('Lines/Second', linesPerSec);
    output += row('Error Rate', `${errorRate}%`, parseFloat(errorRate) > 5 ? c.red : c.green);
    output += row('Anomaly Rate', `${anomalyRate}%`, parseFloat(anomalyRate) > 5 ? c.magenta : c.green);
    output += c.cyan('╚' + '═'.repeat(60) + '╝') + '\n';
    
    output += c.dim(`\n  Press Ctrl+C to stop... (${new Date().toLocaleTimeString()})`);
    output += '\x1b[0K'; // Clear to end of line
    
    return output;
  }
  
  /**
   * Print a header message
   * @param {string} title - Header title
   */
  printHeader(title) {
    console.log('');
    console.log(c.cyan('━'.repeat(60)));
    console.log(c.cyan('  ') + c.bold(title));
    console.log(c.cyan('━'.repeat(60)));
    console.log('');
  }
  
  /**
   * Print a separator line
   */
  printSeparator() {
    console.log(c.cyan('─'.repeat(60)));
  }
  
  /**
   * Print a log line with appropriate formatting
   * @param {string} line - Log line
   * @param {string} level - Log level (error, warning, info, debug, unknown)
   * @param {boolean} isAnomaly - Whether this is an anomaly
   * @param {number} anomalyScore - Anomaly score if applicable
   */
  printLine(line, level, isAnomaly, anomalyScore) {
    this.lineCount++;
    
    // Truncate long lines
    const maxLength = this.width - 15;
    const displayLine = line.length > maxLength 
      ? line.substring(0, maxLength - 3) + '...' 
      : line;
    
    // Format timestamp
    const timestamp = new Date().toLocaleTimeString();
    const ts = c.dim(`[${timestamp}]`);
    
    // Level indicator
    let levelIndicator;
    switch (level) {
      case 'error':
        levelIndicator = c.red('✗');
        break;
      case 'warning':
        levelIndicator = c.yellow('!');
        break;
      case 'info':
        levelIndicator = c.green('•');
        break;
      case 'debug':
        levelIndicator = c.dim('◦');
        break;
      default:
        levelIndicator = c.gray('·');
    }
    
    // Anomaly indicator
    const anomalyFlag = isAnomaly 
      ? c.bgRed(` ${anomalyScore} `) + ' '
      : '  ';
    
    // Build output line
    const output = `${ts} ${levelIndicator}${anomalyFlag}${displayLine}`;
    
    console.log(output);
    
    // Print to stderr if anomaly for logging purposes
    if (isAnomaly && this.debug) {
      console.error(c.magenta(`[ANOMALY #${this.lineCount}] Score: ${anomalyScore}`));
    }
  }
  
  /**
   * Print a formatted message
   * @param {string} type - Message type (info, warn, error, success)
   * @param {string} message - Message to print
   */
  printMessage(type, message) {
    const timestamp = new Date().toLocaleTimeString();
    const ts = c.dim(`[${timestamp}]`);
    
    switch (type) {
      case 'info':
        console.log(`${ts} ${c.cyan('ℹ')} ${message}`);
        break;
      case 'warn':
        console.log(`${ts} ${c.yellow('⚠')} ${message}`);
        break;
      case 'error':
        console.error(`${ts} ${c.red('✗')} ${message}`);
        break;
      case 'success':
        console.log(`${ts} ${c.green('✓')} ${message}`);
        break;
      default:
        console.log(`${ts} ${message}`);
    }
  }
  
  /**
   * Clear the terminal screen
   */
  clear() {
    process.stdout.write('\x1b[2J\x1b[H');
  }
  
  /**
   * Move cursor to top-left
   */
  moveCursorHome() {
    process.stdout.write('\x1b[H');
  }
  
  /**
   * Get the number of lines printed
   * @returns {number}
   */
  getLineCount() {
    return this.lineCount;
  }
}

module.exports = UI;
