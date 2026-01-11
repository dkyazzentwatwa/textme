# /textme - Enable Text Mode

Enable "text me" mode. When enabled, Claude will automatically text you via iMessage when:
- A task is completed
- Claude needs your input or approval
- Claude is blocked and needs guidance

## Usage

```
/textme        - Enable text mode
/textme on     - Enable text mode
/textme off    - Disable text mode (same as /stoptext)
/textme status - Check if text mode is enabled
```

## Instructions

When the user runs `/textme` or `/textme on`:

1. Create a state file at `~/.config/claude-imessage/textme-enabled` with content `1`
2. Confirm: "Text mode enabled. I'll text you when I complete tasks or need input. Use /stoptext when you're back."
3. Send an iMessage via `notify_user`: "Text mode enabled! I'll message you here when I'm done or need input."

When the user runs `/textme off`:
1. Remove the state file `~/.config/claude-imessage/textme-enabled`
2. Confirm: "Text mode disabled. Back to terminal-only."

When the user runs `/textme status`:
1. Check if `~/.config/claude-imessage/textme-enabled` exists
2. Report: "Text mode is currently [enabled/disabled]"

## Behavior When Enabled

After EVERY response while text mode is enabled:
- If you completed significant work: use `notify_user` to send a summary
- If you need user input: use `ask_user` to ask via text and WAIT for response
- If you're blocked: use `ask_user` to explain what you need

The user can respond via their phone, and you'll receive their reply through the MCP tools.

## Example Flow

```
User: /textme
Claude: Text mode enabled. I'll text you when I complete tasks or need input.
        [Sends iMessage: "Text mode on! I'll message you here."]

User: Fix the auth bug and add tests
Claude: [Works on the bug...]
        [Sends iMessage: "Fixed auth bug + added 3 tests. Ready to push?"]
        [Waits for text response...]

User responds via phone: "yes push it"
Claude: [Receives response via MCP]
        [Pushes to remote]
        [Sends iMessage: "Pushed to main. Anything else?"]
```
