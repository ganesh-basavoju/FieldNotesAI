import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Tamper-evident audit log for governance compliance.
 * Logs recording, consent, upload, AI processing, editing, approval, and dispatch events.
 * Each entry includes a hash of the previous entry for chain integrity.
 */

export type AuditAction =
    | 'recording_started'
    | 'recording_stopped'
    | 'consent_confirmed'
    | 'consent_method_set'
    | 'file_uploaded'
    | 'upload_failed'
    | 'ai_processing_started'
    | 'ai_processing_completed'
    | 'ai_processing_failed'
    | 'notes_reviewed'
    | 'summary_edited'
    | 'task_edited'
    | 'task_status_changed'
    | 'session_approved'
    | 'session_discarded'
    | 'email_dispatched'
    | 'project_created'
    | 'project_deleted'
    | 'user_login'
    | 'user_logout'
    | 'settings_changed';

export interface AuditEntry {
    id: string;
    timestamp: number;
    action: AuditAction;
    userId?: string;
    userName?: string;
    projectId?: string;
    sessionId?: string;
    details?: Record<string, any>;
    prevHash: string;
}

const AUDIT_KEY = 'fc_audit_log';
const MAX_ENTRIES = 5000;

/**
 * Simple hash for chain integrity (not cryptographic — for tamper detection).
 */
function simpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
        const char = input.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
}

function generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`;
}

export const AuditLog = {
    /**
     * Append an event to the audit log with chain integrity.
     */
    log: async (
        action: AuditAction,
        details?: Record<string, any>,
        context?: { userId?: string; userName?: string; projectId?: string; sessionId?: string }
    ): Promise<void> => {
        try {
            const entries = await AuditLog.getAll();
            const lastEntry = entries[entries.length - 1];
            const prevHash = lastEntry
                ? simpleHash(JSON.stringify(lastEntry))
                : '0';

            const entry: AuditEntry = {
                id: generateId(),
                timestamp: Date.now(),
                action,
                userId: context?.userId,
                userName: context?.userName,
                projectId: context?.projectId,
                sessionId: context?.sessionId,
                details,
                prevHash,
            };

            entries.push(entry);

            // Rotate if too many entries
            const trimmed = entries.length > MAX_ENTRIES
                ? entries.slice(entries.length - MAX_ENTRIES)
                : entries;

            await AsyncStorage.setItem(AUDIT_KEY, JSON.stringify(trimmed));
        } catch (err) {
            console.warn('AuditLog.log failed:', err);
        }
    },

    /**
     * Get all audit entries.
     */
    getAll: async (): Promise<AuditEntry[]> => {
        try {
            const raw = await AsyncStorage.getItem(AUDIT_KEY);
            return raw ? JSON.parse(raw) : [];
        } catch {
            return [];
        }
    },

    /**
     * Get entries for a specific project.
     */
    getByProject: async (projectId: string): Promise<AuditEntry[]> => {
        const all = await AuditLog.getAll();
        return all.filter((e) => e.projectId === projectId);
    },

    /**
     * Get entries for a specific session.
     */
    getBySession: async (sessionId: string): Promise<AuditEntry[]> => {
        const all = await AuditLog.getAll();
        return all.filter((e) => e.sessionId === sessionId);
    },

    /**
     * Verify chain integrity — returns true if all prevHash values match.
     */
    verifyIntegrity: async (): Promise<{ valid: boolean; brokenAt?: number }> => {
        const entries = await AuditLog.getAll();
        for (let i = 1; i < entries.length; i++) {
            const expectedHash = simpleHash(JSON.stringify(entries[i - 1]));
            if (entries[i].prevHash !== expectedHash) {
                return { valid: false, brokenAt: i };
            }
        }
        return { valid: true };
    },

    /**
     * Export audit log as a JSON string for legal hold / compliance export.
     */
    exportJSON: async (): Promise<string> => {
        const entries = await AuditLog.getAll();
        return JSON.stringify(entries, null, 2);
    },

    /**
     * Clear audit log (admin only — should be gated by role).
     */
    clear: async (): Promise<void> => {
        await AsyncStorage.removeItem(AUDIT_KEY);
    },
};
