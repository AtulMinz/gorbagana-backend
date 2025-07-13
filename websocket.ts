import { WebSocketServer } from "ws";
import http from "http";

// Create HTTP server (optional if you want to serve your Vite app too)
const server = http.createServer();

// Attach WS server to HTTP server
const wss = new WebSocketServer({ server });

const players = {};

wss.on("connection", (ws) => {
  const playerId = generateId();
  players[playerId] = { id: playerId, input: {} };

  console.log(`Player ${playerId} connected`);

  ws.send(JSON.stringify({ type: "message", text: `Welcome ${playerId}` }));

  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);
      if (msg.type === "setButton") {
        players[playerId].input[msg.button] = msg.value;
      }
    } catch (err) {
      console.error("Error parsing message:", err);
    }
  });

  ws.on("close", () => {
    console.log(`Player ${playerId} disconnected`);
    delete players[playerId];
  });
});

// Dummy update loop
setInterval(() => {
  // Update your game state here!
  const state = {
    players: Object.values(players).map((p) => ({
      id: p.id,
      input: p.input,
    })),
  };

  broadcast({ type: "sendState", state });
}, 1000 / 30); // 30 FPS tick

function broadcast(msg: any) {
  const str = JSON.stringify(msg);
  wss.clients.forEach((client) => {
    if (client.readyState === client.OPEN) {
      client.send(str);
    }
  });
}

function generateId() {
  return Math.random().toString(36).substr(2, 9);
}
