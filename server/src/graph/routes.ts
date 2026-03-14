import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getDecryptedCredentials } from '../providers/routes.js';
import { discoverResources } from '../aws/discovery.js';
import { buildGraph } from './builder.js';
import { getDb } from '../db/connection.js';
import type { User } from '../auth/passport.js';
import type { AwsResourceType } from '../aws/resource-registry.js';

const router = Router();

router.use(requireAuth);

// GET cached graph (no AWS call)
router.get('/:providerId/cached', (req: Request, res: Response) => {
  const user = req.user as User;
  const providerId = parseInt(req.params.providerId, 10);
  const db = getDb();

  const row = db.prepare(
    'SELECT graph_data, resource_types, scanned_at, fetch_tags FROM cached_graphs WHERE user_id = ? AND provider_id = ?'
  ).get(user.id, providerId) as any;

  if (!row) {
    return res.json({ cached: null });
  }

  res.json({
    cached: JSON.parse(row.graph_data),
    resourceTypes: row.resource_types.split(','),
    scannedAt: row.scanned_at,
    fetchTags: row.fetch_tags === 1,
  });
});

// GET scan (live AWS call, saves result)
router.get('/:providerId', async (req: Request, res: Response) => {
  const user = req.user as User;
  const providerId = parseInt(req.params.providerId, 10);
  const resourceTypes = ((req.query.types as string) || 'ec2,rds,s3,lambda')
    .split(',') as AwsResourceType[];
  const fetchTags = req.query.fetchTags === 'true';

  const result = getDecryptedCredentials(providerId, user.id);
  if (!result) {
    return res.status(404).json({ error: 'Provider not found' });
  }

  const nodes = await discoverResources(providerId, result.creds, result.region, resourceTypes, fetchTags);
  const graph = buildGraph(nodes);

  // Persist result so it survives logout/login
  const db = getDb();
  db.prepare(`
    INSERT INTO cached_graphs (user_id, provider_id, resource_types, graph_data, scanned_at, fetch_tags)
    VALUES (?, ?, ?, ?, datetime('now'), ?)
    ON CONFLICT(user_id, provider_id) DO UPDATE SET
      resource_types = excluded.resource_types,
      graph_data     = excluded.graph_data,
      scanned_at     = excluded.scanned_at,
      fetch_tags     = excluded.fetch_tags
  `).run(user.id, providerId, resourceTypes.join(','), JSON.stringify(graph), fetchTags ? 1 : 0);

  res.json(graph);
});

export default router;
