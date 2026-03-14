import { Server, Database, HardDrive, Zap, Shield, AlertTriangle } from 'lucide-react';
import type { GraphData } from '../../hooks/useGraph';

interface Props {
  graphData: GraphData;
}

interface ResourceTypeConfig {
  key: string;
  label: string;
  icon: typeof Server;
  iconColor: string;
  statusBreakdown: (nodes: GraphData['nodes']) => StatusItem[];
}

interface StatusItem {
  label: string;
  count: number;
  color: string; // tailwind text color
}

const RESOURCE_CONFIGS: ResourceTypeConfig[] = [
  {
    key: 'ec2',
    label: 'EC2',
    icon: Server,
    iconColor: 'text-neon-blue',
    statusBreakdown: (nodes) => [
      { label: 'Running', count: nodes.filter(n => n.status === 'running').length, color: 'text-neon-green' },
      { label: 'Stopped', count: nodes.filter(n => n.status === 'stopped').length, color: 'text-neon-red' },
      { label: 'Other', count: nodes.filter(n => n.status !== 'running' && n.status !== 'stopped').length, color: 'text-gray-400' },
    ],
  },
  {
    key: 'rds',
    label: 'RDS',
    icon: Database,
    iconColor: 'text-neon-purple',
    statusBreakdown: (nodes) => [
      { label: 'Available', count: nodes.filter(n => n.status === 'available').length, color: 'text-neon-green' },
      { label: 'Stopped', count: nodes.filter(n => n.status === 'stopped').length, color: 'text-neon-red' },
      { label: 'Other', count: nodes.filter(n => n.status !== 'available' && n.status !== 'stopped').length, color: 'text-gray-400' },
    ],
  },
  {
    key: 's3',
    label: 'S3',
    icon: HardDrive,
    iconColor: 'text-yellow-500',
    statusBreakdown: (nodes) => [
      { label: 'Active', count: nodes.length, color: 'text-neon-green' },
    ],
  },
  {
    key: 'lambda',
    label: 'Lambda',
    icon: Zap,
    iconColor: 'text-orange-400',
    statusBreakdown: (nodes) => [
      { label: 'Active', count: nodes.filter(n => ['Active', 'active'].includes(n.status)).length, color: 'text-neon-green' },
      { label: 'Inactive', count: nodes.filter(n => !['Active', 'active'].includes(n.status)).length, color: 'text-gray-400' },
    ],
  },
];

// Fallback config for resource types not yet in RESOURCE_CONFIGS
function getFallbackConfig(key: string): ResourceTypeConfig {
  return {
    key,
    label: key.toUpperCase(),
    icon: Server,
    iconColor: 'text-gray-400',
    statusBreakdown: (nodes) => [
      { label: 'Total', count: nodes.length, color: 'text-gray-300' },
    ],
  };
}

export function ResourceSummary({ graphData }: Props) {
  // Group nodes by type
  const groups: Record<string, GraphData['nodes']> = {};
  for (const node of graphData.nodes) {
    if (!groups[node.type]) groups[node.type] = [];
    groups[node.type].push(node);
  }

  const types = Object.keys(groups);
  if (types.length === 0) return null;

  // Totals across all types
  const totalManual = graphData.nodes.filter(n => n.isManual).length;
  const totalManaged = graphData.nodes.filter(n => !n.isManual).length;

  return (
    <div className="border-b border-surface-600 bg-surface-900/80">
      <div className="flex items-stretch gap-0 overflow-x-auto">
        {/* Overall IaC summary - always first */}
        <div className="flex items-center gap-3 px-4 py-2.5 border-r border-surface-600 shrink-0">
          <div className="flex items-center gap-1.5">
            <Shield className="w-3.5 h-3.5 text-neon-green" />
            <span className="text-[11px] text-neon-green font-medium">{totalManaged}</span>
            <span className="text-[10px] text-gray-500">IaC</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-neon-red" />
            <span className="text-[11px] text-neon-red font-medium">{totalManual}</span>
            <span className="text-[10px] text-gray-500">Manual</span>
          </div>
        </div>

        {/* Per-resource-type cards */}
        {types.map(type => {
          const nodes = groups[type];
          const config = RESOURCE_CONFIGS.find(c => c.key === type) || getFallbackConfig(type);
          const Icon = config.icon;
          const statuses = config.statusBreakdown(nodes).filter(s => s.count > 0);
          const iacCount = nodes.filter(n => !n.isManual).length;
          const manualCount = nodes.filter(n => n.isManual).length;

          return (
            <div
              key={type}
              className="flex items-center gap-3 px-4 py-2.5 border-r border-surface-600 shrink-0"
            >
              {/* Icon + count */}
              <div className="flex items-center gap-1.5">
                <Icon className={`w-3.5 h-3.5 ${config.iconColor}`} />
                <span className="text-sm font-bold text-gray-200">{nodes.length}</span>
                <span className="text-[10px] text-gray-500 uppercase tracking-wider">{config.label}</span>
              </div>

              {/* Status pills */}
              <div className="flex items-center gap-2">
                {statuses.map(s => (
                  <span key={s.label} className="flex items-center gap-1 text-[10px]">
                    <span className={`w-1.5 h-1.5 rounded-full ${s.color.replace('text-', 'bg-')}`} />
                    <span className={s.color}>{s.count}</span>
                    <span className="text-gray-600">{s.label}</span>
                  </span>
                ))}
              </div>

              {/* IaC/Manual for this type */}
              <div className="flex items-center gap-1.5 ml-1 pl-2 border-l border-surface-700">
                {iacCount > 0 && (
                  <span className="text-[10px] text-neon-green/70">{iacCount} IaC</span>
                )}
                {manualCount > 0 && (
                  <span className="text-[10px] text-neon-red/70">{manualCount} Manual</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
