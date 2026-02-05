/**
 * Security utilities for the TextMe daemon
 *
 * Provides input sanitization, rate limiting, permission validation,
 * security logging, and suspicious pattern detection.
 */

import fs from 'fs';
import path from 'path';
import os from 'os';

// Rate limiting
const rateLimits = new Map<string, { count: number; resetTime: number }>();
const SECURITY_LOG = path.join(os.homedir(), '.local/log/claude-imessage-security.log');

/**
 * Sanitize message content to prevent metadata spoofing and injection attacks
 *
 * Filters out patterns that could confuse the daemon's message parsing or
 * allow attackers to impersonate system messages.
 */
export function sanitizeMessageContent(content: string): string {
  // Filter metadata spoofing patterns
  const dangerousPatterns = [
    /is_from_me\s*:\s*(true|false)/gi,
    /sender\s*:\s*\+?\d+/gi,
    /date\s*:\s*\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/gi,
    /message_handle\s*:\s*[a-zA-Z0-9-]+/gi,
    /\[system\]/gi,
    /\[daemon\]/gi,
    /\[admin\]/gi,
  ];

  let sanitized = content;
  let filtered = false;

  for (const pattern of dangerousPatterns) {
    if (pattern.test(sanitized)) {
      filtered = true;
      sanitized = sanitized.replace(pattern, '[FILTERED]');
    }
  }

  if (filtered) {
    logSecurityEvent('content_sanitized', {
      original_length: content.length,
      filtered_count: content.length - sanitized.length
    });
  }

  return sanitized;
}

/**
 * Check if a phone number has exceeded the rate limit
 *
 * @param phoneNumber - The phone number to check
 * @param maxPerHour - Maximum messages allowed per hour (default: 30)
 * @returns Object with allowed status and remaining count
 */
export function checkRateLimit(
  phoneNumber: string,
  maxPerHour: number = 30
): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const limit = rateLimits.get(phoneNumber);

  if (!limit || now > limit.resetTime) {
    rateLimits.set(phoneNumber, { count: 1, resetTime: now + 3600000 });
    return { allowed: true, remaining: maxPerHour - 1 };
  }

  if (limit.count >= maxPerHour) {
    logSecurityEvent('rate_limit_exceeded', { phoneNumber, count: limit.count });
    return { allowed: false, remaining: 0 };
  }

  limit.count++;
  return { allowed: true, remaining: maxPerHour - limit.count };
}

/**
 * Validate and fix config file permissions
 *
 * Config files should have 600 permissions (read/write for owner only)
 * to prevent unauthorized access to API keys.
 */
export function validateConfigPermissions(configPath: string): void {
  try {
    const stat = fs.statSync(configPath);
    const permissions = (stat.mode & parseInt('777', 8)).toString(8);

    if (permissions !== '600') {
      console.warn(`⚠️  Config file has insecure permissions: ${permissions}`);
      console.warn(`   Fixing permissions to 600...`);
      fs.chmodSync(configPath, 0o600);
      console.log(`✓ Config permissions secured`);
      logSecurityEvent('config_permissions_fixed', {
        path: configPath,
        old: permissions,
        new: '600'
      });
    }
  } catch (error) {
    console.error('Failed to validate config permissions:', error);
  }
}

/**
 * Log security events to a dedicated security log
 *
 * Logs are stored at ~/.local/log/claude-imessage-security.log
 */
export function logSecurityEvent(event: string, details: any): void {
  const logEntry = {
    timestamp: new Date().toISOString(),
    event,
    details
  };

  try {
    // Ensure log directory exists
    const logDir = path.dirname(SECURITY_LOG);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }

    fs.appendFileSync(SECURITY_LOG, JSON.stringify(logEntry) + '\n');

    // Console warning for critical events
    if (event === 'rate_limit_exceeded' || event === 'content_sanitized') {
      console.warn(`🚨 SECURITY: ${event}`, details);
    }
  } catch (error) {
    console.error('Failed to write security log:', error);
  }
}

/**
 * Detect suspicious patterns in message content
 *
 * Looks for attempts to access sensitive files or paths that could
 * indicate an attempted attack.
 *
 * @returns Array of detected suspicious patterns
 */
export function detectSuspiciousPatterns(content: string): string[] {
  const suspicious: string[] = [];

  // Detect attempts to access sensitive paths
  const sensitivePaths = [
    { pattern: /~?\/.ssh\//gi, description: 'SSH directory access' },
    { pattern: /\/etc\/passwd/gi, description: 'Password file access' },
    { pattern: /\/etc\/shadow/gi, description: 'Shadow file access' },
    { pattern: /\.aws\/credentials/gi, description: 'AWS credentials access' },
    { pattern: /\.env/gi, description: 'Environment file access' },
    { pattern: /id_rsa|id_dsa|id_ecdsa|id_ed25519/gi, description: 'SSH key access' },
  ];

  for (const { pattern, description } of sensitivePaths) {
    if (pattern.test(content)) {
      suspicious.push(description);
    }
  }

  if (suspicious.length > 0) {
    logSecurityEvent('suspicious_content_detected', {
      patterns: suspicious,
      content_preview: content.substring(0, 100)
    });
  }

  return suspicious;
}

/**
 * Get security statistics for monitoring
 */
export function getSecurityStats(): {
  activeRateLimits: number;
  logPath: string;
} {
  return {
    activeRateLimits: rateLimits.size,
    logPath: SECURITY_LOG
  };
}
