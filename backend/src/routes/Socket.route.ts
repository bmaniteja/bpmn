import { Server, Socket } from 'socket.io';
import { Server as HttpServer } from 'http';
import ProcessExtractionAgent from '../services/agents/ProcessExtractionAgent';
import BPMNProcessExtractionAgent from '../services/agents/BPMNProcessExtractionAgent';

// Initialize the agent (singleton for testing)
const processAgent = new ProcessExtractionAgent();

export function initializeSocketRoutes(httpServer: HttpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*", // For testing only
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Test process extraction
    socket.on('process:extract', async (data: { sessionId:string, featureDescription: string }) => {
      console.log(data)
      try {
        console.log(`Processing extraction for socket ${socket.id}`);
        
        // Use socket.id as sessionId for simplicity
        const sessionId = data.sessionId;
        
        // Call the agent's processMessage method which handles streaming
        await processAgent.processMessage(sessionId, data.featureDescription, socket);
        
      } catch (error) {
        console.error('Socket extraction error:', error);
        socket.emit('agent:error', {
          message: (error as Error).message,
          timestamp: new Date().toISOString()
        });
      }
    });

    // Clear context
    socket.on('agent:clear-context', async () => {
      try {
        await processAgent.clearContext(socket.id);
        socket.emit('agent:context-cleared', { sessionId: socket.id });
      } catch (error) {
        socket.emit('agent:error', { message: (error as Error).message });
      }
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`Socket disconnected: ${socket.id}`);
      // Auto-cleanup context on disconnect
      try {
        await processAgent.clearContext(socket.id);
      } catch (error) {
        console.error('Cleanup error:', error);
      }
    });
  });

  return io;
}



// Initialize the BPMN agent
const bpmnAgent = new BPMNProcessExtractionAgent();

export const setupSocketHandlers = (httpServer: HttpServer) => {

   const io = new Server(httpServer, {
    cors: {
      origin: "*", // For testing only
      methods: ["GET", "POST"]
    }
  });

  io.on('connection', (socket: Socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Handle BPMN process extraction requests
    socket.on('extract:bpmn', async (data: { sessionId: string; message: string }) => {
      try {
        const { sessionId, message } = data;
        
        if (!message || !message.trim()) {
          socket.emit('agent:error', {
            message: 'Message cannot be empty',
            timestamp: new Date().toISOString(),
          });
          return;
        }

        // Use the agent's streaming processing method
        await bpmnAgent.processMessage(sessionId, message, socket);
        
      } catch (error) {
        console.error('BPMN extraction error:', error);
        socket.emit('agent:error', {
          message: `Extraction failed: ${(error as Error).message}`,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle non-streaming BPMN extraction (optional)
    socket.on('extract:bpmn:sync', async (data: { sessionId: string; message: string }) => {
      try {
        const { sessionId, message } = data;
        
        const result = await bpmnAgent.execute(sessionId, message);
        
        if (result.isValid && result.bpmnData && result.bpmnXML) {
          socket.emit('bpmn:extracted', {
            bpmnData: result.bpmnData,
            bpmnXML: result.bpmnXML,
            metadata: {
              sessionId,
              extractedAt: new Date().toISOString(),
              featureDescription: message,
            }
          });
        } else {
          socket.emit('bpmn:validation-error', {
            errors: result.validationErrors || ['Unknown validation error'],
            rawResponse: result.response,
          });
        }
        
      } catch (error) {
        console.error('Sync BPMN extraction error:', error);
        socket.emit('agent:error', {
          message: `Extraction failed: ${(error as Error).message}`,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle context management
    socket.on('clear:context', async (data: { sessionId: string }) => {
      try {
        await bpmnAgent.clearContext(data.sessionId);
        socket.emit('context:cleared', { sessionId: data.sessionId });
      } catch (error) {
        console.error('Context clearing error:', error);
        socket.emit('agent:error', {
          message: `Failed to clear context: ${(error as Error).message}`,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle context retrieval
    socket.on('get:context', (data: { sessionId: string }) => {
      try {
        const context = bpmnAgent.getContext(data.sessionId);
        socket.emit('context:data', { sessionId: data.sessionId, context });
      } catch (error) {
        console.error('Context retrieval error:', error);
        socket.emit('agent:error', {
          message: `Failed to get context: ${(error as Error).message}`,
          timestamp: new Date().toISOString(),
        });
      }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Client disconnected: ${socket.id}`);
    });

    // Handle connection errors
    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error);
    });
  });

  // Global error handling
  io.engine.on('connection_error', (err) => {
    console.error('Socket.IO connection error:', err);
  });
};