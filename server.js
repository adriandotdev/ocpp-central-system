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
	logger.info(`New charger connected: ${req.url.slice(1)}`);

	/**
	 * Extract the charger identity from the URL. This is the unique identifier for the charger.
	 * .slice is used because it is come from the url.
	 *
	 * When the charger is connected to the web socket it is making a GET request which includes the /<charger_identity>.
	 */
	const chargerIdentity = req.url.slice(1);

	// Upon the first successful connection of the charger, add to the map which is responsible for in-memory storage.
	connectedChargers.set(chargerIdentity, {
		ws,
		unique_id: "",
		transactionId: null,
	});

	ws.on("message", (message) => {
		const request = Buffer.from(message, "base64").toString("ascii");
		const data = JSON.parse(request);
		const messageTypeID = data[0];
		const unique_id = data[1];
		const action = data[2];
		const payload = data[3];

		let response = [3, unique_id, {}];

		connectedChargers.set(chargerIdentity, {
			...connectedChargers.get(chargerIdentity),
			unique_id: unique_id,
		});

		logger.info({
			CONNECTED_CHARGERS: [
				...Array.from(connectedChargers.keys()).map((key) => {
					return (key = {
						charger_identity: key,
						transactionId: connectedChargers.get(key).transactionId,
						uniqueId: connectedChargers.get(key).unique_id,
					});
				}),
			],
		});

		// Make a log when it is response from the charger.
		if (messageTypeID === 3) logger.info(`DATA_RECEIVED*: ${message}`);

		if (action === "Authorize") {
			logger.info(
				`========================= AUTHORIZE =============================`
			);
			logger.info(`DATA_RECEIVED: ${message}`);
			logger.info(
				`=========================END OF AUTHORIZE =============================`
			);

			response = [
				3,
				unique_id,
				{
					idTagInfo: {
						status: "Accepted",
					},
				},
			];

			ws.send(JSON.stringify(response));
		} else if (action === "BootNotification") {
			logger.info(
				`========================= BOOT NOTIFICATION =============================`
			);
			logger.info(`DATA_RECEIVED: ${message}`);
			logger.info(
				`=========================END OF BOOT NOTIFICATION =============================`
			);

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

			/**
			 * Change Configuration
			 *
			 * IIFE
			 */
			(async () => {
				try {
					const meterValueSampleIntervalRes = await fetch(
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

					if (!meterValueSampleIntervalRes.ok) {
						const errorText = await meterValueSampleIntervalRes.text();
						throw new Error(
							`HTTP API for Change Config for Meter Value Sample Interval ${meterValueSampleIntervalRes.status}: ${errorText}`
						);
					}

					const data = await meterValueSampleIntervalRes.json();

					logger.info(
						`Change Config: Meter Value Sample Interval - ${
							meterValueSampleIntervalRes.status
						} : ${JSON.stringify(data)}`
					);
				} catch (error) {
					logger.error(`Error occurred: ${error.message}`);
				}
			})();
		} else if (action === "Heartbeat") {
			logger.info(
				`========================= HEARTBEAT =============================`
			);
			logger.info(`DATA_RECEIVED: ${message}`);
			logger.info(
				`========================= HEARTBEAT =============================`
			);

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

			logger.info(
				`=========================STATUS NOTIFICATION =============================`
			);
			logger.info(`DATA_RECEIVED: ${message}`);
			logger.info(
				`=========================END OF STATUS NOTIFICATION =============================`
			);
			if (status === "Preparing") {
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

			logger.info(
				`========================= METER VALUES =============================`
			);
			logger.info(`DATA_RECEIVED: ${message}`);
			logger.info(
				`========================= METER VALUES =============================`
			);

			let ampere = sampledValue.value;

			if (transactionId)
				connectedChargers.set(chargerIdentity, {
					...connectedChargers.get(chargerIdentity),
					transactionId,
				});

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
			logger.info(
				`========================= STOP TRANSACTION =============================`
			);
			logger.info(`DATA_RECEIVED: ${message}`);
			logger.info(
				`========================= END OF STOP TRANSACTION =============================`
			);

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
			logger.info(
				`========================= START TRANSACTION =============================`
			);
			logger.info(`DATA_RECEIVED: ${message}`);
			logger.info(
				`========================= END OF START TRANSACTION =============================`
			);

			let transactionId = connectedChargers.get(chargerIdentity).transactionId; // It must be dynamically generated by some source. (Database primary key, random integer generator, etc.)

			// If from Authorize, then generate transactionId
			if (!transactionId) {
				transactionId = Math.floor(Date.now() / 1000);
				connectedChargers.set(chargerIdentity, {
					...connectedChargers.get(chargerIdentity),
					transactionId,
				});
			}

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
	});

	ws.on("pong", () => {
		logger.info("Pong received");
	});

	ws.on("close", (code, reason) => {
		logger.info(
			`========================= WEB SOCKET CONNECTION CLOSED =============================`
		);
		logger.info(code, reason);
		logger.info(
			`========================= END OF WEB SOCKEET CONNNECTION CLOSED =============================`
		);
	});
});
