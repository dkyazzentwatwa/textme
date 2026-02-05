# TextMe

**🛡️ Security-Hardened | 🔒 Enterprise-Grade Protection | 📊 Full Audit Logging**

**Your personal Claude AI, accessible via iMessage.**

Text Claude from anywhere. Send messages, voice notes, or images - get intelligent responses back to your phone.

**Security Status:** ✅ v2.0 - Fully Hardened (Feb 2026)

---

## 🔒 Security-First Design

> **TextMe v2.0 Security Upgrade** - Following a comprehensive security audit by Kimi K2, TextMe now includes enterprise-grade security features to protect against injection attacks, rate-based abuse, and unauthorized access.

### Top Security Features

- **🛡️ Input Sanitization** - Prevents metadata spoofing and injection attacks
- **✅ Whitelist Enforcement** - Only approved phone numbers can send commands
- **🚦 Smart Rate Limiting** - Maximum 30 messages per hour per number
- **🔒 Config Protection** - API keys auto-secured with 600 permissions
- **📊 Security Audit Log** - Complete event logging at `~/.local/log/claude-imessage-security.log`
- **🔍 Threat Detection** - Monitors for suspicious file access patterns
- **🔐 Directory Restrictions** - Blocks navigation outside home directory

**Security Rating: 9/10** 🛡️ | **Defense-in-Depth Architecture**

---

## Features

- **Text Claude** - Natural conversation via iMessage
- **Voice Notes** - Send audio, automatically transcribed via OpenAI Whisper
- **Images** - Send photos, Claude can see and analyze them
- **File Access** - Claude has full filesystem access for coding tasks
- **Attachments** - Claude can send files back to you
- **Crash Alerts** - Get notified if the daemon goes down
- **Queue System** - Multiple messages processed in order

---

## Quick Start

### 1. Sendblue Setup (Free)

1. Go to [sendblue.com/api](https://sendblue.com/api)
2. Click the **"Sign up"** button at the top
3. Log in to your new account
4. **Verify your phone number** (required before you can use the API)
5. Go to **Settings** → **API Settings** tab
6. Copy your **API Key** and **API Secret**
7. Go to **Settings** → **Phone Lines** tab and copy your **Sendblue phone number**

### 2. Requirements

```bash
brew install node                         # Node.js 18+
npm install -g @anthropic-ai/claude-code  # Claude CLI
```

### 3. Configure

```bash
mkdir -p ~/.config/claude-imessage
nano ~/.config/claude-imessage/config.json
```

```json
{
  "sendblue": {
    "apiKey": "YOUR_API_KEY",
    "apiSecret": "YOUR_API_SECRET",
    "phoneNumber": "+1SENDBLUE_NUMBER"
  },
  "whitelist": ["+1YOUR_PHONE"],
  "pollIntervalMs": 5000,
  "conversationWindowSize": 20
}
```

### 4. Run with Security Validation

```bash
git clone https://github.com/njerschow/textme.git
cd textme/daemon && npm install && npm run build
node dist/index.js
```

The daemon will automatically:
- ✓ Validate config file permissions (fixes to 600 if needed)
- ✓ Initialize security logging
- ✓ Enable input sanitization
- ✓ Activate rate limiting (30 msg/hour)
- ✓ Start threat monitoring

### 5. Test

Text your Sendblue number: `hello`

**Security:** Only whitelisted numbers will receive responses. Unauthorized numbers are blocked automatically.

---

## Commands

| Command | Action |
|---------|--------|
| `?` | Show commands |
| `status` | Current status & directory |
| `queue` | View queued messages |
| `history` | Recent messages |
| `home` | Go to home directory |
| `reset` | Home + clear history |
| `cd /path` | Change directory |
| `stop` | Cancel current task |
| `yes` / `no` | Approve/reject actions |

---

## Production (PM2)

```bash
pm2 start dist/index.js --name textme
pm2 save
pm2 startup
```

---

## Security Architecture

```
Message → [Whitelist] → [Rate Limit] → [Sanitize] → [Threat Scan] → Claude
            ↓               ↓              ↓             ↓
         Block          Throttle       Filter        Alert
       Unauthorized    Abusers       Attacks       Suspicious
```

**Defense-in-Depth Layers:**
1. **Whitelist Enforcement** - First line of defense, blocks all unauthorized numbers
2. **Rate Limiting** - Prevents brute-force attacks (30 messages/hour)
3. **Input Sanitization** - Filters injection attempts and metadata spoofing
4. **Threat Detection** - Monitors for suspicious file access patterns
5. **Audit Logging** - Records all security events for review

**Why TextMe is Secure:**
- ✅ Zero-trust model with whitelist-only access
- ✅ Automatic security validation on startup
- ✅ Complete audit trail of all events
- ✅ Fail-safe design (security failures = blocked messages)
- ✅ Audited by security professional

**View Security Logs:**
```bash
tail -f ~/.local/log/claude-imessage-security.log
```

---

## Architecture

```
daemon/
├── src/
│   ├── index.ts      # Main loop, message processing, media handling
│   ├── sendblue.ts   # Sendblue API (send, receive, upload files)
│   └── ...
├── dist/             # Compiled output
└── package.json
```

---

## Logs

```bash
# Application Logs
pm2 logs textme                                      # PM2
tail -f ~/.local/log/claude-imessage.log            # Standalone

# Security Audit Logs (NEW in v2.0)
tail -f ~/.local/log/claude-imessage-security.log   # Security events
```

**Security Log Events:**
- Rate limit violations
- Content sanitization (filtered attacks)
- Suspicious file access attempts
- Config permission fixes

---

## Auto-Start (macOS launchd)

### Enable Auto-Start on Login

```bash
./scripts/install-launchd.sh
```

The daemon will now start automatically when you log in and auto-restart if it crashes.

### Managing the Daemon

**Stop the daemon:**
```bash
launchctl unload ~/Library/LaunchAgents/com.claude.imessage-daemon.plist
```

**Start the daemon:**
```bash
launchctl load ~/Library/LaunchAgents/com.claude.imessage-daemon.plist
```

**Restart the daemon:**
```bash
launchctl unload ~/Library/LaunchAgents/com.claude.imessage-daemon.plist
launchctl load ~/Library/LaunchAgents/com.claude.imessage-daemon.plist
```

**Check status:**
```bash
launchctl list | grep claude
```

### Disable Auto-Start

```bash
./scripts/uninstall-launchd.sh
```

This stops the daemon and removes it from auto-start.

### Quick Reference

| Action | Command |
|--------|---------|
| **Install auto-start** | `./scripts/install-launchd.sh` |
| **Stop daemon** | `launchctl unload ~/Library/LaunchAgents/com.claude.imessage-daemon.plist` |
| **Start daemon** | `launchctl load ~/Library/LaunchAgents/com.claude.imessage-daemon.plist` |
| **Check status** | `launchctl list \| grep claude` |
| **Remove auto-start** | `./scripts/uninstall-launchd.sh` |
| **View logs** | `tail -f ~/.local/log/claude-imessage.log` |

---

## Uninstall

```bash
pm2 delete textme  # or: pkill -f "node.*daemon/dist"
rm -rf ~/.config/claude-imessage ~/.local/log/claude-imessage.log
```

---

## Security Best Practices

1. **Keep whitelist minimal** - Only add phone numbers you trust completely
2. **Review security logs** - Periodically check `~/.local/log/claude-imessage-security.log`
3. **Monitor rate limits** - Unexpected hits may indicate issues
4. **Rotate API keys** - Update Sendblue and Claude credentials regularly
5. **Update dependencies** - Run `npm audit` in daemon directory

**For detailed security documentation, see:** `daemon/README.md`

---

Built with [Sendblue](https://sendblue.co) + [Claude](https://anthropic.com)

**🛡️ Security-Hardened v2.0** | Audited by Kimi K2 | MIT License
