import * as k8s from '@kubernetes/client-node';
import { decrypt } from '../providers/encryption.js';
import type { KubernetesCluster, KubernetesCredentials } from './types.js';

export interface K8sClients {
  appsV1: k8s.AppsV1Api;
  coreV1: k8s.CoreV1Api;
  networkingV1: k8s.NetworkingV1Api;
  batchV1: k8s.BatchV1Api;
}

export function buildClients(cluster: KubernetesCluster): K8sClients {
  const creds: KubernetesCredentials = JSON.parse(decrypt(cluster.encrypted_credentials));

  const kc = new k8s.KubeConfig();

  const clusterEntry: k8s.Cluster = {
    name: `cluster-${cluster.id}`,
    server: cluster.api_server_url,
    skipTLSVerify: cluster.skip_tls_verify === 1,
    caData: creds.ca,
  };

  const user: k8s.User = {
    name: `user-${cluster.id}`,
    token: creds.token,
  };

  const context: k8s.Context = {
    name: `context-${cluster.id}`,
    cluster: clusterEntry.name,
    user: user.name,
  };

  kc.loadFromOptions({
    clusters: [clusterEntry],
    users: [user],
    contexts: [context],
    currentContext: context.name,
  });

  return {
    appsV1: kc.makeApiClient(k8s.AppsV1Api),
    coreV1: kc.makeApiClient(k8s.CoreV1Api),
    networkingV1: kc.makeApiClient(k8s.NetworkingV1Api),
    batchV1: kc.makeApiClient(k8s.BatchV1Api),
  };
}
