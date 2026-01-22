
import { createServer } from 'http';
import { appendFile } from 'fs';

const PORT = 3000;
const LOG_FILE = 'extension-debug.log';

const server = createServer((req, res) => {
    // Enable CORS for the chrome extension
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.method === 'POST' && req.url === '/log') {
        let body = '';
        req.on('data', chunk => {
            body += chunk.toString();
        });
        req.on('end', () => {
            const timestamp = new Date().toISOString();
            const logEntry = `[${timestamp}] ${body}\n`;

            appendFile(LOG_FILE, logEntry, err => {
                if (err) {
                    console.error('Failed to write to log file:', err);
                    res.writeHead(500);
                    res.end('Error writing log');
                } else {
                    console.log('Log received:', body.substring(0, 100) + '...');
                    res.writeHead(200);
                    res.end('Log saved');
                }
            });
        });
    } else {
        res.writeHead(404);
        res.end('Not Found');
    }
});

server.listen(PORT, () => {
    console.log(`🔍 Log Bridge running at http://localhost:${PORT}`);
    console.log(`📝 Logs will be written to ${LOG_FILE}`);
});
