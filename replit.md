# FieldCapture Pro

## Overview
Offline-first construction field capture mobile app built with Expo React Native. Captures photos, videos, and audio notes organized by project and area, then sends data to an external n8n webhook for AI processing (transcription, task extraction, evidence linking).

## Architecture
- **Frontend**: Expo Router (file-based routing), Zustand state management, AsyncStorage persistence
- **Backend**: Express.js with MongoDB Atlas, AWS S3, JWT authentication
- **Database**: MongoDB Atlas (Mongoose ODM) with `fieldcapture` database
- **File Storage**: AWS S3 with presigned URLs for upload/download
- **Authentication**: JWT tokens (30-day expiry) with bcrypt password hashing
- **AI Processing**: External n8n webhook (no AI logic in the app)
- **Data**: Offline-first with AsyncStorage on mobile, syncs to MongoDB backend

## Backend Structure
- `server/db.ts` - MongoDB connection with retry logic
- `server/middleware/auth.ts` - JWT auth middleware + token generation
- `server/services/s3.ts` - AWS S3 presigned URL generation
- `server/models/` - Mongoose schemas (User, Project, Area, Media, AudioNote, Task, EvidenceLink, Session, TranscriptSegment)
- `server/routes/auth.ts` - POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
- `server/routes/projects.ts` - CRUD /api/projects, POST /api/projects/:id/areas
- `server/routes/tasks.ts` - CRUD /api/tasks, evidence links
- `server/routes/storage.ts` - POST /api/storage/upload-url, /download-url, /batch-upload-urls, /confirm-upload
- `server/routes/sync.ts` - POST /api/sync/batch, /trigger-webhook, GET /api/sync/status
- `server/routes/webhook.ts` - POST /api/webhook/n8n-callback (receives n8n results)

## Key Frontend Files
- `lib/types.ts` - All TypeScript interfaces
- `lib/storage.ts` - AsyncStorage CRUD helpers
- `lib/store.ts` - Zustand global state
- `lib/sync-service.ts` - Webhook sync logic
- `constants/colors.ts` - Dark luxury theme colors
- `app/(tabs)/` - Tab screens (Dashboard, Tasks, Settings)
- `app/capture.tsx` - Three capture modes
- `app/project/[id].tsx` - Project detail with media/tasks/sessions
- `app/session/[id].tsx` - Session review
- `app/task/[id].tsx` - Task detail with evidence linking

## Environment Variables & Secrets
- `MONGODB_URI` - MongoDB Atlas connection string (secret)
- `JWT_SECRET` - JWT signing key (secret)
- `AWS_ACCESS_KEY_ID` - AWS credentials (secret)
- `AWS_SECRET_ACCESS_KEY` - AWS credentials (secret)
- `AWS_REGION` - us-east-1 (env var)
- `AWS_BUCKET_NAME` - fieldnotes-bucket (env var)
- `N8N_WEBHOOK_URL` - n8n webhook endpoint (env var)

## Webhook Upload Format
- Multipart form-data with audio file as "file" field (using FileSystem.uploadAsync from expo-file-system/legacy)
- JSON metadata as "data" field containing: projectId, sessionId, area, sessionType, capturedAt, endedAt, mediaAssets, audioNotes
- Audio recordings are copied to permanent storage (documentDirectory/audio/) before upload

## Webhook Response Format (from n8n)
The n8n webhook responds with a JSON array containing:
- `transcriptSegments`: Array of `{segmentId, audioNoteId, time, text, confidence}`
- `tasks`: Array of `{taskId, title, description, status, priority, tags, confidence, source_audio_note_id, linkTranscriptSegmentIds}`
- `issues`: Array of `{title, description, severity}`
- `questions`: Array of `{text, context}`
- `changeOrderCandidates`: Array of `{title, description, confidence}`
- `dailyLog`: `{summaryBullets: string[], confidence}`
- `audit`: `{aiModel, pipelineVersion, processedAt}`

Status values from webhook ("Open", "Low") are normalized to lowercase. The response may be wrapped in an array.

## Design
- Purple-violet glassmorphism theme (#0D0816 bg, purple-violet gradients)
- Semi-transparent glass cards with rgba borders and gradient overlays
- LinearGradient backgrounds on all screens (gradientStart/gradientMid/gradientEnd)
- Accent gradient buttons (indigo to purple: #6366F1 -> #9333EA)
- Inter font family (400, 500, 600, 700)
- iOS 26 liquid glass tab bar support with BlurView fallback
- Color tokens in constants/colors.ts with glassBg, glassBorder, cardGlow values

## Recent Changes
- 2026-02-12: Full production backend with MongoDB Atlas, AWS S3, JWT auth, and all API routes
- 2026-02-12: Backend API routes: auth, projects, tasks, storage (S3 presigned URLs), sync, webhook callback
- 2026-02-12: Mongoose models for all data entities with proper indexing and JSON transforms
- 2026-02-12: Resilient MongoDB connection with retry logic (non-blocking server startup)
- 2026-02-11: Complete UI overhaul to purple-violet gradient glassmorphism theme across all screens and components
- 2026-02-07: Added full webhook response display (transcript, daily log, change orders, issues, questions, audit info)
- 2026-02-07: Fixed audio file upload - uses expo-file-system/legacy API and copies to permanent storage
- 2026-02-07: Normalized webhook status/priority values (case-insensitive)
- 2026-02-07: Fixed TaskCard crash on unknown status values
