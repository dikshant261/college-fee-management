import { google } from 'googleapis';
import dotenv from 'dotenv';
import { getDB } from '../db';
import { encryptData, decryptData } from '../utils/crypto';

export interface GoogleTokensRecord {
  id: number;
  encrypted_tokens: string;
  user_email: string | null;
  folder_id: string | null;
  folder_name: string | null;
  created_at: string;
  updated_at: string;
}

export function getOAuth2Client() {
  dotenv.config({ override: true });
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const port = process.env.PORT || '5000';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim() || `http://localhost:${port}/api/google/callback`;

  if (!clientId || !clientSecret) {
    throw new Error('GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET is missing from environment variables.');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();
  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email',
  ];

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent select_account',
  });
}

export async function handleAuthCallback(code: string): Promise<{ email: string | null; hasDriveScope: boolean }> {
  const oauth2Client = getOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  oauth2Client.setCredentials(tokens);

  let userEmail: string | null = null;
  try {
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
    const userInfo = await oauth2.userinfo.get();
    userEmail = userInfo.data.email || null;
  } catch (err) {
    console.warn('[GoogleAuth] Could not fetch user profile email:', err);
  }

  const hasDriveScope = Boolean(tokens.scope && tokens.scope.includes('drive'));
  const encryptedTokens = encryptData(JSON.stringify(tokens));
  const db = getDB();

  await db.run(
    `INSERT INTO sync_google_tokens (id, encrypted_tokens, user_email, updated_at)
     VALUES (1, ?, ?, datetime('now'))
     ON CONFLICT(id) DO UPDATE SET
       encrypted_tokens = excluded.encrypted_tokens,
       user_email = excluded.user_email,
       updated_at = datetime('now')`,
    encryptedTokens,
    userEmail
  );

  return { email: userEmail, hasDriveScope };
}

export async function getStoredCredentials(): Promise<{
  tokens: any;
  userEmail: string | null;
  folderId: string | null;
  folderName: string | null;
  hasDriveScope: boolean;
} | null> {
  const db = getDB();
  const row = await db.get<GoogleTokensRecord>(`SELECT * FROM sync_google_tokens WHERE id = 1`);
  if (!row || !row.encrypted_tokens) {
    return null;
  }

  try {
    const decrypted = decryptData(row.encrypted_tokens);
    const tokens = JSON.parse(decrypted);
    const hasDriveScope = Boolean(tokens.scope && tokens.scope.includes('drive'));
    return {
      tokens,
      userEmail: row.user_email,
      folderId: row.folder_id,
      folderName: row.folder_name,
      hasDriveScope,
    };
  } catch (err) {
    console.error('[GoogleAuth] Failed to decrypt stored tokens:', err);
    return null;
  }
}

export async function saveDriveFolderInfo(folderId: string, folderName: string): Promise<void> {
  const db = getDB();
  await db.run(
    `UPDATE sync_google_tokens SET folder_id = ?, folder_name = ?, updated_at = datetime('now') WHERE id = 1`,
    folderId,
    folderName
  );
}

export async function getAuthenticatedDriveClient() {
  const creds = await getStoredCredentials();
  if (!creds || !creds.tokens) {
    throw new Error('Google Drive is not connected. Please authenticate with Google first.');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(creds.tokens);

  // Auto-persist refreshed tokens securely
  oauth2Client.on('tokens', async (newTokens) => {
    try {
      const mergedTokens = { ...creds.tokens, ...newTokens };
      const encrypted = encryptData(JSON.stringify(mergedTokens));
      const db = getDB();
      await db.run(
        `UPDATE sync_google_tokens SET encrypted_tokens = ?, updated_at = datetime('now') WHERE id = 1`,
        encrypted
      );
      console.log('[GoogleAuth] Refreshed tokens securely saved to database');
    } catch (err) {
      console.error('[GoogleAuth] Failed to persist refreshed tokens:', err);
    }
  });

  const drive = google.drive({ version: 'v3', auth: oauth2Client });
  return {
    drive,
    userEmail: creds.userEmail,
    folderId: creds.folderId,
    folderName: creds.folderName,
    hasDriveScope: creds.hasDriveScope,
  };
}

export async function disconnectGoogle(): Promise<void> {
  const db = getDB();
  await db.run(`DELETE FROM sync_google_tokens WHERE id = 1`);
  await db.run(`DELETE FROM sync_drive_files`);
  console.log('[GoogleAuth] Disconnected Google Drive and cleared local sync tokens/file mappings.');
}

export async function getGoogleStatus(): Promise<{
  connected: boolean;
  configured: boolean;
  userEmail: string | null;
  folderId: string | null;
  folderName: string | null;
  hasDriveScope: boolean;
}> {
  dotenv.config({ override: true });
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const isConfigured = Boolean(clientId && clientSecret);

  const creds = await getStoredCredentials();
  return {
    connected: Boolean(creds?.tokens),
    configured: isConfigured,
    userEmail: creds?.userEmail || null,
    folderId: creds?.folderId || null,
    folderName: creds?.folderName || null,
    hasDriveScope: Boolean(creds?.hasDriveScope),
  };
}
