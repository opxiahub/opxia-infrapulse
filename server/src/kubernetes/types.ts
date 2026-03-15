export interface KubernetesCluster {
  id: number;
  user_id: number;
  label: string;
  cluster_type: string;
  api_server_url: string;
  encrypted_credentials: string;
  skip_tls_verify: number;
  verified: number;
  created_at: string;
}

export interface KubernetesCredentials {
  token: string;
  ca?: string;
}

export interface K8sResource {
  name: string;
  namespace: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
  createdAt: string;
  raw?: any;
}

export interface K8sDeployment extends K8sResource {
  replicas: number;
  readyReplicas: number;
  unavailableReplicas: number;
  updatedReplicas: number;
  image: string;
  podLabels: Record<string, string>;
}

export interface K8sStatefulSet extends K8sResource {
  replicas: number;
  readyReplicas: number;
  image: string;
  podLabels: Record<string, string>;
}

export interface K8sDaemonSet extends K8sResource {
  desiredNumberScheduled: number;
  numberReady: number;
  numberMisscheduled: number;
  image: string;
}

export interface K8sConfigMap extends K8sResource {
  dataKeys: string[];
}

export interface K8sPersistentVolumeClaim extends K8sResource {
  phase: string;
  storageClass: string;
  capacity: string;
  accessModes: string[];
}

export interface K8sClusterNode extends K8sResource {
  nodeRole: string;
  osImage: string;
  kubernetesVersion: string;
  cpuCapacity: string;
  memoryCapacity: string;
  ready: boolean;
}

export interface K8sJob extends K8sResource {
  completions: number;
  succeeded: number;
  failed: number;
  active: number;
}

export interface K8sCronJob extends K8sResource {
  schedule: string;
  lastScheduleTime: string;
  active: number;
}

export interface K8sPod extends K8sResource {
  phase: string;
  restarts: number;
  nodeName: string;
  containers: string[];
}

export interface K8sService extends K8sResource {
  type: string;
  clusterIP: string;
  ports: Array<{ port: number; targetPort: string | number; protocol: string; nodePort?: number }>;
  selector: Record<string, string>;  // service selector
}

export interface K8sIngress extends K8sResource {
  hosts: string[];
  lbHostnames: string[];
  rules: Array<{ host: string; paths: Array<{ path: string; backend: string }> }>;
}

export interface K8sSecret extends K8sResource {
  type: string;
}

export interface EnvVar {
  name: string;
  value?: string;
  valueFrom?: string;
}
