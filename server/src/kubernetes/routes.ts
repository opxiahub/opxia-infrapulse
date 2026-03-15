import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getDb } from '../db/connection.js';
import { encrypt } from '../providers/encryption.js';
import { buildClients } from './client.js';
import type { K8sClients } from './client.js';
import {
  listNamespaces, listDeployments, listPods, listServices, listIngresses, listSecrets,
  listStatefulSets, listDaemonSets, listConfigMaps, listPersistentVolumeClaims,
  listK8sNodes, listJobs, listCronJobs, getDeploymentEnvVars,
} from './discovery.js';
import { getPodLogs } from './logs.js';
import type { KubernetesCluster, KubernetesCredentials } from './types.js';
import type { User } from '../auth/passport.js';

const router = Router();
router.use(requireAuth);

// Map resource type → fetch function
type Fetcher = (clients: K8sClients, namespace: string) => Promise<any[]>;
const RESOURCE_FETCHERS: Record<string, Fetcher> = {
  'k8s-deployment':  (c, ns) => listDeployments(c, ns),
  'k8s-pod':         (c, ns) => listPods(c, ns),
  'k8s-service':     (c, ns) => listServices(c, ns),
  'k8s-ingress':     (c, ns) => listIngresses(c, ns),
  'k8s-secret':      (c, ns) => listSecrets(c, ns),
  'k8s-configmap':   (c, ns) => listConfigMaps(c, ns),
  'k8s-statefulset': (c, ns) => listStatefulSets(c, ns),
  'k8s-daemonset':   (c, ns) => listDaemonSets(c, ns),
  'k8s-pvc':         (c, ns) => listPersistentVolumeClaims(c, ns),
  'k8s-node':        (c, _ns) => listK8sNodes(c),
  'k8s-job':         (c, ns) => listJobs(c, ns),
  'k8s-cronjob':     (c, ns) => listCronJobs(c, ns),
};
const ALL_TYPES = Object.keys(RESOURCE_FETCHERS);

// POST /api/kubernetes/clusters
router.post('/clusters', async (req: Request, res: Response) => {
  const user = req.user as User;
  const { label, cluster_type = 'rosa', api_server_url, token, ca, skip_tls_verify = false } = req.body;

  if (!label || !api_server_url || !token) {
    return res.status(400).json({ error: 'label, api_server_url, and token are required' });
  }

  const creds: KubernetesCredentials = { token, ...(ca ? { ca } : {}) };
  const encrypted = encrypt(JSON.stringify(creds));

  const tempCluster = {
    id: 0, user_id: user.id, label, cluster_type, api_server_url,
    encrypted_credentials: encrypted,
    skip_tls_verify: skip_tls_verify ? 1 : 0,
    verified: 0, created_at: '',
  } as KubernetesCluster;

  try {
    const clients = buildClients(tempCluster);
    await listNamespaces(clients);
  } catch (err: any) {
    return res.status(400).json({ error: `Cluster verification failed: ${err.message}` });
  }

  const db = getDb();
  const result = db.prepare(
    `INSERT INTO kubernetes_clusters (user_id, label, cluster_type, api_server_url, encrypted_credentials, skip_tls_verify, verified)
     VALUES (?, ?, ?, ?, ?, ?, 1)`
  ).run(user.id, label, cluster_type, api_server_url, encrypted, skip_tls_verify ? 1 : 0);

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

  if (result.changes === 0) return res.status(404).json({ error: 'Cluster not found' });
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

// GET /api/kubernetes/clusters/:id/resources?namespace=X&types=k8s-deployment,k8s-pod,...
router.get('/clusters/:id/resources', async (req: Request, res: Response) => {
  const user = req.user as User;
  const cluster = getCluster(req.params.id, user.id);
  if (!cluster) return res.status(404).json({ error: 'Cluster not found' });

  const namespace = (req.query.namespace as string) || 'default';
  const typesParam = req.query.types as string | undefined;
  const requestedTypes = typesParam ? typesParam.split(',').filter(t => RESOURCE_FETCHERS[t]) : ALL_TYPES;

  try {
    const clients = buildClients(cluster);
    const results = await Promise.all(
      requestedTypes.map(async type => {
        const items = await RESOURCE_FETCHERS[type](clients, namespace);
        return [type, items] as [string, any[]];
      })
    );
    res.json(Object.fromEntries(results));
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
