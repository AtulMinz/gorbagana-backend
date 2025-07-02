import ws from "ws";

const wss = new ws.WebSocketServer({
  port: 8080,
  // perMessageDeflate: false,
});

wss.on("connection", function (ws) {
  ws.on("error", console.error);
  ws.on("message", function message(data) {
    console.log("Received", data);
    ws.send(data.toString());
  });

  ws.send("something");
});
export default wss;
