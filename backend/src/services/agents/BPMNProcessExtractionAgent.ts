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

      const processData = response.response;
      context.messages.push({
        content: message,
        role: "user" as MessageType,
      });
      context.messages.push({
        content: `Extracted BPMN process`,
        role: "assistant" as MessageType,
      });

      socket.emit('bpmn:extracted', {
        bpmnXML: processData,
        metadata: {
          sessionId,
          extractedAt: new Date().toISOString(),
          featureDescription: message,
        }
      });

      this.emitStatus(socket, { status: "complete" });


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
Respond with ONLY valid XML in this exact example format generated with this prompt As an Operations Admin, I want to review purchase orders submitted by operators, escalate them if required, and either approve or reject them based on policy. Operators can edit and resubmit rejected POs:

<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL" xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI" xmlns:dc="http://www.omg.org/spec/DD/20100524/DC" xmlns:di="http://www.omg.org/spec/DD/20100524/DI" id="Definitions_1txzjx7" targetNamespace="http://bpmn.io/schema/bpmn" exporter="bpmn-js (https://demo.bpmn.io)" exporterVersion="18.6.1">
  <bpmn:collaboration id="Collaboration_0oejvqo">
    <bpmn:participant id="Participant_1dp5nd6" name="Operator" processRef="Process_1finucl" />
    <bpmn:participant id="Participant_0s8ezql" name="Operations Admin" processRef="Process_10wmq2z" />
    <bpmn:messageFlow id="Flow_150pged" sourceRef="Activity_17fny9w" targetRef="Activity_02yxkto" />
    <bpmn:messageFlow id="Flow_050pdl9" sourceRef="Activity_1tnxvtc" targetRef="Activity_02yxkto" />
    <bpmn:messageFlow id="Flow_1utxqgm" sourceRef="Activity_15oun8x" targetRef="Activity_1tnxvtc" />
    <bpmn:messageFlow id="Flow_0ge26wy" sourceRef="Activity_12ar3tr" targetRef="Activity_02l4cco" />
  </bpmn:collaboration>
  <bpmn:process id="Process_1finucl" isExecutable="false">
    <bpmn:startEvent id="Event_0hf5otd" name="Start">
      <bpmn:outgoing>Flow_1u4plgg</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:task id="Activity_17fny9w" name="Create PO">
      <bpmn:incoming>Flow_1u4plgg</bpmn:incoming>
    </bpmn:task>
    <bpmn:sequenceFlow id="Flow_1u4plgg" sourceRef="Event_0hf5otd" targetRef="Activity_17fny9w" />
    <bpmn:task id="Activity_1tnxvtc" name="Edit/Resubmit PO" />
    <bpmn:task id="Activity_02l4cco" name="PO Approved">
      <bpmn:outgoing>Flow_0qznkmq</bpmn:outgoing>
    </bpmn:task>
    <bpmn:sequenceFlow id="Flow_0qznkmq" sourceRef="Activity_02l4cco" targetRef="Event_1covgry" />
    <bpmn:endEvent id="Event_1covgry" name="End">
      <bpmn:incoming>Flow_0qznkmq</bpmn:incoming>
      <bpmn:terminateEventDefinition id="TerminateEventDefinition_16xxud9" />
    </bpmn:endEvent>
  </bpmn:process>
  <bpmn:process id="Process_10wmq2z">
    <bpmn:sequenceFlow id="Flow_0k2uxnz" sourceRef="Gateway_02qv1py" targetRef="Activity_12ar3tr" />
    <bpmn:sequenceFlow id="Flow_0wbns4d" sourceRef="Gateway_02qv1py" targetRef="Activity_15oun8x" />
    <bpmn:sequenceFlow id="Flow_1gg66ru" sourceRef="Activity_1ne39zu" targetRef="Gateway_02qv1py" />
    <bpmn:sequenceFlow id="Flow_0g0m4j1" name="No" sourceRef="Gateway_0w5mtat" targetRef="Gateway_02qv1py" />
    <bpmn:sequenceFlow id="Flow_0n3730m" name="Yes" sourceRef="Gateway_0w5mtat" targetRef="Activity_1ne39zu" />
    <bpmn:sequenceFlow id="Flow_0jb311n" sourceRef="Activity_02yxkto" targetRef="Gateway_0w5mtat" />
    <bpmn:sequenceFlow id="Flow_09h338d" name="Review" sourceRef="Activity_02yxkto" targetRef="Gateway_02qv1py" />
    <bpmn:task id="Activity_12ar3tr" name="Approve">
      <bpmn:incoming>Flow_0k2uxnz</bpmn:incoming>
    </bpmn:task>
    <bpmn:task id="Activity_15oun8x" name="Reject">
      <bpmn:incoming>Flow_0wbns4d</bpmn:incoming>
    </bpmn:task>
    <bpmn:task id="Activity_1ne39zu" name="Review Escalation">
      <bpmn:incoming>Flow_0n3730m</bpmn:incoming>
      <bpmn:outgoing>Flow_1gg66ru</bpmn:outgoing>
    </bpmn:task>
    <bpmn:exclusiveGateway id="Gateway_02qv1py" name="Approve/Reject">
      <bpmn:incoming>Flow_09h338d</bpmn:incoming>
      <bpmn:incoming>Flow_0g0m4j1</bpmn:incoming>
      <bpmn:incoming>Flow_1gg66ru</bpmn:incoming>
      <bpmn:outgoing>Flow_0wbns4d</bpmn:outgoing>
      <bpmn:outgoing>Flow_0k2uxnz</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:exclusiveGateway id="Gateway_0w5mtat" name="Escalate">
      <bpmn:incoming>Flow_0jb311n</bpmn:incoming>
      <bpmn:outgoing>Flow_0n3730m</bpmn:outgoing>
      <bpmn:outgoing>Flow_0g0m4j1</bpmn:outgoing>
    </bpmn:exclusiveGateway>
    <bpmn:task id="Activity_02yxkto" name="Review PO">
      <bpmn:outgoing>Flow_09h338d</bpmn:outgoing>
      <bpmn:outgoing>Flow_0jb311n</bpmn:outgoing>
    </bpmn:task>
  </bpmn:process>
  <bpmndi:BPMNDiagram id="BPMNDiagram_1">
    <bpmndi:BPMNPlane id="BPMNPlane_1" bpmnElement="Collaboration_0oejvqo">
      <bpmndi:BPMNShape id="Participant_1dp5nd6_di" bpmnElement="Participant_1dp5nd6" isHorizontal="true">
        <dc:Bounds x="200" y="120" width="1210" height="250" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Event_0hf5otd_di" bpmnElement="Event_0hf5otd">
        <dc:Bounds x="262" y="222" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="268" y="265" width="24" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Activity_17fny9w_di" bpmnElement="Activity_17fny9w">
        <dc:Bounds x="350" y="200" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Activity_1tnxvtc_di" bpmnElement="Activity_1tnxvtc">
        <dc:Bounds x="1000" y="200" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Activity_02l4cco_di" bpmnElement="Activity_02l4cco">
        <dc:Bounds x="1130" y="200" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Event_1pv8ihc_di" bpmnElement="Event_1covgry">
        <dc:Bounds x="1282" y="222" width="36" height="36" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="1290" y="265" width="20" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_1u4plgg_di" bpmnElement="Flow_1u4plgg">
        <di:waypoint x="298" y="240" />
        <di:waypoint x="350" y="240" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0qznkmq_di" bpmnElement="Flow_0qznkmq">
        <di:waypoint x="1230" y="240" />
        <di:waypoint x="1282" y="240" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNShape id="Participant_0s8ezql_di" bpmnElement="Participant_0s8ezql" isHorizontal="true">
        <dc:Bounds x="200" y="390" width="1210" height="390" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Activity_02yxkto_di" bpmnElement="Activity_02yxkto">
        <dc:Bounds x="470" y="490" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_0w5mtat_di" bpmnElement="Gateway_0w5mtat" isMarkerVisible="true">
        <dc:Bounds x="625" y="685" width="50" height="50" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="629" y="742" width="43" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Gateway_02qv1py_di" bpmnElement="Gateway_02qv1py" isMarkerVisible="true">
        <dc:Bounds x="765" y="505" width="50" height="50" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="752" y="475" width="76" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Activity_1ne39zu_di" bpmnElement="Activity_1ne39zu">
        <dc:Bounds x="740" y="670" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Activity_15oun8x_di" bpmnElement="Activity_15oun8x">
        <dc:Bounds x="1010" y="490" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNShape id="Activity_12ar3tr_di" bpmnElement="Activity_12ar3tr">
        <dc:Bounds x="1010" y="600" width="100" height="80" />
        <bpmndi:BPMNLabel />
      </bpmndi:BPMNShape>
      <bpmndi:BPMNEdge id="Flow_09h338d_di" bpmnElement="Flow_09h338d">
        <di:waypoint x="570" y="530" />
        <di:waypoint x="765" y="530" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="649" y="512" width="37" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0jb311n_di" bpmnElement="Flow_0jb311n">
        <di:waypoint x="570" y="530" />
        <di:waypoint x="598" y="530" />
        <di:waypoint x="598" y="710" />
        <di:waypoint x="625" y="710" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="550" y="555" width="43" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0n3730m_di" bpmnElement="Flow_0n3730m">
        <di:waypoint x="675" y="710" />
        <di:waypoint x="740" y="710" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="699" y="692" width="18" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0g0m4j1_di" bpmnElement="Flow_0g0m4j1">
        <di:waypoint x="650" y="685" />
        <di:waypoint x="650" y="530" />
        <di:waypoint x="765" y="530" />
        <bpmndi:BPMNLabel>
          <dc:Bounds x="658" y="605" width="15" height="14" />
        </bpmndi:BPMNLabel>
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_1gg66ru_di" bpmnElement="Flow_1gg66ru">
        <di:waypoint x="790" y="670" />
        <di:waypoint x="790" y="555" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0wbns4d_di" bpmnElement="Flow_0wbns4d">
        <di:waypoint x="815" y="530" />
        <di:waypoint x="1010" y="530" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0k2uxnz_di" bpmnElement="Flow_0k2uxnz">
        <di:waypoint x="790" y="555" />
        <di:waypoint x="790" y="640" />
        <di:waypoint x="1010" y="640" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_150pged_di" bpmnElement="Flow_150pged">
        <di:waypoint x="400" y="280" />
        <di:waypoint x="400" y="410" />
        <di:waypoint x="520" y="410" />
        <di:waypoint x="520" y="490" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_050pdl9_di" bpmnElement="Flow_050pdl9">
        <di:waypoint x="1050" y="280" />
        <di:waypoint x="1050" y="410" />
        <di:waypoint x="540" y="410" />
        <di:waypoint x="540" y="490" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_1utxqgm_di" bpmnElement="Flow_1utxqgm">
        <di:waypoint x="1060" y="490" />
        <di:waypoint x="1060" y="280" />
      </bpmndi:BPMNEdge>
      <bpmndi:BPMNEdge id="Flow_0ge26wy_di" bpmnElement="Flow_0ge26wy">
        <di:waypoint x="1110" y="640" />
        <di:waypoint x="1190" y="640" />
        <di:waypoint x="1190" y="280" />
      </bpmndi:BPMNEdge>
    </bpmndi:BPMNPlane>
  </bpmndi:BPMNDiagram>
</bpmn:definitions>


CRITICAL RULES:
- Output ONLY the XML, no additional text
- Use proper BPMN element types with "bpmn" prefix as shown in example XML
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

Generate the BPMN XML now:`;
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

      const parseResult = response.response;


      return {
        response: 'BPMN process extracted successfully',
        bpmnXML: parseResult,
        isValid: true,
        metadata: {
          executionTime: Date.now() - startTime,
        }
      };

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