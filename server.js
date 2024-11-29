const app = require("./app");
const WebSocket = require("ws");
const logger = require("./config/logger");

const PORT = 8085;

// Create an HTTP server
const server = app.listen(PORT, () => {
	logger.info(`Server listening on ${PORT}`);
});

// Attach WebSocket server to the existing HTTP server
const wss = new WebSocket.Server({ server });

wss.on("connection", (ws) => {
	logger.info("New WebSocket connection established!");

	ws.on("message", (message) => {
		logger.info(`Received message: ${message}`);
		ws.send(`Echo: ${message}`);
	});

	ws.on("close", () => {
		logger.info("WebSocket connection closed.");
	});
});
