
import { useCallback, useEffect, useMemo, useState } from 'react';
import dagre from '@dagrejs/dagre';
import { toPng } from 'html-to-image';
import { JsonEditor, githubDarkTheme } from 'json-edit-react';
import { CodeIcon, DownloadIcon, ImageIcon } from '@radix-ui/react-icons'
import { ReactFlow, Controls, Background, type Node, useNodesState, useEdgesState, addEdge, ConnectionLineType, ControlButton, type ReactFlowInstance } from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import StartNode from './nodes/Start';
import ProcessNode from './nodes/Process';
import SwimLaneNode from './nodes/SwimLane';
import DecisionNode from './nodes/Decision';
import EndNode from './nodes/End';
import clsx from 'clsx';

const getNodeDimensions = (type: string) => {
  let dimesions;
  switch (type) {
    case 'processNode':
      dimesions = {
        width: 90,
        height: 50
      };
      break;
    case 'startNode':
      dimesions = {
        width: 50,
        height: 50
      };
      break;
    case 'endNode':
      dimesions = {
        width: 50,
        height: 50
      };
      break;
    case 'decisionNode':
      dimesions = {
        width: 70,
        height: 70
      };
      break;
    case 'swimLaneNode':
      dimesions = {
        width: 720,
        height: 100
      };
      break;
    default:
      dimesions = {
        width: 90,
        height: 50
      };
  }
  return dimesions;
}

const getLayoutedElements = (nodes: any, edges: any, direction = 'LR') => {
  const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));
  const isHorizontal = direction === 'LR';
  dagreGraph.setGraph({ rankdir: direction });

  nodes.filter((node: any) => {
    return node.type !== 'swimLaneNode';
  }).forEach((node: any) => {
    dagreGraph.setNode(node.id, getNodeDimensions(node.type));
  });

  edges.forEach((edge: any) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes: any[] = [];
  nodes.filter((node: any) => {
    return node.type !== 'swimLaneNode';
  }).map((node: any) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? 'left' : 'top',
      sourcePosition: isHorizontal ? 'right' : 'bottom',
      position: {
        x: (nodeWithPosition.x - getNodeDimensions(node.type).width / 2) + 30, // offset the swim lane label height
        y: (nodeWithPosition.y - getNodeDimensions(node.type).height / 2) / 2, // offset to center the swim lane
      },
    };

    newNodes.push(newNode);
  });

  const swimLanesWidthHeight: any = {
    width: 0
  };

  newNodes.forEach(node => {
    if (node.parentId) {
      if (swimLanesWidthHeight.width < node.position.x) {
        swimLanesWidthHeight.width = node.position.x + 100;
      }
    }
  });

  // adding back lanes with calculated widths
  const newLanes = nodes.filter((node: any) => {
    return node.type === 'swimLaneNode';
  }).map((swimLaneNode: any) => {
    return {
      ...swimLaneNode,
      style: {
        ...swimLaneNode.style,
        width: swimLanesWidthHeight.width
      }
    }
  })

  return { nodes: [...newLanes, ...newNodes], edges };
};

function SwimLanesViewer({ initialNodes, initialEdges }: { initialNodes: any[], initialEdges: any[] }) {

  const nodeTypes = {
    startNode: StartNode,
    processNode: ProcessNode,
    swimLaneNode: SwimLaneNode,
    decisionNode: DecisionNode,
    endNode: EndNode
  }
  const [data, setData] = useState<{ initialNodes: any[], initialEdges: any[] }>({ initialNodes: [], initialEdges: [] });
  const [toggleEditor, setToggleEditor] = useState<boolean>(false);
  const [instance, setInstance] = useState<ReactFlowInstance<Node, any> | null>(null);

  useEffect(() => {
    const calculatedNodes = getLayoutedElements(
      data.initialNodes,
      data.initialEdges,
    );
    setNodes(calculatedNodes.nodes);
    setEdges(calculatedNodes.edges);
  }, [data.initialEdges, data.initialNodes]);

  useEffect(() => {
    const calculatedNodes = getLayoutedElements(
      initialNodes,
      initialEdges,
    );
    setNodes(calculatedNodes.nodes);
    setEdges(calculatedNodes.edges);
  }, []);

  const [nodes, setNodes, onNodesChange] = useNodesState(data.initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(data.initialNodes);
  const onConnect = useCallback(
    (params: any) =>
      setEdges((eds) =>
        addEdge({ ...params, type: ConnectionLineType.SmoothStep, animated: true }, eds),
      ),
    [],
  );

  return (
      <div className='flex-col content-center h-dvh w-4/5'>
        <div className={clsx({
          'h-full w-full': !toggleEditor,
          'h-1/2 w-full': toggleEditor
        })}>
          <ReactFlow
            nodes={nodes as Node[]}
            onConnect={onConnect}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            fitView
            colorMode='dark'
            nodeTypes={nodeTypes}
            onInit={(inst) => { 
              setInstance(inst);
            }}
            proOptions={{
              hideAttribution: true
            }}
          // nodesDraggable={false}
          >
            <Background />
            <Controls>
              <ControlButton onClick={() => {
                  setToggleEditor(!toggleEditor);
                  setTimeout(() => {
                    instance?.fitView();
                  }, 300)
                }}>
                <CodeIcon/>
              </ControlButton>
              <ControlButton>
                <DownloadIcon onClick={() => {
                  var dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify({
                    nodes, edges
                  }));
                  const a = document.createElement('a');
 
                  a.setAttribute('download', 'reactflow.json');
                  a.setAttribute('href', dataStr);
                  a.click();
                }} />
              </ControlButton>
              <ControlButton onClick={() => {
                const reactFlowElement = document.querySelector('.react-flow__viewport');
                if (reactFlowElement) {
                  toPng(reactFlowElement as HTMLElement, {
                }).then((imageData) => {
                  const a = document.createElement('a');
 
                  a.setAttribute('download', 'reactflow.png');
                  a.setAttribute('href', imageData);
                  a.click();
                });
                }
              }}>
                <ImageIcon />
              </ControlButton>
            </Controls>
          </ReactFlow>
        </div>
        {toggleEditor && <div className='max-h-1/2 overflow-scroll'>
          <JsonEditor
            theme={githubDarkTheme}
            data={{
              nodes: initialNodes,
              edges: initialEdges
            }}
            className='w-full h-1/2'
            maxWidth={'100vw'}
            collapse={2}
            setData={(data: any) => {
              // debugger;
              setData({
                initialEdges: data.edges,
                initialNodes: data.nodes
              });
            }}
          />
        </div>}
      </div>
  );
}

export default SwimLanesViewer;