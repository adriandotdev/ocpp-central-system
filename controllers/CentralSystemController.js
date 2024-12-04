const logger = require("../config/logger");

/**
 *
 * @param {import('express').Request} app
 */
module.exports = (app, CONNECTED_CHARGERS, connectedChargers) => {
	app.post("/api/v1/remote-start", (req, res) => {
		const { charger_identity, connector_id, id_tag } = req.body;

		if (!charger_identity || !connector_id || !id_tag) {
			return res.status(400).json({ message: "Missing required parameters" });
		}

		const ws = connectedChargers.get(charger_identity).ws;

		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return res
				.status(404)
				.json({ message: "Charger not connected or unavailable" });
		}

		// Create the remote start transaction request
		const uniqueId = Date.now(); // Example of a unique ID; you can use any unique generator
		const remoteStartRequest = [
			2, // Call type
			connectedChargers.get(charger_identity).unique_id, // Unique ID
			"RemoteStartTransaction", // Action
			{
				connectorId: connector_id,
				idTag: id_tag,
			},
		];

		try {
			logger.info(`API: ${req.url}`);
			ws.send(JSON.stringify(remoteStartRequest));
			res.status(200).json({
				message: `${charger_identity} Remote start command sent successfully`,
			});
		} catch (error) {
			console.error("Error sending remote start command:", error);
			res.status(500).json({ message: "Failed to send command", error });
		}
	});

	app.post("/api/v1/remote-stop", (req, res) => {
		const { charger_identity } = req.body;

		if (!charger_identity) {
			return res.status(400).json({ message: "Missing required parameters" });
		}

		const ws = connectedChargers.get(charger_identity).ws;

		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return res
				.status(404)
				.json({ message: "Charger not connected or unavailable" });
		}

		// Create the remote start transaction request
		const uniqueId = Date.now(); // Example of a unique ID; you can use any unique generator
		const remoteStopRequest = [
			2, // Call type
			connectedChargers.get(charger_identity).unique_id, // Unique ID
			"RemoteStopTransaction", // Action
			{
				transactionId: 12345,
			},
		];

		try {
			logger.info(`API: ${req.url}`);
			ws.send(JSON.stringify(remoteStopRequest));
			res.status(200).json({
				message: `${charger_identity} Remote stop command sent successfully`,
			});
		} catch (error) {
			console.error("Error sending remote stop command:", error);
			res.status(500).json({ message: "Failed to send command", error });
		}
	});

	app.get("/api/v1/get-local-list", (req, res) => {
		const { charger_id } = req.body;

		if (!charger_id) {
			return res.status(400).json({ message: "Missing required parameters" });
		}

		const ws = connectedChargers.get(charger_id).ws;

		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return res
				.status(404)
				.json({ message: "Charger not connected or unavailable" });
		}

		// Create the local list request
		const uniqueId = Date.now(); // Example of a unique ID; you can use any unique generator
		const localListRequest = [
			2, // Call type
			connectedChargers.get(charger_id).unique_id, // Unique ID
			"GetLocalListVersion", // Action
			{},
		];

		try {
			logger.info(`API: ${req.url}`);
			ws.send(JSON.stringify(localListRequest));
			res.status(200).json({ message: "Local list command sent successfully" });
		} catch (error) {
			console.error("Error sending local list command:", error);
			res.status(500).json({ message: "Failed to send command", error });
		}
	});

	app.post("/api/v1/trigger-message", (req, res) => {
		const { charger_identity, requested_message, connector_id } = req.body;

		if (!requested_message)
			return res.status(400).json({ message: "Invalid trigger message" });

		const ws = connectedChargers.get(charger_identity).ws;

		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return res
				.status(404)
				.json({ message: "Charger not connected or unavailable" });
		}

		const uniqueId = Date.now();
		const triggerMessageRequest = [
			2, // Call type
			connectedChargers.get(charger_identity).unique_id, // Unique ID
			"TriggerMessage", // Action
			{
				requestedMessage: requested_message,
				connectorId: connector_id ? 0 : 1,
			},
		];

		try {
			logger.info(`API: ${req.url}`);
			ws.send(JSON.stringify(triggerMessageRequest));
			res
				.status(200)
				.json({ message: `${charger_identity} Trigger Message Success` });
		} catch (error) {
			console.error("Error sending trigger message command:", error);
			res.status(500).json({ message: "Failed to send command", error });
		}
	});

	app.post("/api/v1/clear-cache", (req, res) => {
		const { charger_identity } = req.body;

		if (!charger_identity) {
			return res.status(400).json({ message: "Missing required request body" });
		}

		const ws = connectedChargers.get(charger_identity).ws;

		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return res
				.status(404)
				.json({ message: "Charger not connected or unavailable" });
		}

		const uniqueId = Date.now();
		const clearCacheRequest = [
			2, // Call type
			connectedChargers.get(charger_identity).unique_id, // Unique ID
			"ClearCache", // Action
			{},
		];

		try {
			logger.info(`API: ${req.url}`);
			ws.send(JSON.stringify(clearCacheRequest));
			res
				.status(200)
				.json({ message: `${charger_identity} Clear Cache Success` });
		} catch (error) {
			console.error("Error sending clear cache command:", error);
			res.status(500).json({ message: "Failed to send command", error });
		}
	});

	app.post("/api/v1/reset", (req, res) => {
		const { charger_identity, reset_type } = req.body;

		if (!charger_identity) {
			return res.status(400).json({ message: "Missing required request body" });
		}

		const ws = connectedChargers.get(charger_identity).ws;

		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return res
				.status(404)
				.json({ message: "Charger not connected or unavailable" });
		}

		const uniqueId = Date.now();
		const resetRequest = [
			2, // Call type
			connectedChargers.get(charger_identity).unique_id, // Unique ID
			"Reset", // Action
			{
				type: reset_type,
			},
		];

		try {
			logger.info(`API: ${req.url}`);
			ws.send(JSON.stringify(resetRequest));
			res.status(200).json({ message: `${charger_identity} Reset Success` });
		} catch (error) {
			console.error("Error sending reset command:", error);
			res.status(500).json({ message: "Failed to send command", error });
		}
	});
};
