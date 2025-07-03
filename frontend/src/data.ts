export const data = {
    "processData": {
        "actors": [
            "Operations Admin",
            "Operator"
        ],
        "swimlanes": [
            {
                "id": "swimlane-operations-admin",
                "type": "swimlane",
                "position": {
                    "x": 0,
                    "y": 0
                },
                "data": {
                    "label": "Operations Admin",
                    "actor": "Operations Admin",
                    "color": "#FF6B6B",
                    "childNodeIds": [
                        "step_3",
                        "step_4",
                        "step_5",
                        "step_6",
                        "step_7",
                        "end_1"
                    ]
                },
                "style": {
                    "backgroundColor": "#FF6B6B15",
                    "border": "2px solid #FF6B6B"
                }
            },
            {
                "id": "swimlane-operator",
                "type": "swimlane",
                "position": {
                    "x": 0,
                    "y": 0
                },
                "data": {
                    "label": "Operator",
                    "actor": "Operator",
                    "color": "#4ECDC4",
                    "childNodeIds": [
                        "start_1",
                        "step_2",
                        "step_8"
                    ]
                },
                "style": {
                    "backgroundColor": "#4ECDC415",
                    "border": "2px solid #4ECDC4"
                }
            }
        ],
        "processSteps": [
            {
                "id": "start_1",
                "type": "start",
                "position": {
                    "x": 20,
                    "y": 20
                },
                "parentId": "swimlane-operator",
                "extent": "parent",
                "data": {
                    "label": "Begin process",
                    "stepType": "start",
                    "actor": "Operator"
                },
                "style": {
                    "backgroundColor": "#90EE90",
                    "border": "2px solid #333",
                    "color": "#333"
                }
            },
            {
                "id": "step_2",
                "type": "action",
                "position": {
                    "x": 20,
                    "y": 120
                },
                "parentId": "swimlane-operator",
                "extent": "parent",
                "data": {
                    "label": "Submit purchase order",
                    "stepType": "action",
                    "actor": "Operator"
                },
                "style": {
                    "backgroundColor": "#87CEEB",
                    "border": "2px solid #333",
                    "color": "#333"
                }
            },
            {
                "id": "step_3",
                "type": "decision",
                "position": {
                    "x": 20,
                    "y": 20
                },
                "parentId": "swimlane-operations-admin",
                "extent": "parent",
                "data": {
                    "label": "Review PO - requires escalation?",
                    "stepType": "decision",
                    "actor": "Operations Admin",
                    "conditions": [
                        {
                            "outcome": "escalate",
                            "nextStep": "step_4"
                        },
                        {
                            "outcome": "no_escalation",
                            "nextStep": "step_5"
                        }
                    ]
                },
                "style": {
                    "backgroundColor": "#FFD700",
                    "border": "2px solid #333",
                    "color": "#333"
                }
            },
            {
                "id": "step_4",
                "type": "action",
                "position": {
                    "x": 20,
                    "y": 120
                },
                "parentId": "swimlane-operations-admin",
                "extent": "parent",
                "data": {
                    "label": "Escalate purchase order",
                    "stepType": "action",
                    "actor": "Operations Admin"
                },
                "style": {
                    "backgroundColor": "#87CEEB",
                    "border": "2px solid #333",
                    "color": "#333"
                }
            },
            {
                "id": "step_5",
                "type": "decision",
                "position": {
                    "x": 20,
                    "y": 220
                },
                "parentId": "swimlane-operations-admin",
                "extent": "parent",
                "data": {
                    "label": "Approve or reject PO?",
                    "stepType": "decision",
                    "actor": "Operations Admin",
                    "conditions": [
                        {
                            "outcome": "approve",
                            "nextStep": "step_6"
                        },
                        {
                            "outcome": "reject",
                            "nextStep": "step_7"
                        }
                    ]
                },
                "style": {
                    "backgroundColor": "#FFD700",
                    "border": "2px solid #333",
                    "color": "#333"
                }
            },
            {
                "id": "step_6",
                "type": "action",
                "position": {
                    "x": 20,
                    "y": 320
                },
                "parentId": "swimlane-operations-admin",
                "extent": "parent",
                "data": {
                    "label": "Approve purchase order",
                    "stepType": "action",
                    "actor": "Operations Admin"
                },
                "style": {
                    "backgroundColor": "#87CEEB",
                    "border": "2px solid #333",
                    "color": "#333"
                }
            },
            {
                "id": "step_7",
                "type": "action",
                "position": {
                    "x": 20,
                    "y": 420
                },
                "parentId": "swimlane-operations-admin",
                "extent": "parent",
                "data": {
                    "label": "Reject purchase order",
                    "stepType": "action",
                    "actor": "Operations Admin"
                },
                "style": {
                    "backgroundColor": "#87CEEB",
                    "border": "2px solid #333",
                    "color": "#333"
                }
            },
            {
                "id": "step_8",
                "type": "action",
                "position": {
                    "x": 20,
                    "y": 220
                },
                "parentId": "swimlane-operator",
                "extent": "parent",
                "data": {
                    "label": "Edit and resubmit PO",
                    "stepType": "action",
                    "actor": "Operator"
                },
                "style": {
                    "backgroundColor": "#87CEEB",
                    "border": "2px solid #333",
                    "color": "#333"
                }
            },
            {
                "id": "end_1",
                "type": "end",
                "position": {
                    "x": 20,
                    "y": 520
                },
                "parentId": "swimlane-operations-admin",
                "extent": "parent",
                "data": {
                    "label": "Process complete",
                    "stepType": "end",
                    "actor": "Operations Admin"
                },
                "style": {
                    "backgroundColor": "#FFA07A",
                    "border": "2px solid #333",
                    "color": "#333"
                }
            }
        ],
        "edges": [
            {
                "id": "start_1-step_2",
                "source": "start_1",
                "target": "step_2",
                "type": "simplebezier",
                "style": {
                    "stroke": "#666",
                    "strokeWidth": 2
                },
                "markerEnd": {
                    "type": "arrowclosed",
                    "color": "#666"
                }
            },
            {
                "id": "step_2-step_3",
                "source": "step_2",
                "target": "step_3",
                "type": "simplebezier",
                "style": {
                    "stroke": "#666",
                    "strokeWidth": 2
                },
                "markerEnd": {
                    "type": "arrowclosed",
                    "color": "#666"
                }
            },
            {
                "id": "step_3-step_4",
                "source": "step_3",
                "target": "step_4",
                "type": "simplebezier",
                "label": "escalate",
                "style": {
                    "stroke": "#666",
                    "strokeWidth": 2
                },
                "markerEnd": {
                    "type": "arrowclosed",
                    "color": "#666"
                }
            },
            {
                "id": "step_3-step_5",
                "source": "step_3",
                "target": "step_5",
                "type": "simplebezier",
                "label": "no_escalation",
                "style": {
                    "stroke": "#666",
                    "strokeWidth": 2
                },
                "markerEnd": {
                    "type": "arrowclosed",
                    "color": "#666"
                }
            },
            {
                "id": "step_4-step_5",
                "source": "step_4",
                "target": "step_5",
                "type": "simplebezier",
                "style": {
                    "stroke": "#666",
                    "strokeWidth": 2
                },
                "markerEnd": {
                    "type": "arrowclosed",
                    "color": "#666"
                }
            },
            {
                "id": "step_5-step_6",
                "source": "step_5",
                "target": "step_6",
                "type": "simplebezier",
                "label": "approve",
                "style": {
                    "stroke": "#666",
                    "strokeWidth": 2
                },
                "markerEnd": {
                    "type": "arrowclosed",
                    "color": "#666"
                }
            },
            {
                "id": "step_5-step_7",
                "source": "step_5",
                "target": "step_7",
                "type": "simplebezier",
                "label": "reject",
                "style": {
                    "stroke": "#666",
                    "strokeWidth": 2
                },
                "markerEnd": {
                    "type": "arrowclosed",
                    "color": "#666"
                }
            },
            {
                "id": "step_6-end_1",
                "source": "step_6",
                "target": "end_1",
                "type": "simplebezier",
                "style": {
                    "stroke": "#666",
                    "strokeWidth": 2
                },
                "markerEnd": {
                    "type": "arrowclosed",
                    "color": "#666"
                }
            },
            {
                "id": "step_7-step_8",
                "source": "step_7",
                "target": "step_8",
                "type": "simplebezier",
                "style": {
                    "stroke": "#666",
                    "strokeWidth": 2
                },
                "markerEnd": {
                    "type": "arrowclosed",
                    "color": "#666"
                }
            },
            {
                "id": "step_8-step_3",
                "source": "step_8",
                "target": "step_3",
                "type": "simplebezier",
                "style": {
                    "stroke": "#666",
                    "strokeWidth": 2
                },
                "markerEnd": {
                    "type": "arrowclosed",
                    "color": "#666"
                }
            }
        ],
        "layoutConfig": {
            "orientation": "horizontal",
            "swimlaneSpacing": 50,
            "nodeSpacing": {
                "x": 150,
                "y": 80
            },
            "autoSize": true
        },
        "metadata": {
            "processName": "Purchase Order Review Process",
            "totalSteps": 8,
            "complexity": "medium",
            "createdAt": "2025-07-03T05:20:35.234Z"
        }
    },
    "metadata": {
        "sessionId": "_LWpWO8KJTiwJKvmAAAB",
        "extractedAt": "2025-07-03T05:20:35.237Z",
        "featureDescription": "As an Operations Admin, I want to review purchase orders submitted by operators, escalate them if required, and either approve or reject them based on policy. Operators can edit and resubmit rejected POs."
    }
}