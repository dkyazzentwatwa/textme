# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

TextMe is a security-hardened iMessage daemon that connects Claude AI to text messages via the Sendblue API. The project consists of two main components:

1. **Daemon** (`daemon/`) - A polling-based Node.js daemon that processes iMessages and executes Claude CLI commands with real-time streaming
2. **MCP Server** (`server/`) - An optional stdio-based MCP server for Claude Desktop integration (Bun-based)

**Security Status**: v2.0 - Enterprise-grade security audit completed (Feb 2026) with defense-in-depth architecture.

## Architecture

### Message Flow (Daemon)

```
iMessage → Sendblue API → TextMe Daemon → Security Layers → Claude CLI → Response
                              ↓
                    [Whitelist → Rate Limit → Sanitize → Threat Scan]
                              ↓
                    SQLite (conversation history, queue, state)
```

### Key Architectural Patterns

**1. Polling-Based Architecture**
- Daemon polls Sendblue API every 2-5 seconds (configurable)
- No webhooks, no ngrok, no public-facing server required
- Message deduplication via SQLite tracking (`processed_messages` table)

**2. Claude CLI Integration**
- Spawns `claude` process with `--output-format stream-json` for real-time updates
- Runs with `--permission-mode bypassPermissions` for full filesystem access
- Streams tool activity (Read, Bash, Write, etc.) back to user via progress messages

**3. Security Layers (v2.0)**
- **Layer 1**: Whitelist enforcement (E.164 phone number validation)
- **Layer 2**: Rate limiting (30 messages/hour per number, in-memory tracking)
- **Layer 3**: Input sanitization (filters metadata spoofing patterns)
- **Layer 4**: Threat detection (monitors for sensitive file access attempts)
- **Layer 5**: Audit logging (all security events to `~/.local/log/claude-imessage-security.log`)

**4. Conversation Context**
- Maintains sliding window of last N messages (default: 50)
- Stored in SQLite with timestamps and roles (user/assistant)
- Automatically trimmed to prevent unbounded growth

**5. Message Queue**
- Messages received while Claude is processing are queued in SQLite
- FIFO processing with automatic dequeue notifications
- Prevents lost messages during long-running tasks

## Build & Development Commands

### Daemon (Primary Component)

```bash
# Build
cd daemon && npm install && npm run build

# Development (with hot reload)
npm run dev

# Watch mode (recompile on changes)
npm run watch

# Run tests
npm test                # Run once
npm run test:watch      # Watch mode

# Production
npm start               # Run compiled daemon
```

### MCP Server (Optional)

```bash
cd server && npm install && npm run build
bun run src/index.ts    # Run MCP server
```

### Monorepo Scripts

```bash
# Auto-start daemon on boot (macOS launchd)
./scripts/install-launchd.sh
./scripts/uninstall-launchd.sh

# Full installation script
./scripts/install.sh
```

## Configuration

### Location
- Config: `~/.config/claude-imessage/config.json`
- Database: `~/.config/claude-imessage/daemon.db`
- App logs: `~/.local/log/claude-imessage.log`
- Security logs: `~/.local/log/claude-imessage-security.log`
- PID file: `~/.config/claude-imessage/daemon.pid`

### Security-Critical Config Values

```json
{
  "sendblue": {
    "apiKey": "...",        // Sendblue API credentials
    "apiSecret": "...",
    "phoneNumber": "+1..."  // Your Sendblue number (E.164)
  },
  "whitelist": ["+1..."],   // CRITICAL: Only these numbers can control daemon
  "pollIntervalMs": 2000,
  "conversationWindowSize": 50
}
```

**Config Security**: File permissions are automatically validated and fixed to `600` on startup (`daemon/src/config.ts:65`).

## Critical Files & Responsibilities

### Daemon Core (`daemon/src/`)

**`index.ts`** - Main daemon loop
- Polls Sendblue every N seconds
- Enforces security layers (whitelist, rate limit, sanitization)
- Manages message queue and conversation history
- Handles special commands (`help`, `status`, `interrupt`, `cd`, etc.)
- Spawns Claude CLI sessions and streams progress updates

**`security.ts`** - Security utilities (NEW in v2.0)
- `sanitizeMessageContent()` - Filters injection attacks, metadata spoofing
- `checkRateLimit()` - Enforces 30 msg/hour limit per phone number
- `validateConfigPermissions()` - Auto-fixes config file to 600 permissions
- `detectSuspiciousPatterns()` - Monitors for SSH key/credential access attempts
- `logSecurityEvent()` - Audit logging to dedicated security log

**`claude-session.ts`** - Claude CLI wrapper
- Spawns `claude` with stream-json output format
- Parses JSON events for tool activity (Read, Bash, Write, etc.)
- Implements retry logic for API errors (529 overloaded, etc.)
- Tracks running tasks and PIDs for interruption

**`sendblue.ts`** - Sendblue API client
- `getInboundMessages()` - Polls for new messages
- `sendMessage()` - Sends text responses
- `sendFile()` - Uploads and sends file attachments
- `transcribeAudio()` - Transcribes voice notes via OpenAI Whisper

**`config.ts`** - Configuration loader
- Loads and validates config from `~/.config/claude-imessage/config.json`
- Normalizes phone numbers to E.164 format using libphonenumber
- Creates example config on first run
- **SECURITY**: Validates config permissions on startup

**`db.ts`** - SQLite database operations
- Tables: `conversation_history`, `processed_messages`, `message_queue`, `daemon_state`, `pending_approvals`, `working_directories`
- Conversation management with sliding window
- Message deduplication and queue management
- Working directory tracking for `cd` command

**`types.ts`** - TypeScript type definitions
- Shared interfaces for config, messages, sessions, queue, approvals

### MCP Server (`server/src/`)

**`index.ts`** - MCP stdio server
- Implements `send_message`, `read_messages`, `list_contacts` tools
- Uses polling instead of webhooks (like daemon)
- Separate conversation tracking from daemon

## Security Guidelines

### When Adding New Commands

1. Add command detection function (e.g., `isMyCommand()`)
2. Add handler in poll loop (`daemon/src/index.ts`)
3. **Update `HELP_MESSAGE` constant** (`daemon/src/index.ts:358`)
4. Update command table in `README.md` and `daemon/README.md`
5. Update `daemon/CLAUDE.md` command list

### When Modifying Security-Sensitive Code

**Input Sanitization** (`daemon/src/security.ts`)
- All user content passes through `sanitizeMessageContent()`
- Filters patterns: `is_from_me:`, `sender:`, `[system]`, `[daemon]`, etc.
- Update `dangerousPatterns` array if new attack vectors discovered

**Rate Limiting** (`daemon/src/security.ts`)
- Default: 30 messages per hour per phone number
- Adjust `maxPerHour` parameter carefully (impacts legitimate usage)
- Rate limits stored in-memory (resets on daemon restart)

**Security Logging** (`daemon/src/security.ts`)
- Use `logSecurityEvent(event, details)` for security-relevant actions
- Logs stored at `~/.local/log/claude-imessage-security.log`
- Add new event types for new security features

**Suspicious Pattern Detection** (`daemon/src/security.ts`)
- Monitors for: SSH keys, `/etc/passwd`, AWS credentials, `.env` files
- Update `sensitivePaths` array for new patterns
- Balance false positives vs. security

**Config Security** (`daemon/src/config.ts`)
- Permissions automatically validated on startup (600)
- Never store sensitive data in other locations
- Never commit config files to git

### Security Testing Checklist

Before deploying security-related changes:

1. **Test sanitization** - Send messages with dangerous patterns (`is_from_me: true`, `sender: +1...`)
2. **Test rate limiting** - Send 31+ messages rapidly, verify rate limit kicks in
3. **Test permission validation** - `chmod 644 config.json && npm start`, verify auto-fix
4. **Review logs** - Check `~/.local/log/claude-imessage-security.log` for events
5. **Update documentation** - Update `README.md` and `daemon/README.md` security sections

## Common Gotchas

### Whitelist Phone Numbers
- Must be in E.164 format (e.g., `+15551234567`)
- Automatically normalized on config load using libphonenumber
- Missing `+` prefix or country code will cause lookup failures

### Message Deduplication
- Uses `message_handle` from Sendblue as unique ID
- Stored in `processed_messages` table in SQLite
- Old entries cleaned up after 7 days (`cleanupOldProcessedMessages()`)

### Claude CLI Path
- Auto-detected via `which claude` or fallback paths
- Set `CLAUDE_CLI_PATH` env var to override
- Must have `--output-format stream-json` support (recent versions)

### Rate Limiting State
- Stored in-memory (Map), resets on daemon restart
- If legitimate user hits limit, wait 1 hour or restart daemon
- Adjust `maxPerHour` in `security.ts` if needed

### Working Directory Restrictions
- User-issued `cd` command restricted to home directory and `/tmp`
- Prevents navigation to `/etc`, `/var`, etc.
- Claude CLI still has full filesystem access via tools (intentional)

## Project Structure

```
textme/
├── daemon/                    # Main polling daemon (TypeScript)
│   ├── src/
│   │   ├── index.ts          # Main loop, security layers, command handlers
│   │   ├── security.ts       # v2.0 security utilities (NEW)
│   │   ├── claude-session.ts # Claude CLI wrapper with streaming
│   │   ├── sendblue.ts       # Sendblue API client
│   │   ├── config.ts         # Config loader with validation
│   │   ├── db.ts             # SQLite operations
│   │   └── types.ts          # TypeScript definitions
│   ├── test/                 # Vitest tests
│   ├── scripts/              # Utility scripts
│   ├── dist/                 # Compiled JavaScript
│   ├── CLAUDE.md             # Daemon-specific development notes
│   └── README.md             # Comprehensive daemon documentation
├── server/                   # MCP server (Bun/TypeScript)
│   └── src/
│       ├── index.ts          # MCP stdio server
│       ├── sendblue.ts       # Sendblue client (separate from daemon)
│       ├── db.ts             # Conversation history (separate DB)
│       └── types.ts          # MCP-specific types
├── scripts/                  # Installation scripts
│   ├── install-launchd.sh    # macOS auto-start
│   └── install.sh            # Full setup
├── skills/                   # Claude Desktop skills
├── README.md                 # Project overview with security highlights
├── textme-threat-model.md    # Security audit documentation
└── CLAUDE.md                 # This file
```

## Testing Strategy

### Unit Tests (`daemon/test/`)
- Uses Vitest test framework
- Run: `cd daemon && npm test`
- Watch: `npm run test:watch`
- Coverage: Contact card parsing, daemon logic

### Manual Security Testing
1. Send message with `is_from_me: true` → Verify `[FILTERED]` in logs
2. Send 31 messages in 1 hour → Verify rate limit warning
3. `chmod 644 config.json && npm start` → Verify auto-fix to 600
4. Send `"cat ~/.ssh/id_rsa"` → Verify suspicious pattern logged
5. Check security log: `tail -f ~/.local/log/claude-imessage-security.log`

## Emergency Procedures

### Security Incident Response

If a security issue is discovered:

1. **Immediate**: Kill daemon
   ```bash
   pkill -f claude-imessage-daemon
   ```

2. **Review security logs**
   ```bash
   tail -100 ~/.local/log/claude-imessage-security.log
   ```

3. **Check database for suspicious activity**
   ```bash
   sqlite3 ~/.config/claude-imessage/daemon.db
   # SELECT * FROM conversation_history ORDER BY timestamp DESC LIMIT 20;
   ```

4. **Implement fix** in `daemon/src/security.ts`

5. **Add regression test** in `daemon/test/`

6. **Document** in `daemon/README.md` troubleshooting section

### Daemon Won't Start

**Single instance lock**: Check PID file
```bash
cat ~/.config/claude-imessage/daemon.pid
rm ~/.config/claude-imessage/daemon.pid  # If stale
```

**Config issues**: Validate JSON syntax
```bash
cat ~/.config/claude-imessage/config.json | jq .
```

**Permission issues**: Reset config permissions
```bash
chmod 600 ~/.config/claude-imessage/config.json
```

## Key Dependencies

- **better-sqlite3**: SQLite database for state/history
- **google-libphonenumber**: Phone number validation and normalization
- **formdata-node**: File upload support for Sendblue
- **node-pty**: Terminal emulation (used by skills)
- **vitest**: Test framework
- **tsx**: TypeScript execution for development

## Production Deployment

### PM2 (Recommended)
```bash
cd daemon && npm run build
pm2 start dist/index.js --name textme
pm2 save
pm2 startup  # Enable auto-start on reboot
```

### Launchd (macOS)
```bash
./scripts/install-launchd.sh
launchctl list | grep claude.imessage
```

### Monitoring
```bash
# Application logs
tail -f ~/.local/log/claude-imessage.log

# Security audit logs
tail -f ~/.local/log/claude-imessage-security.log

# PM2 logs (if using PM2)
pm2 logs textme
```

## Security Audit History

- **Feb 2026**: v2.0 security hardening by Kimi K2
  - Added input sanitization layer
  - Implemented rate limiting (30 msg/hour)
  - Added config permission validation
  - Added security event logging
  - Added suspicious pattern detection
  - See `textme-threat-model.md` for full audit report

## Related Documentation

- **Project README**: `README.md` - Quick start and overview
- **Daemon README**: `daemon/README.md` - Comprehensive security documentation
- **Daemon Dev Notes**: `daemon/CLAUDE.md` - Implementation-specific notes
- **Threat Model**: `textme-threat-model.md` - Security audit findings
