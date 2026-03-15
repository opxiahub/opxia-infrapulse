# Plan: Kubernetes Integration for InfraPulse

## Context
Add a Kubernetes section to InfraPulse (alongside existing Providers). Users can connect to Kubernetes clusters and inspect resources organized by namespace. Initially supports ROSA (Red Hat OpenShift on AWS); EKS, AKS, GKE show "Coming Soon". Features: view Deployments/Pods/Services/Ingress/Secrets, click a Deployment to see env vars, fetch on-demand logs for any Pod or Deployment (last 100 lines).

---

## Architecture Overview

### New npm Package
- `@kubernetes/client-node` — official Kubernetes JS client (server-side only)

### DB Migration
**`server/src/db/migrations/005_kubernetes_clusters.sql`**
```sql
CREATE TABLE IF NOT EXISTS kubernetes_clusters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  cluster_type TEXT NOT NULL DEFAULT 'rosa',  -- rosa|eks|aks|gke
  api_server_url TEXT NOT NULL,
  encrypted_credentials TEXT NOT NULL,         -- AES-256-GCM of { token, ca? }
  skip_tls_verify INTEGER NOT NULL DEFAULT 0,
  verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

---

## Server-Side Files

### `server/src/kubernetes/types.ts`
```typescript
interface KubernetesCluster { id, user_id, label, cluster_type, api_server_url, encrypted_credentials, skip_tls_verify, verified, created_at }
interface KubernetesCredentials { token: string; ca?: string }
interface K8sResource { name, namespace, labels, annotations, createdAt, raw }
```

### `server/src/kubernetes/client.ts`
- Creates a `KubeConfig` from API server URL + bearer token (+ optional CA / skip-TLS)
- Returns typed API clients: `AppsV1Api`, `CoreV1Api`, `NetworkingV1Api`
- Reuses same `encrypt`/`decrypt` from `server/src/providers/encryption.ts`

### `server/src/kubernetes/discovery.ts`
Exports:
- `listNamespaces(client)` → string[]
- `listDeployments(client, namespace)` → Deployment[]
- `listPods(client, namespace)` → Pod[]
- `listServices(client, namespace)` → Service[]
- `listIngresses(client, namespace)` → Ingress[]
- `listSecrets(client, namespace)` → Secret[] (names + types only, no values)
- `getDeploymentEnvVars(client, namespace, deploymentName)` → EnvVar[] (key + value or sourceRef)

### `server/src/kubernetes/logs.ts`
- `getPodLogs(client, namespace, podName, container?, tailLines=100)` → string

### `server/src/kubernetes/routes.ts`
All routes require `requireAuth` middleware.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/kubernetes/clusters` | Add cluster (verify with namespace list call) |
| GET | `/api/kubernetes/clusters` | List user's clusters |
| DELETE | `/api/kubernetes/clusters/:id` | Delete cluster |
| GET | `/api/kubernetes/clusters/:id/namespaces` | List namespaces |
| GET | `/api/kubernetes/clusters/:id/resources` | All resources for `?namespace=X` (deployments, pods, services, ingresses, secrets) |
| GET | `/api/kubernetes/clusters/:id/deployments/:name/envvars` | Env vars for deployment (`?namespace=X`) |
| GET | `/api/kubernetes/clusters/:id/logs` | Pod logs (`?namespace=X&pod=Y&container=Z&tail=100`) |

### `server/src/app.ts` (modify)
Register: `app.use('/api/kubernetes', kubernetesRouter)`

---

## Client-Side Files

### Navigation — `client/src/components/layout/Sidebar.tsx` (modify)
Add third nav link:
```tsx
<NavLink to="/kubernetes" className={linkClass}>
  <Box className="w-4 h-4" />
  Kubernetes
</NavLink>
```
Import `Box` from lucide-react.

### Routing — `client/src/App.tsx` (modify)
```tsx
import { KubernetesPage } from './pages/KubernetesPage';
// inside Routes:
<Route path="/kubernetes" element={<KubernetesPage />} />
```

### New Page — `client/src/pages/KubernetesPage.tsx`
Layout:
1. **Top section** — 4 distribution cards in a row:
   - ROSA: clickable, opens cluster management view
   - EKS / AKS / GKE: `opacity-40 cursor-not-allowed` + "Coming Soon" (same pattern as GCP/Azure in ProvidersPage)
2. When ROSA is selected/active:
   - Show connected cluster list (`ClusterList`)
   - "Add Cluster" button → opens `AddClusterModal`
   - If a cluster is selected → show `KubernetesExplorer`

### `client/src/components/kubernetes/AddClusterModal.tsx`
Form fields:
- Label (text)
- API Server URL (text, e.g. `https://api.cluster.example.com:6443`)
- Bearer Token (password input)
- Skip TLS Verify (checkbox, default unchecked)

On submit → `POST /api/kubernetes/clusters` → on success close modal + refresh list.

### `client/src/components/kubernetes/ClusterList.tsx`
- Displays connected ROSA clusters (label, URL, verified badge)
- Click cluster → selects it for exploration
- Delete button with confirmation

### `client/src/components/kubernetes/KubernetesExplorer.tsx`
Main exploration area for a selected cluster:
- `NamespaceSelector` dropdown (calls `/namespaces`)
- Once namespace chosen, renders `ResourceTabs`

### `client/src/components/kubernetes/ResourceTabs.tsx`
Tabbed view (Deployments | Pods | Services | Ingress | Secrets):
- Each tab calls `/api/kubernetes/clusters/:id/resources?namespace=X` (single call returns all)
- **Deployments**: table with name, replicas ready/desired, age; click row → opens `DeploymentDetail` side panel
- **Pods**: table with name, status, restarts, age; "View Logs" button per row
- **Services**: name, type (ClusterIP/NodePort/LoadBalancer), ports, age
- **Ingress**: name, hosts, rules, age
- **Secrets**: name, type, age (no values shown)

### `client/src/components/kubernetes/DeploymentDetail.tsx`
Side panel (slides in from right, same pattern as `NodeDetailPanel`):
- Shows deployment metadata
- Lists env vars in a table: `KEY | VALUE / SOURCE`
  - Direct values shown as-is
  - Secret/ConfigMap refs shown as `secretKeyRef: my-secret/MY_KEY`
- "View Logs" button → opens `LogViewer` for any pod of this deployment

### `client/src/components/kubernetes/LogViewer.tsx`
Modal overlay:
- Header: `<pod-name> / <container-name>` + namespace
- "Fetch Logs" button (on-demand, not automatic)
- Calls `GET /api/kubernetes/clusters/:id/logs?namespace=X&pod=Y&tail=100`
- Displays logs in a `<pre>` block with monospace, dark bg, scrollable (max-height)
- "Copy" button for clipboard

---

## Files Created
```
server/src/db/migrations/005_kubernetes_clusters.sql
server/src/kubernetes/types.ts
server/src/kubernetes/client.ts
server/src/kubernetes/discovery.ts
server/src/kubernetes/logs.ts
server/src/kubernetes/routes.ts
client/src/pages/KubernetesPage.tsx
client/src/components/kubernetes/types.ts
client/src/components/kubernetes/AddClusterModal.tsx
client/src/components/kubernetes/ClusterList.tsx
client/src/components/kubernetes/KubernetesExplorer.tsx
client/src/components/kubernetes/ResourceTabs.tsx
client/src/components/kubernetes/DeploymentDetail.tsx
client/src/components/kubernetes/LogViewer.tsx
PLAN_kubernetes_integration.md
```

## Files Modified
```
client/src/components/layout/Sidebar.tsx   — added Kubernetes nav link
client/src/App.tsx                         — added /kubernetes route
server/src/app.ts                          — registered kubernetes router
server/package.json                        — added @kubernetes/client-node (via npm install)
```

---

## Reused Utilities
- `server/src/providers/encryption.ts` — `encrypt` / `decrypt` (same AES-256-GCM)
- `server/src/auth/middleware.ts` — `requireAuth`
- `server/src/db/connection.ts` — `getDb()`
- `client/src/lib/api.ts` — `api.get / api.post / api.delete`

---

## Security Notes
- Secrets: list names/types only, never expose `.data` values in the API response
- Env vars: show `secretKeyRef` source path, not the resolved secret value (avoids over-exposure)
- TLS: skip-TLS-verify option available for dev/internal clusters, off by default

---

## Verification
1. `npm install @kubernetes/client-node` in server/
2. `npm run dev` — server + client start without errors
3. Navigate to `/kubernetes` → see 4 distribution cards (ROSA active, others coming soon)
4. Add a ROSA cluster with valid API URL + token → cluster appears in list with "verified" badge
5. Select cluster → pick a namespace → see tabs populate with resources
6. Click a Deployment → side panel shows env vars
7. Click "View Logs" on a Pod → modal opens, fetch button returns last 100 lines
8. Invalid token on add → error shown inline
