import { Router, Request, Response } from 'express';
import { requireAuth } from '../auth/middleware.js';
import { getDb } from '../db/connection.js';
import type { User } from '../auth/passport.js';
import type { ChatRequest, ChatResponse } from './types.js';
import { analyzeIntent } from './intent-analyzer.js';
import { buildContext } from './context-builder.js';
import { callGlobantLLM } from './llm-service.js';
import type { GraphData } from '../aws/types.js';

const router = Router();

router.use(requireAuth);

// POST /api/chat/message - Send a chat message
router.post('/message', async (req: Request, res: Response) => {
  const user = req.user as User;
  const { message, providerId, conversationHistory }: ChatRequest = req.body;

  if (!message || !providerId) {
    return res.status(400).json({ error: 'Message and providerId are required' });
  }

  try {
    // Verify user has access to this provider
    const db = getDb();
    const provider = db.prepare(
      'SELECT id, label, region FROM provider_credentials WHERE id = ? AND user_id = ?'
    ).get(providerId, user.id) as any;

    if (!provider) {
      return res.status(404).json({ error: 'Provider not found or access denied' });
    }

    // Get cached graph data for this provider
    const cachedGraph = db.prepare(
      'SELECT graph_data FROM cached_graphs WHERE user_id = ? AND provider_id = ?'
    ).get(user.id, providerId) as any;

    if (!cachedGraph) {
      return res.status(404).json({
        error: 'No infrastructure data found. Please scan your resources first.'
      });
    }

    const graphData: GraphData = JSON.parse(cachedGraph.graph_data);

    // Step 1: Analyze user intent
    console.log(`Analyzing intent for: "${message}"`);
    const intent = await analyzeIntent(message);
    console.log('Intent analysis result:', intent);

    // Step 2: Build context based on intent
    const { context, isRefusal, refusalMessage } = buildContext(graphData, intent);

    // If this is a refusal (asking about unavailable data), return the refusal message
    if (isRefusal && refusalMessage) {
      const response: ChatResponse = {
        response: refusalMessage,
        timestamp: new Date().toISOString()
      };
      return res.json(response);
    }

    // Step 3: Generate response using LLM with context
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

    const llmResponse = await callGlobantLLM(
      systemPrompt,
      message,
      "openai/gpt-4o-mini",
      false
    );

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
