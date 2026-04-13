/**
 * Log File Monitor
 * 
 * Watches a log file for new content and emits lines as they appear.
 * Uses polling-based monitoring for cross-platform compatibility.
 */

'use strict';

const fs = require('fs');
const EventEmitter = require('events');

class Monitor extends EventEmitter {
  /**
   * Create a new file monitor
   * @param {Object} options - Configuration options
   * @param {string} options.file - File path to monitor
   * @param {number} options.interval - Polling interval in ms
   * @param {boolean} options.debug - Enable debug logging
   */
  constructor(options = {}) {
    super();
    
    this.file = options.file;
    this.interval = options.interval || 1000;
    this.debug = options.debug || false;
    
    // Internal state
    this.position = 0;        // Current read position in file
    this.lineCount = 0;       // Total lines read
    this.intervalId = null;   // Polling interval ID
    this.isWatching = false;
    
    // Cache the last file size to detect truncation
    this.lastSize = 0;
  }
  
  /**
   * Start monitoring the file
   */
  start() {
    if (this.isWatching) {
      this.debugLog('Already watching file');
      return;
    }
    
    // Get initial file size
    try {
      const stats = fs.statSync(this.file);
      this.position = stats.size;
      this.lastSize = stats.size;
      this.debugLog(`Started at position ${this.position} (file size: ${stats.size})`);
    } catch (err) {
      this.emit('error', new Error(`Cannot access file: ${err.message}`));
      return;
    }
    
    this.isWatching = true;
    
    // Start polling
    this.intervalId = setInterval(() => this.poll(), this.interval);
    
    // Emit initial read
    this.poll();
  }
  
  /**
   * Stop monitoring
   */
  stop() {
    if (!this.isWatching) return;
    
    this.isWatching = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    
    this.debugLog('Stopped monitoring');
  }
  
  /**
   * Poll the file for new content
   */
  poll() {
    try {
      const stats = fs.statSync(this.file);
      
      // Check for file truncation (log rotation)
      if (stats.size < this.lastSize) {
        this.debugLog('File was truncated (log rotation detected), resetting position');
        this.position = 0;
      }
      this.lastSize = stats.size;
      
      // No new content
      if (stats.size <= this.position) {
        return;
      }
      
      // Read new content
      const fd = fs.openSync(this.file, 'r');
      const buffer = Buffer.alloc(stats.size - this.position);
      fs.readSync(fd, buffer, 0, buffer.length, this.position);
      fs.closeSync(fd);
      
      // Update position
      this.position = stats.size;
      
      // Parse and emit lines
      const content = buffer.toString('utf8');
      const lines = content.split('\n');
      
      // Don't emit empty string from trailing newline
      if (lines[lines.length - 1] === '') {
        lines.pop();
      }
      
      lines.forEach(line => {
        if (line.trim()) {
          this.lineCount++;
          this.emit('line', line, this.lineCount);
        }
      });
      
    } catch (err) {
      this.emit('error', err);
    }
  }
  
  /**
   * Debug logging helper
   * @param {string} msg - Message to log
   */
  debugLog(msg) {
    if (this.debug) {
      console.error(`[Monitor DEBUG] ${msg}`);
    }
  }
  
  /**
   * Get current line count
   * @returns {number}
   */
  getLineCount() {
    return this.lineCount;
  }
  
  /**
   * Get current read position
   * @returns {number}
   */
  getPosition() {
    return this.position;
  }
}

module.exports = Monitor;
