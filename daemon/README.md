# TextMe - Claude iMessage Daemon

A secure, intelligent iMessage daemon that connects Claude AI to your text messages via the Sendblue API. Send tasks, get real-time progress updates, and interact with Claude through natural conversation.

## Features

### Core Functionality
- **📱 iMessage Integration** - Send and receive messages through Sendblue API
- **🤖 Claude AI Powered** - Full access to Claude's capabilities via CLI
- **📊 Real-time Progress** - Streaming updates as Claude works on tasks
- **💬 Conversation History** - Context-aware responses with message history
- **📁 File Support** - Send files and images through iMessage
- **🎤 Voice Notes** - Automatic audio transcription via Whisper API

### Security Features
- **🛡️ Input Sanitization** - Prevents metadata spoofing and injection attacks
- **🚦 Rate Limiting** - Protects against abuse (30 messages/hour per number)
- **🔒 Config Security** - Automatic permission validation (600) for API keys
- **📊 Security Logging** - Dedicated audit trail at `~/.local/log/claude-imessage-security.log`
- **🔍 Suspicious Pattern Detection** - Monitors for attempts to access sensitive files
- **✅ Phone Number Whitelist** - Only approved numbers can interact with daemon

## Architecture

```
┌─────────────┐
│   iMessage  │
└──────┬──────┘
       │
       ▼
┌─────────────┐      ┌──────────────┐
│  Sendblue   │◄────►│   TextMe     │
│     API     │      │   Daemon     │
└─────────────┘      └──────┬───────┘
                            │
                            ▼
                     ┌──────────────┐
                     │  Claude CLI  │
                     └──────────────┘
```

### Message Flow
1. User sends message via iMessage
2. Sendblue API receives and stores message
3. Daemon polls Sendblue every 2 seconds
4. Message validated against whitelist
5. Rate limiting and security checks applied
6. Content sanitized and passed to Claude
7. Claude processes with streaming progress updates
8. Response sent back via Sendblue → iMessage

## Installation

### Prerequisites
- Node.js 18+ with npm
- [Claude CLI](https://github.com/anthropics/claude-code) installed and authenticated
- [Sendblue](https://sendblue.co/) account with API credentials
- macOS (for local testing with iMessage)

### Setup

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd daemon
   npm install
   ```

2. **Configure the daemon**
   ```bash
   npm run build
   npm start  # Creates example config at ~/.config/claude-imessage/config.json.example
   ```

3. **Edit configuration**
   ```bash
   cp ~/.config/claude-imessage/config.json.example ~/.config/claude-imessage/config.json
   nano ~/.config/claude-imessage/config.json
   ```

   Required configuration:
   ```json
   {
     "sendblue": {
       "apiKey": "your_sendblue_api_key",
       "apiSecret": "your_sendblue_api_secret",
       "phoneNumber": "+15551234567"
     },
     "whitelist": [
       "+15559876543"
     ],
     "pollIntervalMs": 2000,
     "conversationWindowSize": 50
   }
   ```

4. **Verify config permissions**
   The daemon automatically sets correct permissions (600) on startup, but you can verify:
   ```bash
   ls -l ~/.config/claude-imessage/config.json
   # Should show: -rw------- (600)
   ```

5. **Start the daemon**
   ```bash
   npm start
   ```

## Usage

### Available Commands

Send these commands via iMessage to control the daemon:

| Command | Description |
|---------|-------------|
| `help` or `?` | Show available commands |
| `status` | Show current task and queue status |
| `interrupt`, `stop`, `cancel` | Stop the current running task |
| `yes`, `y`, `approve`, `ok` | Approve pending actions |
| `no`, `n`, `deny`, `reject` | Reject pending actions |
| `dirs` or `projects` | List available project directories |
| `cd <path>` | Change working directory (restricted to home and /tmp) |

### Conversation Examples

**Simple task:**
```
You: What's the weather like today?
Claude: Let me check that for you...
[streams response with weather info]
```

**Development task:**
```
You: Add a new API endpoint for user authentication
Claude: I'll help you with that. Let me explore the codebase first...
[creates plan, shows progress updates]
[implements code]
Claude: Done! Created POST /api/auth/login endpoint with JWT tokens.
```

**File operations:**
```
You: [sends image]
Claude: I can see the diagram. Would you like me to implement this architecture?
```

**Directory navigation:**
```
You: cd ~/Projects/myapp
Claude: Changed directory to /Users/you/Projects/myapp
You: What files are in this project?
Claude: [lists project structure]
```

### Working with Projects

The daemon maintains a list of your project directories in `~/.config/claude-imessage/projects.json`:

```json
{
  "projects": [
    "/Users/you/Projects/webapp",
    "/Users/you/Projects/api-server"
  ]
}
```

Commands:
- `dirs` or `projects` - List all saved project directories
- `cd <path>` - Switch to a project directory
- Claude automatically shows your current directory in status updates

## Security

### Threat Model

TextMe assumes:
- **Trusted whitelist** - Only approved phone numbers can interact
- **Local security** - Runs on a trusted machine with proper OS-level protections
- **API security** - Sendblue and Claude APIs are secure and authenticated

### Security Measures

#### 1. Input Sanitization
Prevents metadata spoofing attacks by filtering dangerous patterns:
- `is_from_me: true` → `[FILTERED]`
- `sender: +15551234567` → `[FILTERED]`
- `[system]`, `[daemon]`, `[admin]` → `[FILTERED]`

#### 2. Rate Limiting
- Maximum 30 messages per hour per phone number
- Automatic reset after 1 hour
- User notified when limit exceeded

#### 3. Config File Security
- API keys stored at `~/.config/claude-imessage/config.json`
- Permissions automatically set to 600 (read/write owner only)
- Validation on every daemon startup

#### 4. Security Logging
All security events logged to `~/.local/log/claude-imessage-security.log`:
```json
{
  "timestamp": "2026-02-04T10:30:00.000Z",
  "event": "content_sanitized",
  "details": {
    "original_length": 150,
    "filtered_count": 15
  }
}
```

#### 5. Suspicious Pattern Detection
Monitors for attempts to access:
- SSH keys (`~/.ssh/`, `id_rsa`)
- System files (`/etc/passwd`, `/etc/shadow`)
- Credentials (`.aws/credentials`, `.env`)

#### 6. Phone Number Whitelist
- International format validation using libphonenumber
- Normalization (e.g., `555-1234` → `+15551234`)
- Only whitelisted numbers can send commands

#### 7. Directory Restrictions
- `cd` command restricted to home directory and `/tmp`
- Prevents navigation to sensitive system directories
- Absolute path validation

### Accepted Risks

The following are conscious design decisions:

1. **Full Filesystem Access** - Claude runs with normal user permissions
   - **Mitigation**: Strong whitelist enforcement, security logging
   - **Rationale**: Users trust whitelisted numbers and need full capabilities

2. **No Webhook HMAC Verification** - Sendblue messages trusted without cryptographic verification
   - **Mitigation**: Whitelist prevents unauthorized senders
   - **Future**: Can be added when Sendblue supports webhook secrets

3. **No Sandboxing/Containerization** - Process runs as normal user
   - **Mitigation**: OS-level security, file permissions, audit logging
   - **Rationale**: Complexity vs. benefit for trusted personal use

### Security Best Practices

1. **Keep whitelist minimal** - Only add phone numbers you trust completely
2. **Review security logs** - Periodically check `~/.local/log/claude-imessage-security.log`
3. **Use strong API keys** - Rotate Sendblue and Claude credentials regularly
4. **Monitor rate limits** - Unexpected limit hits may indicate issues
5. **Update dependencies** - Run `npm audit` and keep packages current

### Security Incident Response

If you suspect a security issue:

1. **Stop the daemon** - `pkill -f claude-imessage-daemon`
2. **Review security logs** - Check `~/.local/log/claude-imessage-security.log`
3. **Check conversation history** - Review `~/.config/claude-imessage/daemon.db`
4. **Rotate credentials** - Generate new Sendblue API keys
5. **Update whitelist** - Remove compromised phone numbers
6. **Clear history** - Send `clear history` command to reset conversation

## Configuration

### Full Config Schema

```typescript
{
  sendblue: {
    apiKey: string;        // Sendblue API key
    apiSecret: string;     // Sendblue API secret
    phoneNumber: string;   // Your phone number (E.164 format)
  };
  whitelist: string[];     // Allowed phone numbers
  pollIntervalMs: number;  // Polling interval (default: 2000)
  conversationWindowSize: number; // Max messages in context (default: 50)
  streamingIntervalMs?: number;   // Progress update interval (default: 3000)
  streamingMinChunkSize?: number; // Min chars before update (default: 50)
  progressIntervalMs?: number;    // Periodic update interval (default: 5000)
}
```

### Environment Variables

The daemon uses standard Claude CLI authentication. Set these if needed:

```bash
export ANTHROPIC_API_KEY="your_api_key"
export CLAUDE_CLI_PATH="/path/to/claude"  # Optional: custom CLI path
```

### Database Location

Conversation history stored at: `~/.config/claude-imessage/daemon.db`

SQLite tables:
- `conversation_history` - Message context
- `processed_messages` - Deduplication tracking
- `message_queue` - Pending messages during task processing

## Development

### Project Structure

```
daemon/
├── src/
│   ├── index.ts           # Main daemon loop
│   ├── claude-session.ts  # Claude CLI process management
│   ├── sendblue.ts        # Sendblue API client
│   ├── config.ts          # Configuration loader
│   ├── security.ts        # Security utilities (NEW)
│   ├── database.ts        # SQLite operations
│   └── types.ts           # TypeScript definitions
├── dist/                  # Compiled JavaScript
├── package.json
├── tsconfig.json
├── CLAUDE.md             # Development notes for Claude
└── README.md             # This file
```

### Build Commands

```bash
npm run build    # Compile TypeScript
npm start        # Run daemon
npm run dev      # Watch mode (if configured)
npm test         # Run tests (if configured)
```

### Adding New Commands

1. Add detection function (e.g., `isMyCommand()`)
2. Add handler in poll loop (`src/index.ts`)
3. **Update `HELP_MESSAGE` constant** (`src/index.ts:358`)
4. Update this README's command table

See `CLAUDE.md` for development guidelines.

## Troubleshooting

### Daemon won't start

**Config file missing:**
```
Error: Config not found. Created example at ~/.config/claude-imessage/config.json.example
```
Solution: Copy example config and fill in your credentials

**Invalid config:**
```
Error: Invalid configuration: ...
```
Solution: Check JSON syntax and required fields

**Permission denied:**
```
Error: EACCES: permission denied, open '~/.config/claude-imessage/config.json'
```
Solution: `chmod 600 ~/.config/claude-imessage/config.json`

### Messages not received

1. **Check Sendblue webhook** - Verify messages appear in Sendblue dashboard
2. **Check whitelist** - Ensure sender phone number is whitelisted (E.164 format)
3. **Check logs** - Look for `[Poll] Not whitelisted: ...` messages
4. **Check rate limit** - May have exceeded 30 messages/hour

### Rate limit issues

```
⚠️ Rate limit exceeded. Please wait before sending more messages.
```

Solution: Wait 1 hour for rate limit reset. If legitimate usage, adjust limit in `src/security.ts`:
```typescript
export function checkRateLimit(
  phoneNumber: string,
  maxPerHour: number = 60  // Increase from 30
)
```

### Security warnings

```
🚨 SECURITY: content_sanitized { original_length: 150, filtered_count: 15 }
```

This is expected if messages contain patterns like `is_from_me: true`. Check security log for details:
```bash
tail -f ~/.local/log/claude-imessage-security.log
```

### Claude not responding

1. **Check Claude CLI** - Run `claude --version` to verify installation
2. **Check API key** - Ensure `ANTHROPIC_API_KEY` is set or CLI is authenticated
3. **Check process** - `ps aux | grep claude` to see if session exists
4. **Send interrupt** - Text `stop` to kill hung session
5. **Restart daemon** - Stop and restart with `npm start`

### Database issues

**Corrupted database:**
```bash
rm ~/.config/claude-imessage/daemon.db
npm start  # Will recreate database
```

**Clear conversation history:**
Send `clear history` command via text, or manually:
```bash
sqlite3 ~/.config/claude-imessage/daemon.db "DELETE FROM conversation_history;"
```

## Performance

### Resource Usage
- **Memory**: ~100MB (daemon) + ~300MB (Claude session)
- **CPU**: Minimal when idle, spikes during Claude processing
- **Network**: ~1KB per poll (empty), varies with message content
- **Disk**: Conversation history grows over time

### Optimization Tips
1. **Increase poll interval** - Reduce `pollIntervalMs` to 5000 for less frequent checks
2. **Decrease conversation window** - Lower `conversationWindowSize` to reduce context size
3. **Clear old messages** - Periodically clear conversation history
4. **Monitor security logs** - Rotate logs to prevent unbounded growth

## Roadmap

### Planned Features
- [ ] Webhook support (when Sendblue adds HMAC)
- [ ] Multi-user support with separate contexts
- [ ] Message archiving and search
- [ ] Usage analytics dashboard
- [ ] Docker containerization option
- [ ] End-to-end encryption for local storage
- [ ] Configurable security policies
- [ ] Automated backups

### Known Limitations
- Only supports one active conversation at a time
- No group chat support (Sendblue limitation)
- Voice transcription requires OpenAI API key
- Rate limiting is per-daemon, not global across restarts

## Contributing

This is a personal project, but suggestions and bug reports are welcome!

1. Check existing issues
2. Open issue describing the problem or feature
3. Submit PR with tests and documentation

## License

MIT License - see LICENSE file for details

## Support

For issues related to:
- **TextMe daemon**: Open a GitHub issue
- **Sendblue API**: Contact Sendblue support
- **Claude CLI**: See [Claude Code documentation](https://github.com/anthropics/claude-code)

## Acknowledgments

- **Anthropic** - Claude AI and Claude CLI
- **Sendblue** - iMessage API infrastructure
- **Kimi K2** - Security audit and recommendations

---

Built with ❤️ for seamless AI-powered messaging
