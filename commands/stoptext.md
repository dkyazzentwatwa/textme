# /stoptext - Disable Text Mode

Disable "text me" mode and return to terminal-only interaction.

## Usage

```
/stoptext
```

## Instructions

When the user runs `/stoptext`:

1. Remove the state file at `~/.config/claude-imessage/textme-enabled` if it exists
2. Confirm in terminal: "Text mode disabled. Back to terminal-only interaction."
3. Optionally send final iMessage via `notify_user`: "Text mode off. Back to terminal!"

## Notes

- This is equivalent to `/textme off`
- After running this, Claude will no longer automatically text the user
- User can re-enable anytime with `/textme`
