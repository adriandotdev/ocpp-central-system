let { app, CONNECTED_CHARGERS, connectedChargers } = require("./app");
const WebSocket = require("ws");
const logger = require("./config/logger");

const PORT = 4500;

const server = app.listen(PORT, () => {
	logger.info(`Server listening on ${PORT}`);
});

const wss = new WebSocket.Server({
	server,
});

wss.on("connection", (ws, req) => {
	logger.info({
		New_Client_Connected: {
			identity: req.url.slice(1),
			headers: {
				...req.headers,
			},
		},
	});

	const chargerIdentity = req.url.slice(1);

	connectedChargers.set(chargerIdentity, {
		ws,
		unique_id: "",
		transactionId: null,
	});

	ws.on("message", (message) => {
		const request = Buffer.from(message, "base64").toString("ascii");
		const data = JSON.parse(request);

		const unique_id = data[1];
		const action = data[2];
		const payload = data[3];

		let response = [3, unique_id, {}];

		connectedChargers.set(chargerIdentity, {
			...connectedChargers.get(chargerIdentity),
			unique_id: unique_id,
		});

		console.log(connectedChargers);
		logger.info(`Data Received*: ${message}`);

		if (action === "Authorize") {
			logger.info({
				DATA_RECEIVED: {
					action: "Authorize",
					identity: chargerIdentity,
					headers: {
						...req.headers,
					},
					unique_id,
					payload,
				},
			});

			response = [
				3,
				unique_id,
				{
					status: "Accepted",
				},
			];

			ws.send(JSON.stringify(response));

			(async () => {
				const response = await fetch(
					"http://localhost:4500/ocpp/1.6/api/v1/remote-start",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json", // Inform the server you're sending JSON
						},
						body: JSON.stringify({
							charger_identity: chargerIdentity,
							connector_id: 1,
							id_tag: payload.idTag,
						}),
					}
				);

				const data = await response.json();

				logger.info({
					charger_identity: chargerIdentity,
					connector_id: 1,
					id_tag: payload.idTag,
				});
				logger.info(`Data Received: ${data}`);
				logger.info(data);
			})();
		} else if (action === "BootNotification") {
			logger.info({
				DATA_RECEIVED: {
					action: "BootNotification",
					identity: req.url.slice(1),
					headers: {
						...req.headers,
					},
					unique_id,
					payload,
				},
			});

			const date = new Date();
			const offsetDate = new Date(date.getTime() + 8 * 60 * 60 * 1000); // Add 8 hours
			const isoStringWithOffset = offsetDate.toISOString();

			response = [
				3,
				unique_id,
				{
					currentTime: isoStringWithOffset, // ISO 8601 date format
					interval: 60, // Example interval in seconds
					status: "Accepted", // RegistrationStatus value
				},
			];

			ws.send(JSON.stringify(response));

			(async () => {
				try {
					const response = await fetch(
						"http://localhost:4500/ocpp/1.6/api/v1/change-configuration",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json", // Inform the server you're sending JSON
							},
							body: JSON.stringify({
								charger_identity: req.url.slice(1),
								key: "MeterValueSampleInterval",
								value: "5",
							}),
						}
					);

					// Check for HTTP errors
					if (!response.ok) {
						const errorText = await response.text();
						throw new Error(`HTTP ${response.status}: ${errorText}`);
					}

					// Check if the response is JSON
					const contentType = response.headers.get("Content-Type");
					if (contentType && contentType.includes("application/json")) {
						const data = await response.json();
						logger.info({
							charger_identity: req.url.slice(1),
							connector_id: 1,
							id_tag: payload.idTag,
						});
						logger.info(`Data Received: ${JSON.stringify(data)}`);
						logger.info(data);
					} else {
						const errorText = await response.text();
						throw new Error(
							`Unexpected content type: ${contentType}. Body: ${errorText}`
						);
					}
				} catch (error) {
					logger.error(`Error occurred: ${error.message}`);
				}
			})();
		} else if (action === "Heartbeat") {
			logger.info({
				DATA_RECEIVED: {
					action: "Heartbeat",
					identity: chargerIdentity,
					headers: {
						...req.headers,
					},
					unique_id,
					currentTime: new Date().toISOString(),
					payload,
				},
			});

			const date = new Date();
			const offsetDate = new Date(date.getTime() + 8 * 60 * 60 * 1000); // Add 8 hours
			const isoStringWithOffset = offsetDate.toISOString();

			response = [
				3,
				unique_id,
				{
					currentTime: isoStringWithOffset,
				},
			];

			ws.send(JSON.stringify(response));
		} else if (action === "StatusNotification") {
			const status = payload.status;

			logger.info({
				DATA_RECEIVED: {
					action: "StatusNotification",
					identity: req.url.slice(1),
					headers: {
						...req.headers,
					},
					unique_id,
					payload,
				},
			});

			if (status === "Preparing") {
				// logger.info({ CS_COMMAND: "RemoteStartTransaction" });
				// response = [
				// 	2,
				// 	unique_id,
				// 	"RemoteStartTransaction",
				// 	{
				// 		connectorId: 1,
				// 		idTag: "0001RFIDTAG00000012",
				// 	},
				// ];

				// logger.info({ STATUS: "PREPARING" });
				response = [3, unique_id, {}];
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
				DATA_RECEIVED: {
					action: "MeterValues",
					identity: req.url.slice(1),
					headers: {
						...req.headers,
					},
					unique_id,
					payload,
					transactionId,
				},
			});

			let ampere = sampledValue.value;

			response = [3, unique_id, {}];

			if (!CONNECTED_CHARGERS.includes(identity)) {
				CONNECTED_CHARGERS.push(identity);

				// logger.info(`setTimeout created at: ${new Date().toISOString()}`);

				// setTimeout(() => {
				// 	logger.info("Executing delayed logic after 10 minutes");
				// 	logger.info({ CS_COMMAND: "RemoteStopTransaction" });
				// 	const stopTransactionResponse = [
				// 		2,
				// 		unique_id,
				// 		"RemoteStopTransaction",
				// 		{
				// 			transactionId,
				// 		},
				// 	];

				// 	CONNECTED_CHARGERS = CONNECTED_CHARGERS.filter(
				// 		(charger) => charger !== identity
				// 	);

				// 	logger.info({
				// 		CONNECTED_CHARGERS,
				// 		transactionId,
				// 	});

				// 	try {
				// 		ws.send(JSON.stringify(stopTransactionResponse));
				// 	} catch (error) {
				// 		logger.error("Failed to send WebSocket message: ", error);
				// 	}
				// }, 60_000 * 5);
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

			connectedChargers.set(chargerIdentity, {
				...connectedChargers.get(chargerIdentity),
				transactionId: null,
			});

			ws.send(JSON.stringify(response));
		} else if (action === "StartTransaction") {
			let transactionId = connectedChargers.get(chargerIdentity).transactionId; // It must be dynamically generated by some source. (Database primary key, random integer generator, etc.)
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
		} else if (action === "ClearCache") {
			logger.info({
				DATA_RECEIVED: {
					action: "ClearCache",
					identity: req.url.slice(1),
					headers: {
						...req.headers,
					},
					unique_id,
					payload,
				},
			});

			ws.send(JSON.stringify(response));
		} else if (action === "Reset") {
			logger.info({
				DATA_RECEIVED: {
					action: "Reset",
					identity: req.url.slice(1),
					headers: {
						...req.headers,
					},
					unique_id,
					payload,
				},
			});

			ws.send(JSON.stringify(response));
		} else if (action === "GetLocalListVersion") {
			logger.info({
				DATA_RECEIVED: {
					action: "GetLocalListVersion",
					identity: req.url.slice(1),
					headers: {
						...req.headers,
					},
					unique_id,
					payload,
				},
			});
		}
	});

	ws.on("pong", () => {
		logger.info("Pong received");
	});

	ws.on("close", () => {
		logger.info("WebSocket connection closed.");
	});
});
