# FieldCapture Pro

Offline-first construction field capture mobile app built with Expo React Native. Captures photos, videos, and audio notes organized by project and area, then sends data to an external n8n webhook for AI processing.

## Features

- **Photo + Speak**: Take photos with attached voice notes
- **Walkthrough Mode**: Continuous audio with rapid photo captures
- **Voice-Only**: Audio recording mode
- **Site Meeting Mode**: Formal recorded meetings with participant consent tracking
- **Offline-First**: Works without internet, syncs when connected
- **AI Processing**: Transcription, task extraction, evidence linking via n8n

## Tech Stack

- **Frontend**: React Native (Expo SDK 54), Expo Router, Zustand, AsyncStorage
- **Backend**: Node.js, Express.js, TypeScript
- **Database**: MongoDB Atlas (Mongoose ODM)
- **File Storage**: AWS S3 (presigned URLs)
- **Auth**: JWT tokens with bcrypt password hashing
- **AI Pipeline**: External n8n webhook

---

## Local Development Setup

### Prerequisites

- **Node.js** 18+ (recommended: 20.x)
- **npm** or **yarn**
- **Expo Go** app on your phone (for mobile testing)
- **MongoDB Atlas** account (free tier works)
- **AWS S3** bucket (for file storage)

### 1. Clone the Repository

```bash
git clone https://github.com/YOUR_USERNAME/fieldcapture-pro.git
cd fieldcapture-pro
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Create Your Environment File

Copy the example environment file and fill in your values:

```bash
cp .env.example .env
```

**IMPORTANT**: The `.env` file is already in `.gitignore` - it will NEVER be committed to GitHub. This prevents secret leaks.

### 4. Configure Environment Variables

Open `.env` in your editor and fill in each value:

```env
# MongoDB Atlas connection string
# Get from: https://cloud.mongodb.com > Database > Connect > Drivers
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/fieldcapture?retryWrites=true&w=majority

# JWT secret for authentication (generate a random string)
# Run: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_random_secret_here

# AWS S3 credentials
# Get from: AWS Console > IAM > Users > Security Credentials
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=your-bucket-name

# N8N Webhook URL (for AI processing)
N8N_WEBHOOK_URL=https://your-n8n-instance/webhook/your-webhook-id

# Express session secret
SESSION_SECRET=another_random_secret
```

### 5. Start the Backend Server

```bash
npm run server:dev
```

The backend runs on **http://localhost:5000**

### 6. Start the Expo Frontend

In a separate terminal:

```bash
npm run start
```

This starts the Expo dev server. You can then:
- Press `w` to open in web browser
- Scan the QR code with Expo Go on your phone
- Press `i` for iOS simulator (requires Xcode on Mac)
- Press `a` for Android emulator

### 7. Test the API

```bash
# Health check
curl http://localhost:5000/api/health

# Register a user
curl -X POST http://localhost:5000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Test User","email":"test@example.com","password":"password123"}'
```

---

## Environment File Location

```
fieldcapture-pro/
  .env              <-- YOUR secrets (never committed)
  .env.example      <-- Template with key names (committed)
  .gitignore        <-- Lists .env to prevent commits
  package.json
  server/
  app/
  lib/
  ...
```

### Where to Create `.env`

Place the `.env` file in the **project root directory** (same level as `package.json`). The backend server automatically loads it.

### Security Rules

1. **NEVER** commit `.env` to git - it contains your secrets
2. **ALWAYS** use `.env.example` as the template (this IS committed)
3. **NEVER** share your `.env` file with anyone
4. If you suspect secrets were leaked, rotate them immediately

---

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm run server:dev` | Start backend server (development) |
| `npm run start` | Start Expo dev server |
| `npm run server:build` | Build backend for production |
| `npm run server:prod` | Run production backend |
| `npm run lint` | Run ESLint |

---

## API Endpoints

### Auth
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `GET /api/auth/me` - Get current user (requires auth)

### Projects
- `GET /api/projects` - List projects
- `POST /api/projects` - Create project
- `POST /api/projects/:id/areas` - Add area to project

### Tasks
- `GET /api/tasks` - List tasks
- `POST /api/tasks` - Create task
- `PUT /api/tasks/:id` - Update task

### Sessions
- `GET /api/sessions` - List sessions
- `POST /api/sessions` - Create session
- `PUT /api/sessions/:id/end` - End session
- `POST /api/sessions/:id/approve` - Approve meeting session
- `POST /api/sessions/:id/dispatch` - Dispatch meeting notes

### Storage (S3)
- `POST /api/storage/upload-url` - Get presigned upload URL
- `POST /api/storage/download-url` - Get presigned download URL
- `POST /api/storage/batch-upload-urls` - Get batch upload URLs
- `POST /api/storage/confirm-upload` - Confirm upload complete

### Sync
- `POST /api/sync/batch` - Batch sync data
- `POST /api/sync/trigger-webhook` - Trigger n8n webhook
- `GET /api/sync/status` - Get sync status

### Webhook
- `POST /api/webhook/n8n-callback` - Receive n8n results

---

## Project Structure

```
fieldcapture-pro/
  app/                    # Expo Router screens
    (auth)/               # Auth screens (login/register)
    (tabs)/               # Tab screens (dashboard/tasks/settings)
    capture.tsx           # Capture screen (all modes)
    project/[id].tsx      # Project detail
    session/[id].tsx      # Session review
    task/[id].tsx         # Task detail
  components/             # Reusable UI components
  constants/              # Theme colors, config
  lib/                    # Business logic
    types.ts              # TypeScript interfaces
    store.ts              # Zustand state management
    storage.ts            # AsyncStorage helpers
    sync-service.ts       # Webhook sync logic
    query-client.ts       # React Query + API client
  server/                 # Express backend
    models/               # Mongoose schemas
    routes/               # API routes
    middleware/            # Auth middleware
    services/             # S3, etc.
    db.ts                 # MongoDB connection
    index.ts              # Server entry point
```
