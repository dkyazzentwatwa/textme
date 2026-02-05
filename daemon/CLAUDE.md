# Claude iMessage Daemon - Development Notes

## Important Reminders

### Help Message Must Be Updated

When adding new commands to the daemon, **always update the `HELP_MESSAGE` constant** in `src/index.ts`.

The help message is displayed when users send `help` or `?`. It must accurately reflect all available commands.

Location: `src/index.ts` - search for `HELP_MESSAGE`

Current commands:
- `help` / `?` - Show help
- `status` - Show current status
- `interrupt` / `stop` / `cancel` - Stop current task
- `yes` / `no` (and variants) - Approval responses

### Adding a New Command Checklist

1. Add the command detection function (e.g., `isMyCommand()`)
2. Add the handler in the poll loop
3. **Update `HELP_MESSAGE` to include the new command**
4. Update this list in CLAUDE.md
5. Update the command table in README.md

## Security Considerations

### When Modifying Security-Sensitive Code

The daemon has multiple security layers to prevent attacks. When making changes:

1. **Input Sanitization** (`src/security.ts`)
   - All user content passes through `sanitizeMessageContent()`
   - Filters metadata spoofing patterns (e.g., `is_from_me: true`)
   - Update patterns list if new attack vectors discovered

2. **Rate Limiting** (`src/security.ts`)
   - Default: 30 messages per hour per phone number
   - Adjust `maxPerHour` parameter if needed
   - Consider impact on legitimate usage

3. **Security Logging** (`src/security.ts`)
   - Use `logSecurityEvent()` for security-relevant actions
   - Logs stored at `~/.local/log/claude-imessage-security.log`
   - Add new event types for new security features

4. **Suspicious Pattern Detection** (`src/security.ts`)
   - Monitors for sensitive file access attempts
   - Update `sensitivePaths` array for new patterns
   - Balance false positives vs. security

5. **Config File Security** (`src/config.ts`)
   - Permissions automatically validated on startup (600)
   - Don't store sensitive data in other locations
   - Never commit config files to git

### Testing Security Changes

Before deploying security-related changes:

1. **Test sanitization** - Send messages with dangerous patterns
2. **Test rate limiting** - Send 31+ messages rapidly
3. **Test permission validation** - Check config file permissions after startup
4. **Review logs** - Verify security events are logged correctly
5. **Update README.md** - Document new security features

### Security Update Checklist

When adding security features:

1. Implement the feature in `src/security.ts`
2. Integrate into `src/index.ts` or relevant module
3. Add logging via `logSecurityEvent()`
4. Update README.md security section
5. Add to this CLAUDE.md security notes
6. Test thoroughly before deployment

### Emergency Procedures

If a security issue is discovered:

1. **Immediate**: Kill daemon (`pkill -f claude-imessage-daemon`)
2. Review security logs (`tail -100 ~/.local/log/claude-imessage-security.log`)
3. Check database for suspicious activity (`sqlite3 ~/.config/claude-imessage/daemon.db`)
4. Implement fix in `src/security.ts`
5. Add regression test
6. Document in README.md troubleshooting section
