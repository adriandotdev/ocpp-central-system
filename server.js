const app = require("./app");
const WebSocket = require("ws");
const logger = require("./config/logger");

const PORT = 4500;

// Create an HTTP server
const server = app.listen(PORT, () => {
	logger.info(`Server listening on ${PORT}`);
});

// Attach WebSocket server to the existing HTTP server
const wss = new WebSocket.Server({
	server,
});

let CONNECTED_CHARGERS = [];

wss.on("connection", (ws, req) => {
	logger.info("New WebSocket connection established!");
	logger.info(req.url);
	logger.info({ ...req.headers });

	ws.on("message", (message) => {
		logger.info(`Received message: ${message}`);

		const request = Buffer.from(message, "base64").toString("ascii"); // convert data to json or readable text
		const data = JSON.parse(request);
		//raw_logs.info(data);
		const unique_id = data[1]; //telto fix-1010 // Unique id that has been receive, will use it again in our response to his current request
		//let unique_id = data[1]; // Unique id that has been receive, will use it again in our response to his current request
		const action = data[2]; // OPERATION(BootNotif, Authorize, ...)
		const payload = data[3]; // payload data

		logger.info({
			DATA_RECEIVED: {
				unique_id,
				action,
				payload,
			},
		});

		let response = [3, unique_id, {}];

		if (action === "BootNotification") {
			logger.info({
				action: "BootNotification",
				identity: req.url.slice(1),
				headers: {
					...req.headers,
				},
				unique_id,
			});

			// changeConfigResponse = [
			// 	2,
			// 	unique_id,
			// 	"ChangeConfiguration",
			// 	{
			// 		key: "MeterValueSampleInterval",
			// 		value: "10",
			// 	},
			// ];

			// ws.send(JSON.stringify(changeConfigResponse));

			response = [
				3,
				unique_id,
				{
					currentTime: new Date().toISOString(), // ISO 8601 date format
					interval: 60, // Example interval in seconds
					status: "Accepted", // RegistrationStatus value
				},
			];

			ws.send(JSON.stringify(response));
		} else if (action === "Heartbeat") {
			logger.info({
				action: "Heartbeat",
				identity: req.url.slice(1),
				headers: {
					...req.headers,
				},
				unique_id,
				currentTime: new Date().toISOString(),
			});

			response = [
				3,
				unique_id,
				{
					currentTime: new Date().toISOString(),
				},
			];

			ws.send(JSON.stringify(response));
		} else if (action === "StatusNotification") {
			const status = payload.status;

			logger.info({
				action: "StatusNotification",
				identity: req.url.slice(1),
				headers: {
					...req.headers,
				},
				unique_id,
				status,
			});

			if (status === "Preparing") {
				logger.info({ CS_COMMAND: "RemoteStartTransaction" });
				response = [
					2,
					unique_id,
					"RemoteStartTransaction",
					{
						connectorId: 1,
						idTag: "0001RFIDTAG00000012",
					},
				];

				ws.send(JSON.stringify(response));
			} else if (status === "Charging") {
				logger.info({ unique_id, status });

				ws.send(JSON.stringify(response));
			} else {
				response = [3, unique_id, {}];

				ws.send(JSON.stringify(response));
			}
		} else if (action === "MeterValues") {
			let meterValue = payload.meterValue;
			let identity = req.url.slice(1);
			let sampledValue = meterValue[0].sampledValue[0];
			let transactionId = payload.transactionId;

			logger.info({
				action: "MeterValues",
				identity: req.url.slice(1),
				headers: {
					...req.headers,
				},
				unique_id,
				sampledValue,
				transactionId,
			});

			let ampere = sampledValue.value;

			response = [3, unique_id, {}];

			if (!CONNECTED_CHARGERS.includes(identity)) {
				CONNECTED_CHARGERS.push(identity);

				setTimeout(() => {
					logger.info({ CS_COMMAND: "RemoteStopTransaction" });
					const stopTransactionResponse = [
						2,
						unique_id,
						"RemoteStopTransaction",
						{
							transactionId,
						},
					];
					CONNECTED_CHARGERS = CONNECTED_CHARGERS.filter(
						(charger) => charger !== identity
					);
					logger.info({
						CONNECTED_CHARGERS,
						transactionId,
					});
					ws.send(JSON.stringify(stopTransactionResponse));
				}, 60000);
			}

			ws.send(JSON.stringify(response));
		} else if (action === "StopTransaction") {
			response = [
				3,
				unique_id,
				{
					idTag: {
						status: "Accepted",
					},
				},
			];

			ws.send(JSON.stringify(response));
		} else if (action === "StartTransaction") {
			let transactionId = 12345;
			response = [
				3,
				unique_id,
				{
					idTagInfo: {
						status: "Accepted",
					},
					transactionId,
				},
			];

			ws.send(JSON.stringify(response));
		}

		/**
		 * else if (action === "StartTransaction") {
			let transactionId = payload.transactionId;
			response = [
				3,
				unique_id,
				{
					idTag: {
						status: "Accepted",
					},
					transactionId,
				},
			];

			ws.send(JSON.stringify(response));
		}
		 */
		/**
		 * else if (action === "StartTransaction") {
			response = [
				3,
				unique_id,
				{
					connectorId: 1,
					idTag: {
						status: "Accepted",
					},
					meterStart: 1,
					timestamp: new Date().toISOString(),
					transactionId: "transaction_id",
				},
			];
		}
		 */
	});

	ws.on("pong", () => {
		logger.info("Pong received");
	});

	ws.on("close", () => {
		logger.info("WebSocket connection closed.");
	});
});
