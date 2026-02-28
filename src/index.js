import express from 'express';
import http from 'http';
import { matchRouter } from './routes/matches.js';
import { setupWebSocketServer } from './ws/server.js';
import { securityMiddleware } from './arcjet.js';
import { commentaryRouter } from './routes/commentary.js';


const PORT = Number(process.env.PORT || 8001);
const HOST = process.env.HOST || '0.0.0.0';
const app = express();
const server = http.createServer(app);

app.use(express.json());

app.get('/', (req, res) => {
    res.send('Welcome to the Sports Commentary API!');
});
//Middleware
app.use(securityMiddleware())
//Router
app.use('/matches', matchRouter);
app.use('/matches/:id/commentary', commentaryRouter);
const { bradcastMatchCreated, broadcastCommentary } = setupWebSocketServer(server);
app.locals.broadcastMatchCreated = bradcastMatchCreated;
app.locals.broadcastCommentary = broadcastCommentary;


server.listen(PORT, HOST, () => {
  const baseUrl = HOST === '0.0.0.0' ? `http://localhost:${PORT}` : `http://${HOST}:${PORT}`;
  console.log(`Server is running on ${baseUrl}`);
  console.log(`WebSocket Server is running on ${baseUrl.replace('http', 'ws')}/ws`);
});