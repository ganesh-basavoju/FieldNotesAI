# Project Run Instructions for FieldCapture Pro

This document provides a detailed guide on how to set up and run the FieldCapture Pro application, based on an analysis of the codebase.

## Project Overview

**FieldCapture Pro** is a mobile data capture application built with:
-   **Frontend**: React Native (via Expo)
-   **Backend**: Node.js with Express
-   **Database**: MongoDB (via Mongoose)
    -   *Note: The project also contains configuration for Drizzle ORM/PostgreSQL, but the active codebase primarily uses MongoDB.*
-   **Authentication**: JWT-based auth

## Prerequisites

Before starting, ensure you have the following installed:
1.  **Node.js** (v18 or higher recommended)
2.  **npm** (comes with Node.js)
3.  **MongoDB Database** (You can use a free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas) cluster or a local instance)
4.  **Expo Go** app on your iOS/Android device (or an Android Emulator / iOS Simulator)

## Installation & Setup

1.  **Install Dependencies**
    Open your terminal in the project root and run:
    ```bash
    npm install
    ```

2.  **Environment Configuration**
    Create a `.env` file in the root directory (copy from `.env.example`):
    ```bash
    cp .env.example .env
    ```

    Open the `.env` file and configure the following variables:

    | Variable | Description | Required? |
    | :--- | :--- | :--- |
    | `MONGODB_URI` | Connection string for your MongoDB database. | **Yes** |
    | `JWT_SECRET` | A secure random string for signing tokens. | **Yes** |
    | `AWS_ACCESS_KEY_ID` | AWS Credentials for S3 storage. | Yes (for photo/audio uploads) |
    | `AWS_SECRET_ACCESS_KEY`| AWS Credentials for S3 storage. | Yes |
    | `AWS_REGION` | AWS Region (e.g., `us-east-1`). | Yes |
    | `AWS_BUCKET_NAME` | S3 Bucket name. | Yes |
    | `N8N_WEBHOOK_URL` | URL for AI processing webhook (if using AI features). | No (optional for dev) |
    | `PORT` | Backend server port (default: 5000). | No |

    *Note: If you are testing on a physical device, you may need to set `EXPO_PUBLIC_DOMAIN=your-machine-ip:5000` in your env or run command to ensure the phone can reach the backend.*

## Running the Application

You will need two terminal windows running simultaneously.

### 1. Start the Backend Server
This runs the Express API that connects to MongoDB.

```bash
npm run server:dev
```
-   The server should start on `http://localhost:5000`.
-   Verify it's connected to MongoDB by checking the console logs ("MongoDB connected successfully").

### 2. Start the Frontend (Expo)
This runs the Metro bundler for the React Native app.

```bash
npm start
```
(or `npm run expo:dev` if you have specific dev environment needs)

-   Press `w` to run in web browser.
-   Press `a` to run in Android Emulator.
-   Press `i` to run in iOS Simulator.
-   **Scan the QR code** with the Expo Go app to run on your physical device.

## Troubleshooting

-   **Database Connection Issues**: Ensure your IP address is whitelisted in MongoDB Atlas Network Access if you are using the cloud service.
-   **API Connection Issues (Network Error)**:
    -   If running on a **physical device**, your phone cannot access `localhost`. You must use your computer's local IP address (e.g., `192.168.1.5`).
    -   Ensure your phone and computer are on the **same Wi-Fi network**.
    -   You might need to update the API base URL logic in `lib/query-client.ts` or set `EXPO_PUBLIC_DOMAIN` to your IP:Port.
-   **Missing Dependencies**: If you see errors about missing modules, try running `npm install` again or `npx expo install --fix`.

## Architecture Notes

-   **Backend Entry**: `server/index.ts`
-   **Database Schema**: Mongoose models are located in `server/models/`. (Note: `shared/schema.ts` and `drizzle.config.ts` exist for PostgreSQL but appear to be secondary or future work).
-   **API Client**: Configured in `lib/query-client.ts`. defaults to `http://localhost:5000`.
