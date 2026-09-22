<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/15a06d21-7759-4b38-8097-615cc5fa25a0

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## REAL AUTH
The mobile client now starts with a real server login/registration screen. It uses /api/register, /api/login and /api/me with credentials. Set VITE_API_URL to your Zentora server URL when the server is not on localhost:5000. Demo/AI test notifications are disabled.
