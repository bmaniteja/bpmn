
import { useCallback, useEffect, useState } from 'react';
import dagre from '@dagrejs/dagre';
import { toPng } from 'html-to-image';
import { JsonEditor, githubDarkTheme } from 'json-edit-react';
import { CodeIcon, DownloadIcon, ImageIcon, StarIcon } from '@radix-ui/react-icons'
import { ReactFlow, Controls, Background, type Node, useNodesState, useEdgesState, addEdge, ConnectionLineType, ControlButton, type ReactFlowInstance } from '@xyflow/react';

import '@xyflow/react/dist/style.css';

import StartNode from './nodes/Start';
import ProcessNode from './nodes/Process';
import SwimLaneNode from './nodes/SwimLane';
import DecisionNode from './nodes/Decision';
import EndNode from './nodes/End';
import clsx from 'clsx';
import { Badge } from './components/ui/badge';

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
  const newNodes: any[] = [];
  const swimLanesWidthHeight: any = {
    width: 0
  };
  const swimLanesById:any = {};
  nodes.forEach((node: any) => {
    if(node.type === 'swimLaneNode') {
      if (!swimLanesById[node.id]) {
        swimLanesById[node.id] = node;
      }
    }
  });

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
        y: (getNodeDimensions(node.type).height / 2), // offset to center the swim lane
      },
    };

    newNodes.push(newNode);
  });

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

const debounce = (callback: Function, wait: number) => {
  let timeoutId: number | null = null;
  // @ts-expect-error
  return (...args) => {
    if (timeoutId) {
      window.clearTimeout(timeoutId);
    }
    timeoutId = window.setTimeout(() => {
      callback(...args);
    }, wait);
  };
}

const SwimLanesViewer: React.FC<{ initialNodes: any[], initialEdges: any[], isMock: boolean }> = ({ initialNodes, initialEdges, isMock }) => {

  const nodeTypes = {
    startNode: StartNode,
    processNode: ProcessNode,
    swimLaneNode: SwimLaneNode,
    decisionNode: DecisionNode,
    endNode: EndNode
  }
  const [data, setData] = useState<{ initialNodes: any[], initialEdges: any[] }>({ initialNodes, initialEdges });
  const [toggleEditor, setToggleEditor] = useState<boolean>(false);
  const [instance, setInstance] = useState<ReactFlowInstance<Node, any> | null>(null);
  const resizeHandler = debounce(() => {
      instance?.fitView();
    }, 100);

  useEffect(() => {
    window.addEventListener('resize', resizeHandler);
    return () => {
      window.removeEventListener('resize', resizeHandler);
    }
  }, [instance])

  useEffect(() => {
    const calculatedNodes = getLayoutedElements(
      data.initialNodes,
      data.initialEdges,
    );
    setNodes(calculatedNodes.nodes);
    setEdges(calculatedNodes.edges);
    setTimeout(() => instance?.fitView(),100)
  }, [data.initialEdges, data.initialNodes]);

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
    <div className='flex-col content-center h-dvh flex-1 lg:flex-3/4'>
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
              }, 10)
            }}>
              <CodeIcon />
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
            {isMock ? <Badge
              className="h-5 mt-5 min-w-5 rounded-full px-2 font-mono tabular-nums"
              variant="outline"
            >
              Mock Data
            </Badge> : <Badge className="h-5 mt-5 min-w-5 rounded-full px-2 font-mono tabular-nums border-purple-400 text-purple-400"><StarIcon />AI Generated</Badge>}
          </Controls>
        </ReactFlow>
      </div>
      {toggleEditor && <div className='max-h-1/2 overflow-scroll'>
        <JsonEditor
          theme={githubDarkTheme}
          data={{
            nodes: data.initialNodes,
            edges: data.initialEdges
          }}
          className='w-full h-1/2'
          maxWidth={'100vw'}
          collapse={2}
          setData={(updateddata: any) => {
            setData({
              initialEdges: updateddata.edges,
              initialNodes: updateddata.nodes
            });
          }}
        />
      </div>}
    </div>
  );
}

export default SwimLanesViewer;