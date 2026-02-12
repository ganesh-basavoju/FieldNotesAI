export type SyncStatus = 'captured' | 'syncing' | 'uploaded' | 'failed';

export type CaptureMode = 'photo_speak' | 'walkthrough' | 'voice_only';

export type SessionType = 'walkthrough' | 'meeting';

export type MeetingType = 'scope' | 'schedule' | 'material' | 'vendor' | 'internal';

export type ParticipantRole = 'pm' | 'sub' | 'owner' | 'vendor' | 'internal';

export type ConsentMethod = 'verbal' | 'written' | 'contract';

export type ApprovalStatus = 'pending' | 'approved' | 'rejected';

export type TaskStatus = 'open' | 'in_progress' | 'blocked' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high';

export type LinkType = 'strong' | 'suggested' | 'possible';

export type LinkCreator = 'system' | 'user';

export type AreaType = 'kitchen' | 'bath' | 'roof' | 'exterior' | 'garage' | 'basement' | 'bedroom' | 'living_room' | 'other';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  company?: string;
}

export interface Participant {
  name: string;
  role: ParticipantRole;
  email?: string;
}

export interface ConsentRecord {
  obtainedAt: number;
  method: ConsentMethod;
  confirmedByUserId: string;
}

export interface MeetingMetadata {
  meetingType: MeetingType;
  participants: Participant[];
  consentGiven: boolean;
  consentMethod: ConsentMethod;
  consentTimestamp: number;
}

export interface Project {
  id: string;
  name: string;
  address: string;
  clientName: string;
  createdAt: number;
  updatedAt: number;
  mediaCount: number;
  taskCount: number;
  openTaskCount: number;
}

export interface Area {
  id: string;
  projectId: string;
  type: AreaType;
  label: string;
  createdAt: number;
}

export interface MediaAsset {
  id: string;
  projectId: string;
  areaId: string;
  areaType: AreaType;
  type: 'photo' | 'video';
  uri: string;
  thumbnailUri?: string;
  capturedAt: number;
  syncStatus: SyncStatus;
  sessionId?: string;
  width?: number;
  height?: number;
  metadata?: Record<string, unknown>;
}

export interface AudioNote {
  id: string;
  projectId: string;
  areaId: string;
  areaType: AreaType;
  uri: string;
  durationMs: number;
  capturedAt: number;
  syncStatus: SyncStatus;
  sessionId?: string;
  linkedMediaId?: string;
  transcript?: string;
}

export interface TranscriptSegment {
  id: string;
  audioNoteId: string;
  projectId: string;
  text: string;
  startMs: number;
  endMs: number;
  speakerRole?: string;
  confidence: number;
}

export interface TaskItem {
  id: string;
  projectId: string;
  areaId?: string;
  areaType?: AreaType;
  title: string;
  description: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate?: number;
  tags: string[];
  createdAt: number;
  updatedAt: number;
  createdBy: LinkCreator;
  confidence?: number;
}

export interface EvidenceLink {
  id: string;
  taskId: string;
  targetType: 'media' | 'audio' | 'transcript';
  targetId: string;
  linkType: LinkType;
  linkScore: number;
  createdBy: LinkCreator;
  createdAt: number;
}

export interface CaptureSession {
  id: string;
  projectId: string;
  areaId: string;
  areaType: AreaType;
  mode: CaptureMode;
  sessionType: SessionType;
  startedAt: number;
  endedAt?: number;
  mediaIds: string[];
  audioIds: string[];
  webhookStatus: 'pending' | 'sent' | 'received' | 'failed';
  webhookResult?: WebhookResult;
  meetingMetadata?: MeetingMetadata;
  approvalStatus?: ApprovalStatus;
  approvedAt?: number;
  approvedBy?: string;
}

export interface WebhookIssue {
  title: string;
  description: string;
  severity?: string;
  sourceAudioNoteId?: string;
  sourceTranscriptSegmentIds?: string[];
  confidence?: number;
}

export interface WebhookQuestion {
  text: string;
  context?: string;
  sourceAudioNoteId?: string;
  sourceTranscriptSegmentIds?: string[];
  confidence?: number;
}

export interface WebhookChangeOrder {
  title: string;
  description: string;
  sourceAudioNoteId?: string;
  sourceTranscriptSegmentIds?: string[];
  linkMediaAssetIds?: string[];
  confidence?: number;
}

export interface WebhookDailyLog {
  summaryBullets: string[];
  confidence?: number;
}

export interface WebhookAudit {
  aiModel?: string;
  pipelineVersion?: string;
  processedAt?: string;
}

export interface WebhookResult {
  transcriptSegments?: TranscriptSegment[];
  tasks?: TaskItem[];
  evidenceLinks?: EvidenceLink[];
  issues?: WebhookIssue[];
  questions?: WebhookQuestion[];
  changeOrderCandidates?: WebhookChangeOrder[];
  dailyLog?: WebhookDailyLog;
  audit?: WebhookAudit;
  processedAt: number;
}

export interface SyncQueueItem {
  id: string;
  type: 'media' | 'audio' | 'webhook';
  targetId: string;
  attempts: number;
  lastAttemptAt?: number;
  error?: string;
  createdAt: number;
}
