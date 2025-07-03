import { Socket } from 'socket.io';
import {
  Settings,
  Document,
  VectorStoreIndex,
  storageContextFromDefaults,
  ContextChatEngine,
  ChatMessage,
  MessageType,
  PromptTemplate,
  FunctionTool,
} from "llamaindex";

import AzureOpenAIProvider from '../providers/AzureOpenai.provider';
import AnthropicProvider from '../providers/Anthropic.provider';
import { LLMProvider, LLMProviderName } from '../providers/LLMProvider.interface'
import OpenAIProvider from '../providers/Openai.provider';
import * as path from 'path';
import * as fs from 'fs';

interface AgentConfig {
  provider: LLMProviderName;
  streaming: boolean;
  contextPersistence: boolean;
  maxTokens?: number;
}

export interface ToolExecution {
  toolName: string;
  input: any;
  output: any;
  executionTime: number;
  error?: string;
}

export interface AgentContext {
  sessionId: string;
  messages: ChatMessage[];
  currentView?: string;
  preferences?: any;
  lastToolExecutions?: ToolExecution[];
  createdAt: number;
  lastAccessedAt: number;
}

export interface AgentResult {
  response: string;
  processData?: any;
  metadata?: {
    executionTime: number;
    tokenUsage?: any;
  };
}

export interface AgentStatus {
  status: "thinking" | "extracting" | "validating" | "complete" | "error";
  action?: string;
}

// Updated validation result interface
export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  data?: any;
}

abstract class BaseAgent {
  protected provider: LLMProvider;
  protected chatEngine: ContextChatEngine | null = null;
  private contexts: Map<string, AgentContext> = new Map();
  private persistenceEnabled: boolean = true;
  private readonly contextStoragePath: string = path.join(process.cwd(), "storage", "contexts");
  protected config: AgentConfig;

  constructor(config: AgentConfig) {
    this.config = config;
    this.provider = this.initializeProvider();
    this.configureLlamaIndex();
    this.persistenceEnabled = config.contextPersistence;
  }

  // Abstract methods (must implement in child classes):
  abstract getSystemPrompt(): string
  abstract processMessage(sessionId: string, message: string, socket: Socket): Promise<void>
  
  // Updated to return ValidationResult instead of boolean
  abstract validateResponse(response: any): ValidationResult

  private configureLlamaIndex(): void {
    Settings.llm = this.provider.getLLM();
    Settings.embedModel = this.provider.getEmbedding();
  }

  protected async initializeChatEngine(sessionId: string) {
    const storageContext = await storageContextFromDefaults({
      persistDir: `./storage/${sessionId}`,
    });

    const documents: Document[] = [];
    const index = await VectorStoreIndex.fromDocuments(documents, {
      storageContext,
    });

    // Use the abstract getSystemPrompt() method from child class
    const systemPromptText = this.getSystemPrompt();
    
    const systemPrompt = new PromptTemplate({
      template: `${systemPromptText}

Context information is below:
---------------------
{context}
---------------------

Use the context information above to provide more personalized and informed responses when available.`,
      templateVars: ["context"],
    });

    this.chatEngine = new ContextChatEngine({
      chatModel: this.provider.getLLM(),
      retriever: index.asRetriever(),
      contextSystemPrompt: systemPrompt,
    });
  }

  protected initializeProvider(): LLMProvider {
    let provider: LLMProvider;
    const providerName = this.config.provider || (process.env.MODEL_PROVIDER as LLMProviderName);

    switch (providerName) {
      case LLMProviderName.AZURE_OPENAI:
        provider = new AzureOpenAIProvider();
        break;
      case LLMProviderName.OPENAI:
        provider = new OpenAIProvider();
        break;
      case LLMProviderName.ANTHROPIC:
        provider = new AnthropicProvider();
        break;
      default:
        console.warn(
          `Unknown provider ${providerName}, defaulting to OpenAI`
        );
        provider = new OpenAIProvider();
    }

    console.log(`✅ Initialized ${provider.name} provider`);
    return provider;
  }

  protected getOrCreateContext(sessionId: string): AgentContext {
    if (!this.contexts.has(sessionId)) {
      const now = Date.now();
      const context: AgentContext = {
        sessionId,
        messages: [],
        createdAt: now,
        lastAccessedAt: now,
      };
      this.contexts.set(sessionId, context);
    } else {
      const context = this.contexts.get(sessionId)!;
      context.lastAccessedAt = Date.now();
    }
    return this.contexts.get(sessionId)!;
  }

  protected emitStatus(socket: Socket, status: AgentStatus): void {
    socket.emit('agent:status', status);
  }

  protected emitError(socket: Socket, error: Error): void {
    socket.emit('agent:error', {
      message: error.message,
      timestamp: new Date().toISOString()
    });
  }

  protected emitProcessChunk(socket: Socket, chunk: string): void {
    socket.emit('agent:process-chunk', { chunk });
  }

  protected emitProcessComplete(socket: Socket, data: any): void {
    socket.emit('agent:process-complete', data);
  }

  /**
   * Execute with chat engine (for conversational interactions)
   * Child classes can override this for specialized behavior
   */
  async execute(sessionId: string, message: string): Promise<AgentResult> {
    const startTime = Date.now();
    const context = this.getOrCreateContext(sessionId);
    
    // Initialize chat engine if needed
    if (!this.chatEngine) {
      await this.initializeChatEngine(sessionId);
    }

    // Add user message to context
    context.messages.push({
      content: message,
      role: "user" as MessageType,
    });

    const response = await this.chatEngine!.chat({
      message,
      chatHistory: context.messages,
      stream: false, // For execute, we don't stream
    });

    let fullResponse = response.response;

    // Add assistant response to context
    context.messages.push({
      content: fullResponse,
      role: "assistant" as MessageType,
    });

    return {
      response: fullResponse,
      metadata: {
        executionTime: Date.now() - startTime,
      }
    };
  }

  /**
   * Execute with streaming using chat engine
   * Calls processMessage() for agent-specific streaming behavior
   */
  async executeWithStreaming(sessionId: string, message: string, socket: Socket): Promise<void> {
    // Delegate to the child class's processMessage implementation
    await this.processMessage(sessionId, message, socket);
  }

  getContext(sessionId: string): AgentContext {
    return this.getOrCreateContext(sessionId);
  }

  async clearContext(sessionId: string): Promise<void> {
    this.contexts.delete(sessionId);
    if (this.persistenceEnabled) {
      try {
        const filePath = path.join(this.contextStoragePath, `${sessionId}.json`);
        await fs.promises.unlink(filePath);
      } catch (error) {
        // File might not exist, ignore error
      }
    }
  }

  // Utility method for child classes to get direct LLM access
  protected getLLM() {
    return this.provider.getLLM();
  }
}

export default BaseAgent;