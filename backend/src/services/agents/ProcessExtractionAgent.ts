import { Socket } from 'socket.io';
import { z } from 'zod';
import BaseAgent, { AgentResult, AgentStatus, AgentContext, ValidationResult } from './BaseAgent';
import { LLMProviderName } from '../providers/LLMProvider.interface';
import { MessageType } from 'llamaindex';

// Zod schemas for React-Flow compatible nested swimlane structure
export const SwimlaneNodeSchema = z.object({
  id: z.string(),
  type: z.literal('swimlane'),
  position: z.object({
    x: z.number(),
    y: z.number(),
  }),
  data: z.object({
    label: z.string(), // Actor name
    actor: z.string(),
    color: z.string(),
    childNodeIds: z.array(z.string()), // IDs of child nodes
  }),
  style: z.object({
    width: z.number().optional(), // Will be auto-calculated by FE
    height: z.number().optional(), // Will be auto-calculated by FE
    backgroundColor: z.string(),
    border: z.string().optional(),
  }),
});

export const ProcessStepNodeSchema = z.object({
  id: z.string(),
  type: z.enum(['start', 'action', 'decision', 'end']),
  position: z.object({
    x: z.number(), // Relative position within swimlane
    y: z.number(), // Relative position within swimlane
  }),
  parentId: z.string(), // Reference to swimlane node ID
  extent: z.literal('parent'),
  data: z.object({
    label: z.string(),
    stepType: z.enum(['start', 'action', 'decision', 'end']),
    actor: z.string(),
    conditions: z.array(z.object({
      outcome: z.string(),
      nextStep: z.string(),
    })).optional(),
  }),
  style: z.object({
    backgroundColor: z.string(),
    border: z.string().optional(),
    color: z.string().optional(),
  }),
});

export const ReactFlowEdgeSchema = z.object({
  id: z.string(),
  source: z.string(),
  target: z.string(),
  type: z.enum(['default', 'smoothstep', 'step', 'simplebezier']).default('simplebezier'),
  label: z.string().optional(),
  style: z.object({
    stroke: z.string().optional(),
    strokeWidth: z.number().optional(),
  }).optional(),
  markerEnd: z.object({
    type: z.string(),
    color: z.string().optional(),
  }).optional(),
});

export const ProcessDiagramSchema = z.object({
  actors: z.array(z.string()),
  swimlanes: z.array(SwimlaneNodeSchema), // Parent nodes
  processSteps: z.array(ProcessStepNodeSchema), // Child nodes
  edges: z.array(ReactFlowEdgeSchema),
  layoutConfig: z.object({
    orientation: z.enum(['horizontal', 'vertical']).default('horizontal'),
    swimlaneSpacing: z.number().default(50),
    nodeSpacing: z.object({
      x: z.number().default(150),
      y: z.number().default(80),
    }),
    autoSize: z.boolean().default(true),
  }),
  metadata: z.object({
    processName: z.string(),
    totalSteps: z.number(),
    complexity: z.enum(['low', 'medium', 'high']),
    createdAt: z.string().datetime(),
  }),
});

// Type exports for TypeScript
export type SwimlaneNode = z.infer<typeof SwimlaneNodeSchema>;
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

1. **Identify all actors** (roles, departments, systems) involved
2. **Extract all process steps** and classify each as:
   - "start": Process initiation points
   - "action": Tasks or activities  
   - "decision": Choice points with multiple outcomes
   - "end": Process completion points

3. **Map the complete flow** including all connections between steps

OUTPUT REQUIREMENTS:
Respond with ONLY valid JSON in this exact format:

{
  "actors": ["Operations Admin", "Operator"],
  "steps": [
    {
      "id": "start_1",
      "type": "start",
      "actor": "Operator",
      "label": "Begin process",
      "next": ["step_2"]
    },
    {
      "id": "step_2", 
      "type": "action",
      "actor": "Operator",
      "label": "Submit purchase order",
      "next": ["step_3"]
    },
    {
      "id": "step_3",
      "type": "decision", 
      "actor": "Operations Admin",
      "label": "Review PO - requires escalation?",
      "next": ["step_4", "step_5"],
      "conditions": [
        {"outcome": "escalate", "nextStep": "step_4"},
        {"outcome": "no_escalation", "nextStep": "step_5"}
      ]
    },
    {
      "id": "step_4",
      "type": "action",
      "actor": "Operations Admin", 
      "label": "Escalate purchase order",
      "next": ["step_5"]
    },
    {
      "id": "step_5",
      "type": "decision",
      "actor": "Operations Admin",
      "label": "Approve or reject PO?", 
      "next": ["step_6", "step_7"],
      "conditions": [
        {"outcome": "approve", "nextStep": "step_6"},
        {"outcome": "reject", "nextStep": "step_7"}
      ]
    },
    {
      "id": "step_6",
      "type": "action",
      "actor": "Operations Admin",
      "label": "Approve purchase order",
      "next": ["end_1"]
    },
    {
      "id": "step_7", 
      "type": "action",
      "actor": "Operations Admin",
      "label": "Reject purchase order",
      "next": ["step_8"]
    },
    {
      "id": "step_8",
      "type": "action", 
      "actor": "Operator",
      "label": "Edit and resubmit PO",
      "next": ["step_3"]
    },
    {
      "id": "end_1",
      "type": "end",
      "actor": "Operations Admin", 
      "label": "Process complete",
      "next": []
    }
  ],
  "metadata": {
    "processName": "Purchase Order Review Process",
    "totalSteps": 8,
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
      if (!parsedData.actors || !parsedData.steps || !parsedData.metadata) {
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
    const actors = rawData.actors as string[];
    const swimlanes: SwimlaneNode[] = [];
    const processSteps: ProcessStepNode[] = [];
    const edges: ReactFlowEdge[] = [];

    // Create swimlane parent nodes
    actors.forEach((actor, index) => {
      const swimlaneId = `swimlane-${actor.toLowerCase().replace(/\s+/g, '-')}`;
      
      swimlanes.push({
        id: swimlaneId,
        type: 'swimlane',
        position: { x: 0, y: 0 }, // Frontend will calculate based on layout
        data: {
          label: actor,
          actor: actor,
          color: this.actorColors[index % this.actorColors.length],
          childNodeIds: [], // Will be populated below
        },
        style: {
          backgroundColor: `${this.actorColors[index % this.actorColors.length]}15`, // 15% opacity
          border: `2px solid ${this.actorColors[index % this.actorColors.length]}`,
        },
      });
    });

    // Create process step child nodes and organize by swimlane
    const swimlaneStepMap: { [swimlaneId: string]: string[] } = {};
    
    rawData.steps.forEach((step: any, index: number) => {
      const swimlaneId = `swimlane-${step.actor.toLowerCase().replace(/\s+/g, '-')}`;
      
      // Initialize array if first step for this swimlane
      if (!swimlaneStepMap[swimlaneId]) {
        swimlaneStepMap[swimlaneId] = [];
      }
      
      // Calculate relative position within swimlane (frontend will use this as base)
      const stepsInLane = swimlaneStepMap[swimlaneId].length;
      const relativePosition = {
        x: 20, // Small padding from swimlane edge
        y: 20 + (stepsInLane * 100), // Vertical spacing between steps
      };

      const processStepNode: ProcessStepNode = {
        id: step.id,
        type: step.type,
        position: relativePosition,
        parentId: swimlaneId,
        extent: 'parent',
        data: {
          label: step.label,
          stepType: step.type,
          actor: step.actor,
          conditions: step.conditions,
        },
        style: {
          backgroundColor: this.getNodeColor(step.type),
          border: '2px solid #333',
          color: '#333',
        },
      };

      processSteps.push(processStepNode);
      swimlaneStepMap[swimlaneId].push(step.id);

      // Create edges for connections
      if (step.next && Array.isArray(step.next)) {
        step.next.forEach((nextStepId: string, edgeIndex: number) => {
          const edge: ReactFlowEdge = {
            id: `${step.id}-${nextStepId}`,
            source: step.id,
            target: nextStepId,
            type: 'simplebezier',
            style: {
              stroke: '#666',
              strokeWidth: 2,
            },
            markerEnd: {
              type: 'arrowclosed',
              color: '#666',
            },
          };

          // Add label for decision outcomes
          if (step.type === 'decision' && step.conditions) {
            const condition = step.conditions[edgeIndex];
            if (condition) {
              edge.label = condition.outcome;
            }
          }

          edges.push(edge);
        });
      }
    });

    // Update swimlanes with their child node IDs
    swimlanes.forEach(swimlane => {
      const childIds = swimlaneStepMap[swimlane.id] || [];
      swimlane.data.childNodeIds = childIds;
    });

    // Create the process diagram data
    const processData: ProcessDiagramData = {
      actors,
      swimlanes,
      processSteps,
      edges,
      layoutConfig: {
        orientation: 'horizontal', // Default to horizontal
        swimlaneSpacing: 50,
        nodeSpacing: {
          x: 150,
          y: 80,
        },
        autoSize: true,
      },
      metadata: {
        processName: rawData.metadata.processName,
        totalSteps: rawData.metadata.totalSteps,
        complexity: rawData.metadata.complexity,
        createdAt: new Date().toISOString(),
      },
    };

    // Validate with Zod schema
    const validationResult = ProcessDiagramSchema.safeParse(processData);
    
    if (!validationResult.success) {
      console.error('Zod validation failed:', validationResult.error);
      throw new Error(`Schema validation failed: ${validationResult.error.message}`);
    }

    return validationResult.data;
  }

  /**
   * Get node color based on step type
   */
  private getNodeColor(stepType: string): string {
    const colors = {
      start: '#90EE90',    // Light green
      action: '#87CEEB',   // Sky blue  
      decision: '#FFD700', // Gold
      end: '#FFA07A',      // Light salmon
    };
    return colors[stepType as keyof typeof colors] || '#E0E0E0';
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