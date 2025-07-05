import { Socket } from 'socket.io';
import { z } from 'zod';
import BaseAgent, { AgentResult, AgentStatus, AgentContext, ValidationResult } from './BaseAgent';
import { LLMProviderName } from '../providers/LLMProvider.interface';
import { MessageType } from 'llamaindex';

export const ProcessStepNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['startNode', 'processNode', 'decisionNode', 'endNode', 'swimLaneNode']),
  position: z.object({
    x: z.number(), // Relative position within swimlane
    y: z.number(), // Relative position within swimlane
  }).default({ x:0, y:0 }),
  parentId: z.string().optional(), // Reference to swimlane node ID
  extent: z.literal('parent').optional(),
  data: z.object({
    label: z.string()
  }).optional()
});

export const ReactFlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.enum(['default', 'smoothstep', 'step', 'simplebezier']).default('smoothstep'),
  label: z.string().optional(),
  animated: z.boolean()
});

export const ProcessDiagramSchema = z.object({
  nodes: z.array(ProcessStepNodeSchema),
  edges: z.array(ReactFlowEdgeSchema),
  metadata: z.object({
    processName: z.string(),
    totalSteps: z.number(),
    complexity: z.enum(['low', 'medium', 'high']),
    createdAt: z.number(),
  }),
});

// Type exports for TypeScript
export type ProcessStepNode = z.infer<typeof ProcessStepNodeSchema>;
export type ReactFlowEdge = z.infer<typeof ReactFlowEdgeSchema>;
export type ProcessDiagramData = z.infer<typeof ProcessDiagramSchema>;

export interface ProcessExtractionResult extends AgentResult {
  processData?: ProcessDiagramData;
  isValid: boolean;
  validationErrors?: string[];
}

export class ProcessExtractionAgent extends BaseAgent {
  private readonly actorColors = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FECA57',
    '#FF9FF3', '#54A0FF', '#5F27CD', '#00D2D3', '#FF9F43'
  ];

  constructor() {
    const config = {
      provider: (process.env.MODEL_PROVIDER as LLMProviderName) || LLMProviderName.OPENAI,
      streaming: true,
      contextPersistence: true,
      maxTokens: 3000,
      temperature: 0.2, // Very low temperature for consistent JSON structure
    };
    
    super(config);
  }

  /**
   * System prompt defines the agent's identity and expertise
   */
  getSystemPrompt(): string {
    return `You are an expert business process analyst with deep expertise in workflow modeling and swimlane diagrams.

Your core competencies include:
- **Process Decomposition**: Breaking complex workflows into discrete, actionable steps
- **Actor Identification**: Recognizing all roles, departments, and systems involved in a process
- **Flow Analysis**: Understanding sequence, dependencies, and decision points in business processes
- **Swimlane Modeling**: Organizing process steps by responsible actors in clear swimlane structures

Your approach is methodical and thorough:
1. You carefully analyze each feature description to understand the complete workflow
2. You identify all explicit and implicit actors mentioned
3. You break down processes into atomic steps that map to swimlane diagram elements
4. You ensure complete flow coverage from start to end, including all decision branches
5. You maintain logical consistency in actor assignments and step sequences

You specialize in converting feature descriptions into structured data suitable for interactive process visualization tools. You understand that your output will be used to generate React-Flow based swimlane diagrams, so precision and completeness are essential.

When analyzing processes, you consider:
- Business rules and policies that govern decisions
- Error handling and exception flows  
- Loops and iterative processes
- Parallel activities and synchronization points
- Start and end conditions

You communicate through structured data formats optimized for modern web-based diagram libraries.`;
  }

  /**
   * Process a specific feature description and extract React-Flow compatible data
   * This uses the BaseAgent's chat engine (which has our system prompt) 
   */
  async processMessage(sessionId: string, message: string, socket: Socket): Promise<void> {
    try {
      this.emitStatus(socket, { 
        status: "thinking", 
        action: "Analyzing feature description..." 
      });

      // Use BaseAgent's executeWithStreaming which uses the chat engine with our system prompt
      // But we need to modify the approach to get JSON output
      const context = this.getOrCreateContext(sessionId);
      
      // Initialize chat engine if needed (this will use our getSystemPrompt())
      if (!this.chatEngine) {
        await this.initializeChatEngine(sessionId);
      }

      // Create the specific extraction task prompt
      const extractionPrompt = this.buildExtractionPrompt(message);
      
      this.emitStatus(socket, { 
        status: "extracting", 
        action: "Extracting process structure..." 
      });

      // Use the chat engine (which has our system prompt) with the task prompt
      const response = await this.chatEngine!.chat({
        message: extractionPrompt,
        chatHistory: [], // Don't use previous context for JSON extraction
        stream: false,
      });

      this.emitStatus(socket, { 
        status: "validating", 
        action: "Validating and structuring data..." 
      });

      // Parse and validate the response using Zod
      console.log(response.response);
      const processData = this.parseAndValidateResponse(response.response);
      
      if (processData.isValid && processData.data) {
        // Convert to React-Flow format and add positioning
        const reactFlowData = this.convertToReactFlowFormat(processData.data);
        
        // Add to context for future reference
        context.messages.push({
          content: message,
          role: "user" as MessageType,
        });
        context.messages.push({
          content: `Extracted process: ${reactFlowData.metadata.processName}`,
          role: "assistant" as MessageType,
        });
        
        // Emit the valid process data
        socket.emit('process:extracted', {
          processData: reactFlowData,
          metadata: {
            sessionId,
            extractedAt: new Date().toISOString(),
            featureDescription: message,
          }
        });
        
        this.emitStatus(socket, { status: "complete" });
      } else {
        // Handle validation errors
        socket.emit('process:validation-error', {
          errors: processData.errors,
          rawResponse: response.response.substring(0, 500) + '...', // Truncated for debugging
        });
        
        this.emitStatus(socket, { 
          status: "error", 
          action: "Process extraction failed validation" 
        });
      }

    } catch (error) {
      console.error('Process extraction error:', error);
      this.emitError(socket, error as Error);
    }
  }

  /**
   * Build the task-specific extraction prompt with React-Flow schema
   */
  private buildExtractionPrompt(featureDescription: string): string {
    return `Analyze the following feature description and extract a complete process flow.

FEATURE DESCRIPTION:
"${featureDescription}"

TASK: Convert this into a structured process with the following requirements:

1. **Identify all actors (swimlane)** involved
2. **Extract all process steps** and classify each as:
   - "start": Process initiation points
   - "process": Tasks or activities  
   - "decision": Choice points with multiple outcomes
   - "end": Process completion points

3. **Map the complete flow** including all connections between steps

OUTPUT REQUIREMENTS:
Respond with ONLY valid JSON in this exact format:

{
  "nodes" : [
  {
    "id": "1",
    "data": {
      "label": "Operator"
    },
    "type": "swimLaneNode",
    "position": {
      "x": 0,
      "y": 0
    },
    "style": {
      "width": 720,
      "height": 100
    }
  },
  {
    "id": "2",
    "data": {
      "label": "Start"
    },
    "parentId": "1",
    "extent": "parent",
    "type": "startNode"
  },
  {
    "id": "3",
    "data": {
      "label": "Create PO"
    },
    "parentId": "1",
    "extent": "parent",
    "type": "processNode"
  },
  {
    "id": "4",
    "data": {
      "label": "Operations Admin"
    },
    "type": "swimLaneNode",
    "position": {
      "x": 0,
      "y": 102
    },
    "style": {
      "width": 720,
      "height": 100
    }
  },
  {
    "id": "5",
    "data": {
      "label": "Review"
    },
    "parentId": "4",
    "extent": "parent",
    "type": "processNode"
  },
  {
    "id": "6",
    "data": {
      "label": "Approve"
    },
    "parentId": "4",
    "extent": "parent",
    "type": "decisionNode"
  },
  {
    "id": "7",
    "data": {
      "label": "Re-submit PO"
    },
    "parentId": "1",
    "extent": "parent",
    "type": "processNode"
  },
  {
    "id": "8",
    "parentId": "4",
    "extent": "parent",
    "type": "endNode"
  }
],
"edges": [
  {
    "id": "2-3",
    "source": "2",
    "target": "3",
    "type": "smoothstep",
    "animated": true
  },
  {
    "id": "5-6",
    "source": "5",
    "target": "6",
    "type": "smoothstep",
    "animated": true
  },
  {
    "id": "3-5",
    "source": "3",
    "target": "5",
    "label": "review",
    "type": "smoothstep",
    "animated": true
  },
  {
    "id": "6-7",
    "source": "6",
    "target": "7",
    "label": "reject",
    "type": "smoothstep",
    "animated": true
  },
  {
    "id": "6-8",
    "source": "6",
    "target": "8",
    "label": "approve",
    "type": "smoothstep",
    "animated": true
  },
  {
    "id": "7-5",
    "source": "7",
    "target": "5",
    "label": "re-submit",
    "type": "smoothstep",
    "animated": true
  }
]
  "metadata": {
    "processName": "Purchase Order Review Process",
    "totalSteps": 6,
    "complexity": "medium"
  }
}

CRITICAL RULES:
- Output ONLY the JSON, no additional text or markdown
- Every step must have a unique ID (use descriptive prefixes)
- All actors must be consistent throughout
- Decision steps must include conditions array
- Every step must specify what comes next via "next" array
- Start steps have no predecessors, end steps have empty "next" array
- Use clear, actionable step labels

Generate the process JSON now:`;
  }

  /**
   * Parse and validate using Zod schemas
   */
  private parseAndValidateResponse(response: string): {
    isValid: boolean;
    data?: any; // Will be converted to ProcessDiagramData later
    errors?: string[];
  } {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return {
          isValid: false,
          errors: ['No valid JSON found in response']
        };
      }

      const parsedData = JSON.parse(jsonMatch[0]);
      
      // Basic structure validation before conversion
      if (!parsedData.nodes || !parsedData.edges || !parsedData.metadata) {
        return {
          isValid: false,
          errors: ['Missing required fields: actors, steps, or metadata']
        };
      }

      return {
        isValid: true,
        data: parsedData
      };
      
    } catch (parseError) {
      return {
        isValid: false,
        errors: [`JSON parsing failed: ${(parseError as Error).message}`]
      };
    }
  }

  /**
   * Convert raw process data to nested React-Flow compatible format
   */
  private convertToReactFlowFormat(rawData: any): ProcessDiagramData {
    rawData.metadata.createdAt = Date.now();
    // Validate with Zod schema
    const validationResult = ProcessDiagramSchema.safeParse(rawData);
    if (!validationResult.success) {
      console.error('Zod validation failed:', validationResult.error);
      throw new Error(`Schema validation failed: ${validationResult.error.message}`);
    }

    return validationResult.data;
  }

  /**
   * Zod-based validation - now matches BaseAgent interface
   */
  validateResponse(data: any): ValidationResult {
    try {
      const validatedData = ProcessDiagramSchema.parse(data);
      return { 
        isValid: true, 
        data: validatedData 
      };
    } catch (error) {
      if (error instanceof z.ZodError) {
        const errors = error.errors.map(err => 
          `${err.path.join('.')}: ${err.message}`
        );
        return { isValid: false, errors };
      }
      return { isValid: false, errors: ['Unknown validation error'] };
    }
  }

  /**
   * Override execute to handle process extraction without streaming
   * This also uses the chat engine with our system prompt
   */
  async execute(sessionId: string, message: string): Promise<ProcessExtractionResult> {
    const startTime = Date.now();
    
    try {
      // Initialize chat engine if needed (this will use our getSystemPrompt())
      if (!this.chatEngine) {
        await this.initializeChatEngine(sessionId);
      }

      const extractionPrompt = this.buildExtractionPrompt(message);
      
      // Use the chat engine (which has our system prompt)
      const response = await this.chatEngine!.chat({
        message: extractionPrompt,
        chatHistory: [], // Don't use previous context for JSON extraction
        stream: false,
      });

      const parseResult = this.parseAndValidateResponse(response.response);
      
      if (parseResult.isValid && parseResult.data) {
        const reactFlowData = this.convertToReactFlowFormat(parseResult.data);
        
        return {
          response: 'Process extracted successfully',
          processData: reactFlowData,
          isValid: true,
          metadata: {
            executionTime: Date.now() - startTime,
          }
        };
      } else {
        return {
          response: 'Process extraction failed',
          isValid: false,
          validationErrors: parseResult.errors,
          metadata: {
            executionTime: Date.now() - startTime,
          }
        };
      }
      
    } catch (error) {
      return {
        response: 'Process extraction failed',
        isValid: false,
        validationErrors: [`Execution error: ${(error as Error).message}`],
        metadata: {
          executionTime: Date.now() - startTime,
        }
      };
    }
  }
}

export default ProcessExtractionAgent;