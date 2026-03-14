import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getDb } from '../db/connection.js';
import { encrypt, decrypt } from './encryption.js';
import { STSClient, GetCallerIdentityCommand } from '@aws-sdk/client-sts';
import type { ProviderCredential, AwsCredentials } from './types.js';
import type { User } from '../auth/passport.js';

const router = Router();

router.use(requireAuth);

router.post('/', async (req: Request, res: Response) => {
  const { label, provider, region, accessKeyId, secretAccessKey, sessionToken } = req.body;
  const user = req.user as User;

  if (!label || !accessKeyId || !secretAccessKey) {
    return res.status(400).json({ error: 'Label, accessKeyId, and secretAccessKey are required' });
  }

  // Verify credentials with STS
  try {
    const stsClient = new STSClient({
      region: region || 'us-east-1',
      credentials: {
        accessKeyId,
        secretAccessKey,
        ...(sessionToken ? { sessionToken } : {}),
      },
    });
    const identity = await stsClient.send(new GetCallerIdentityCommand({}));
    console.log(`AWS identity verified: ${identity.Arn}`);
  } catch (err: any) {
    return res.status(400).json({ error: `AWS credential verification failed: ${err.message}` });
  }

  const credentialType = sessionToken ? 'temporary' : 'permanent';
  const creds: AwsCredentials = {
    accessKeyId,
    secretAccessKey,
    ...(sessionToken ? { sessionToken } : {}),
  };
  const encrypted = encrypt(JSON.stringify(creds));

  const db = getDb();
  const result = db.prepare(
    'INSERT INTO provider_credentials (user_id, label, provider, region, encrypted_credentials, verified, credential_type) VALUES (?, ?, ?, ?, ?, 1, ?)'
  ).run(user.id, label, provider || 'aws', region || 'us-east-1', encrypted, credentialType);

  res.json({
    id: result.lastInsertRowid,
    label,
    provider: provider || 'aws',
    region: region || 'us-east-1',
    verified: true,
    credentialType,
  });
});

router.get('/', (req: Request, res: Response) => {
  const user = req.user as User;
  const db = getDb();
  const providers = db.prepare(
    'SELECT id, label, provider, region, verified, credential_type, created_at FROM provider_credentials WHERE user_id = ?'
  ).all(user.id);
  res.json({ providers });
});

router.delete('/:id', (req: Request, res: Response) => {
  const user = req.user as User;
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM provider_credentials WHERE id = ? AND user_id = ?'
  ).run(req.params.id, user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Provider not found' });
  }
  res.json({ ok: true });
});

export default router;
export function getDecryptedCredentials(providerId: number, userId: number): { creds: AwsCredentials; region: string } | null {
  const db = getDb();
  const row = db.prepare(
    'SELECT * FROM provider_credentials WHERE id = ? AND user_id = ?'
  ).get(providerId, userId) as ProviderCredential | undefined;

  if (!row) return null;
  const creds = JSON.parse(decrypt(row.encrypted_credentials)) as AwsCredentials;
  return { creds, region: row.region };
}
