import { Box, Network, Globe, Key, Cpu } from 'lucide-react';

export interface K8sResourceConfig {
  type: string;
  label: string;
  group: string;
  groupOrder: number;
  icon: any;
  iconColor: string;
  groupColor: string;
}

export const K8S_RESOURCES: K8sResourceConfig[] = [
  { type: 'k8s-deployment', label: 'Deployments', group: 'Workloads',  groupOrder: 0, icon: Box,     iconColor: 'text-neon-purple', groupColor: '#BC13FE' },
  { type: 'k8s-pod',        label: 'Pods',         group: 'Workloads',  groupOrder: 1, icon: Cpu,     iconColor: 'text-neon-green',  groupColor: '#39FF14' },
  { type: 'k8s-service',    label: 'Services',     group: 'Networking', groupOrder: 2, icon: Network, iconColor: 'text-neon-blue',   groupColor: '#04D9FF' },
  { type: 'k8s-ingress',    label: 'Ingress',      group: 'Networking', groupOrder: 3, icon: Globe,   iconColor: 'text-amber-400',   groupColor: '#FBBF24' },
  { type: 'k8s-secret',     label: 'Secrets',      group: 'Config',     groupOrder: 4, icon: Key,     iconColor: 'text-rose-400',    groupColor: '#FB7185' },
];

export function getK8sResourceConfig(type: string): K8sResourceConfig | undefined {
  return K8S_RESOURCES.find(r => r.type === type);
}
