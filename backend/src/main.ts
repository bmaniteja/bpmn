import app from './app';
import config from './config';
import { createServer } from 'http';
import { setupSocketHandlers } from './routes/Socket.route';

const httpServer = createServer(app);
setupSocketHandlers(httpServer);

httpServer.listen(config.port, () => {
  console.log(`Server with Socket.io running on port ${config.port}`);
});

// Simple test client (HTML):
/*
<!DOCTYPE html>
<html>
<head>
    <title>Process Agent Test</title>
    <script src="/socket.io/socket.io.js"></script>
</head>
<body>
    <div>
        <textarea id="feature" placeholder="Enter feature description..."></textarea>
        <button onclick="extract()">Extract Process</button>
        <button onclick="clear()">Clear Context</button>
    </div>
    <div id="output"></div>
    
    <script>
        const socket = io();
        const output = document.getElementById('output');
        
        socket.on('agent:status', (data) => {
            output.innerHTML += `<p>Status: ${data.status} - ${data.action || ''}</p>`;
        });
        
        socket.on('process:extracted', (data) => {
            output.innerHTML += `<p>✅ Process extracted: ${data.processData.metadata.processName}</p>`;
            console.log('Full process data:', data);
        });
        
        socket.on('agent:error', (data) => {
            output.innerHTML += `<p>❌ Error: ${data.message}</p>`;
        });
        
        function extract() {
            const feature = document.getElementById('feature').value;
            if (feature.trim()) {
                output.innerHTML = '';
                socket.emit('process:extract', { featureDescription: feature });
            }
        }
        
        function clear() {
            socket.emit('agent:clear-context');
            output.innerHTML = '';
        }
    </script>
</body>
</html>
*/