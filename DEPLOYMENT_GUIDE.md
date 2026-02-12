# Deploying FieldCapture Pro to Vercel

This guide explains how to deploy the **FieldCapture Pro** backend and frontend to Vercel.

## prerequisites

-   **Vercel Account**: [Sign up here](https://vercel.com/signup).
-   **Vercel CLI** (Optional but recommended): `npm i -g vercel`
-   **MongoDB Atlas Cluster**: Ensure your IP Whitelist includes `0.0.0.0/0` (Allow Access from Anywhere) because Vercel Serverless Functions use dynamic IP addresses.

## 1. Project Configuration

We have already configured the project for Vercel:
-   Created `vercel.json` to route traffic to the API.
-   Updated `server/index.ts` to export the Express app for serverless execution.

## 2. Deploy Method A: Using GitHub (Requested)

This is the preferred method for continuous deployment.

1.  **Push to GitHub**:
    Ensure your project is pushed to a GitHub repository.
    ```bash
    git add .
    git commit -m "Ready for deployment"
    git push origin main
    ```

2.  **Import Project in Vercel**:
    -   Go to the [Vercel Dashboard](https://vercel.com/dashboard).
    -   Click **"Add New..."** -> **"Project"**.
    -   Under **"Import Git Repository"**, find your repository and click **Import**.

3.  **Configure Build**:
    -   **Framework Preset**: Select "Other" (since this is a custom Express setup).
    -   **Root Directory**: `./` (leave default).
    -   **Build Command**: Vercel generally detects `package.json` scripts. You can leave it default or empty if you don't have a specific build step for the backend (our `vercel.json` handles the runtime). If it asks, ensure it doesn't try to run a frontend build command that fails.
    -   **Output Directory**: Leave default.

4.  **Environment Variables (Crucial)**:
    Expand the "Environment Variables" section and add all keys from your `.env` file:
    -   `MONGODB_URI`
    -   `JWT_SECRET`
    -   `AWS_ACCESS_KEY_ID`
    -   `AWS_SECRET_ACCESS_KEY`
    -   `AWS_REGION`
    -   `AWS_BUCKET_NAME`
    -   `N8N_WEBHOOK_URL`

5.  **Deploy**:
    Click **Deploy**. Vercel will build the project and assign a domain (e.g., `fieldcapture-pro.vercel.app`).

## 2. Deploy Method B: Using Vercel CLI (Alternative)

1.  Open your terminal in the project root.
2.  Run the deploy command:
    ```bash
    vercel
    ```
3.  Follow the prompts:
    -   Set up and deploy? **Yes**
    -   Link to existing project? **No**
    -   Project name? **fieldcapture-pro**
4.  **Environment Variables**:
    Confirm "Yes" when asked to set up environment variables, or configure them later in the dashboard.
5.  The deployment will start.

## 3. Post-Deployment Setup

### Update Frontend API URL
Once deployed, your backend will be at `https://your-project.vercel.app`.

If you are using the Expo frontend with this backend:
1.  **Local Dev**: The app uses `localhost:5000` by default.
2.  **Production**: You need to ensure the Expo app points to the Vercel URL.
    -   Update `lib/query-client.ts` logic if needed, OR
    -   Set `EXPO_PUBLIC_DOMAIN` environment variable when building your Expo app:
        ```bash
        EXPO_PUBLIC_DOMAIN=your-project.vercel.app npx expo build ...
        ```

## Troubleshooting

-   **Database Connection Errors**: 
    -   Check MongoDB Atlas "Network Access" -> IP Whitelist. It MUST be `0.0.0.0/0`.
    -   Check that `MONGODB_URI` is set correctly in Vercel Project Settings > Environment Variables.
-   **Cold Starts**: Vercel functions go to sleep. The first request might take a few seconds to wake up and connect to MongoDB.

## 4. Build Android APK

To generate an installable APK file for Android:

1.  **Install EAS CLI**:
    ```bash
    npm install -g eas-cli
    ```

2.  **Login to Expo**:
    ```bash
    eas login
    ```

3.  **Configure Project** (if not done):
    ```bash
    eas build:configure
    ```

4.  **Run Build**:
    We have configured an APK build profile in `eas.json`. Run:
    ```bash
    eas build -p android --profile preview
    ```

5.  **Download**:
    Once the build finishes, EAS will provide a link to download the `.apk` file.

### Important: Production URL
Before building for production use, ensure your app points to the deployed Vercel backend.
You can set this via environment variable during build:

```bash
EXPO_PUBLIC_DOMAIN=your-project.vercel.app eas build -p android --profile preview
```
(Replace `your-project.vercel.app` with your actual Vercel domain).
