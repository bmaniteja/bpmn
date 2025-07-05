import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import BPMNViewer from './BPMNViewer';

interface ProcessExtractionPageProps {
  socketUrl?: string;
  className?: string;
}

interface ExtractionState {
  status: 'idle' | 'thinking' | 'extracting' | 'validating' | 'complete' | 'error';
  action?: string;
  loading: boolean;
  error: string | null;
}

interface ExtractedProcess {
  bpmnXML: string;
  metadata: {
    sessionId: string;
    extractedAt: string;
    featureDescription: string;
  };
}

const ProcessExtractionPage: React.FC<ProcessExtractionPageProps> = ({
  socketUrl = 'ws://localhost:3000',
  className = '',
}) => {
  const [inputText, setInputText] = useState('');
  const [extractionState, setExtractionState] = useState<ExtractionState>({
    status: 'idle',
    loading: false,
    error: null,
  });
  const [extractedProcess, setExtractedProcess] = useState<ExtractedProcess | null>(null);
  const [history, setHistory] = useState<ExtractedProcess[]>([]);
  const [selectedElement, setSelectedElement] = useState<any>(null);
  
  const socketRef = useRef<Socket | null>(null);
  const sessionId = useRef<string>(`session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    // Initialize socket connection
    socketRef.current = io(socketUrl);

    // Set up socket event listeners
    setupSocketListeners();

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, [socketUrl]);

  const setupSocketListeners = () => {
    if (!socketRef.current) return;

    const socket = socketRef.current;

    // Agent status updates
    socket.on('agent:status', (status: { status: string; action?: string }) => {
      setExtractionState(prev => ({
        ...prev,
        status: status.status as any,
        action: status.action,
        loading: status.status !== 'complete' && status.status !== 'error',
      }));
    });

    // Successful extraction
    socket.on('bpmn:extracted', (data: ExtractedProcess) => {
      setExtractedProcess(data);
      console.log(data.bpmnXML);
      setHistory(prev => [data, ...prev.slice(0, 9)]); // Keep last 10
      setExtractionState(prev => ({
        ...prev,
        status: 'complete',
        loading: false,
        error: null,
      }));
    });

    // Validation errors
    socket.on('bpmn:validation-error', (error: { errors: string[]; rawResponse: string }) => {
      setExtractionState(prev => ({
        ...prev,
        status: 'error',
        loading: false,
        error: `Validation failed: ${error.errors.join(', ')}`,
      }));
    });

    // General errors
    socket.on('agent:error', (error: { message: string; timestamp: string }) => {
      setExtractionState(prev => ({
        ...prev,
        status: 'error',
        loading: false,
        error: error.message,
      }));
    });
  };

  const handleExtractProcess = async () => {
    if (!inputText.trim() || !socketRef.current) return;

    setExtractionState({
      status: 'thinking',
      loading: true,
      error: null,
    });

    // Emit process extraction request
    socketRef.current.emit('extract:bpmn', {
      sessionId: sessionId.current,
      message: inputText.trim(),
    });
  };

  const handleElementClick = (element: any) => {
    setSelectedElement(element);
  };

  const handleClearHistory = () => {
    setHistory([]);
    setExtractedProcess(null);
    setSelectedElement(null);
  };

  const loadHistoryItem = (item: ExtractedProcess) => {
    setExtractedProcess(item);
    setSelectedElement(null);
  };

  const getStatusIcon = () => {
    switch (extractionState.status) {
      case 'thinking':
        return '🤔';
      case 'extracting':
        return '⚙️';
      case 'validating':
        return '✅';
      case 'complete':
        return '🎉';
      case 'error':
        return '❌';
      default:
        return '📝';
    }
  };

  const getStatusMessage = () => {
    if (extractionState.action) {
      return extractionState.action;
    }
    
    switch (extractionState.status) {
      case 'idle':
        return 'Ready to extract process';
      case 'thinking':
        return 'Analyzing feature description...';
      case 'extracting':
        return 'Extracting BPMN process structure...';
      case 'validating':
        return 'Validating BPMN structure...';
      case 'complete':
        return 'Process extraction complete!';
      case 'error':
        return extractionState.error || 'An error occurred';
      default:
        return 'Ready';
    }
  };

  return (
    <div className={`process-extraction-page ${className}`} style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <header style={{
        padding: '20px',
        backgroundColor: '#f8f9fa',
        borderBottom: '1px solid #e9ecef',
      }}>
        <h1 style={{ margin: 0, fontSize: '24px', color: '#333' }}>
          BPMN Process Extraction
        </h1>
        <p style={{ margin: '8px 0 0 0', color: '#666', fontSize: '14px' }}>
          Describe your business process and get a professional BPMN swimlane diagram
        </p>
      </header>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Input Panel */}
        <div style={{
          width: '400px',
          padding: '20px',
          backgroundColor: 'white',
          borderRight: '1px solid #e9ecef',
          display: 'flex',
          flexDirection: 'column',
          gap: '16px',
        }}>
          {/* Input Section */}
          <div>
            <label style={{
              display: 'block',
              marginBottom: '8px',
              fontSize: '14px',
              fontWeight: 'bold',
              color: '#333',
            }}>
              Feature Description
            </label>
            <textarea
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="Describe your business process or feature... 

Example: 'Users can submit purchase orders which need approval from their manager. If the amount is over $5000, it also requires finance team approval before being processed.'"
              style={{
                width: '100%',
                height: '120px',
                padding: '12px',
                border: '1px solid #ccc',
                borderRadius: '6px',
                fontSize: '14px',
                resize: 'vertical',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Action Button */}
          <button
            onClick={handleExtractProcess}
            disabled={!inputText.trim() || extractionState.loading}
            style={{
              padding: '12px 20px',
              backgroundColor: extractionState.loading ? '#6c757d' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              cursor: extractionState.loading ? 'not-allowed' : 'pointer',
              transition: 'background-color 0.2s',
            }}
          >
            {extractionState.loading ? 'Extracting...' : 'Extract BPMN Process'}
          </button>

          {/* Status Display */}
          <div style={{
            padding: '12px',
            backgroundColor: extractionState.status === 'error' ? '#f8d7da' : '#e7f3ff',
            border: `1px solid ${extractionState.status === 'error' ? '#f5c6cb' : '#b8daff'}`,
            borderRadius: '6px',
            fontSize: '14px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '18px' }}>{getStatusIcon()}</span>
              <span style={{ 
                color: extractionState.status === 'error' ? '#721c24' : '#004085',
                fontWeight: 'bold',
              }}>
                {getStatusMessage()}
              </span>
            </div>
            {extractionState.loading && (
              <div style={{
                width: '100%',
                height: '4px',
                backgroundColor: '#e9ecef',
                borderRadius: '2px',
                marginTop: '8px',
                overflow: 'hidden',
              }}>
                <div style={{
                  height: '100%',
                  backgroundColor: '#007bff',
                  borderRadius: '2px',
                  animation: 'progress 2s ease-in-out infinite',
                }} />
              </div>
            )}
          </div>

          {/* Element Inspector */}
          {selectedElement && (
            <div style={{
              padding: '12px',
              backgroundColor: '#fff3cd',
              border: '1px solid #ffeaa7',
              borderRadius: '6px',
              fontSize: '14px',
            }}>
              <h4 style={{ margin: '0 0 8px 0', color: '#856404' }}>
                Selected Element
              </h4>
              <div style={{ color: '#856404', fontSize: '12px' }}>
                <div><strong>ID:</strong> {selectedElement.id}</div>
                <div><strong>Type:</strong> {selectedElement.type}</div>
                {selectedElement.businessObject?.name && (
                  <div><strong>Name:</strong> {selectedElement.businessObject.name}</div>
                )}
              </div>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div>
              <div style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '8px',
              }}>
                <h4 style={{ margin: 0, fontSize: '14px', color: '#333' }}>
                  Recent Extractions
                </h4>
                <button
                  onClick={handleClearHistory}
                  style={{
                    padding: '4px 8px',
                    fontSize: '12px',
                    color: '#6c757d',
                    backgroundColor: 'transparent',
                    border: '1px solid #6c757d',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Clear
                </button>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
                {history.map((item, index) => (
                  <div
                    key={index}
                    onClick={() => loadHistoryItem(item)}
                    style={{
                      padding: '8px',
                      marginBottom: '4px',
                      backgroundColor: extractedProcess === item ? '#e7f3ff' : '#f8f9fa',
                      border: '1px solid #e9ecef',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      transition: 'background-color 0.2s',
                    }}
                  >
                    <div style={{ color: '#666' }}>
                      {new Date(item.metadata.extractedAt).toLocaleTimeString()}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* BPMN Viewer Panel */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <BPMNViewer
            bpmnXML={extractedProcess?.bpmnXML}
            mode="viewer"
            height="100%"
            onElementClick={handleElementClick}
            className="main-viewer"
          />
        </div>
      </div>

      {/* CSS Animations */}
      <style>{`
        @keyframes progress {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        
        .process-extraction-page textarea:focus {
          outline: none;
          border-color: #007bff;
          box-shadow: 0 0 0 2px rgba(0, 123, 255, 0.25);
        }
        
        .process-extraction-page button:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
      `}</style>
    </div>
  );
};

export default ProcessExtractionPage;