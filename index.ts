import express from "express";
import { WebSocketServer } from "ws";
import http from "http";

/** Allowed input keys */
type Button = "up" | "down" | "left" | "right" | "attack";

interface PlayerInput {
  up?: boolean;
  down?: boolean;
  left?: boolean;
  right?: boolean;
  attack?: boolean;
}

interface ServerMessage {
  type: string;
  button?: Button;
  value?: boolean;
}

/** === Animation === */
class Animation {
  frame = 0;
  index = 0;
  isDone = false;

  constructor(
    public spriteKey: string,
    public startIndex: number,
    public numIndices: number,
    public framesPerIndex: number,
    public loop: boolean,
  ) {}

  update() {
    if (this.isDone) return;

    this.frame++;
    if (this.frame >= this.framesPerIndex) {
      this.frame = 0;
      this.index++;
      if (this.index >= this.numIndices) {
        if (this.loop) this.index = 0;
        else {
          this.index = this.numIndices - 1;
          this.isDone = true;
        }
      }
    }
  }

  reset() {
    this.frame = 0;
    this.index = 0;
    this.isDone = false;
  }

  getDrawIndex() {
    return this.startIndex + this.index;
  }
}

/** === StickMan player === */
class StickMan {
  input: PlayerInput = {};
  facingRight = false;
  position = { x: Math.random() * 700 + 50, y: Math.random() * 500 + 50 };
  action = "none";
  animation: Animation;

  animations: Record<string, Animation> = {
    stand: new Animation("stickman", 0, 3, 4, true),
    standR: new Animation("stickmanR", 0, 3, 4, true),
    run: new Animation("stickman", 3, 4, 3, true),
    runR: new Animation("stickmanR", 3, 4, 3, true),
    punch: new Animation("stickmanAttacks", 0, 6, 3, false),
    punchR: new Animation("stickmanAttacksR", 0, 6, 3, false),
    hurt: new Animation("stickman", 7, 5, 3, false),
    hurtR: new Animation("stickmanR", 7, 5, 3, false),
  };

  constructor(public id: string) {
    this.animation = this.animations.stand;
  }

  update() {
    let xInput = 0,
      yInput = 0;
    if (this.input.left) xInput--;
    if (this.input.right) xInput++;
    if (this.input.up) yInput--;
    if (this.input.down) yInput++;

    this.position.x += xInput * 6;
    this.position.y += yInput * 4;

    if (xInput > 0) this.facingRight = true;
    else if (xInput < 0) this.facingRight = false;

    this.animation.update();

    switch (this.action) {
      case "none":
        if (xInput === 0 && yInput === 0) {
          this.animation = !this.facingRight
            ? this.animations.stand
            : this.animations.standR;
        } else {
          this.animation = !this.facingRight
            ? this.animations.run
            : this.animations.runR;
        }

        if (this.input.attack) {
          this.action = "attack.punch";
          this.animation = !this.facingRight
            ? this.animations.punch
            : this.animations.punchR;
          this.animation.reset();
        }
        break;

      case "attack.punch":
        if (this.animation.isDone) {
          this.action = "none";
        }
        break;
    }
  }

  setButton(button: Button, value: boolean) {
    this.input[button] = value;
  }

  getDrawInfo() {
    return {
      position: this.position,
      facingRight: this.facingRight,
      spriteKey: this.animation.spriteKey,
      index: this.animation.getDrawIndex(),
    };
  }
}

/** === Players === */
const players: Map<string, StickMan> = new Map();

/** === WS server === */
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

wss.on("connection", (ws) => {
  const id = generateId();
  const stickman = new StickMan(id);
  players.set(id, stickman);
  console.log(`Player ${id} connected`);

  ws.send(JSON.stringify({ type: "message", text: `Welcome player ${id}!` }));

  ws.on("message", (data) => {
    try {
      const msg: ServerMessage = JSON.parse(data.toString());
      if (msg.type === "setButton" && msg.button) {
        const player = players.get(id);
        if (player) player.setButton(msg.button, msg.value ?? false);
      }
    } catch (err) {
      console.error("Invalid WS message:", err);
    }
  });

  ws.on("close", () => {
    players.delete(id);
    console.log(`Player ${id} disconnected`);
  });
});

/** === Game loop === */
setInterval(() => {
  for (const player of players.values()) {
    player.update();
  }

  const state = {
    players: Array.from(players.values()).map((p) => p.getDrawInfo()),
  };

  wss.clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(JSON.stringify({ type: "sendState", state }));
    }
  });
}, 1000 / 30);

function generateId(): string {
  return Math.random().toString(36).substring(2, 9);
}

const PORT = 3001;
server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
