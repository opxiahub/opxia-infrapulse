import { useMemo, useEffect, useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Ec2Node } from './nodes/Ec2Node';
import { RdsNode } from './nodes/RdsNode';
import { S3Node } from './nodes/S3Node';
import { LambdaNode } from './nodes/LambdaNode';
import { PulseEdge } from './PulseEdge';
import { GroupNode } from './nodes/GroupNode';
import { NodeDetailPanel } from './NodeDetailPanel';
import type { GraphData } from '../../hooks/useGraph';

const nodeTypes = {
  ec2: Ec2Node,
  rds: RdsNode,
  s3: S3Node,
  lambda: LambdaNode,
  resourceGroup: GroupNode,
};

const edgeTypes = {
  pulse: PulseEdge,
};

const GROUP_LABELS: Record<string, string> = {
  ec2: 'EC2 Instances',
  rds: 'RDS Databases',
  s3: 'S3 Buckets',
  lambda: 'Lambda Functions',
};

const GROUP_COLORS: Record<string, string> = {
  ec2: '#04D9FF',
  rds: '#BC13FE',
  s3: '#EAB308',
  lambda: '#FB923C',
};

interface Props {
  graphData: GraphData;
  searchQuery: string;
}

const NODE_WIDTH = 180;
const NODE_HEIGHT = 140;
const NODE_GAP_X = 30;
const NODE_GAP_Y = 30;
const GROUP_PADDING = 50;
const GROUP_HEADER = 40;
const GROUP_GAP = 60;
const NODES_PER_ROW = 3;

function layoutNodes(graphData: GraphData): { nodes: Node[]; edges: Edge[] } {
  const groups: Record<string, typeof graphData.nodes> = {};
  for (const node of graphData.nodes) {
    if (!groups[node.type]) groups[node.type] = [];
    groups[node.type].push(node);
  }

  const typeOrder = Object.keys(groups).sort((a, b) => {
    const order = ['ec2', 'lambda', 'rds', 's3'];
    return (order.indexOf(a) === -1 ? 99 : order.indexOf(a)) - (order.indexOf(b) === -1 ? 99 : order.indexOf(b));
  });

  const nodes: Node[] = [];
  let groupX = 0;

  for (const type of typeOrder) {
    const group = groups[type];
    if (!group || group.length === 0) continue;

    const cols = Math.min(group.length, NODES_PER_ROW);
    const rows = Math.ceil(group.length / NODES_PER_ROW);
    const groupWidth = cols * (NODE_WIDTH + NODE_GAP_X) - NODE_GAP_X + GROUP_PADDING * 2;
    const groupHeight = rows * (NODE_HEIGHT + NODE_GAP_Y) - NODE_GAP_Y + GROUP_PADDING + GROUP_HEADER + GROUP_PADDING;

    // Group container node
    const groupId = `group-${type}`;
    nodes.push({
      id: groupId,
      type: 'resourceGroup',
      position: { x: groupX, y: 0 },
      data: {
        label: GROUP_LABELS[type] || type.toUpperCase(),
        color: GROUP_COLORS[type] || '#6b7280',
        count: group.length,
      },
      style: { width: groupWidth, height: groupHeight },
      draggable: true,
      selectable: false,
    });

    // Resource nodes inside group
    group.forEach((node, i) => {
      const col = i % NODES_PER_ROW;
      const row = Math.floor(i / NODES_PER_ROW);
      nodes.push({
        id: node.id,
        type: node.type,
        position: {
          x: GROUP_PADDING + col * (NODE_WIDTH + NODE_GAP_X),
          y: GROUP_HEADER + GROUP_PADDING + row * (NODE_HEIGHT + NODE_GAP_Y),
        },
        parentNode: groupId,
        extent: 'parent' as const,
        data: {
          type: node.type,
          label: node.label,
          status: node.status,
          isManual: node.isManual,
          metadata: node.metadata,
          metrics: node.metrics,
        },
      });
    });

    groupX += groupWidth + GROUP_GAP;
  }

  const edges: Edge[] = graphData.edges.map(edge => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    type: 'pulse',
    data: { label: edge.label, animated: edge.animated },
  }));

  return { nodes, edges };
}

function InfraGraphInner({ graphData, searchQuery }: Props) {
  const layout = useMemo(() => layoutNodes(graphData), [graphData]);
  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, , onEdgesChange] = useEdgesState(layout.edges);
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const { fitView, setCenter } = useReactFlow();

  // Update nodes when graphData changes
  useEffect(() => {
    const newLayout = layoutNodes(graphData);
    setNodes(newLayout.nodes);
  }, [graphData, setNodes]);

  // Update edges when graphData changes
  useEffect(() => {
    const newLayout = layoutNodes(graphData);
    // useEdgesState doesn't expose setEdges cleanly, so we rely on the initial layout + key
  }, [graphData]);

  // Apply search dimming
  useEffect(() => {
    if (!searchQuery.trim()) {
      // Reset all nodes to full opacity
      setNodes(prev => prev.map(n => ({
        ...n,
        style: n.type === 'resourceGroup'
          ? { ...n.style, opacity: 1 }
          : { ...n.style, opacity: 1 },
      })));
      return;
    }

    const query = searchQuery.toLowerCase();
    setNodes(prev => prev.map(n => {
      if (n.type === 'resourceGroup') return n;
      const label = (n.data?.label || '').toLowerCase();
      const id = n.id.toLowerCase();
      const instanceId = (n.data?.metadata?.instanceId || '').toLowerCase();
      const dbInstanceId = (n.data?.metadata?.dbInstanceId || '').toLowerCase();
      const bucketName = (n.data?.metadata?.bucketName || '').toLowerCase();
      const functionName = (n.data?.metadata?.functionName || '').toLowerCase();

      const matches = label.includes(query)
        || id.includes(query)
        || instanceId.includes(query)
        || dbInstanceId.includes(query)
        || bucketName.includes(query)
        || functionName.includes(query);

      return {
        ...n,
        style: { ...n.style, opacity: matches ? 1 : 0.15 },
      };
    }));
  }, [searchQuery, setNodes]);

  // Focus on first matched node when search changes
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const query = searchQuery.toLowerCase();
    const match = nodes.find(n =>
      n.type !== 'resourceGroup' && (
        (n.data?.label || '').toLowerCase().includes(query) ||
        n.id.toLowerCase().includes(query) ||
        (n.data?.metadata?.instanceId || '').toLowerCase().includes(query) ||
        (n.data?.metadata?.dbInstanceId || '').toLowerCase().includes(query) ||
        (n.data?.metadata?.bucketName || '').toLowerCase().includes(query) ||
        (n.data?.metadata?.functionName || '').toLowerCase().includes(query)
      )
    );
    if (match) {
      // Calculate absolute position (parent offset + node offset)
      const parent = nodes.find(n => n.id === match.parentNode);
      const absX = (parent?.position?.x || 0) + match.position.x + NODE_WIDTH / 2;
      const absY = (parent?.position?.y || 0) + match.position.y + NODE_HEIGHT / 2;
      setCenter(absX, absY, { zoom: 1.2, duration: 500 });
    }
  }, [searchQuery, nodes, setCenter]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    if (node.type === 'resourceGroup') return;
    setSelectedNode(node.data);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  return (
    <div className="flex h-full">
      <div className="flex-1">
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          fitViewOptions={{ padding: 0.15 }}
          proOptions={{ hideAttribution: true }}
          minZoom={0.1}
          maxZoom={2}
        >
          <Background color="#1a1a25" gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeColor={node => {
              if (node.type === 'resourceGroup') return 'transparent';
              if (node.data?.isManual) return '#FF073A';
              return '#39FF14';
            }}
            maskColor="rgba(0,0,0,0.8)"
          />
        </ReactFlow>
      </div>

      {selectedNode && (
        <NodeDetailPanel
          node={selectedNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
}

export function InfraGraph(props: Props) {
  return (
    <ReactFlowProvider>
      <InfraGraphInner {...props} />
    </ReactFlowProvider>
  );
}
