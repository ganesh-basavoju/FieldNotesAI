import * as Network from 'expo-network';
import { useEffect, useState } from 'react';
import { useAppStore } from './store';
import { ProjectStorage, AreaStorage, SessionStorage } from './storage';
import { apiRequest } from './query-client';
import type { Project, Area, CaptureSession } from './types';

/**
 * Hook that tracks network connectivity state.
 * Returns { isConnected, isInternetReachable }.
 */
export function useNetworkStatus() {
    const [status, setStatus] = useState({ isConnected: true, isInternetReachable: true });

    useEffect(() => {
        // Get initial state
        Network.getNetworkStateAsync().then((state) => {
            setStatus({
                isConnected: state.isConnected ?? false,
                isInternetReachable: state.isInternetReachable ?? false,
            });
        }).catch(() => { });

        // Subscribe to changes
        const sub = Network.addNetworkStateListener((state) => {
            setStatus({
                isConnected: state.isConnected ?? false,
                isInternetReachable: state.isInternetReachable ?? false,
            });
        });

        return () => sub.remove();
    }, []);

    return status;
}

/**
 * Check current network connectivity (one-shot, non-hook).
 */
export async function isOnline(): Promise<boolean> {
    try {
        const state = await Network.getNetworkStateAsync();
        return !!(state.isConnected && state.isInternetReachable);
    } catch {
        return false;
    }
}

/**
 * Sync all pending-sync projects to the backend.
 * Called automatically when connectivity is restored.
 */
export async function syncPendingProjects(): Promise<number> {
    const store = useAppStore.getState();
    const token = store.authToken;
    if (!token) return 0;

    const allProjects = await ProjectStorage.getAll();
    const pendingProjects = allProjects.filter((p) => p.syncStatus === 'pending_sync');

    if (pendingProjects.length === 0) return 0;

    let synced = 0;

    for (const project of pendingProjects) {
        try {
            const res = await apiRequest('POST', '/api/fieldnotesai/projects', {
                name: project.name,
                jobId: project.jobId,
                mode: project.mode,
                scopes: project.scopes,
                participants: project.participants,
                consentMethod: project.consentMethod,
                address: project.address,
                clientName: project.clientName,
            });

            if (res.ok) {
                const data = await res.json();
                // Update local project with server ID and mark as synced
                await ProjectStorage.update(project.id, {
                    syncStatus: 'synced' as any,
                    serverId: data.project?._id || data.project?.id,
                });

                // Update in-memory store
                useAppStore.setState((s) => ({
                    projects: s.projects.map((p) =>
                        p.id === project.id
                            ? { ...p, syncStatus: 'synced' as any, serverId: data.project?._id || data.project?.id }
                            : p
                    ),
                }));

                synced++;
            }
        } catch (err) {
            console.warn(`[OfflineSync] Failed to sync project ${project.id}:`, err);
            // Will retry on next connectivity change
        }
    }

    if (synced > 0) {
        console.log(`[OfflineSync] Synced ${synced}/${pendingProjects.length} pending projects`);
    }

    return synced;
}

/**
 * Sync all pending sessions to the backend.
 */
export async function syncPendingSessions(): Promise<number> {
    const store = useAppStore.getState();
    const token = store.authToken;
    if (!token) return 0;

    const allSessions = await SessionStorage.getAll();
    const pendingSessions = allSessions.filter((s) => (s as any).syncStatus === 'pending_sync');

    if (pendingSessions.length === 0) return 0;

    let synced = 0;

    for (const session of pendingSessions) {
        try {
            const res = await apiRequest('POST', '/api/fieldnotesai/sessions', {
                projectId: session.projectId,
                areaId: session.areaId,
                areaType: session.areaType,
                mode: session.mode,
                sessionType: session.sessionType,
                meetingMetadata: session.meetingMetadata,
            });

            if (res.ok) {
                await SessionStorage.update(session.id, { syncStatus: 'synced' } as any);

                useAppStore.setState((s) => ({
                    sessions: s.sessions.map((ses) =>
                        ses.id === session.id ? { ...ses, syncStatus: 'synced' } as any : ses
                    ),
                }));

                synced++;
            }
        } catch (err) {
            console.warn(`[OfflineSync] Failed to sync session ${session.id}:`, err);
        }
    }

    return synced;
}

/**
 * Run all pending sync operations.
 */
export async function runPendingSync(): Promise<void> {
    try {
        const online = await isOnline();
        if (!online) return;

        const store = useAppStore.getState();
        if (!store.authToken) return;

        const projectsSynced = await syncPendingProjects();
        const sessionsSynced = await syncPendingSessions();

        if (projectsSynced > 0 || sessionsSynced > 0) {
            console.log(`[OfflineSync] Sync complete: ${projectsSynced} projects, ${sessionsSynced} sessions`);
        }
    } catch (err) {
        console.warn('[OfflineSync] Sync run failed:', err);
    }
}
