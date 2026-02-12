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
} from './types';
import { generateId } from './generate-id';

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

  setCurrentProject: (id: string | null) => void;
  setCurrentArea: (id: string | null) => void;

  addProject: (name: string, address: string, clientName: string) => Promise<Project>;
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
    webhookUrl: 'https://n8n.srv1234562.hstgr.cloud/webhook/56de15fe-5286-4bda-880a-e67c5aa87aa4',
  },
  isLoading: true,

  login: (token, user) => {
    set({ authToken: token, currentUser: user });
  },

  logout: () => {
    set({ authToken: null, currentUser: null });
  },

  setAuth: (token, user) => {
    set({ authToken: token, currentUser: user });
  },

  loadAll: async () => {
    set({ isLoading: true });
    const [projects, areas, media, audioNotes, tasks, evidenceLinks, sessions, transcripts, settings] = await Promise.all([
      ProjectStorage.getAll(),
      AreaStorage.getAll(),
      MediaStorage.getAll(),
      AudioStorage.getAll(),
      TaskStorage.getAll(),
      EvidenceLinkStorage.getAll(),
      SessionStorage.getAll(),
      TranscriptStorage.getAll(),
      SettingsStorage.get(),
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
      isLoading: false,
    });
  },

  setCurrentProject: (id) => set({ currentProjectId: id }),
  setCurrentArea: (id) => set({ currentAreaId: id }),

  addProject: async (name, address, clientName) => {
    const now = Date.now();
    const project: Project = {
      id: generateId(),
      name,
      address,
      clientName,
      createdAt: now,
      updatedAt: now,
      mediaCount: 0,
      taskCount: 0,
      openTaskCount: 0,
    };
    await ProjectStorage.add(project);
    set((s) => ({ projects: [project, ...s.projects] }));

    const defaultAreas: { type: AreaType; label: string }[] = [
      { type: 'kitchen', label: 'Kitchen' },
      { type: 'bath', label: 'Bathroom' },
      { type: 'roof', label: 'Roof' },
      { type: 'exterior', label: 'Exterior' },
      { type: 'other', label: 'Other' },
    ];
    for (const a of defaultAreas) {
      const area: Area = { id: generateId(), projectId: project.id, type: a.type, label: a.label, createdAt: now };
      await AreaStorage.add(area);
      set((s) => ({ areas: [...s.areas, area] }));
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
