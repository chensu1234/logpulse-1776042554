# 🔍 LogPulse

> Real-time log monitoring and anomaly detection for the modern terminal

[![npm version](https://img.shields.io/npm/v/logpulse.svg)](https://npmjs.org/package/logpulse)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![GitHub Stars](https://img.shields.io/github/stars/chensu1234/logpulse-1776042554)](https://github.com/chensu1234/logpulse-1776042554)

LogPulse is a powerful CLI tool for monitoring log files in real-time. It combines beautiful terminal output with intelligent anomaly detection to help developers, DevOps engineers, and SREs identify issues before they become problems.

![LogPulse Demo](docs/demo.gif)

---

## ✨ Features

- **📊 Real-time Monitoring** — Watch log files as they're written with sub-second updates
- **🚨 Anomaly Detection** — Automatically detect suspicious patterns, injection attempts, and unusual activity
- **🎨 Beautiful Terminal UI** — Color-coded output with timestamps, log levels, and anomaly flags
- **📈 Live Statistics** — See line counts, error rates, and anomaly counts update in real-time
- **🔒 Security Pattern Matching** — Built-in detection for SQL injection, XSS, path traversal, and more
- **⚡ Burst Detection** — Identify sudden spikes in errors or warnings
- **📁 Log Rotation Support** — Automatically handles log file rotation/truncation
- **⚙️ Configurable** — YAML-based configuration for thresholds, patterns, and behavior
- **🎯 Zero Dependencies** — Runs on vanilla Node.js, no native modules required

---

## 🏃 Quick Start

### Installation

```bash
# Install globally via npm
npm install -g logpulse

# Or use without installing (npx)
npx logpulse --file /var/log/app.log
```

### Basic Usage

```bash
# Monitor a log file (default settings)
logpulse -f /var/log/app.log

# Monitor with custom interval and threshold
logpulse -f /var/log/app.log -i 500 -t 80

# Show statistics dashboard only (no live tail)
logpulse -f /var/log/app.log --stats

# Parse JSON-formatted logs
logpulse -f /var/log/app.log --json

# Disable colors for piping to files
logpulse -f /var/log/app.log --no-color
```

### Generate Sample Log for Testing

```bash
# Create a sample log file to test with
for i in {1..100}; do
  echo "[$(date '+%Y-%m-%d %H:%M:%S')] INFO Processing request #$i" >> app.log
  if [ $((RANDOM % 20)) -eq 0 ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] ERROR Database timeout on query #$i" >> app.log
  fi
done

# Watch it
logpulse -f app.log
```

---

## ⚙️ Configuration

### Configuration File

LogPulse reads configuration from `config/default.yaml` in the current directory, or you can specify a custom config:

```bash
logpulse -f app.log -c /path/to/config.yaml
```

### Configuration Options

| Section | Key | Default | Description |
|---------|-----|---------|-------------|
| `monitor.interval` | Poll interval | `1000` | How often to check for new content (ms) |
| `monitor.showInitialLines` | Initial lines | `50` | Number of recent lines to show on start |
| `detection.threshold` | Anomaly threshold | `70` | Score threshold for anomaly (0-100) |
| `detection.errorBurstThreshold` | Burst threshold | `5` | Consecutive errors before burst alert |
| `ui.color` | Colors enabled | `true` | Enable/disable colored output |
| `security.enabled` | Security patterns | `true` | Enable security pattern detection |

---

## 📋 Command Line Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--file <path>` | `-f` | Log file to monitor | _(required)_ |
| `--config <path>` | `-c` | Configuration file path | `config/default.yaml` |
| `--interval <ms>` | `-i` | Check interval in milliseconds | `1000` |
| `--threshold <n>` | `-t` | Anomaly threshold (0-100) | `70` |
| `--stats` | `-s` | Show statistics only | `false` |
| `--lines <n>` | `-n` | Number of initial lines to show | `50` |
| `--json` | — | Parse JSON-formatted logs | `false` |
| `--no-color` | — | Disable colored output | `false` |
| `--debug` | — | Enable debug mode | `false` |
| `--version` | `-v` | Show version number | — |
| `--help` | `-h` | Show help information | — |

---

## 📁 Project Structure

```
logpulse/
├── bin/
│   └── logpulse              # CLI entry point (shebang script)
├── config/
│   └── default.yaml          # Default configuration
├── log/
│   └── .gitkeep              # Directory for log output
├── src/
│   ├── index.js              # Main LogPulse class
│   ├── monitor.js            # File system monitor
│   ├── detector.js           # Anomaly detection engine
│   └── ui.js                 # Terminal UI renderer
├── tests/
│   └── detector.test.js      # Unit tests
├── docs/
│   └── demo.gif              # Demo animation
├── package.json              # Project manifest
├── README.md                 # This file
├── LICENSE                   # MIT License
├── CHANGELOG.md              # Version history
└── .gitignore                # Git ignore rules
```

---

## 🚨 Anomaly Detection

LogPulse automatically detects the following types of anomalies:

### Security Issues
| Pattern | Score | Description |
|---------|-------|-------------|
| SQL Injection | 90 | Union/select/insert with SQL keywords |
| Command Injection | 90 | Pipes, semicolons, backticks in commands |
| Path Traversal | 85 | `../` or URL-encoded traversal attempts |
| XSS Attempt | 80 | `<script>`, `javascript:`, event handlers |

### System Issues
| Pattern | Score | Description |
|---------|-------|-------------|
| Memory Exhaustion | 95 | Out of memory, heap limits, allocation failed |
| Connection Problems | 65 | Timeouts, refused connections, resets |
| Auth Failures | 60 | Invalid tokens, access denied, 401/403 |
| Stack Traces | 40 | Exceptions and stack traces |

### Anomaly Score Interpretation
- **0-40**: Normal/Info (green)
- **41-70**: Warning (yellow)  
- **71-100**: Critical (red with flag)

---

## 📝 Examples

### Monitor a Web Server Log

```bash
logpulse -f /var/log/nginx/access.log --no-color | grep "500 "
```

### Watch for Security Threats in Real-time

```bash
logpulse -f app.log -t 60 --json
```

### Docker Container Logging

```bash
docker logs -f mycontainer 2>&1 | logpulse --file /dev/stdin
```

### Jenkins Build Log Monitoring

```bash
logpulse -f /var/log/jenkins/build.log --stats
```

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

## 📝 CHANGELOG

### [1.0.0](https://github.com/chensu1234/logpulse-1776042554) (2026-04-13)

#### Added
- Initial release
- Real-time log file monitoring with polling
- Anomaly detection engine with security patterns
- Beautiful terminal UI with colors and timestamps
- Log level classification (error, warning, info, debug)
- Burst detection for consecutive errors
- Log rotation/truncation detection
- YAML-based configuration system
- Statistics dashboard mode
- JSON log parsing support
- Comprehensive README and documentation

---

## 🙏 Acknowledgments

Built with [chalk](https://www.npmjs.com/package/chalk) for terminal colors and [commander](https://www.npmjs.com/package/commander) for CLI argument parsing.
