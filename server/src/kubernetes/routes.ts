import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getDb } from '../db/connection.js';
import { encrypt } from '../providers/encryption.js';
import { buildClients } from './client.js';
import { listNamespaces, listDeployments, listPods, listServices, listIngresses, listSecrets, getDeploymentEnvVars } from './discovery.js';
import { getPodLogs } from './logs.js';
import type { KubernetesCluster, KubernetesCredentials } from './types.js';
import type { User } from '../auth/passport.js';

const router = Router();
router.use(requireAuth);

// POST /api/kubernetes/clusters
router.post('/clusters', async (req: Request, res: Response) => {
  const user = req.user as User;
  const { label, cluster_type = 'rosa', api_server_url, token, ca, skip_tls_verify = false } = req.body;

  if (!label || !api_server_url || !token) {
    return res.status(400).json({ error: 'label, api_server_url, and token are required' });
  }

  const creds: KubernetesCredentials = { token, ...(ca ? { ca } : {}) };
  const encrypted = encrypt(JSON.stringify(creds));

  const cluster: Omit<KubernetesCluster, 'id' | 'created_at' | 'encrypted_credentials'> & { encrypted_credentials: string } = {
    user_id: user.id,
    label,
    cluster_type,
    api_server_url,
    encrypted_credentials: encrypted,
    skip_tls_verify: skip_tls_verify ? 1 : 0,
    verified: 0,
  };

  // Verify by attempting to list namespaces
  try {
    const tempCluster = { ...cluster, id: 0, created_at: '' } as KubernetesCluster;
    const clients = buildClients(tempCluster);
    await listNamespaces(clients);
  } catch (err: any) {
    return res.status(400).json({ error: `Cluster verification failed: ${err.message}` });
  }

  const db = getDb();
  const result = db.prepare(
    `INSERT INTO kubernetes_clusters (user_id, label, cluster_type, api_server_url, encrypted_credentials, skip_tls_verify, verified)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).run(user.id, label, cluster_type, api_server_url, encrypted, cluster.skip_tls_verify);

  res.json({ id: result.lastInsertRowid, label, cluster_type, api_server_url, verified: true });
});

// GET /api/kubernetes/clusters
router.get('/clusters', (req: Request, res: Response) => {
  const user = req.user as User;
  const db = getDb();
  const clusters = db.prepare(
    'SELECT id, label, cluster_type, api_server_url, skip_tls_verify, verified, created_at FROM kubernetes_clusters WHERE user_id = ?'
  ).all(user.id);
  res.json({ clusters });
});

// DELETE /api/kubernetes/clusters/:id
router.delete('/clusters/:id', (req: Request, res: Response) => {
  const user = req.user as User;
  const db = getDb();
  const result = db.prepare(
    'DELETE FROM kubernetes_clusters WHERE id = ? AND user_id = ?'
  ).run(req.params.id, user.id);

  if (result.changes === 0) {
    return res.status(404).json({ error: 'Cluster not found' });
  }
  res.json({ ok: true });
});

function getCluster(id: string, userId: number): KubernetesCluster | null {
  const db = getDb();
  return db.prepare('SELECT * FROM kubernetes_clusters WHERE id = ? AND user_id = ?').get(id, userId) as KubernetesCluster | null;
}

// GET /api/kubernetes/clusters/:id/namespaces
router.get('/clusters/:id/namespaces', async (req: Request, res: Response) => {
  const user = req.user as User;
  const cluster = getCluster(req.params.id, user.id);
  if (!cluster) return res.status(404).json({ error: 'Cluster not found' });

  try {
    const clients = buildClients(cluster);
    const namespaces = await listNamespaces(clients);
    res.json({ namespaces });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/kubernetes/clusters/:id/resources?namespace=X
router.get('/clusters/:id/resources', async (req: Request, res: Response) => {
  const user = req.user as User;
  const cluster = getCluster(req.params.id, user.id);
  if (!cluster) return res.status(404).json({ error: 'Cluster not found' });

  const namespace = (req.query.namespace as string) || 'default';

  try {
    const clients = buildClients(cluster);
    const [deployments, pods, services, ingresses, secrets] = await Promise.all([
      listDeployments(clients, namespace),
      listPods(clients, namespace),
      listServices(clients, namespace),
      listIngresses(clients, namespace),
      listSecrets(clients, namespace),
    ]);
    res.json({ deployments, pods, services, ingresses, secrets });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/kubernetes/clusters/:id/deployments/:name/envvars?namespace=X
router.get('/clusters/:id/deployments/:name/envvars', async (req: Request, res: Response) => {
  const user = req.user as User;
  const cluster = getCluster(req.params.id, user.id);
  if (!cluster) return res.status(404).json({ error: 'Cluster not found' });

  const namespace = (req.query.namespace as string) || 'default';

  try {
    const clients = buildClients(cluster);
    const envVars = await getDeploymentEnvVars(clients, namespace, req.params.name);
    res.json({ envVars });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/kubernetes/clusters/:id/logs?namespace=X&pod=Y&container=Z&tail=100
router.get('/clusters/:id/logs', async (req: Request, res: Response) => {
  const user = req.user as User;
  const cluster = getCluster(req.params.id, user.id);
  if (!cluster) return res.status(404).json({ error: 'Cluster not found' });

  const namespace = (req.query.namespace as string) || 'default';
  const pod = req.query.pod as string;
  const container = req.query.container as string | undefined;
  const tail = parseInt((req.query.tail as string) || '100', 10);

  if (!pod) return res.status(400).json({ error: 'pod query param is required' });

  try {
    const clients = buildClients(cluster);
    const logs = await getPodLogs(clients, namespace, pod, container, tail);
    res.json({ logs });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
