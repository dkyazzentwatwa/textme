# TextMe

**Your personal Claude AI, accessible via iMessage.**

Text Claude from anywhere. Send messages, voice notes, or images - get intelligent responses back to your phone.

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

1. Sign up at [dashboard.sendblue.com](https://dashboard.sendblue.com/company-signup)
2. Get your **API Key** and **API Secret** from Dashboard → API Keys
3. Add your phone number as a **verified contact**

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

### 4. Run

```bash
git clone https://github.com/njerschow/textme.git
cd textme/daemon && npm install && npm run build
node dist/index.js
```

### 5. Test

Text your Sendblue number: `hello`

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
# PM2
pm2 logs textme

# Standalone
tail -f ~/.local/log/claude-imessage.log
```

---

## Auto-Start (launchd)

```bash
./scripts/install-launchd.sh    # Enable
./scripts/uninstall-launchd.sh  # Disable
```

---

## Uninstall

```bash
pm2 delete textme  # or: pkill -f "node.*daemon/dist"
rm -rf ~/.config/claude-imessage ~/.local/log/claude-imessage.log
```

---

Built with [Sendblue](https://sendblue.co) + [Claude](https://anthropic.com)

MIT License
