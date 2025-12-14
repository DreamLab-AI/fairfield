/**
 * Minimoonoir Embedding API Worker
 *
 * Provides text embedding using transformers.js (ONNX runtime)
 * Model: all-MiniLM-L6-v2 (384 dimensions, ~22MB)
 *
 * Free tier compatible: ~5-10ms inference time
 */

import { pipeline, env } from '@xenova/transformers';

// Configure transformers.js for Cloudflare Workers
env.allowLocalModels = false;
env.useBrowserCache = false;

// Cache the pipeline instance
let embeddingPipeline: any = null;

interface EmbeddingRequest {
  text: string | string[];
}

interface EmbeddingResponse {
  embeddings: number[][];
  dimensions: number;
  model: string;
}

interface ErrorResponse {
  error: string;
  code: number;
}

// CORS headers for PWA access
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

async function getEmbeddingPipeline() {
  if (!embeddingPipeline) {
    console.log('Loading embedding model...');
    embeddingPipeline = await pipeline(
      'feature-extraction',
      'Xenova/all-MiniLM-L6-v2',
      { quantized: true } // Use quantized model for faster inference
    );
    console.log('Model loaded');
  }
  return embeddingPipeline;
}

async function generateEmbedding(text: string | string[]): Promise<number[][]> {
  const extractor = await getEmbeddingPipeline();

  const texts = Array.isArray(text) ? text : [text];
  const embeddings: number[][] = [];

  for (const t of texts) {
    const output = await extractor(t, {
      pooling: 'mean',
      normalize: true
    });

    // Convert Float32Array to regular array
    embeddings.push(Array.from(output.data));
  }

  return embeddings;
}

export default {
  async fetch(request: Request, env: any, ctx: ExecutionContext): Promise<Response> {
    // Handle CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health' || url.pathname === '/') {
      return new Response(JSON.stringify({
        status: 'healthy',
        model: 'Xenova/all-MiniLM-L6-v2',
        dimensions: 384,
        version: '1.0.0'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Embedding endpoint
    if (url.pathname === '/embed' && request.method === 'POST') {
      try {
        const body = await request.json() as EmbeddingRequest;

        if (!body.text) {
          return new Response(JSON.stringify({
            error: 'Missing "text" field in request body',
            code: 400
          } as ErrorResponse), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        const startTime = Date.now();
        const embeddings = await generateEmbedding(body.text);
        const inferenceTime = Date.now() - startTime;

        const response: EmbeddingResponse = {
          embeddings,
          dimensions: 384,
          model: 'Xenova/all-MiniLM-L6-v2'
        };

        return new Response(JSON.stringify(response), {
          headers: {
            ...corsHeaders,
            'Content-Type': 'application/json',
            'X-Inference-Time': `${inferenceTime}ms`
          }
        });

      } catch (error) {
        console.error('Embedding error:', error);
        return new Response(JSON.stringify({
          error: error instanceof Error ? error.message : 'Embedding failed',
          code: 500
        } as ErrorResponse), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // 404 for unknown routes
    return new Response(JSON.stringify({
      error: 'Not found',
      code: 404,
      endpoints: {
        'GET /': 'Health check',
        'GET /health': 'Health check',
        'POST /embed': 'Generate embeddings { text: string | string[] }'
      }
    }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
};
