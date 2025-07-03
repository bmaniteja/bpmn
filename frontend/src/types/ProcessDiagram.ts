import { z } from 'zod';

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
    lanes: z.array(BPMNLaneSchema),
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