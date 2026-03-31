import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getDb } from '../db/connection.js';
import type { User } from '../auth/passport.js';
import type { ChatRequest, ChatResponse } from './types.js';
import { analyzeIntent } from './intent-analyzer.js';
import { buildContext } from './context-builder.js';
import { callGlobantLLM } from './llm-service.js';
import type { GraphData } from '../aws/types.js';
import { analyzeK8sIntent } from './k8s-intent-analyzer.js';
import { buildK8sContext } from './k8s-context-builder.js';
import type { K8sGraphData } from './k8s-types.js';

const router = Router();

router.use(requireAuth);

// POST /api/chat/message - Send a chat message
router.post('/message', async (req: Request, res: Response) => {
  const user = req.user as User;
  const {
    message,
    sourceType = 'aws',
    providerId,
    clusterId,
    namespace,
    conversationHistory,
  }: ChatRequest = req.body;

  if (!message) {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const db = getDb();
    let llmResponse = '';

    if (sourceType === 'k8s') {
      if (!clusterId || !namespace) {
        return res.status(400).json({ error: 'clusterId and namespace are required for Kubernetes chat' });
      }

      const cluster = db.prepare(
        'SELECT id, label, cluster_type FROM kubernetes_clusters WHERE id = ? AND user_id = ?'
      ).get(clusterId, user.id) as any;

      if (!cluster) {
        return res.status(404).json({ error: 'Cluster not found or access denied' });
      }

      const cachedGraph = db.prepare(
        `SELECT graph_data
         FROM cached_kubernetes_graphs
         WHERE user_id = ? AND cluster_id = ? AND namespace = ?`
      ).get(user.id, clusterId, namespace) as any;

      if (!cachedGraph) {
        return res.status(404).json({
          error: 'No Kubernetes namespace data found. Please fetch resources for this namespace first.',
        });
      }

      const graphData: K8sGraphData = JSON.parse(cachedGraph.graph_data);
      const intent = await analyzeK8sIntent(message);
      const { context, isRefusal, refusalMessage } = buildK8sContext(graphData, intent);

      if (isRefusal && refusalMessage) {
        const response: ChatResponse = {
          response: refusalMessage,
          timestamp: new Date().toISOString(),
        };
        return res.json(response);
      }

      const systemPrompt = `You are a Kubernetes infrastructure assistant for the "${cluster.label}" ${String(cluster.cluster_type).toUpperCase()} cluster.

Your role is to help users understand the scanned "${namespace}" namespace based on cached configuration metadata ONLY.

You have access to the following namespace context:
${context}

Guidelines:
1. Answer only from the provided cached Kubernetes context
2. Be concise but informative
3. Use bullet points for lists when helpful
4. Include specific workload, service, ingress, pod, node, or storage names when relevant
5. If asked about logs, live metrics, traffic, runtime health, or other unavailable data, explain that you only have scanned metadata
6. Do NOT invent cluster state that is not present in the context
7. Stay within the scope of the scanned namespace and related cluster-node metadata

Cluster context: ${cluster.label}
Cluster type: ${String(cluster.cluster_type).toUpperCase()}
Namespace context: ${namespace}`;

      llmResponse = await callGlobantLLM(systemPrompt, message, 'openai/gpt-5.4', false);
    } else {
      if (!providerId) {
        return res.status(400).json({ error: 'providerId is required for AWS chat' });
      }

      const provider = db.prepare(
        'SELECT id, label, region FROM provider_credentials WHERE id = ? AND user_id = ?'
      ).get(providerId, user.id) as any;

      if (!provider) {
        return res.status(404).json({ error: 'Provider not found or access denied' });
      }

      const cachedGraph = db.prepare(
        'SELECT graph_data FROM cached_graphs WHERE user_id = ? AND provider_id = ?'
      ).get(user.id, providerId) as any;

      if (!cachedGraph) {
        return res.status(404).json({
          error: 'No infrastructure data found. Please scan your resources first.'
        });
      }

      const graphData: GraphData = JSON.parse(cachedGraph.graph_data);
      console.log(`Analyzing intent for: "${message}"`);
      const intent = await analyzeIntent(message);
      console.log('Intent analysis result:', intent);

      const { context, isRefusal, refusalMessage } = buildContext(graphData, intent);

      if (isRefusal && refusalMessage) {
        const response: ChatResponse = {
          response: refusalMessage,
          timestamp: new Date().toISOString()
        };
        return res.json(response);
      }

      const systemPrompt = `You are an AWS infrastructure assistant for the "${provider.label}" environment (${provider.region} region).

Your role is to help users understand their infrastructure based on configuration and metadata ONLY.

You have access to the following information about their resources:
${context}

Guidelines:
1. Answer questions accurately based on the provided context
2. Be concise but informative
3. Use bullet points for lists
4. Include specific resource names and details when relevant
5. If asked about something not in the context, politely explain you don't have that information
6. Do NOT make assumptions about data not provided
7. Stay within the scope of infrastructure configuration and metadata

Provider context: ${provider.label} in ${provider.region}`;

      llmResponse = await callGlobantLLM(
        systemPrompt,
        message,
        'openai/gpt-5.4',
        false
      );
    }

    const response: ChatResponse = {
      response: llmResponse,
      timestamp: new Date().toISOString()
    };

    res.json(response);
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({
      error: 'Failed to process chat message',
      details: error.message
    });
  }
});

// GET /api/chat/health - Health check endpoint
router.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', service: 'chatbot' });
});

export default router;
