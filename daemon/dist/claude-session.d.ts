/**
 * Claude Code CLI wrapper - VERBOSE MODE
 * Uses `claude --verbose` for real-time tool activity streaming
 * Parses verbose output for tool calls and extracts final response
 */
export interface ClaudeSessionConfig {
    workingDirectory: string;
}
export interface VerboseCallbacks {
    /** Called when a tool activity is detected */
    onToolActivity?: (activity: string) => void;
    /** Minimum interval between activity callbacks in ms (default: 1000) */
    activityIntervalMs?: number;
}
export declare class ClaudeSession {
    private config;
    private isActive_;
    private currentTaskId;
    private currentProcess;
    private partialOutput;
    constructor(config: ClaudeSessionConfig);
    start(): Promise<void>;
    /**
     * Send a message and get response - with real-time tool activity updates via --verbose
     */
    send(message: string, taskId?: string, callbacks?: VerboseCallbacks): Promise<string>;
    private cleanup;
    getPartialOutput(): string;
    getPid(): number | undefined;
    isActive(): boolean;
    isProcessing(): boolean;
    kill(): void;
    exit(): Promise<void>;
}
export declare function getOrCreateSession(workingDir: string): Promise<ClaudeSession>;
export declare function getCurrentSession(): ClaudeSession | null;
export declare function killCurrentSession(): void;
export declare function interruptCurrentTask(): string | null;
