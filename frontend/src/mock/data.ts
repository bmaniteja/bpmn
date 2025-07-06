
const position = { x: 0, y: 0 };

export const genereatedNodes = [
    {
        "id": "1",
        "type": "swimLaneNode",
        "position": {
            "x": 0,
            "y": 0
        },
        "data": {
            "label": "Swimlane"
        },
        style: { width: 200, height: 100 },
    },
    {
        "id": "5",
        "type": "swimLaneNode",
        "position": {
            "x": 0,
            "y": 102
        },
        "data": {
            "label": "Swimlane 2"
        },
        style: { width: 200, height: 100 },
    },
    {
        "id": "6",
        "type": "startNode",
        position,
        "parentId": "5",
        "extent": "parent",
    },
    {
        "id": "7",
        "type": "decisionNode",
        position,
        "parentId": "5",
        "extent": "parent",
        "data": {
            "label": "Approval"
        },
    },
    {
        "id": "2",
        "type": "startNode",
        "parentId": "1",
        "extent": "parent",
        "data": {
            "label": "Start"
        },
        position
    },
    {
        "id": "3",
        "type": "processNode",
        "parentId": "1",
        "extent": "parent",
        "data": {
            "label": "Edit PO"
        },
        position
    },
    {
        "id": "4",
        "type": "endNode",
        "parentId": "1",
        "extent": "parent",
        "data": {
            "label": "End"
        },
        position
    }
]

export const generatedEdges = [
    {
        "id": "2-3",
        "source": "2",
        "target": "3",
        "type": "smoothstep",
        "animated": true
    },
    {
        "id": "3-4",
        "source": "3",
        "target": "4",
        "type": "smoothstep",
        "animated": true
    },
    {
        "id": "6-7",
        "source": "6",
        "target": "7",
        "type": "smoothstep",
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