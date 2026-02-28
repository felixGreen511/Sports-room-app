import { WebSocket, WebSocketServer } from "ws";
import { wsArcjet } from "../arcjet";

//Get a Single User Subscriber
const matcheSubscribers = new Map();
//Subcribe
function subscriber(matchId, socket){
    if(!matcheSubscribers.has(matchId)){
        matcheSubscribers.set(matchId, new Set());
    }
    matcheSubscribers.get(matchId).add(socket);
}
//Unscubscribe
function unSubscriber(matchId, socket){
    const subscribers = matcheSubscribers.get(matchId);
    if(!subscribers) return;
    subscribers.delete(socket)
    if(subscribers.size === 0){
        matcheSubscribers.delete(matchId)
    }

}
function cleanUpSubscriptions(socket){
    for(const matchId of socket.subscriptions){
        unSubscriber(matchId, socket)
    }
}
function sendJson(socket, payLoad){
    if (socket.readyState === WebSocket.OPEN) return;
    socket.send(JSON.stringify(payLoad));
}
function broadcastToAll(wss, payLoad){
   for( const client of wss.clients){
    if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify(payLoad));
    }
   }
}
function broadcastToMatch(matchId, payLoad){
    const subscribers = matcheSubscribers.get(matchId);
    if(!subscribers || subscribers.size === 0) return;
    const message = JSON.stringify(payLoad);
    for(const socket of subscribers){
        if(socket.readyState === WebSocket.OPEN){
            socket.send(message);
        }
    }

}
function handleMessage(socket, data){
    let message;
    try {
        message = JSON.parse(data.toString());
    } catch {
        sendJson(socket, { type: 'error', message: 'Invalid JSON..'})
    }
    if(message?.type === "subscriber" && Number.isInteger(message.matchId)){
        subscriber(message.matchId, socket);
        socket.subscriptions.add(message.matchId);
        sendJson(socket, { type: 'subscribed', matchId: message.matchId })
    }
    if(message?.type === "unSubscriber" && Number.isInteger(message.matchId)){
        unSubscriber(message.matchId, socket)
        socket.subscriptions.delete(message.matchId);
        sendJson(socket, { type: 'unsubscribed', matchId: message.matchId })
    }
}
//Websocket Server
export function setupWebSocketServer(server) {
    const wss = new WebSocketServer({ noServer: true, path: '/ws', maxPayload: 1024 * 1024 });
    server.on('upgrade', async (req, socket, head) => {
        const { pathname } = new URL(req.url, `http://${req.headers.host}`);

        if (pathname !== '/ws') {
            return;
        }

        if (wsArcjet) {
            try {
                const decision = await wsArcjet.protect(req);

                if (decision.isDenied()) {
                    if (decision.reason.isRateLimit()) {
                        socket.write('HTTP/1.1 429 Too Many Requests\r\n\r\n');
                    } else {
                        socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
                    }
                    socket.destroy();
                    return;
                }
            } catch (e) {
                console.error('WS upgrade protection error', e);
                socket.write('HTTP/1.1 500 Internal Server Error\r\n\r\n');
                socket.destroy();
                return;
            }
        }

        wss.handleUpgrade(req, socket, head, (ws) => {
            wss.emit('connection', ws, req);
        });
    });

    wss.on('connection', async (socket, req) => {
        socket.isAlive = true;
        socket.on('pong', () => { socket.isAlive = true; });

        socket.subscriptions = new Set();

        sendJson(socket, { type: 'welcome' });

        socket.on('message', (data) => {
            handleMessage(socket, data);
        });

        socket.on('error', () => {
            socket.terminate();
        });

        socket.on('close', () => {
            cleanUpSubscriptions(socket);
        })

        socket.on('error', console.error);
    });

    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            if (ws.isAlive === false) return ws.terminate();

            ws.isAlive = false;
            ws.ping();
        })}, 30000);

    wss.on('close', () => clearInterval(interval));

    function broadcastMatchCreated(match) {
        broadcastToAll(wss, { type: 'match_created', data: match });
    }

    function broadcastCommentary(matchId, comment) {
        broadcastToMatch(matchId, { type: 'commentary', data: comment });
    }

    return { broadcastMatchCreated, broadcastCommentary };
}