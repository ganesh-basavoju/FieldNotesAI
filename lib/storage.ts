import AsyncStorage from '@react-native-async-storage/async-storage';
import type {
  Project,
  Area,
  MediaAsset,
  AudioNote,
  TranscriptSegment,
  TaskItem,
  EvidenceLink,
  CaptureSession,
  SyncQueueItem,
} from './types';

const KEYS = {
  PROJECTS: 'fc_projects',
  AREAS: 'fc_areas',
  MEDIA: 'fc_media',
  AUDIO: 'fc_audio',
  TRANSCRIPTS: 'fc_transcripts',
  TASKS: 'fc_tasks',
  EVIDENCE_LINKS: 'fc_evidence_links',
  SESSIONS: 'fc_sessions',
  SYNC_QUEUE: 'fc_sync_queue',
  SETTINGS: 'fc_settings',
} as const;

async function getList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

async function setList<T>(key: string, items: T[]): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(items));
}

async function addItem<T extends { id: string }>(key: string, item: T): Promise<void> {
  const items = await getList<T>(key);
  items.push(item);
  await setList(key, items);
}

async function updateItem<T extends { id: string }>(key: string, id: string, updates: Partial<T>): Promise<T | null> {
  const items = await getList<T>(key);
  const idx = items.findIndex((i) => i.id === id);
  if (idx === -1) return null;
  items[idx] = { ...items[idx], ...updates };
  await setList(key, items);
  return items[idx];
}

async function removeItem<T extends { id: string }>(key: string, id: string): Promise<void> {
  const items = await getList<T>(key);
  await setList(key, items.filter((i) => i.id !== id));
}

export const ProjectStorage = {
  getAll: () => getList<Project>(KEYS.PROJECTS),
  add: (p: Project) => addItem(KEYS.PROJECTS, p),
  update: (id: string, u: Partial<Project>) => updateItem<Project>(KEYS.PROJECTS, id, u),
  remove: (id: string) => removeItem<Project>(KEYS.PROJECTS, id),
};

export const AreaStorage = {
  getAll: () => getList<Area>(KEYS.AREAS),
  getByProject: async (projectId: string) => {
    const all = await getList<Area>(KEYS.AREAS);
    return all.filter((a) => a.projectId === projectId);
  },
  add: (a: Area) => addItem(KEYS.AREAS, a),
  remove: (id: string) => removeItem<Area>(KEYS.AREAS, id),
};

export const MediaStorage = {
  getAll: () => getList<MediaAsset>(KEYS.MEDIA),
  getByProject: async (projectId: string) => {
    const all = await getList<MediaAsset>(KEYS.MEDIA);
    return all.filter((m) => m.projectId === projectId);
  },
  getBySession: async (sessionId: string) => {
    const all = await getList<MediaAsset>(KEYS.MEDIA);
    return all.filter((m) => m.sessionId === sessionId);
  },
  add: (m: MediaAsset) => addItem(KEYS.MEDIA, m),
  update: (id: string, u: Partial<MediaAsset>) => updateItem<MediaAsset>(KEYS.MEDIA, id, u),
  remove: (id: string) => removeItem<MediaAsset>(KEYS.MEDIA, id),
};

export const AudioStorage = {
  getAll: () => getList<AudioNote>(KEYS.AUDIO),
  getByProject: async (projectId: string) => {
    const all = await getList<AudioNote>(KEYS.AUDIO);
    return all.filter((a) => a.projectId === projectId);
  },
  getBySession: async (sessionId: string) => {
    const all = await getList<AudioNote>(KEYS.AUDIO);
    return all.filter((a) => a.sessionId === sessionId);
  },
  add: (a: AudioNote) => addItem(KEYS.AUDIO, a),
  update: (id: string, u: Partial<AudioNote>) => updateItem<AudioNote>(KEYS.AUDIO, id, u),
  remove: (id: string) => removeItem<AudioNote>(KEYS.AUDIO, id),
};

export const TranscriptStorage = {
  getAll: () => getList<TranscriptSegment>(KEYS.TRANSCRIPTS),
  getByAudio: async (audioNoteId: string) => {
    const all = await getList<TranscriptSegment>(KEYS.TRANSCRIPTS);
    return all.filter((t) => t.audioNoteId === audioNoteId);
  },
  addBatch: async (segments: TranscriptSegment[]) => {
    const existing = await getList<TranscriptSegment>(KEYS.TRANSCRIPTS);
    await setList(KEYS.TRANSCRIPTS, [...existing, ...segments]);
  },
  remove: (id: string) => removeItem<TranscriptSegment>(KEYS.TRANSCRIPTS, id),
};

export const TaskStorage = {
  getAll: () => getList<TaskItem>(KEYS.TASKS),
  getByProject: async (projectId: string) => {
    const all = await getList<TaskItem>(KEYS.TASKS);
    return all.filter((t) => t.projectId === projectId);
  },
  add: (t: TaskItem) => addItem(KEYS.TASKS, t),
  addBatch: async (tasks: TaskItem[]) => {
    const existing = await getList<TaskItem>(KEYS.TASKS);
    await setList(KEYS.TASKS, [...existing, ...tasks]);
  },
  update: (id: string, u: Partial<TaskItem>) => updateItem<TaskItem>(KEYS.TASKS, id, u),
  remove: (id: string) => removeItem<TaskItem>(KEYS.TASKS, id),
};

export const EvidenceLinkStorage = {
  getAll: () => getList<EvidenceLink>(KEYS.EVIDENCE_LINKS),
  getByTask: async (taskId: string) => {
    const all = await getList<EvidenceLink>(KEYS.EVIDENCE_LINKS);
    return all.filter((l) => l.taskId === taskId);
  },
  add: (l: EvidenceLink) => addItem(KEYS.EVIDENCE_LINKS, l),
  addBatch: async (links: EvidenceLink[]) => {
    const existing = await getList<EvidenceLink>(KEYS.EVIDENCE_LINKS);
    await setList(KEYS.EVIDENCE_LINKS, [...existing, ...links]);
  },
  remove: (id: string) => removeItem<EvidenceLink>(KEYS.EVIDENCE_LINKS, id),
};

export const SessionStorage = {
  getAll: () => getList<CaptureSession>(KEYS.SESSIONS),
  getByProject: async (projectId: string) => {
    const all = await getList<CaptureSession>(KEYS.SESSIONS);
    return all.filter((s) => s.projectId === projectId);
  },
  add: (s: CaptureSession) => addItem(KEYS.SESSIONS, s),
  update: (id: string, u: Partial<CaptureSession>) => updateItem<CaptureSession>(KEYS.SESSIONS, id, u),
};

export const SyncQueueStorage = {
  getAll: () => getList<SyncQueueItem>(KEYS.SYNC_QUEUE),
  add: (item: SyncQueueItem) => addItem(KEYS.SYNC_QUEUE, item),
  update: (id: string, u: Partial<SyncQueueItem>) => updateItem<SyncQueueItem>(KEYS.SYNC_QUEUE, id, u),
  remove: (id: string) => removeItem<SyncQueueItem>(KEYS.SYNC_QUEUE, id),
};

export interface AppSettings {
  wifiOnlyUpload: boolean;
  autoSync: boolean;
  webhookUrl: string;
}

const DEFAULT_SETTINGS: AppSettings = {
  wifiOnlyUpload: true,
  autoSync: true,
  webhookUrl: 'https://n8n.srv1234562.hstgr.cloud/webhook/56de15fe-5286-4bda-880a-e67c5aa87aa4',
};

export const SettingsStorage = {
  get: async (): Promise<AppSettings> => {
    try {
      const raw = await AsyncStorage.getItem(KEYS.SETTINGS);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed.webhookUrl && parsed.webhookUrl.includes('webhook-test')) {
          parsed.webhookUrl = DEFAULT_SETTINGS.webhookUrl;
          await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify({ ...DEFAULT_SETTINGS, ...parsed }));
        }
        return { ...DEFAULT_SETTINGS, ...parsed };
      }
      return DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  },
  set: async (settings: Partial<AppSettings>) => {
    const current = await SettingsStorage.get();
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify({ ...current, ...settings }));
  },
};
