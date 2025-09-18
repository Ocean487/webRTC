console.log('Testing ws module...');
const WebSocket = require('./node_modules/ws');
console.log('ws module loaded successfully:', !!WebSocket);
console.log('Starting basic server...');

const express = require('express');
const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });

console.log('WebSocket server created');

server.listen(3001, () => {
    console.log('Test server running on port 3001');
});