/**
 * Claude Code CLI wrapper - VERBOSE MODE
 * Uses `claude --verbose` for real-time tool activity streaming
 * Parses verbose output for tool calls and extracts final response
 */

import { spawn, execSync, ChildProcess } from 'child_process';
import { setRunningTask, clearRunningTask, updateRunningTaskPid } from './db.js';

// Find claude binary path
function findClaudePath(): string {
  try {
    return execSync('which claude', { encoding: 'utf-8' }).trim();
  } catch {
    const paths = [
      `${process.env.HOME}/.nvm/versions/node/v24.12.0/bin/claude`,
      '/usr/local/bin/claude',
      `${process.env.HOME}/.local/bin/claude`,
    ];
    for (const p of paths) {
      try {
        execSync(`test -x "${p}"`);
        return p;
      } catch {}
    }
    return 'claude';
  }
}

const CLAUDE_PATH = findClaudePath();

// Strip ANSI codes from text
function stripAnsi(text: string): string {
  return text.replace(/\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g, '');
}

// Parse tool activity from verbose output
function parseToolActivity(line: string): string | null {
  const stripped = stripAnsi(line).trim();

  // Common tool patterns in Claude CLI verbose output
  const patterns = [
    { regex: /^Read\s+(.+)$/i, format: (m: RegExpMatchArray) => `Reading: ${m[1]}` },
    { regex: /^Glob\s+(.+)$/i, format: (m: RegExpMatchArray) => `Searching: ${m[1]}` },
    { regex: /^Grep\s+(.+)$/i, format: (m: RegExpMatchArray) => `Grep: ${m[1]}` },
    { regex: /^Bash\s+(.+)$/i, format: (m: RegExpMatchArray) => `Running: ${m[1]}` },
    { regex: /^Write\s+(.+)$/i, format: (m: RegExpMatchArray) => `Writing: ${m[1]}` },
    { regex: /^Edit\s+(.+)$/i, format: (m: RegExpMatchArray) => `Editing: ${m[1]}` },
    { regex: /^Task\s+(.+)$/i, format: (m: RegExpMatchArray) => `Task: ${m[1]}` },
    { regex: /Reading file[:\s]+(.+)$/i, format: (m: RegExpMatchArray) => `Reading: ${m[1]}` },
    { regex: /Running[:\s]+(.+)$/i, format: (m: RegExpMatchArray) => `Running: ${m[1]}` },
    { regex: /Writing to[:\s]+(.+)$/i, format: (m: RegExpMatchArray) => `Writing: ${m[1]}` },
    { regex: /Searching[:\s]+(.+)$/i, format: (m: RegExpMatchArray) => `Searching: ${m[1]}` },
  ];

  for (const { regex, format } of patterns) {
    const match = stripped.match(regex);
    if (match) {
      return format(match);
    }
  }

  return null;
}

// Extract the final response from verbose output
// Verbose output includes tool calls, ANSI codes, spinners, etc.
// We want to extract just the actual text response
function extractFinalResponse(rawOutput: string): string {
  // Strip ANSI codes first
  let cleaned = stripAnsi(rawOutput);

  // Remove common verbose output patterns
  const linesToRemove = [
    /^╭─+╮$/,
    /^│.*│$/,
    /^╰─+╯$/,
    /^─+$/,
    /^\s*⠋.*$/,
    /^\s*⠙.*$/,
    /^\s*⠹.*$/,
    /^\s*⠸.*$/,
    /^\s*⠼.*$/,
    /^\s*⠴.*$/,
    /^\s*⠦.*$/,
    /^\s*⠧.*$/,
    /^\s*⠇.*$/,
    /^\s*⠏.*$/,
    /^Read\s+/,
    /^Glob\s+/,
    /^Grep\s+/,
    /^Bash\s+/,
    /^Write\s+/,
    /^Edit\s+/,
    /^Task\s+/,
    /^TodoWrite\s+/,
    /^\s*\d+\s*│/,  // Line numbers from file output
    /^>\s+/,  // User prompt prefix
    /^User:/,
    /^Assistant:/,
  ];

  const lines = cleaned.split('\n');
  const filteredLines: string[] = [];

  for (const line of lines) {
    let shouldKeep = true;
    for (const pattern of linesToRemove) {
      if (pattern.test(line.trim())) {
        shouldKeep = false;
        break;
      }
    }
    if (shouldKeep) {
      filteredLines.push(line);
    }
  }

  // Join and clean up extra whitespace
  let result = filteredLines.join('\n');

  // Remove multiple consecutive empty lines
  result = result.replace(/\n{3,}/g, '\n\n');

  return result.trim();
}

export interface ClaudeSessionConfig {
  workingDirectory: string;
}

export interface VerboseCallbacks {
  /** Called when a tool activity is detected */
  onToolActivity?: (activity: string) => void;
  /** Minimum interval between activity callbacks in ms (default: 1000) */
  activityIntervalMs?: number;
}

export class ClaudeSession {
  private config: ClaudeSessionConfig;
  private isActive_: boolean = true;
  private currentTaskId: string | null = null;
  private currentProcess: ChildProcess | null = null;
  private partialOutput: string = '';

  constructor(config: ClaudeSessionConfig) {
    this.config = config;
  }

  async start(): Promise<void> {
    console.log(`[ClaudeSession] Ready in ${this.config.workingDirectory}`);
    console.log(`[ClaudeSession] Using claude at: ${CLAUDE_PATH}`);
  }

  /**
   * Send a message and get response - with real-time tool activity updates via --verbose
   */
  async send(message: string, taskId?: string, callbacks?: VerboseCallbacks): Promise<string> {
    console.log(`[Claude] ====== STARTING CLAUDE REQUEST (VERBOSE MODE) ======`);
    console.log(`[Claude] Task ID: ${taskId || 'none'}`);
    console.log(`[Claude] Message length: ${message.length} chars`);
    console.log(`[Claude] Working dir: ${this.config.workingDirectory}`);

    if (!this.isActive_) {
      console.error(`[Claude] Session not active!`);
      throw new Error('Claude session not active');
    }

    if (taskId) {
      this.currentTaskId = taskId;
      setRunningTask(taskId, message.substring(0, 100));
      console.log(`[Claude] Set running task: ${taskId}`);
    }

    this.partialOutput = '';

    const { onToolActivity, activityIntervalMs = 1000 } = callbacks || {};
    console.log(`[Claude] Tool activity callback: ${onToolActivity ? 'enabled' : 'disabled'}`);

    return new Promise((resolve, reject) => {
      let rawOutput = '';
      let errorOutput = '';
      let lastActivityTime = 0;
      let activityCount = 0;
      const startTime = Date.now();

      // Use --verbose for real-time tool activity
      console.log(`[Claude] Spawning process: ${CLAUDE_PATH} --verbose --continue --permission-mode bypassPermissions`);
      const proc = spawn(CLAUDE_PATH, [
        '--verbose',
        '--continue',
        '--permission-mode', 'bypassPermissions',
      ], {
        cwd: this.config.workingDirectory,
        env: {
          ...process.env,
          // Don't disable colors - we'll strip them ourselves
        },
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      this.currentProcess = proc;
      console.log(`[Claude] Process spawned with PID: ${proc.pid}`);

      if (proc.pid && this.currentTaskId) {
        updateRunningTaskPid(this.currentTaskId, proc.pid);
      }

      // Process incoming data for tool activity
      const processLine = (line: string) => {
        const activity = parseToolActivity(line);
        if (activity && onToolActivity) {
          const now = Date.now();
          // Rate limit activity callbacks
          if (now - lastActivityTime >= activityIntervalMs) {
            activityCount++;
            console.log(`[Claude] Tool activity #${activityCount}: ${activity}`);
            onToolActivity(activity);
            lastActivityTime = now;
          }
        }
      };

      // Buffer for incomplete lines
      let lineBuffer = '';

      proc.stdout.on('data', (data) => {
        const text = data.toString();
        rawOutput += text;
        this.partialOutput = rawOutput;

        // Process line by line for tool activity detection
        lineBuffer += text;
        const lines = lineBuffer.split('\n');
        lineBuffer = lines.pop() || ''; // Keep incomplete last line in buffer

        for (const line of lines) {
          processLine(line);
        }

        console.log(`[Claude] stdout: +${text.length} chars (total: ${rawOutput.length})`);
      });

      proc.stderr.on('data', (data) => {
        const text = data.toString();
        errorOutput += text;

        // stderr often has tool activity in verbose mode too
        const lines = text.split('\n');
        for (const line of lines) {
          processLine(line);
        }

        console.log(`[Claude] stderr: ${text.substring(0, 100)}${text.length > 100 ? '...' : ''}`);
      });

      proc.on('error', (error) => {
        console.error(`[Claude] Process error:`, error);
        this.cleanup();
        reject(error);
      });

      proc.on('close', (code) => {
        const duration = Date.now() - startTime;
        this.currentProcess = null;
        this.cleanup();

        console.log(`[Claude] ====== PROCESS CLOSED ======`);
        console.log(`[Claude] Exit code: ${code}`);
        console.log(`[Claude] Duration: ${duration}ms`);
        console.log(`[Claude] Raw output length: ${rawOutput.length} chars`);
        console.log(`[Claude] Tool activities detected: ${activityCount}`);

        if (errorOutput) {
          console.log(`[Claude] Stderr (first 200 chars): ${errorOutput.substring(0, 200)}`);
        }

        // Extract clean response from verbose output
        // The actual response is typically at the end after all the tool outputs
        const cleanOutput = extractFinalResponse(rawOutput);

        if (cleanOutput.trim()) {
          console.log(`[Claude] Resolving with clean output (${cleanOutput.length} chars)`);
          resolve(cleanOutput.trim());
        } else if (code !== 0) {
          console.log(`[Claude] Rejecting due to non-zero exit code`);
          reject(new Error(`Claude exited with code ${code}: ${errorOutput}`));
        } else {
          console.log(`[Claude] Resolving with "No response"`);
          resolve('No response from Claude.');
        }
      });

      // Timeout after 10 minutes
      const timeout = setTimeout(() => {
        console.log('[Claude] TIMEOUT - killing process after 10 minutes');
        this.kill();
        const partial = extractFinalResponse(this.partialOutput);
        if (partial.trim()) {
          resolve(partial.trim() + '\n\n[Response timed out]');
        } else {
          reject(new Error('Response timeout'));
        }
      }, 10 * 60 * 1000);

      proc.on('close', () => clearTimeout(timeout));

      // Send the message
      console.log(`[Claude] Writing message to stdin (${message.length} chars)`);
      proc.stdin.write(message);
      proc.stdin.end();
      console.log(`[Claude] stdin closed, waiting for response...`);
    });
  }

  private cleanup(): void {
    if (this.currentTaskId) {
      clearRunningTask();
      this.currentTaskId = null;
    }
  }

  getPartialOutput(): string {
    return this.partialOutput;
  }

  getPid(): number | undefined {
    return this.currentProcess?.pid;
  }

  isActive(): boolean {
    return this.isActive_;
  }

  isProcessing(): boolean {
    return this.currentProcess !== null;
  }

  kill(): void {
    if (this.currentProcess) {
      console.log('[ClaudeSession] Killing current process');
      this.currentProcess.kill('SIGTERM');
      this.currentProcess = null;
    }
    this.cleanup();
  }

  async exit(): Promise<void> {
    console.log('[ClaudeSession] Session ended');
    this.isActive_ = false;
    this.kill();
  }
}

// Session manager
let currentSession: ClaudeSession | null = null;
let currentDir: string = '';

export async function getOrCreateSession(workingDir: string): Promise<ClaudeSession> {
  if (currentSession?.isActive() && currentDir === workingDir) {
    return currentSession;
  }

  if (currentSession) {
    await currentSession.exit();
  }

  currentDir = workingDir;
  currentSession = new ClaudeSession({ workingDirectory: workingDir });
  await currentSession.start();
  return currentSession;
}

export function getCurrentSession(): ClaudeSession | null {
  return currentSession?.isActive() ? currentSession : null;
}

export function killCurrentSession(): void {
  if (currentSession) {
    currentSession.kill();
    currentSession = null;
    currentDir = '';
  }
}

export function interruptCurrentTask(): string | null {
  if (currentSession?.isProcessing()) {
    const partial = currentSession.getPartialOutput();
    currentSession.kill();
    return partial;
  }
  return null;
}
