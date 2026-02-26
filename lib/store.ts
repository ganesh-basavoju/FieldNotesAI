import { create } from 'zustand';
import {
  ProjectStorage,
  AreaStorage,
  MediaStorage,
  AudioStorage,
  TaskStorage,
  EvidenceLinkStorage,
  SessionStorage,
  TranscriptStorage,
  SettingsStorage,
  AuthStorage,
  type AppSettings,
} from './storage';
import type {
  Project,
  Area,
  MediaAsset,
  AudioNote,
  TaskItem,
  EvidenceLink,
  CaptureSession,
  TranscriptSegment,
  AreaType,
  CaptureMode,
  TaskStatus,
  TaskPriority,
  SyncStatus,
  AuthUser,
  SessionType,
  MeetingMetadata,
  Participant,
  ConsentMethod,
} from './types';
import { generateId } from './generate-id';
import { AuditLog } from './audit-log';

interface AppState {
  authToken: string | null;
  currentUser: AuthUser | null;

  projects: Project[];
  currentProjectId: string | null;
  currentAreaId: string | null;
  areas: Area[];
  media: MediaAsset[];
  audioNotes: AudioNote[];
  tasks: TaskItem[];
  evidenceLinks: EvidenceLink[];
  sessions: CaptureSession[];
  transcripts: TranscriptSegment[];
  settings: AppSettings;
  isLoading: boolean;

  login: (token: string, user: AuthUser) => void;
  logout: () => void;
  setAuth: (token: string | null, user: AuthUser | null) => void;

  loadAll: () => Promise<void>;
  fetchFromServer: () => Promise<void>;

  setCurrentProject: (id: string | null) => void;
  setCurrentArea: (id: string | null) => void;

  addProject: (params: {
    name: string;
    jobId: string;
    mode: CaptureMode;
    scopes: string[];
    participants: Participant[];
    consentMethod: ConsentMethod;
    isOnline?: boolean;
  }) => Promise<Project>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;

  addArea: (projectId: string, type: AreaType, label: string) => Promise<Area>;

  addMedia: (asset: Omit<MediaAsset, 'id' | 'syncStatus'>) => Promise<MediaAsset>;
  updateMediaStatus: (id: string, status: SyncStatus) => Promise<void>;

  addAudioNote: (note: Omit<AudioNote, 'id' | 'syncStatus'>) => Promise<AudioNote>;
  updateAudioStatus: (id: string, status: SyncStatus) => Promise<void>;

  addTask: (task: Omit<TaskItem, 'id' | 'createdAt' | 'updatedAt'>) => Promise<TaskItem>;
  updateTask: (id: string, updates: Partial<TaskItem>) => Promise<void>;
  deleteTask: (id: string) => Promise<void>;

  addEvidenceLink: (link: Omit<EvidenceLink, 'id' | 'createdAt'>) => Promise<EvidenceLink>;
  removeEvidenceLink: (id: string) => Promise<void>;

  startSession: (
    projectId: string,
    areaId: string,
    areaType: AreaType,
    mode: CaptureMode,
    sessionType?: SessionType,
    meetingMetadata?: MeetingMetadata
  ) => Promise<CaptureSession>;
  endSession: (id: string) => Promise<void>;
  addMediaToSession: (sessionId: string, mediaId: string) => Promise<void>;
  addAudioToSession: (sessionId: string, audioId: string) => Promise<void>;

  addTranscripts: (segments: TranscriptSegment[]) => Promise<void>;

  updateSettings: (updates: Partial<AppSettings>) => Promise<void>;
}

export const useAppStore = create<AppState>((set, get) => ({
  authToken: null,
  currentUser: null,

  projects: [],
  currentProjectId: null,
  currentAreaId: null,
  areas: [],
  media: [],
  audioNotes: [],
  tasks: [],
  evidenceLinks: [],
  sessions: [],
  transcripts: [],
  settings: {
    wifiOnlyUpload: true,
    autoSync: true,
    webhookUrl: 'https://n8n.srv1234562.hstgr.cloud/webhook/c42e858c-d96e-4761-aebf-b364cf62a132',
    transcriptWebhookUrl: 'https://n8n.srv1234562.hstgr.cloud/webhook/transcript-upload-a1b2c3d4',
    aiJobWebhookUrl: 'https://n8n.srv1234562.hstgr.cloud/webhook/ai-job-chat',
    aiPortfolioWebhookUrl: 'https://n8n.srv1234562.hstgr.cloud/webhook/ai-portfolio-chat',
  },
  isLoading: true,

  login: (token, user) => {
    set({ authToken: token, currentUser: user });
    AuditLog.log('user_login', { method: 'token' }, { userId: user.id, userName: user.name });
    AuthStorage.set(token, user).catch(() => { });
  },

  logout: () => {
    set({ authToken: null, currentUser: null });
    AuthStorage.clear().catch(() => { });
  },

  setAuth: (token, user) => {
    set({ authToken: token, currentUser: user });
    if (token) {
      AuthStorage.set(token, user).catch(() => { });
    } else {
      AuthStorage.clear().catch(() => { });
    }
  },

  loadAll: async () => {
    set({ isLoading: true });
    const [projects, areas, media, audioNotes, tasks, evidenceLinks, sessions, transcripts, settings, savedAuth] = await Promise.all([
      ProjectStorage.getAll(),
      AreaStorage.getAll(),
      MediaStorage.getAll(),
      AudioStorage.getAll(),
      TaskStorage.getAll(),
      EvidenceLinkStorage.getAll(),
      SessionStorage.getAll(),
      TranscriptStorage.getAll(),
      SettingsStorage.get(),
      AuthStorage.get(),
    ]);
    set({
      projects: projects.sort((a, b) => b.updatedAt - a.updatedAt),
      areas,
      media,
      audioNotes,
      tasks,
      evidenceLinks,
      sessions,
      transcripts,
      settings,
      authToken: savedAuth?.token || null,
      currentUser: savedAuth?.user || null,
      isLoading: false,
    });

    // After loading local data, fetch from server if authenticated
    if (savedAuth?.token) {
      get().fetchFromServer().catch(() => { });
    }
  },

  fetchFromServer: async () => {
    const token = get().authToken;
    if (!token) return;

    try {
      const { apiRequest } = await import('./query-client');
      const res = await apiRequest('GET', '/api/fieldnotesai/projects');
      if (!res.ok) return;

      const data = await res.json();
      const serverProjects = data.projects || [];
      if (serverProjects.length === 0) return;

      const localProjects = get().projects;
      const localSessions = get().sessions;
      const localTasks = get().tasks;
      const localServerIds = new Set(localProjects.map(p => p.serverId).filter(Boolean));
      const localClientIds = new Set(localProjects.map(p => p.id));
      const localTaskIds = new Set(localTasks.map(t => t.id));

      let newProjects: Project[] = [];
      let newSessions: CaptureSession[] = [];
      let newTasks: TaskItem[] = [];
      let updatedProjectIds: string[] = [];

      for (const sp of serverProjects) {
        const spId = sp._id || sp.id;

        // ─── Find or create local project ───────────────────────
        let localProject = localProjects.find(p => p.serverId === spId || p.id === spId);

        if (localProject) {
          // Update existing local project with latest server data
          const updates: Partial<Project> = {
            webhookStatus: sp.webhookStatus || localProject.webhookStatus,
            taskCount: sp.taskCount ?? localProject.taskCount,
            openTaskCount: sp.openTaskCount ?? localProject.openTaskCount,
          };
          await ProjectStorage.update(localProject.id, updates);
          updatedProjectIds.push(localProject.id);
        } else if (!localClientIds.has(spId)) {
          // New project from server
          localProject = {
            id: spId,
            serverId: spId,
            name: sp.name || 'Unnamed Project',
            jobId: sp.jobId || '',
            mode: sp.mode || 'photo_video',
            scopes: sp.scopes || [],
            participants: sp.participants || [],
            consentMethod: sp.consentMethod || 'verbal',
            consentGiven: sp.consentGiven ?? true,
            webhookStatus: sp.webhookStatus || 'pending',
            createdAt: new Date(sp.createdAt).getTime(),
            updatedAt: new Date(sp.updatedAt || sp.createdAt).getTime(),
            mediaCount: sp.mediaCount || 0,
            taskCount: sp.taskCount || 0,
            openTaskCount: sp.openTaskCount || 0,
            syncStatus: 'synced',
          };
          newProjects.push(localProject);
          await ProjectStorage.add(localProject);
        }

        if (!localProject) continue;
        const projectId = localProject.id;

        // ─── Hydrate session from latestSession ──────────────────
        if (sp.latestSession) {
          const serverSession = sp.latestSession;
          const serverSessionId = serverSession._id?.toString();
          const clientSessionId = serverSession.metadata?.clientSessionId;

          // Find existing local session
          let existingSession = localSessions.find(s =>
            s.serverId === serverSessionId ||
            (clientSessionId && s.id === clientSessionId)
          );

          if (existingSession) {
            // Update existing session with server's processed data
            const sessionUpdates: Partial<CaptureSession> = {
              webhookStatus: serverSession.webhookStatus || existingSession.webhookStatus,
              webhookResult: serverSession.webhookResult || existingSession.webhookResult,
              serverId: serverSessionId || existingSession.serverId,
            };
            await SessionStorage.update(existingSession.id, sessionUpdates);
          } else {
            // Create new local session from server data
            const newSession: CaptureSession = {
              id: clientSessionId || serverSessionId || `server_${Date.now()}`,
              serverId: serverSessionId,
              projectId,
              areaId: '',
              areaType: (serverSession.areaType as AreaType) || 'general',
              mode: (serverSession.mode as CaptureMode) || 'voice_only',
              sessionType: 'walkthrough',
              startedAt: new Date(serverSession.startedAt).getTime(),
              endedAt: serverSession.endedAt ? new Date(serverSession.endedAt).getTime() : undefined,
              mediaIds: [],
              audioIds: [],
              webhookStatus: serverSession.webhookStatus || 'pending',
              webhookResult: serverSession.webhookResult || undefined,
            };
            newSessions.push(newSession);
            await SessionStorage.add(newSession);
          }
        }

        // ─── Hydrate tasks from server ───────────────────────────
        if (sp.tasks && Array.isArray(sp.tasks)) {
          for (const serverTask of sp.tasks) {
            const taskId = serverTask._id?.toString() || serverTask.id;
            if (localTaskIds.has(taskId)) continue;
            localTaskIds.add(taskId);

            const newTask: TaskItem = {
              id: taskId,
              projectId,
              areaId: serverTask.areaId || undefined,
              areaType: serverTask.areaType || undefined,
              title: serverTask.title || 'Untitled Task',
              description: serverTask.description || '',
              status: serverTask.status || 'open',
              priority: serverTask.priority || 'medium',
              dueDate: serverTask.dueDate ? new Date(serverTask.dueDate).getTime() : undefined,
              tags: serverTask.tags || [],
              createdAt: new Date(serverTask.createdAt || Date.now()).getTime(),
              updatedAt: new Date(serverTask.updatedAt || Date.now()).getTime(),
              createdBy: serverTask.createdBy || 'system',
              confidence: serverTask.confidence,
              suggestedAssignee: serverTask.suggestedAssignee,
            };
            newTasks.push(newTask);
            await TaskStorage.add(newTask);
          }
        }
      }

      // ─── Batch update store ────────────────────────────────────
      set((s) => {
        let projects = [...s.projects];

        // Update existing projects with server data
        if (updatedProjectIds.length > 0) {
          const serverMap = new Map(serverProjects.map((sp: any) => [sp._id || sp.id, sp]));
          projects = projects.map((p) => {
            const sp: any = serverMap.get(p.serverId) || serverMap.get(p.id);
            if (sp && updatedProjectIds.includes(p.id)) {
              return {
                ...p,
                webhookStatus: sp.webhookStatus || p.webhookStatus,
                taskCount: sp.taskCount ?? p.taskCount,
                openTaskCount: sp.openTaskCount ?? p.openTaskCount,
              };
            }
            return p;
          });
        }

        // Add new projects
        if (newProjects.length > 0) {
          projects = [...newProjects, ...projects];
        }

        // Update sessions — merge new + update existing
        let sessions = [...s.sessions];
        if (newSessions.length > 0) {
          sessions = [...newSessions, ...sessions];
        }
        // Update existing sessions with server webhook results
        for (const sp of serverProjects) {
          if (!sp.latestSession?.webhookResult) continue;
          const serverSessionId = sp.latestSession._id?.toString();
          const clientSessionId = sp.latestSession.metadata?.clientSessionId;
          sessions = sessions.map((sess) => {
            if (sess.serverId === serverSessionId || (clientSessionId && sess.id === clientSessionId)) {
              return {
                ...sess,
                webhookStatus: sp.latestSession.webhookStatus || sess.webhookStatus,
                webhookResult: sp.latestSession.webhookResult || sess.webhookResult,
                serverId: serverSessionId || sess.serverId,
              };
            }
            return sess;
          });
        }

        return {
          projects: projects.sort((a, b) => b.updatedAt - a.updatedAt),
          sessions,
          tasks: newTasks.length > 0 ? [...newTasks, ...s.tasks] : s.tasks,
        };
      });
    } catch (err) {
      console.warn('[Store] fetchFromServer failed:', err);
    }
  },

  setCurrentProject: (id) => set({ currentProjectId: id }),
  setCurrentArea: (id) => set({ currentAreaId: id }),

  addProject: async ({ name, jobId, mode, scopes, participants, consentMethod, isOnline: online }) => {
    const now = Date.now();
    const project: Project = {
      id: generateId(),
      name,
      jobId,
      mode,
      scopes,
      participants,
      consentMethod,
      consentGiven: true,
      webhookStatus: 'pending',
      createdAt: now,
      updatedAt: now,
      mediaCount: 0,
      taskCount: 0,
      openTaskCount: 0,
      syncStatus: 'local',
    };

    // Save locally first (always works, even offline)
    await ProjectStorage.add(project);
    set((s) => ({ projects: [project, ...s.projects] }));

    // Audit log: project created
    const user = get().currentUser;
    AuditLog.log('project_created', { name, jobId, mode, consentMethod }, {
      userId: user?.id, userName: user?.name, projectId: project.id,
    });
    AuditLog.log('consent_confirmed', { method: consentMethod, given: true }, {
      userId: user?.id, userName: user?.name, projectId: project.id,
    });

    // Create an area from the first scope for session linking
    const areaType = (scopes[0] || 'other') as AreaType;
    const area: Area = { id: generateId(), projectId: project.id, type: areaType, label: scopes[0] || 'General', createdAt: now };
    await AreaStorage.add(area);
    set((s) => ({ areas: [...s.areas, area] }));

    // If online and authenticated, sync to backend immediately
    const token = get().authToken;
    if (online && token) {
      try {
        const { apiRequest } = await import('./query-client');
        const res = await apiRequest('POST', '/api/fieldnotesai/projects', {
          name, jobId, mode, scopes, participants, consentMethod,
        });
        if (res.ok) {
          const data = await res.json();
          const serverId = data.project?._id || data.project?.id;
          project.syncStatus = 'synced';
          project.serverId = serverId;
          await ProjectStorage.update(project.id, { syncStatus: 'synced', serverId });
          set((s) => ({
            projects: s.projects.map((p) =>
              p.id === project.id ? { ...p, syncStatus: 'synced', serverId } : p
            ),
          }));
        } else {
          // Backend failed — mark for later sync
          project.syncStatus = 'pending_sync';
          await ProjectStorage.update(project.id, { syncStatus: 'pending_sync' });
          set((s) => ({
            projects: s.projects.map((p) =>
              p.id === project.id ? { ...p, syncStatus: 'pending_sync' } : p
            ),
          }));
        }
      } catch {
        // Network error — mark for later sync
        project.syncStatus = 'pending_sync';
        await ProjectStorage.update(project.id, { syncStatus: 'pending_sync' });
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === project.id ? { ...p, syncStatus: 'pending_sync' } : p
          ),
        }));
      }
    } else if (token) {
      // Authenticated but offline — queue for sync
      project.syncStatus = 'pending_sync';
      await ProjectStorage.update(project.id, { syncStatus: 'pending_sync' });
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === project.id ? { ...p, syncStatus: 'pending_sync' } : p
        ),
      }));
    }

    return project;
  },

  updateProject: async (id, updates) => {
    await ProjectStorage.update(id, { ...updates, updatedAt: Date.now() });
    set((s) => ({
      projects: s.projects.map((p) => (p.id === id ? { ...p, ...updates, updatedAt: Date.now() } : p)),
    }));
  },

  deleteProject: async (id) => {
    await ProjectStorage.remove(id);
    set((s) => ({ projects: s.projects.filter((p) => p.id !== id) }));
  },

  addArea: async (projectId, type, label) => {
    const area: Area = { id: generateId(), projectId, type, label, createdAt: Date.now() };
    await AreaStorage.add(area);
    set((s) => ({ areas: [...s.areas, area] }));
    return area;
  },

  addMedia: async (asset) => {
    const media: MediaAsset = { ...asset, id: generateId(), syncStatus: 'captured' };
    await MediaStorage.add(media);
    set((s) => ({ media: [...s.media, media] }));
    const project = get().projects.find((p) => p.id === media.projectId);
    if (project) {
      await ProjectStorage.update(project.id, { mediaCount: (project.mediaCount || 0) + 1, updatedAt: Date.now() });
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === project.id ? { ...p, mediaCount: (p.mediaCount || 0) + 1, updatedAt: Date.now() } : p
        ),
      }));
    }
    return media;
  },

  updateMediaStatus: async (id, status) => {
    await MediaStorage.update(id, { syncStatus: status });
    set((s) => ({ media: s.media.map((m) => (m.id === id ? { ...m, syncStatus: status } : m)) }));
  },

  addAudioNote: async (note) => {
    const audio: AudioNote = { ...note, id: generateId(), syncStatus: 'captured' };
    await AudioStorage.add(audio);
    set((s) => ({ audioNotes: [...s.audioNotes, audio] }));
    return audio;
  },

  updateAudioStatus: async (id, status) => {
    await AudioStorage.update(id, { syncStatus: status });
    set((s) => ({ audioNotes: s.audioNotes.map((a) => (a.id === id ? { ...a, syncStatus: status } : a)) }));
  },

  addTask: async (task) => {
    const now = Date.now();
    const newTask: TaskItem = { ...task, id: generateId(), createdAt: now, updatedAt: now };
    await TaskStorage.add(newTask);
    set((s) => ({ tasks: [...s.tasks, newTask] }));
    const project = get().projects.find((p) => p.id === newTask.projectId);
    if (project) {
      const openCount = newTask.status === 'open' || newTask.status === 'in_progress' ? 1 : 0;
      await ProjectStorage.update(project.id, {
        taskCount: (project.taskCount || 0) + 1,
        openTaskCount: (project.openTaskCount || 0) + openCount,
        updatedAt: now,
      });
      set((s) => ({
        projects: s.projects.map((p) =>
          p.id === project.id
            ? { ...p, taskCount: (p.taskCount || 0) + 1, openTaskCount: (p.openTaskCount || 0) + openCount, updatedAt: now }
            : p
        ),
      }));
    }
    return newTask;
  },

  updateTask: async (id, updates) => {
    const now = Date.now();
    await TaskStorage.update(id, { ...updates, updatedAt: now });
    set((s) => ({
      tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: now } : t)),
    }));
  },

  deleteTask: async (id) => {
    await TaskStorage.remove(id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
  },

  addEvidenceLink: async (link) => {
    const newLink: EvidenceLink = { ...link, id: generateId(), createdAt: Date.now() };
    await EvidenceLinkStorage.add(newLink);
    set((s) => ({ evidenceLinks: [...s.evidenceLinks, newLink] }));
    return newLink;
  },

  removeEvidenceLink: async (id) => {
    await EvidenceLinkStorage.remove(id);
    set((s) => ({ evidenceLinks: s.evidenceLinks.filter((l) => l.id !== id) }));
  },

  startSession: async (projectId, areaId, areaType, mode, sessionType = 'walkthrough', meetingMetadata) => {
    const session: CaptureSession = {
      id: generateId(),
      projectId,
      areaId,
      areaType,
      mode,
      sessionType,
      startedAt: Date.now(),
      mediaIds: [],
      audioIds: [],
      webhookStatus: 'pending',
      meetingMetadata,
      approvalStatus: sessionType === 'meeting' ? 'pending' : undefined,
    };
    await SessionStorage.add(session);
    set((s) => ({ sessions: [...s.sessions, session] }));

    // Sync session to server
    const token = get().authToken;
    if (token) {
      try {
        const { apiRequest } = await import('./query-client');
        const project = get().projects.find((p) => p.id === projectId);
        const serverProjectId = project?.serverId || projectId;
        const res = await apiRequest('POST', '/api/fieldnotesai/sessions', {
          clientSessionId: session.id,
          projectId: serverProjectId,
          areaType,
          mode,
          sessionType,
          meetingMetadata,
        });
        if (res.ok) {
          const serverRes = await res.json();
          const serverId = serverRes.session?.id || serverRes.session?._id;
          if (serverId) {
            await SessionStorage.update(session.id, { serverId });
            set((s) => ({
              sessions: s.sessions.map((sess) =>
                sess.id === session.id ? { ...sess, serverId } : sess
              ),
            }));
          }
        }
      } catch (err) {
        console.warn('[Store] Session sync to server failed:', err);
      }
    }

    return session;
  },

  endSession: async (id) => {
    await SessionStorage.update(id, { endedAt: Date.now() });
    set((s) => ({
      sessions: s.sessions.map((ses) => (ses.id === id ? { ...ses, endedAt: Date.now() } : ses)),
    }));
  },

  addMediaToSession: async (sessionId, mediaId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const mediaIds = [...session.mediaIds, mediaId];
    await SessionStorage.update(sessionId, { mediaIds });
    set((s) => ({
      sessions: s.sessions.map((ses) => (ses.id === sessionId ? { ...ses, mediaIds } : ses)),
    }));
  },

  addAudioToSession: async (sessionId, audioId) => {
    const session = get().sessions.find((s) => s.id === sessionId);
    if (!session) return;
    const audioIds = [...session.audioIds, audioId];
    await SessionStorage.update(sessionId, { audioIds });
    set((s) => ({
      sessions: s.sessions.map((ses) => (ses.id === sessionId ? { ...ses, audioIds } : ses)),
    }));
  },

  addTranscripts: async (segments) => {
    await TranscriptStorage.addBatch(segments);
    set((s) => ({ transcripts: [...s.transcripts, ...segments] }));
  },

  updateSettings: async (updates) => {
    await SettingsStorage.set(updates);
    set((s) => ({ settings: { ...s.settings, ...updates } }));
  },
}));
