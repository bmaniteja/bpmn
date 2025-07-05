
const position = { x: 0, y: 0 };

export const genereatedNodes = [
    {
        "id": "swimlane-1",
        "type": "swimLaneNode",
        "position": {
            "x": 0,
            "y": 0
        },
        "data": {
            "label": "Operator"
        },
        style: { width: 720, height: 100 },
    },
    {
        "id": "start-1",
        "type": "startNode",
        "parentId": "swimlane-1",
        "extent": "parent",
        "data": {
            "label": "Start"
        },
        position
    },
    {
        "id": "process-1",
        "type": "processNode",
        "parentId": "swimlane-1",
        "extent": "parent",
        "data": {
            "label": "Submit PO"
        },
        position
    },
    {
        "id": "swimlane-2",
        "type": "swimLaneNode",
        "position": {
            "x": 0,
            "y": 102
        },
        "data": {
            "label": "Operations Admin"
        },
        style: { width: 720, height: 100 },
    },
    {
        "id": "process-2",
        "type": "processNode",
        "parentId": "swimlane-2",
        "extent": "parent",
        "data": {
            "label": "Review PO"
        },
        position
    },
    {
        "id": "decision-1",
        "type": "decisionNode",
        "parentId": "swimlane-2",
        "extent": "parent",
        "data": {
            "label": "Approve or Reject"
        },
        position
    },
    {
        "id": "process-3",
        "type": "processNode",
        "parentId": "swimlane-1",
        "extent": "parent",
        "data": {
            "label": "Edit PO"
        },
        position
    },
    {
        "id": "end-1",
        "type": "endNode",
        "parentId": "swimlane-2",
        "extent": "parent",
        "data": {
            "label": "End"
        },
        position
    }
]

export const generatedEdges = [
    {
        "id": "start-1-process-1",
        "source": "start-1",
        "target": "process-1",
        "type": "smoothstep",
        "animated": true
    },
    {
        "id": "process-1-process-2",
        "source": "process-1",
        "target": "process-2",
        "type": "smoothstep",
        "animated": true
    },
    {
        "id": "process-2-decision-1",
        "source": "process-2",
        "target": "decision-1",
        "type": "smoothstep",
        "animated": true
    },
    {
        "id": "decision-1-process-3",
        "source": "decision-1",
        "target": "process-3",
        "type": "smoothstep",
        "label": "Reject",
        "animated": true
    },
    {
        "id": "decision-1-end-1",
        "source": "decision-1",
        "target": "end-1",
        "type": "smoothstep",
        "label": "Approve",
        "animated": true
    },
    {
        "id": "process-3-process-2",
        "source": "process-3",
        "target": "process-2",
        "type": "smoothstep",
        "label": "Re-submit",
        "animated": true
    }
];

//   { id: '2-3', source: '2', target: '3', type: 'smoothstep' },
//   { id: '5-6', source: '5', target: '6', type: 'smoothstep' },
//   { id: '3-5', source: '3', target: '5', label: 'review', type: 'smoothstep' },
//   { id: '6-7', source: '6', target: '7', label: 'reject', type: 'smoothstep' },
//   { id: '6-8', source: '6', target: '8', label: 'approve', type: 'smoothstep' },
//   { id: '7-5', source: '7', target: '5', label: 're-submit', type: 'smoothstep' },
// ];

// export const initialNodes = [
//   {
//     id: '1',
//     data: { label: 'Operator' },
//     style: { width: 720, height: 100 },
//     type: 'swimLaneNode',
//   },
//   {
//     id: '2',
//     data: { label: 'Start' },
//     position: { x: 25, y: 25 },
//     parentId: '1',
//     extent: 'parent',
//     type: 'startNode',
//   },
//   {
//     id: '3',
//     data: { label: 'Create PO' },
//     position: { x: 140, y: 25 },
//     parentId: '1',
//     extent: 'parent',
//     type: 'processNode',
//   },
//   {
//     id: '4',
//     data: { label: 'Operations Admin' },
//     position: { x: 0, y: 102 },
//     style: { width: 720, height: 100 },
//     type: 'swimLaneNode',
//   },
//   {
//     id: '5',
//     data: { label: 'Review' },
//     position: { x: 250, y: 25 },
//     parentId: '4',
//     extent: 'parent',
//     type: 'processNode',
//   },
//   {
//     id: '6',
//     data: { label: 'Approve' },
//     position: { x: 230 + 180, y: 25 },
//     parentId: '4',
//     extent: 'parent',
//     type: 'decisionNode',
//   },
//   {
//     id: '7',
//     data: { label: 'Re-submit PO' },
//     position: { x: 230 + 180 + 70, y: 25 },
//     parentId: '1',
//     extent: 'parent',
//     type: 'processNode',
//   },
//   {
//     id: '8',
//     data: { label: 'Re-submit PO' },
//     position: { x: 230 + 180 + 70 + 150, y: 25 },
//     parentId: '1',
//     extent: 'parent',
//     type: 'endNode',
//   },
// ];