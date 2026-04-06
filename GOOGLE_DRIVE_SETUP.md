# Google Drive Setup

1. Open Google Cloud Console and create or select a project.
2. Enable the Google Drive API for that project.
3. Configure the OAuth consent screen.
4. Create an OAuth 2.0 Client ID of type `Web application`.
5. Add these scopes in the OAuth / Data Access section:
   - `https://www.googleapis.com/auth/drive.appdata`
   - `openid`
   - `email`
   - `profile`
6. Add these Authorized JavaScript origins for local work:
   - `http://127.0.0.1:4173`
   - `http://localhost:4173`
7. Copy the generated client ID into `drive-config.js`.
8. Start the site from the project folder:

```bash
python3 -m http.server 4173
```

9. Open `http://127.0.0.1:4173/`, click `Подключить Google Drive`, and allow access.

Notes:
- The app stores data in Google Drive `appDataFolder`, which is hidden from the normal Drive file list.
- The site still keeps a local browser copy for speed, but Google Drive becomes the durable backup.
- If you later deploy the site to a domain, add that exact origin to the OAuth client settings too.
