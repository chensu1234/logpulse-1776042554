/**
 * LogPulse Detector Tests
 * 
 * Unit tests for the anomaly detection engine.
 */

'use strict';

const { test, describe } = require('node:test');
const assert = require('node:assert');
const Detector = require('../src/detector.js');

describe('Detector', () => {
  
  test('should detect SQL injection patterns', () => {
    const detector = new Detector({ threshold: 70 });
    
    const result = detector.analyze("SELECT * FROM users WHERE id=1 OR 1=1", 1);
    
    assert.strictEqual(result.isAnomaly, true);
    assert.strictEqual(result.score, 90);
    assert.ok(result.reason.includes('SQL injection'));
  });
  
  test('should detect path traversal', () => {
    const detector = new Detector({ threshold: 70 });
    
    const result = detector.analyze("GET /../../etc/passwd HTTP/1.1", 1);
    
    assert.strictEqual(result.isAnomaly, true);
    assert.strictEqual(result.score, 85);
    assert.ok(result.reason.includes('path traversal'));
  });
  
  test('should detect XSS attempts', () => {
    const detector = new Detector({ threshold: 70 });
    
    const result = detector.analyze('<script>alert("xss")</script>', 1);
    
    assert.strictEqual(result.isAnomaly, true);
    assert.strictEqual(result.score, 80);
  });
  
  test('should detect command injection', () => {
    const detector = new Detector({ threshold: 70 });
    
    const result = detector.analyze('cat /etc/passwd | grep root', 1);
    
    assert.strictEqual(result.isAnomaly, true);
    assert.strictEqual(result.score, 90);
  });
  
  test('should detect memory exhaustion', () => {
    const detector = new Detector({ threshold: 70 });
    
    const result = detector.analyze('FATAL: out of memory error', 1);
    
    assert.strictEqual(result.isAnomaly, true);
    assert.strictEqual(result.score, 95);
  });
  
  test('should classify error log level', () => {
    const detector = new Detector({ threshold: 70 });
    
    // Use a line with "error" as a standalone word (boundary matched)
    const result = detector.analyze('2026-04-13 [error] Connection refused', 1);
    
    assert.ok(result.score >= 60);
  });
  
  test('should not flag normal logs as anomalies', () => {
    const detector = new Detector({ threshold: 70 });
    
    const result = detector.analyze('2026-04-13 INFO: Request processed successfully', 1);
    
    assert.strictEqual(result.isAnomaly, false);
  });
  
  test('should handle burst detection', () => {
    const detector = new Detector({ 
      threshold: 70,
      patterns: { error: /error/i }
    });
    
    // Send 5 consecutive errors
    for (let i = 0; i < 5; i++) {
      detector.analyze('2026-04-13 error: Database timeout', i);
    }
    
    // The 5th error should trigger burst detection
    const result = detector.analyze('2026-04-13 error: Another error', 6);
    assert.ok(result.score >= 75);
    assert.ok(result.reason.includes('burst'));
  });
  
  test('should calculate entropy correctly', () => {
    const detector = new Detector({ threshold: 70 });
    
    // Low entropy string (repetitive)
    const lowEntropy = 'aaaaaaaaaa';
    const lowResult = detector.calculateEntropy(lowEntropy);
    assert.ok(lowResult < 2);
    
    // High entropy string (random)
    const highEntropy = 'x7k9#@mP2$vL';
    const highResult = detector.calculateEntropy(highEntropy);
    assert.ok(highResult > 3);
  });
  
  test('should detect high entropy content', () => {
    const detector = new Detector({ threshold: 50 }); // Lower threshold for this test
    
    // A string that is definitely high entropy and > 50 chars
    const encoded = 'Xj7k9#@mP2$vLqR8n3B5cT1yH6gU0abcdefghijklmnop1234567890!@#$%^&*()';
    
    const result = detector.analyze(encoded, 1);
    // High entropy (>4.5) and length > 50 triggers anomaly
    assert.strictEqual(result.isAnomaly, true);
    assert.ok(result.reason.includes('entropy'));
  });
  
  test('should reset state correctly', () => {
    const detector = new Detector({ threshold: 70 });
    
    detector.analyze('error: something failed', 1);
    assert.strictEqual(detector.history.length, 1);
    
    detector.reset();
    assert.strictEqual(detector.history.length, 0);
  });
  
  test('should get log rate', () => {
    const detector = new Detector({ threshold: 70 });
    
    // Add some entries
    detector.analyze('Line 1', 1);
    detector.analyze('Line 2', 2);
    detector.analyze('Line 3', 3);
    
    const rate = detector.getLogRate();
    assert.ok(rate >= 0);
  });
  
  test('should parse JSON logs when enabled', () => {
    const detector = new Detector({ 
      threshold: 70,
      parseJson: true,
      patterns: { error: /error/i }
    });
    
    // JSON log with error text in message
    const jsonLine = '{"level":"info","message":"Database connection error occurred","timestamp":1712995200}';
    const result = detector.analyze(jsonLine, 1);
    
    // The word "error" appears in the message field
    assert.ok(result.score >= 40);
  });
  
  test('should respect threshold setting', () => {
    const lowThreshold = new Detector({ threshold: 10 });
    const highThreshold = new Detector({ threshold: 95 });
    
    const warningLine = 'WARNING: deprecated API call';
    
    const lowResult = lowThreshold.analyze(warningLine, 1);
    const highResult = highThreshold.analyze(warningLine, 1);
    
    assert.strictEqual(lowResult.isAnomaly, true);
    assert.strictEqual(highResult.isAnomaly, false);
  });
});
