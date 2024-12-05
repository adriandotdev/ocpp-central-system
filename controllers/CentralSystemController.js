const logger = require("../config/logger");

/**
 * @param {import('express').Request} app
 * @param {Array} CONNECTED_CHARGERS
 * @param {Map<String, Object>} connectedChargers
 */
module.exports = (app, CONNECTED_CHARGERS, connectedChargers) => {
	app.post(
		"/ocpp/1.6/api/v1/remote-start",

		/**
		 * @param {import('express').Request} req
		 * @param {import('express').Response} res
		 */
		(req, res) => {
			const { charger_identity, connector_id, id_tag } = req.body;

			if (!charger_identity || !connector_id || !id_tag) {
				return res.status(400).json({
					statusCode: 400,
					data: {
						message:
							"Request body properties: charger_identity, connector_id, id_tag must be provided",
					},
					message: "Bad Request",
				});
			}

			const ws = connectedChargers.get(charger_identity)?.ws;

			if (!ws || ws.readyState !== WebSocket.OPEN) {
				return res.status(404).json({
					statusCode: 404,
					data: { message: "Charger not connected or unavailable." },
					message: "Not Found",
				});
			}

			const remoteStartRequest = [
				2,
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
					statusCode: 200,
					data: {
						charger_identity,
						action: "RemoteStartTransaction",
						message: `Success`,
					},
					message: `OK`,
				});
			} catch (error) {
				logger.error({
					statusCode: 500,
					data: { error },
					message: "Internal Server Error",
				});
				res.status(500).json({
					statusCode: 500,
					data: { error },
					message: "Internal Server Error",
				});
			}
		}
	);

	app.post(
		"/ocpp/1.6/api/v1/remote-stop",

		/**
		 * @param {import('express').Request} req
		 * @param {import('express').Response} res
		 */
		(req, res) => {
			const { charger_identity } = req.body;

			if (!charger_identity) {
				return res.status(400).json({
					statusCode: 400,
					data: {
						message:
							"Request body properties: charger_identity must be provided.",
					},
					message: "Bad Request",
				});
			}

			const ws = connectedChargers.get(charger_identity)?.ws;

			if (!ws || ws.readyState !== WebSocket.OPEN) {
				return res.status(404).json({
					statusCode: 404,
					data: { message: "Charger is not connected or unavailable." },
					message: "Not Found",
				});
			}

			const remoteStopRequest = [
				2,
				connectedChargers.get(charger_identity).unique_id,
				"RemoteStopTransaction",
				{
					transactionId: 12345,
				},
			];

			try {
				logger.info(`API: ${req.url}`);
				ws.send(JSON.stringify(remoteStopRequest));
				res.status(200).json({
					statusCode: 200,
					data: {
						charger_identity,
						action: "RemoteStopTransaction",
						message: "Success",
					},
					message: `OK`,
				});
			} catch (error) {
				logger.error({
					statusCode: 500,
					data: { error },
					message: "Internal Server Error",
				});
				res.status(500).json({
					statusCode: 500,
					data: { error },
					message: "Internal Server Error",
				});
			}
		}
	);

	app.get(
		"/ocpp/1.6/api/v1/get-local-list",

		/**
		 * @param {import('express').Request} req
		 * @param {import('express').Response} res
		 */
		(req, res) => {
			const { charger_identity } = req.body;

			if (!charger_identity) {
				return res.status(400).json({
					statusCode: 400,
					data: {
						message:
							"Request body properties: charger_identity must be provided",
					},
					message: "Bad Request",
				});
			}

			const ws = connectedChargers.get(charger_identity)?.ws;

			if (!ws || ws.readyState !== WebSocket.OPEN) {
				return res.status(404).json({
					statusCode: 404,
					data: { message: "Charger is not connected or unavailable" },
					message: "Not Found",
				});
			}

			const localListRequest = [
				2,
				connectedChargers.get(charger_identity).unique_id,
				"GetLocalListVersion",
				{},
			];

			try {
				logger.info(`API: ${req.url}`);
				ws.send(JSON.stringify(localListRequest));
				res.status(200).json({
					statusCode: 200,
					data: {
						charger_identity,
						action: "GetLocalListVersion",
						message: "Success",
					},
					message: "OK",
				});
			} catch (error) {
				logger.error({
					statusCode: 500,
					data: { error },
					message: "Internal Server Error",
				});
				res.status(500).json({
					statusCode: 500,
					data: { error },
					message: "Internal Server Error",
				});
			}
		}
	);

	app.post(
		"/ocpp/1.6/api/v1/trigger-message",

		/**
		 * @param {import('express').Request} req
		 * @param {import('express').Response} res
		 */
		(req, res) => {
			const { charger_identity, requested_message, connector_id } = req.body;

			if (!requested_message || !charger_identity || !connector_id)
				return res.status(400).json({
					statusCode: 400,
					data: {
						message:
							"Request body properties: charger_identity, requested_message, connector_id must be provided",
					},
					message: "Bad Request",
				});

			const ws = connectedChargers.get(charger_identity)?.ws;

			if (!ws || ws.readyState !== WebSocket.OPEN) {
				return res.status(404).json({
					statusCode: 404,
					data: { message: "Charger is not connected or unavailable" },
					message: "Not Found",
				});
			}

			const triggerMessageRequest = [
				2,
				connectedChargers.get(charger_identity).unique_id,
				"TriggerMessage",
				{
					requestedMessage: requested_message,
					connectorId: connector_id ? 0 : 1,
				},
			];

			try {
				logger.info(`API: ${req.url}`);
				ws.send(JSON.stringify(triggerMessageRequest));
				res.status(200).json({
					statusCode: 200,
					data: {
						charger_identity,
						action: "TriggerMessage",
						requested_message,
						connector_id,
						message: "Success",
					},
					message: "OK",
				});
			} catch (error) {
				logger.error({
					statusCode: 500,
					data: { error },
					message: "Internal Server Error",
				});
				res.status(500).json({
					statusCode: 500,
					data: { error },
					message: "Internal Server Error",
				});
			}
		}
	);

	app.post(
		"/ocpp/1.6/api/v1/clear-cache",

		/**
		 * @param {import('express').Request} req
		 * @param {import('express').Response} res
		 */
		(req, res) => {
			const { charger_identity } = req.body;

			if (!charger_identity) {
				return res.status(400).json({
					statusCode: 400,
					data: {
						message:
							"Request body properties: charger_identity must be provided",
					},
					message: "Bad Request",
				});
			}

			const ws = connectedChargers.get(charger_identity)?.ws;

			if (!ws || ws.readyState !== WebSocket.OPEN) {
				return res.status(404).json({
					statusCode: 404,
					data: { message: "Charger is not connected or unavailable." },
					message: "Not Found",
				});
			}

			const clearCacheRequest = [
				2,
				connectedChargers.get(charger_identity).unique_id,
				"ClearCache",
				{},
			];

			try {
				logger.info(`API: ${req.url}`);
				ws.send(JSON.stringify(clearCacheRequest));
				res.status(200).json({
					statusCode: 200,
					data: {
						charger_identity,
						action: "ClearCache",
						message: "Success",
					},
					message: "OK",
				});
			} catch (error) {
				logger.error({
					statusCode: 500,
					data: { error },
					message: "Internal Server Error",
				});
				res.status(500).json({
					statusCode: 500,
					data: { error },
					message: "Internal Server Error",
				});
			}
		}
	);

	app.post("/ocpp/1.6/api/v1/reset", (req, res) => {
		const { charger_identity, reset_type } = req.body;

		if (!charger_identity || !reset_type) {
			return res.status(400).json({
				statusCode: 400,
				data: {
					message:
						"Request body properties: charger_identity, reset_type must be provided",
				},
				message: "Bad Request",
			});
		}

		const ws = connectedChargers.get(charger_identity)?.ws;

		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return res.status(404).json({
				statusCode: 404,
				data: { message: "Charger is not connected or unavailable." },
				message: "Not Found",
			});
		}

		const resetRequest = [
			2,
			connectedChargers.get(charger_identity).unique_id,
			"Reset",
			{
				type: reset_type,
			},
		];

		try {
			logger.info(`API: ${req.url}`);
			ws.send(JSON.stringify(resetRequest));
			res.status(200).json({
				statusCode: 200,
				data: {
					charger_identity,
					action: "Reset",
					reset_type,
					message: "Success",
				},
				message: "OK",
			});
		} catch (error) {
			logger.error({
				statusCode: 500,
				data: { error },
				message: "Internal Server Error",
			});
			res.status(500).json({
				statusCode: 500,
				data: { error },
				message: "Internal Server Error",
			});
		}
	});
};
