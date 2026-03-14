import { useMemo, useEffect, useCallback, useState } from 'react';
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  type Node,
  type Edge,
  useNodesState,
  useEdgesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Ec2Node } from './nodes/Ec2Node';
import { RdsNode } from './nodes/RdsNode';
import { S3Node } from './nodes/S3Node';
import { LambdaNode } from './nodes/LambdaNode';
import { PulseEdge } from './PulseEdge';
import { NodeDetailPanel } from './NodeDetailPanel';
import type { GraphData } from '../../hooks/useGraph';

const nodeTypes = {
  ec2: Ec2Node,
  rds: RdsNode,
  s3: S3Node,
  lambda: LambdaNode,
};

const edgeTypes = {
  pulse: PulseEdge,
};

interface Props {
  graphData: GraphData;
}

function layoutNodes(graphData: GraphData): { nodes: Node[]; edges: Edge[] } {
  // Simple grid layout by type
  const groups: Record<string, typeof graphData.nodes> = {};
  for (const node of graphData.nodes) {
    if (!groups[node.type]) groups[node.type] = [];
    groups[node.type].push(node);
  }

  const typeOrder = ['ec2', 'lambda', 'rds', 's3'];
  const nodes: Node[] = [];
  let colIndex = 0;

  for (const type of typeOrder) {
    const group = groups[type] || [];
    group.forEach((node, rowIndex) => {
      nodes.push({
        id: node.id,
        type: node.type,
        position: { x: colIndex * 250 + 50, y: rowIndex * 200 + 50 },
        data: {
          type: node.type,   // include so NodeDetailPanel can read it
          label: node.label,
          status: node.status,
          isManual: node.isManual,
          metadata: node.metadata,
          metrics: node.metrics,
        },
      });
    });
    if (group.length > 0) colIndex++;
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

export function InfraGraph({ graphData }: Props) {
  const layout = useMemo(() => layoutNodes(graphData), [graphData]);
  const [nodes, setNodes, onNodesChange] = useNodesState(layout.nodes);
  const [edges, , onEdgesChange] = useEdgesState(layout.edges);
  const [selectedNode, setSelectedNode] = useState<any>(null);

  // Update nodes when graphData changes (e.g., metrics update)
  useEffect(() => {
    const newLayout = layoutNodes(graphData);
    setNodes(prev => {
      return newLayout.nodes.map(newNode => {
        const existing = prev.find(n => n.id === newNode.id);
        if (existing) {
          return { ...existing, data: newNode.data };
        }
        return newNode;
      });
    });
  }, [graphData, setNodes]);

  const onNodeClick = useCallback((_: any, node: Node) => {
    setSelectedNode(node.data);
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
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#1a1a25" gap={20} size={1} />
          <Controls />
          <MiniMap
            nodeColor={node => {
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
