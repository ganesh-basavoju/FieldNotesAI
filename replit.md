# FieldCapture Pro

## Overview
Offline-first construction field capture mobile app built with Expo React Native. Captures photos, videos, and audio notes organized by project and area, then sends data to an external n8n webhook for AI processing (transcription, task extraction, evidence linking).

## Architecture
- **Frontend**: Expo Router (file-based routing), Zustand state management, AsyncStorage persistence
- **Backend**: Express.js serving static landing page and API
- **AI Processing**: External n8n webhook (no AI logic in the app)
- **Data**: Offline-first with AsyncStorage, sync queue for webhook delivery

## Key Files
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
- 2026-02-11: Complete UI overhaul to purple-violet gradient glassmorphism theme across all screens and components
- 2026-02-07: Added full webhook response display (transcript, daily log, change orders, issues, questions, audit info)
- 2026-02-07: Fixed audio file upload - uses expo-file-system/legacy API and copies to permanent storage
- 2026-02-07: Normalized webhook status/priority values (case-insensitive)
- 2026-02-07: Fixed TaskCard crash on unknown status values
