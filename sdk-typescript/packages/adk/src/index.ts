/**
 * WAVE Agent Developer Kit (ADK)
 *
 * The complete toolkit for AI agents to create, manage,
 * and interact with live video infrastructure.
 *
 * @example
 * ```typescript
 * import { WaveAgent, StreamMonitorAgent } from '@wave-av/adk';
 *
 * const agent = new StreamMonitorAgent({
 *   apiKey: process.env.WAVE_AGENT_KEY,
 *   onQualityDrop: async (alert) => {
 *     await agent.tools.switchToBackup(alert.streamId);
 *   },
 * });
 *
 * await agent.start();
 * ```
 */

// Core agent base class
export { WaveAgent, type WaveAgentConfig, type AgentEventHandler } from './agents/WaveAgent.js';

// Agent runtime (v2 — health, heartbeat, logging)
export { AgentRuntime, type AgentRuntimeConfig, type AgentHealthStatus } from './agents/AgentRuntime.js';
export { AgentLogger, type LogLevel, type AgentLoggerConfig } from './agents/AgentLogger.js';

// Pre-built agent templates
export { StreamMonitorAgent } from './templates/StreamMonitorAgent.js';
export { AutoProducerAgent } from './templates/AutoProducerAgent.js';
export { ClipFactoryAgent } from './templates/ClipFactoryAgent.js';
export { ModerationAgent } from './templates/ModerationAgent.js';
export { CaptionAgent } from './templates/CaptionAgent.js';

// Agent tools (MCP-compatible)
export { AgentToolkit, WaveToolError, type AgentTool } from './tools/AgentToolkit.js';

// Framework adapters
export { createMastraTools, createWaveMCPConfig, createStreamMonitorStep } from './adapters/mastra.js';
export { createLiveKitWaveTools, createWaveStreamSource } from './adapters/livekit.js';
export { createLangGraphTools, createStreamMonitorNode, createClipNode } from './adapters/langgraph.js';
export { createKernelTools, type KernelConfig } from './adapters/kernel.js';

// Types
export type {
  AgentType,
  AgentTier,
  AgentInvocation,
  AgentWebhookEvent,
  StreamQualityAlert,
  ClipHighlight,
  ModerationFlag,
} from './types.js';
