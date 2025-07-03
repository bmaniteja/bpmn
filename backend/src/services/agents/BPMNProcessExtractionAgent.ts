import { Socket } from 'socket.io';
import { z } from 'zod';
import BaseAgent, { AgentResult, AgentStatus, AgentContext, ValidationResult } from './BaseAgent';
import { LLMProviderName } from '../providers/LLMProvider.interface';
import { MessageType } from 'llamaindex';

// BPMN-compatible Zod schemas
export const BPMNElementSchema = z.object({
    id: z.string(),
    type: z.enum([
        'bpmn:StartEvent',
        'bpmn:Task',
        'bpmn:UserTask',
        'bpmn:ServiceTask',
        'bpmn:ExclusiveGateway',
        'bpmn:ParallelGateway',
        'bpmn:EndEvent'
    ]),
    name: z.string(),
    documentation: z.string().optional(),
    // Swimlane assignment
    lane: z.string().optional(),
    participant: z.string(),
    // Position for layout
    bounds: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
    }),
    // Gateway-specific properties
    gatewayDirection: z.enum(['Diverging', 'Converging', 'Mixed']).optional(),
});

export const BPMNSequenceFlowSchema = z.object({
    id: z.string(),
    sourceRef: z.string(),
    targetRef: z.string(),
    name: z.string().optional(), // For gateway conditions
    conditionExpression: z.string().optional(),
    isDefault: z.boolean().optional(),
    waypoints: z.array(z.object({
        x: z.number(),
        y: z.number(),
    })).optional(),
});

export const BPMNLaneSchema = z.object({
    id: z.string(),
    name: z.string(),
    participantRef: z.string(),
    flowNodeRefs: z.array(z.string()), // Elements in this lane
    bounds: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
    }),
});

export const BPMNParticipantSchema = z.object({
    id: z.string(),
    name: z.string(),
    processRef: z.string(),
    bounds: z.object({
        x: z.number(),
        y: z.number(),
        width: z.number(),
        height: z.number(),
    }),
});

export const BPMNProcessSchema = z.object({
    id: z.string(),
    name: z.string(),
    isExecutable: z.boolean().default(false),
    elements: z.array(BPMNElementSchema),
    sequenceFlows: z.array(BPMNSequenceFlowSchema),
});

export const BPMNDiagramSchema = z.object({
    processes: z.array(BPMNProcessSchema),
    participants: z.array(BPMNParticipantSchema),
    lanes: z.array(BPMNLaneSchema).optional(),
    metadata: z.object({
        processName: z.string(),
        totalElements: z.number(),
        complexity: z.enum(['low', 'medium', 'high']),
        createdAt: z.string().datetime(),
        bpmnVersion: z.string().default('2.0'),
    }),
});

// Type exports
export type BPMNElement = z.infer<typeof BPMNElementSchema>;
export type BPMNSequenceFlow = z.infer<typeof BPMNSequenceFlowSchema>;
export type BPMNLane = z.infer<typeof BPMNLaneSchema>;
export type BPMNParticipant = z.infer<typeof BPMNParticipantSchema>;
export type BPMNProcess = z.infer<typeof BPMNProcessSchema>;
export type BPMNDiagramData = z.infer<typeof BPMNDiagramSchema>;

export interface BPMNExtractionResult extends AgentResult {
    bpmnData?: BPMNDiagramData;
    bpmnXML?: string;
    isValid: boolean;
    validationErrors?: string[];
}

export class BPMNProcessExtractionAgent extends BaseAgent {
    private readonly participantColors = [
        '#E3F2FD', '#F3E5F5', '#E8F5E8', '#FFF3E0', '#FCE4EC',
        '#E0F2F1', '#F1F8E9', '#FFF8E1', '#EFEBE9', '#FAFAFA'
    ];

    constructor() {
        const config = {
            provider: (process.env.MODEL_PROVIDER as LLMProviderName) || LLMProviderName.OPENAI,
            streaming: true,
            contextPersistence: true,
            maxTokens: 4000,
            temperature: 0.1, // Very low for consistent BPMN structure
        };

        super(config);
    }

    getSystemPrompt(): string {
        return `You are an expert BPMN (Business Process Model and Notation) analyst with deep expertise in business process modeling and swimlane diagrams.

Your core competencies include:
- **BPMN 2.0 Standards**: Deep understanding of BPMN elements, symbols, and notation rules
- **Process Decomposition**: Breaking workflows into proper BPMN elements (events, tasks, gateways)
- **Swimlane Modeling**: Organizing processes using participants and lanes for role-based responsibility
- **Gateway Logic**: Properly modeling decision points with exclusive and parallel gateways
- **Flow Analysis**: Understanding sequence flows, message flows, and process boundaries

Your BPMN expertise covers:
- **Start Events**: Process triggers and initiators
- **Tasks**: User tasks, service tasks, and generic tasks based on automation level
- **Gateways**: Exclusive (XOR), Parallel (AND), and Inclusive (OR) decision points
- **End Events**: Process completion and termination points
- **Participants**: High-level organizational units (departments, systems, roles)
- **Lanes**: Sub-divisions within participants for specific actors

You convert feature descriptions into valid BPMN-compliant process models that can be rendered in bpmn-js. You ensure:
- Proper BPMN element types and naming conventions
- Correct gateway usage for decision logic
- Clear participant and lane organization
- Valid sequence flow connections
- Comprehensive process coverage from start to end

Your output is structured data optimized for BPMN visualization tools and follows BPMN 2.0 standards.`;
    }

    async processMessage(sessionId: string, message: string, socket: Socket): Promise<void> {
        try {
            this.emitStatus(socket, {
                status: "thinking",
                action: "Analyzing feature for BPMN extraction..."
            });

            const context = this.getOrCreateContext(sessionId);

            if (!this.chatEngine) {
                await this.initializeChatEngine(sessionId);
            }

            const extractionPrompt = this.buildBPMNExtractionPrompt(message);

            this.emitStatus(socket, {
                status: "extracting",
                action: "Extracting BPMN process structure..."
            });

            const response = await this.chatEngine!.chat({
                message: extractionPrompt,
                chatHistory: [],
                stream: false,
            });

            this.emitStatus(socket, {
                status: "validating",
                action: "Validating BPMN structure..."
            });

            const processData = this.parseAndValidateBPMNResponse(response.response);

            if (processData.isValid && processData.data) {
                const bpmnData = this.convertToBPMNFormat(processData.data);
                const bpmnXML = this.generateBPMNXML(bpmnData);

                context.messages.push({
                    content: message,
                    role: "user" as MessageType,
                });
                context.messages.push({
                    content: `Extracted BPMN process: ${bpmnData.metadata.processName}`,
                    role: "assistant" as MessageType,
                });

                socket.emit('bpmn:extracted', {
                    bpmnData,
                    bpmnXML,
                    metadata: {
                        sessionId,
                        extractedAt: new Date().toISOString(),
                        featureDescription: message,
                    }
                });

                this.emitStatus(socket, { status: "complete" });
            } else {
                socket.emit('bpmn:validation-error', {
                    errors: processData.errors,
                    rawResponse: response.response.substring(0, 500) + '...',
                });

                this.emitStatus(socket, {
                    status: "error",
                    action: "BPMN extraction failed validation"
                });
            }

        } catch (error) {
            console.error('BPMN extraction error:', error);
            this.emitError(socket, error as Error);
        }
    }

    private buildBPMNExtractionPrompt(featureDescription: string): string {
        return `Analyze the following feature description and extract a complete BPMN process model.

FEATURE DESCRIPTION:
"${featureDescription}"

TASK: Convert this into a structured BPMN process with the following requirements:

1. **Identify participants** (departments, roles, systems) - these will be swimlanes
2. **Extract process elements** and classify each as:
   - "bpmn:StartEvent": Process initiation
   - "bpmn:Task": Generic work activities
   - "bpmn:UserTask": Human-performed activities
   - "bpmn:ServiceTask": System/automated activities
   - "bpmn:ExclusiveGateway": Decision points (XOR logic)
   - "bpmn:ParallelGateway": Parallel work (AND logic)
   - "bpmn:EndEvent": Process completion

3. **Map sequence flows** between all elements with proper conditions for gateways
4. **Assign elements to correct participants** based on who performs each activity

OUTPUT REQUIREMENTS:
Respond with ONLY valid JSON in this exact format:

{
  "participants": [
    {"name": "Operations Admin", "id": "participant_ops"},
    {"name": "Operator", "id": "participant_operator"}
  ],
  "elements": [
    {
      "id": "start_1",
      "type": "bpmn:StartEvent",
      "name": "Purchase request received",
      "participant": "participant_operator"
    },
    {
      "id": "task_1", 
      "type": "bpmn:UserTask",
      "name": "Review purchase request",
      "participant": "participant_ops"
    },
    {
      "id": "gateway_1",
      "type": "bpmn:ExclusiveGateway", 
      "name": "Amount exceeds limit?",
      "participant": "participant_ops"
    },
    {
      "id": "task_2",
      "type": "bpmn:UserTask",
      "name": "Approve purchase",
      "participant": "participant_ops"
    },
    {
      "id": "task_3",
      "type": "bpmn:UserTask",
      "name": "Edit and resubmit",
      "participant": "participant_operator"
    },
    {
      "id": "end_1",
      "type": "bpmn:EndEvent",
      "name": "Purchase approved",
      "participant": "participant_ops"
    },
    {
      "id": "end_2",
      "type": "bpmn:EndEvent",
      "name": "Purchase rejected",
      "participant": "participant_operator"
    }
  ],
  "sequenceFlows": [
    {
      "id": "flow_1",
      "sourceRef": "start_1",
      "targetRef": "task_1"
    },
    {
      "id": "flow_2", 
      "sourceRef": "task_1",
      "targetRef": "gateway_1"
    },
    {
      "id": "flow_3",
      "sourceRef": "gateway_1", 
      "targetRef": "task_2",
      "name": "Amount > $5000",
      "conditionExpression": "amount > 5000"
    },
    {
      "id": "flow_4",
      "sourceRef": "gateway_1",
      "targetRef": "end_2",
      "name": "Amount <= $5000",
      "conditionExpression": "amount <= 5000"
    },
    {
      "id": "flow_5",
      "sourceRef": "task_2",
      "targetRef": "end_1"
    },
    {
      "id": "flow_6",
      "sourceRef": "end_2",
      "targetRef": "task_3"
    },
    {
      "id": "flow_7",
      "sourceRef": "task_3",
      "targetRef": "task_1"
    }
  ],
  "metadata": {
    "processName": "Purchase Request Process",
    "complexity": "medium"
  }
}

CRITICAL RULES:
- Output ONLY the JSON, no additional text
- Use proper BPMN element types with "bpmn:" prefix
- Every element must have a unique ID
- All participants must be referenced consistently
- **Assign each element to the correct participant who performs that activity**
- Gateways require both incoming and outgoing flows
- Use descriptive names for elements and flows
- Include condition expressions for gateway flows
- Ensure complete flow from start to end events
- **Start events should be assigned to the participant who initiates the process**
- **End events should be assigned to the participant who completes that particular path**
- **Tasks should be assigned to the participant who performs the work**
- **Gateways should be assigned to the participant who makes the decision**
- Cross-swimlane flows are allowed and encouraged when the process moves between participants
- Each participant should have at least one element assigned to them
- Use logical participant assignment based on real-world process ownership
- **End events cannot have outgoing flows** - they terminate the process
- **If you need to continue after rejection, use a Task instead of End Event**
- Use End Events only for true process termination points

PARTICIPANT ASSIGNMENT EXAMPLES:
- Customer submitting request → Customer participant
- Manager reviewing request → Manager participant  
- System sending notification → System participant
- Finance approving payment → Finance participant

Generate the BPMN JSON now:`;
    }

    private parseAndValidateBPMNResponse(response: string): {
        isValid: boolean;
        data?: any;
        errors?: string[];
    } {
        try {
            const jsonMatch = response.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                return {
                    isValid: false,
                    errors: ['No valid JSON found in response']
                };
            }

            const parsedData = JSON.parse(jsonMatch[0]);

            if (!parsedData.participants || !parsedData.elements || !parsedData.sequenceFlows) {
                return {
                    isValid: false,
                    errors: ['Missing required fields: participants, elements, or sequenceFlows']
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

    private convertToBPMNFormat(rawData: any): BPMNDiagramData {
        const participants: BPMNParticipant[] = [];
        const lanes: BPMNLane[] = [];
        const elements: BPMNElement[] = [];
        const sequenceFlows: BPMNSequenceFlow[] = [];

        // Create separate participants (swimlanes) - NO OVERLAP
        let participantY = 80;
        const participantHeight = 150; // Reduced height
        const participantWidth = 1000; // Wider
        const participantSpacing = 20; // Gap between swimlanes

        rawData.participants.forEach((participant: any, index: number) => {
            const participantBounds = {
                x: 50,
                y: participantY,
                width: participantWidth,
                height: participantHeight,
            };

            participants.push({
                id: participant.id,
                name: participant.name,
                processRef: 'process_1',
                bounds: participantBounds,
            });

            // Create ONE lane per participant - NO NESTING
            lanes.push({
                id: `lane_${index}`,
                name: participant.name,
                participantRef: participant.id,
                flowNodeRefs: [],
                bounds: {
                    x: participantBounds.x,
                    y: participantBounds.y,
                    width: participantBounds.width,
                    height: participantBounds.height,
                },
            });

            // Move to next swimlane position
            participantY += participantHeight + participantSpacing;
        });

        // Deduplicate elements first
        const uniqueElements = new Map<string, any>();
        rawData.elements.forEach((element: any) => {
            if (!uniqueElements.has(element.id)) {
                uniqueElements.set(element.id, element);
            } else {
                console.warn(`Duplicate element ID detected: ${element.id}`);
            }
        });

        // Track elements per participant for positioning
        const elementsPerParticipant = new Map<string, number>();

        // Convert unique elements and assign to correct participants
        Array.from(uniqueElements.values()).forEach((element: any) => {
            const participantIndex = rawData.participants.findIndex(
                (p: any) => p.id === element.participant
            );

            if (participantIndex === -1) {
                console.warn(`Element ${element.id} references unknown participant ${element.participant}`);
                return; // Skip if participant not found
            }

            const participant = participants[participantIndex];
            const lane = lanes[participantIndex];

            // Track how many elements are in this participant
            const participantElementCount = elementsPerParticipant.get(participant.id) || 0;
            elementsPerParticipant.set(participant.id, participantElementCount + 1);

            // Position elements within participant bounds (like reference image)
            let elementX, elementY;

            if (element.type === 'bpmn:StartEvent') {
                // Start events at the beginning of the participant lane
                elementX = participant.bounds.x + 80;
                elementY = participant.bounds.y + (participant.bounds.height / 2) - 18; // Center vertically
            } else if (element.type === 'bpmn:EndEvent') {
                // End events toward the end of the participant lane
                elementX = participant.bounds.x + participant.bounds.width - 120;
                elementY = participant.bounds.y + (participant.bounds.height / 2) - 18; // Center vertically
            } else {
                // Flow-based positioning for tasks and gateways
                const elementsInParticipant = participantElementCount - 1; // Subtract 1 because we already incremented
                elementX = participant.bounds.x + 200 + (elementsInParticipant % 5) * 150;
                elementY = participant.bounds.y + 35 + Math.floor(elementsInParticipant / 5) * 80;

                // Ensure elements don't go outside participant bounds
                if (elementX + this.getElementWidth(element.type) > participant.bounds.x + participant.bounds.width - 50) {
                    elementX = participant.bounds.x + 200;
                    elementY = participant.bounds.y + 35 + Math.floor((elementsInParticipant + 5) / 5) * 80;
                }
            }

            const bpmnElement: BPMNElement = {
                id: element.id,
                type: element.type,
                name: element.name,
                participant: element.participant,
                lane: lane.id,
                bounds: {
                    x: elementX,
                    y: elementY,
                    width: this.getElementWidth(element.type),
                    height: this.getElementHeight(element.type),
                },
            };

            // Add gateway direction for gateways
            if (element.type.includes('Gateway')) {
                bpmnElement.gatewayDirection = 'Diverging';
            }

            elements.push(bpmnElement);

            // Add element to lane's flowNodeRefs
            lane.flowNodeRefs.push(element.id);
        });

        // Deduplicate sequence flows
        const uniqueFlows = new Map<string, any>();

        rawData.sequenceFlows.forEach((flow: any) => {
            const flowKey = `${flow.sourceRef}-${flow.targetRef}`;

            // Only add if we haven't seen this exact flow before
            if (!uniqueFlows.has(flowKey)) {
                uniqueFlows.set(flowKey, flow);
            } else {
                console.warn(`Duplicate sequence flow detected: ${flowKey}`);
            }
        });

        // Validate and filter flows
        const elementIds = new Set(elements.map(e => e.id));
        const endEventIds = elements
            .filter(e => e.type === 'bpmn:EndEvent')
            .map(e => e.id);

        // Process unique flows with validation
        Array.from(uniqueFlows.values()).forEach((flow: any) => {
            const sourceExists = elementIds.has(flow.sourceRef);
            const targetExists = elementIds.has(flow.targetRef);
            const isInvalidEndEventFlow = endEventIds.includes(flow.sourceRef);

            if (!sourceExists) {
                console.warn(`Flow ${flow.id} references unknown source element: ${flow.sourceRef}`);
                return;
            }
            if (!targetExists) {
                console.warn(`Flow ${flow.id} references unknown target element: ${flow.targetRef}`);
                return;
            }
            if (isInvalidEndEventFlow) {
                console.warn(`Flow ${flow.id} has invalid source (End Event cannot have outgoing flows): ${flow.sourceRef}`);
                return;
            }

            const sequenceFlow: BPMNSequenceFlow = {
                id: flow.id,
                sourceRef: flow.sourceRef,
                targetRef: flow.targetRef,
                name: flow.name,
                conditionExpression: flow.conditionExpression,
            };

            sequenceFlows.push(sequenceFlow);
        });

        const bpmnData: BPMNDiagramData = {
            processes: [{
                id: 'process_1',
                name: rawData.metadata.processName,
                isExecutable: false,
                elements,
                sequenceFlows,
            }],
            participants,
            lanes,
            metadata: {
                processName: rawData.metadata.processName,
                totalElements: elements.length,
                complexity: rawData.metadata.complexity,
                createdAt: new Date().toISOString(),
                bpmnVersion: '2.0',
            },
        };

        // Validate with Zod schema
        const validationResult = BPMNDiagramSchema.safeParse(bpmnData);

        if (!validationResult.success) {
            console.error('BPMN validation failed:', validationResult.error);
            throw new Error(`BPMN schema validation failed: ${validationResult.error.message}`);
        }

        return validationResult.data;
    }

    private getElementWidth(type: string): number {
        const widths: { [key: string]: number } = {
            'bpmn:StartEvent': 36,
            'bpmn:EndEvent': 36,
            'bpmn:Task': 100,
            'bpmn:UserTask': 100,
            'bpmn:ServiceTask': 100,
            'bpmn:ExclusiveGateway': 50,
            'bpmn:ParallelGateway': 50,
        };
        return widths[type] || 100;
    }

    private getElementHeight(type: string): number {
        const heights: { [key: string]: number } = {
            'bpmn:StartEvent': 36,
            'bpmn:EndEvent': 36,
            'bpmn:Task': 80,
            'bpmn:UserTask': 80,
            'bpmn:ServiceTask': 80,
            'bpmn:ExclusiveGateway': 50,
            'bpmn:ParallelGateway': 50,
        };
        return heights[type] || 80;
    }

    private generateBPMNXML(bpmnData: BPMNDiagramData): string {
        const process = bpmnData.processes[0];

        let xml = `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" 
                 xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" 
                 xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" 
                 xmlns:di="http://www.omg.org/spec/DD/20100524/DI" 
                 id="Definitions_1" 
                 targetNamespace="http://bpmn.io/schema/bpmn">
  
  <bpmn:collaboration id="Collaboration_1">`;

        // Add participants
        bpmnData.participants.forEach(participant => {
            xml += `
    <bpmn:participant id="${participant.id}" name="${participant.name}" processRef="${participant.processRef}" />`;
        });

        xml += `
  </bpmn:collaboration>
  
  <bpmn:process id="${process.id}" name="${process.name}" isExecutable="${process.isExecutable}">
    <bpmn:laneSet id="LaneSet_1">`;

        // Add ALL lanes within single laneSet
        bpmnData.lanes?.forEach(lane => {
            xml += `
      <bpmn:lane id="${lane.id}" name="${lane.name}">`;
            lane.flowNodeRefs.forEach(nodeRef => {
                xml += `
        <bpmn:flowNodeRef>${nodeRef}</bpmn:flowNodeRef>`;
            });
            xml += `
      </bpmn:lane>`;
        });

        xml += `
    </bpmn:laneSet>`;

        // Add elements with proper BPMN syntax - CHANGED THIS PART
        process.elements.forEach(element => {
            const elementType = element.type.replace('bpmn:', ''); // Remove bpmn: prefix for XML tag
            xml += `
    <bpmn:${elementType} id="${element.id}" name="${element.name}" />`;
        });

        // Add sequence flows
        process.sequenceFlows.forEach(flow => {
            xml += `
    <bpmn:sequenceFlow id="${flow.id}" sourceRef="${flow.sourceRef}" targetRef="${flow.targetRef}"`;
            if (flow.name) xml += ` name="${flow.name}"`;
            xml += ` />`;
        });

        xml += `
  </bpmn:process>
  
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_1">`;

        // Add participant shapes
        bpmnData.participants.forEach(participant => {
            xml += `
      <bpmndi:BPMNShape id="${participant.id}_di" bpmnElement="${participant.id}" isHorizontal="true">
        <dc:Bounds x="${participant.bounds.x}" y="${participant.bounds.y}" width="${participant.bounds.width}" height="${participant.bounds.height}" />
      </bpmndi:BPMNShape>`;
        });

        // Add lane shapes
        bpmnData.lanes?.forEach(lane => {
            xml += `
      <bpmndi:BPMNShape id="${lane.id}_di" bpmnElement="${lane.id}" isHorizontal="true">
        <dc:Bounds x="${lane.bounds.x}" y="${lane.bounds.y}" width="${lane.bounds.width}" height="${lane.bounds.height}" />
      </bpmndi:BPMNShape>`;
        });

        // Add element shapes
        process.elements.forEach(element => {
            xml += `
      <bpmndi:BPMNShape id="${element.id}_di" bpmnElement="${element.id}">
        <dc:Bounds x="${element.bounds.x}" y="${element.bounds.y}" width="${element.bounds.width}" height="${element.bounds.height}" />
      </bpmndi:BPMNShape>`;
        });

        // Add sequence flow edges
        process.sequenceFlows.forEach(flow => {
            xml += `
      <bpmndi:BPMNEdge id="${flow.id}_di" bpmnElement="${flow.id}">
        <di:waypoint x="${this.getElementCenter(flow.sourceRef, process.elements).x}" y="${this.getElementCenter(flow.sourceRef, process.elements).y}" />
        <di:waypoint x="${this.getElementCenter(flow.targetRef, process.elements).x}" y="${this.getElementCenter(flow.targetRef, process.elements).y}" />
      </bpmndi:BPMNEdge>`;
        });

        xml += `
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>`;

        return xml;
    }

    private getElementCenter(elementId: string, elements: BPMNElement[]): { x: number; y: number } {
        const element = elements.find(e => e.id === elementId);
        if (!element) return { x: 0, y: 0 };

        return {
            x: element.bounds.x + element.bounds.width / 2,
            y: element.bounds.y + element.bounds.height / 2,
        };
    }

    validateResponse(data: any): ValidationResult {
        try {
            const validatedData = BPMNDiagramSchema.parse(data);
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

    async execute(sessionId: string, message: string): Promise<BPMNExtractionResult> {
        const startTime = Date.now();

        try {
            if (!this.chatEngine) {
                await this.initializeChatEngine(sessionId);
            }

            const extractionPrompt = this.buildBPMNExtractionPrompt(message);

            const response = await this.chatEngine!.chat({
                message: extractionPrompt,
                chatHistory: [],
                stream: false,
            });

            const parseResult = this.parseAndValidateBPMNResponse(response.response);

            if (parseResult.isValid && parseResult.data) {
                const bpmnData = this.convertToBPMNFormat(parseResult.data);
                const bpmnXML = this.generateBPMNXML(bpmnData);

                return {
                    response: 'BPMN process extracted successfully',
                    bpmnData,
                    bpmnXML,
                    isValid: true,
                    metadata: {
                        executionTime: Date.now() - startTime,
                    }
                };
            } else {
                return {
                    response: 'BPMN extraction failed',
                    isValid: false,
                    validationErrors: parseResult.errors,
                    metadata: {
                        executionTime: Date.now() - startTime,
                    }
                };
            }

        } catch (error) {
            return {
                response: 'BPMN extraction failed',
                isValid: false,
                validationErrors: [`Execution error: ${(error as Error).message}`],
                metadata: {
                    executionTime: Date.now() - startTime,
                }
            };
        }
    }
}

export default BPMNProcessExtractionAgent;