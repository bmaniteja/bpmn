import React, { useEffect, useRef, useState } from 'react';
import BpmnViewer from 'bpmn-js/lib/Viewer';
import BpmnModeler from 'bpmn-js/lib/Modeler';
import 'bpmn-js/dist/assets/diagram-js.css';
import 'bpmn-js/dist/assets/bpmn-font/css/bpmn.css';

interface BPMNViewerProps {
  bpmnXML?: string;
  bpmnData?: any; // Your BPMNDiagramData type
  mode?: 'viewer' | 'modeler';
  height?: string;
  width?: string;
  onElementClick?: (element: any) => void;
  onElementHover?: (element: any) => void;
  onModelingComplete?: (xml: string) => void;
  className?: string;
}

interface BPMNViewerState {
  loading: boolean;
  error: string | null;
  zoomLevel: number;
}

const BPMNViewer: React.FC<BPMNViewerProps> = ({
  bpmnXML,
  bpmnData,
  mode = 'viewer',
  height = '600px',
  width = '100%',
  onElementClick,
  onElementHover,
  onModelingComplete,
  className = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const bpmnInstanceRef = useRef<BpmnViewer | BpmnModeler | null>(null);
  const [state, setState] = useState<BPMNViewerState>({
    loading: false,
    error: null,
    zoomLevel: 1,
  });

  // Initialize BPMN instance
  useEffect(() => {
    if (!containerRef.current) return;

    const BpmnClass = mode === 'modeler' ? BpmnModeler : BpmnViewer;
    
    const bpmnInstance = new BpmnClass({
      container: containerRef.current,
      width: '100%',
      height: height,
      keyboard: {
        bindTo: document,
      },
      additionalModules: [
        // Add custom modules here if needed
      ],
    });

    bpmnInstanceRef.current = bpmnInstance;

    // Set up event listeners
    setupEventListeners(bpmnInstance);

    return () => {
      if (bpmnInstanceRef.current) {
        bpmnInstanceRef.current.destroy();
        bpmnInstanceRef.current = null;
      }
    };
  }, [mode, height, onElementClick, onElementHover]);

  // Load BPMN diagram when XML changes
  useEffect(() => {
    if (bpmnXML && bpmnInstanceRef.current) {
      loadBPMNDiagram(bpmnXML);
    }
  }, [bpmnXML]);

  const setupEventListeners = (bpmnInstance: BpmnViewer | BpmnModeler) => {
    const eventBus = bpmnInstance.get<any>('eventBus');

    // Element click events
    if (onElementClick) {
      eventBus.on('element.click', (event: any) => {
        const { element } = event;
        onElementClick(element);
      });
    }

    // Element hover events
    if (onElementHover) {
      eventBus.on('element.hover', (event: any) => {
        const { element } = event;
        onElementHover(element);
      });
    }

    // Import done event
    eventBus.on('import.done', (event: any) => {
      const { error } = event;
      if (error) {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: `Failed to render diagram: ${error.message}` 
        }));
      } else {
        setState(prev => ({ 
          ...prev, 
          loading: false, 
          error: null 
        }));
        // Auto-fit diagram
        fitViewport();
      }
    });

    // Zoom change events
    eventBus.on('canvas.viewbox.changed', () => {
      if (bpmnInstanceRef.current) {
        const canvas = bpmnInstanceRef.current.get<any>('canvas');
        const viewbox = canvas.viewbox();
        setState(prev => ({ 
          ...prev, 
          zoomLevel: Math.round(viewbox.scale * 100) / 100 
        }));
      }
    });
  };

  const loadBPMNDiagram = async (xml: string) => {
    if (!bpmnInstanceRef.current) return;

    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
       // IMPORTANT: Clear the canvas completely before importing
    await bpmnInstanceRef.current.clear();
    
    // Small delay to ensure cleanup is complete
    await new Promise(resolve => setTimeout(resolve, 100));
    
    await bpmnInstanceRef.current.importXML(xml);
      
      // If it's a modeler and we have a callback, set up save listener
      if (mode === 'modeler' && onModelingComplete) {
        const commandStack = bpmnInstanceRef.current.get<any>('commandStack');
        commandStack.registerHandler('elements.changed', async () => {
          try {
            const { xml: updatedXML } = await bpmnInstanceRef.current!.saveXML({ format: true });
            onModelingComplete(updatedXML || '');
          } catch (error) {
            console.error('Error saving BPMN XML:', error);
          }
        });
      }
    } catch (error) {
      setState(prev => ({ 
        ...prev, 
        loading: false, 
        error: `Failed to load diagram: ${(error as Error).message}` 
      }));
    }
  };

  const fitViewport = () => {
    if (bpmnInstanceRef.current) {
      const canvas = bpmnInstanceRef.current.get<any>('canvas');
      canvas.zoom('fit-viewport', 'auto');
    }
  };

  const zoomIn = () => {
    if (bpmnInstanceRef.current) {
      const canvas = bpmnInstanceRef.current.get<any>('canvas');
      canvas.zoom(state.zoomLevel + 0.2);
    }
  };

  const zoomOut = () => {
    if (bpmnInstanceRef.current) {
      const canvas = bpmnInstanceRef.current.get<any>('canvas');
      canvas.zoom(Math.max(0.2, state.zoomLevel - 0.2));
    }
  };

  const resetZoom = () => {
    if (bpmnInstanceRef.current) {
      const canvas = bpmnInstanceRef.current.get<any>('canvas');
      canvas.zoom(1);
    }
  };

  const exportSVG = async () => {
    if (!bpmnInstanceRef.current) return;

    try {
      const { svg } = await bpmnInstanceRef.current.saveSVG();
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'process-diagram.svg';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting SVG:', error);
    }
  };

  const exportXML = async () => {
    if (!bpmnInstanceRef.current) return;

    try {
      const { xml } = await bpmnInstanceRef.current.saveXML({ format: true });
      const blob = new Blob([xml || ''], { type: 'application/xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'process-diagram.bpmn';
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Error exporting XML:', error);
    }
  };

  return (
    <div className={`bpmn-viewer-container ${className}`}>
      {/* Toolbar */}
      <div className="bpmn-toolbar" style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        padding: '8px 12px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #e9ecef',
        borderRadius: '8px 8px 0 0',
      }}>
        <div className="zoom-controls" style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={zoomOut}
            disabled={state.loading}
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Zoom Out"
          >
            −
          </button>
          <span style={{
            padding: '4px 8px',
            fontSize: '12px',
            minWidth: '50px',
            textAlign: 'center',
            backgroundColor: 'white',
            border: '1px solid #ccc',
            borderRadius: '4px',
          }}>
            {Math.round(state.zoomLevel * 100)}%
          </span>
          <button
            onClick={zoomIn}
            disabled={state.loading}
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Zoom In"
          >
            +
          </button>
          <button
            onClick={fitViewport}
            disabled={state.loading}
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Fit to Viewport"
          >
            Fit
          </button>
          <button
            onClick={resetZoom}
            disabled={state.loading}
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Reset Zoom"
          >
            1:1
          </button>
        </div>

        <div style={{ width: '1px', height: '20px', backgroundColor: '#e9ecef' }} />

        <div className="export-controls" style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={exportSVG}
            disabled={state.loading || !bpmnXML}
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Export as SVG"
          >
            SVG
          </button>
          <button
            onClick={exportXML}
            disabled={state.loading || !bpmnXML}
            style={{
              padding: '4px 8px',
              border: '1px solid #ccc',
              borderRadius: '4px',
              backgroundColor: 'white',
              cursor: 'pointer',
              fontSize: '12px',
            }}
            title="Export as BPMN XML"
          >
            XML
          </button>
        </div>

        {state.loading && (
          <div style={{
            marginLeft: 'auto',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '12px',
            color: '#666',
          }}>
            <div style={{
              width: '16px',
              height: '16px',
              border: '2px solid #e9ecef',
              borderTop: '2px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
            }} />
            Loading diagram...
          </div>
        )}

        {mode === 'modeler' && (
          <div style={{
            marginLeft: 'auto',
            fontSize: '12px',
            color: '#666',
          }}>
            Modeling Mode
          </div>
        )}
      </div>

      {/* Error Display */}
      {state.error && (
        <div style={{
          padding: '12px',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          border: '1px solid #f5c6cb',
          fontSize: '14px',
        }}>
          <strong>Error:</strong> {state.error}
        </div>
      )}

      {/* BPMN Canvas Container */}
      <div
        ref={containerRef}
        style={{
          width,
          height: height === '100%' ? 'calc(100vh - 140px)' : height,
          border: '1px solid #e9ecef',
          borderTop: state.error ? '1px solid #e9ecef' : 'none',
          borderRadius: state.error ? '0 0 8px 8px' : '0 0 8px 8px',
          overflow: 'hidden',
          position: 'relative',
        }}
      />

      {/* No Data State */}
      {!bpmnXML && !state.loading && !state.error && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          textAlign: 'center',
          color: '#666',
          fontSize: '16px',
        }}>
          <div style={{ marginBottom: '8px', fontSize: '48px', opacity: 0.3 }}>
            📊
          </div>
          <div>No BPMN diagram to display</div>
          <div style={{ fontSize: '14px', marginTop: '4px' }}>
            Extract a process to see the diagram here
          </div>
        </div>
      )}

      {/* CSS Animation for loading spinner */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        
        .bpmn-viewer-container .djs-container {
          font-family: Arial, sans-serif;
        }
        
        .bpmn-viewer-container .djs-palette {
          left: 20px;
          top: 20px;
        }
        
        .bpmn-viewer-container .djs-context-pad {
          background: white;
          border-radius: 4px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );
};

export default BPMNViewer;