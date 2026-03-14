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
import { GenericResourceNode } from './nodes/GenericResourceNode';
import { PulseEdge } from './PulseEdge';
import { GroupNode } from './nodes/GroupNode';
import { NodeDetailPanel } from './NodeDetailPanel';
import { getResourceConfig, AWS_RESOURCES } from '../../config/aws-resources';
import type { GraphData } from '../../hooks/useGraph';

// Specialized nodes for types with metric rendering; all others use GenericResourceNode
const SPECIALIZED_NODES: Record<string, any> = {
  ec2: Ec2Node,
  rds: RdsNode,
  s3: S3Node,
  lambda: LambdaNode,
};

// Build nodeTypes map: specialized + generic for every registered type
const nodeTypes: Record<string, any> = { resourceGroup: GroupNode };
for (const res of AWS_RESOURCES) {
  nodeTypes[res.type] = SPECIALIZED_NODES[res.type] || GenericResourceNode;
}

const edgeTypes = { pulse: PulseEdge };

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
const GROUPS_PER_ROW = 4;

function layoutNodes(graphData: GraphData): { nodes: Node[]; edges: Edge[] } {
  const groups: Record<string, typeof graphData.nodes> = {};
  for (const node of graphData.nodes) {
    if (!groups[node.type]) groups[node.type] = [];
    groups[node.type].push(node);
  }

  // Sort types by their group order then by label
  const typeOrder = Object.keys(groups).sort((a, b) => {
    const configA = getResourceConfig(a);
    const configB = getResourceConfig(b);
    const groupOrder = ['Compute', 'Networking', 'Database & Cache', 'Storage', 'Security', 'Content & API', 'Messaging'];
    const gA = configA ? groupOrder.indexOf(configA.group) : 99;
    const gB = configB ? groupOrder.indexOf(configB.group) : 99;
    if (gA !== gB) return gA - gB;
    return (configA?.label || a).localeCompare(configB?.label || b);
  });

  const nodes: Node[] = [];
  const groupSizes: { width: number; height: number }[] = [];

  // First pass: calculate all group sizes
  for (const type of typeOrder) {
    const group = groups[type];
    const cols = Math.min(group.length, NODES_PER_ROW);
    const rows = Math.ceil(group.length / NODES_PER_ROW);
    groupSizes.push({
      width: cols * (NODE_WIDTH + NODE_GAP_X) - NODE_GAP_X + GROUP_PADDING * 2,
      height: rows * (NODE_HEIGHT + NODE_GAP_Y) - NODE_GAP_Y + GROUP_PADDING + GROUP_HEADER + GROUP_PADDING,
    });
  }

  // Layout groups in a grid (GROUPS_PER_ROW columns)
  let currentX = 0;
  let currentY = 0;
  let rowMaxHeight = 0;
  let colInRow = 0;

  typeOrder.forEach((type, i) => {
    const group = groups[type];
    const config = getResourceConfig(type);
    const size = groupSizes[i];

    if (colInRow >= GROUPS_PER_ROW) {
      currentX = 0;
      currentY += rowMaxHeight + GROUP_GAP;
      rowMaxHeight = 0;
      colInRow = 0;
    }

    const groupId = `group-${type}`;
    nodes.push({
      id: groupId,
      type: 'resourceGroup',
      position: { x: currentX, y: currentY },
      data: {
        label: config?.label || type.toUpperCase(),
        color: config?.groupColor || '#6b7280',
        count: group.length,
      },
      style: { width: size.width, height: size.height },
      draggable: true,
      selectable: false,
    });

    group.forEach((node, j) => {
      const col = j % NODES_PER_ROW;
      const row = Math.floor(j / NODES_PER_ROW);
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

    currentX += size.width + GROUP_GAP;
    rowMaxHeight = Math.max(rowMaxHeight, size.height);
    colInRow++;
  });

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
  const { setCenter } = useReactFlow();

  // Update nodes when graphData changes
  useEffect(() => {
    const newLayout = layoutNodes(graphData);
    setNodes(newLayout.nodes);
  }, [graphData, setNodes]);

  // Apply search dimming
  useEffect(() => {
    if (!searchQuery.trim()) {
      setNodes(prev => prev.map(n => ({ ...n, style: { ...n.style, opacity: 1 } })));
      return;
    }

    const query = searchQuery.toLowerCase();
    setNodes(prev => prev.map(n => {
      if (n.type === 'resourceGroup') return n;
      const searchableValues = [
        n.data?.label,
        n.id,
        ...Object.values(n.data?.metadata || {}).filter(v => typeof v === 'string'),
      ].filter(Boolean).map(v => String(v).toLowerCase());

      const matches = searchableValues.some(v => v.includes(query));
      return { ...n, style: { ...n.style, opacity: matches ? 1 : 0.15 } };
    }));
  }, [searchQuery, setNodes]);

  // Focus on first matched node
  useEffect(() => {
    if (!searchQuery.trim()) return;
    const query = searchQuery.toLowerCase();
    const match = nodes.find(n => {
      if (n.type === 'resourceGroup') return false;
      const searchableValues = [
        n.data?.label,
        n.id,
        ...Object.values(n.data?.metadata || {}).filter(v => typeof v === 'string'),
      ].filter(Boolean).map(v => String(v).toLowerCase());
      return searchableValues.some(v => v.includes(query));
    });
    if (match) {
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
          minZoom={0.05}
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
