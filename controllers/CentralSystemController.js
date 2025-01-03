const WebSocket = require("ws");
const logger = require("../config/logger");

/**
 * @param {import('express').Express} app
 * @param {Array} CONNECTED_CHARGERS
 * @param {Map<String, Object>} connectedChargers
 */
module.exports = (app, CONNECTED_CHARGERS, connectedChargers) => {
	// Action: Remote Start
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
					message: "Bad Request - 1",
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

			const transactionID = Math.floor(Date.now() / 1000);

			connectedChargers.set(charger_identity, {
				...connectedChargers.get(charger_identity),
				transactionId: transactionID,
			});

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

				const messageListener = (message) => {
					try {
						const parsedMessage = JSON.parse(message);

						// Check if the response corresponds to this request
						// parsedMessage[1] is the unique id from the charger.
						if (
							parsedMessage[1] ===
							connectedChargers.get(charger_identity).unique_id
						) {
							// Cleanup the listener after processing
							ws.off("message", messageListener);

							// Handle the response
							if (parsedMessage[0] === 3) {
								let message = undefined;

								message = parsedMessage[2]?.status;

								if (message !== "Accepted")
									return res.status(400).json({
										statusCode: 400,
										data: {
											charger_identity,
											action: "RemoteStartTransaction",
											connector_id,
											id_tag,
											message: "Charger is currently charging or not available",
										},
										message,
									});

								return res.status(200).json({
									statusCode: 200,
									data: {
										charger_identity,
										action: "RemoteStartTransaction",
										connector_id,
										id_tag,
										message: "Successfully start transaction",
									},
									message,
								});
							} else if (parsedMessage[0] === 4) {
								// Error response
								logger.error(
									`Remote Start Transaction Failed: ${JSON.stringify(
										parsedMessage
									)}`
								);
								res.status(400).json({
									statusCode: 400,
									data: { error: parsedMessage[2] },
									message: "Remote Start Transaction Failed",
								});
							}
						}
					} catch (error) {
						logger.error("Error parsing WebSocket message:", error);
					}
				};

				ws.on("message", messageListener);
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

	// Action: Remote Stop
	app.post(
		"/ocpp/1.6/api/v1/remote-stop",

		/**
		 * @param {import('express').Request} req
		 * @param {import('express').Response} res
		 */
		(req, res) => {
			const { charger_identity, transaction_id } = req.body;

			if (!charger_identity || !transaction_id) {
				return res.status(400).json({
					statusCode: 400,
					data: {
						message:
							"Request body properties: charger_identity, transaction_id must be provided.",
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
					transactionId: transaction_id,
				},
			];

			try {
				logger.info(`API: ${req.url}`);
				ws.send(JSON.stringify(remoteStopRequest));

				// Listen for WebSocket messages
				const messageListener = (message) => {
					try {
						const parsedMessage = JSON.parse(message);

						// Check if the response corresponds to this request
						if (
							parsedMessage[1] ===
							connectedChargers.get(charger_identity).unique_id
						) {
							// Cleanup the listener after processing
							ws.off("message", messageListener);

							// Handle the response
							if (parsedMessage[0] === 3) {
								let message = undefined;

								message = parsedMessage[2]?.status;

								if (message !== "Accepted")
									return res.status(400).json({
										statusCode: 400,
										data: {
											charger_identity,
											action: "RemoteStopTransaction",
											transaction_id,
											message: "Transaction ID is not found",
										},
										message,
									});

								return res.status(200).json({
									statusCode: 200,
									data: {
										charger_identity,
										action: "RemoteStopTransaction",
										transaction_id,
										message: "Successfully stopped transaction",
									},
									message,
								});
							} else if (parsedMessage[0] === 4) {
								// Error response
								logger.error(
									`Reservation failed: ${JSON.stringify(parsedMessage)}`
								);
								res.status(400).json({
									statusCode: 400,
									data: { error: parsedMessage[2] },
									message: "Reservation failed.",
								});
							}
						}
					} catch (error) {
						logger.error("Error parsing WebSocket message:", error);
					}
				};

				// Attach the listener
				ws.on("message", messageListener);
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
					connectorId: !connector_id ? 0 : connector_id,
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

	app.post(
		"/ocpp/1.6/api/v1/reset",
		/**
		 * @param {import('express').Request} req
		 * @param {import('express').Response} res
		 */
		(req, res) => {
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
		}
	);

	app.post(
		"/ocpp/1.6/api/v1/send-local-list",
		/**
		 * @param {import('express').Request} req
		 * @param {import('express').Response} res
		 */
		(req, res) => {
			const {
				charger_identity,
				list_version,
				local_authorization_list,
				update_type,
			} = req.body;

			const ws = connectedChargers.get(charger_identity)?.ws;

			if (!ws || ws.readyState !== WebSocket.OPEN) {
				return res.status(404).json({
					statusCode: 404,
					data: { message: "Charger is not connected or unavailable." },
					message: "Not Found",
				});
			}

			const sendLocalListRequest = [
				2,
				connectedChargers.get(charger_identity).unique_id,
				"SendLocalList",
				{
					listVersion: list_version,
					localAuthorizationList: local_authorization_list,
					updateType: update_type,
				},
			];

			try {
				logger.info(`API: ${req.url}`);
				ws.send(JSON.stringify(sendLocalListRequest));
				res.status(200).json({
					statusCode: 200,
					data: {
						charger_identity,
						action: "SendLocalList",
						list_version,
						local_authorization_list,
						update_type,
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
		"/ocpp/1.6/api/v1/change-configuration",
		[],
		/**
		 * @param {import('express').Request} req
		 * @param {import('express').Response} res
		 */
		(req, res) => {
			const { charger_identity, key, value } = req.body;

			const ws = connectedChargers.get(charger_identity)?.ws;

			if (!ws || ws.readyState !== WebSocket.OPEN) {
				return res.status(404).json({
					statusCode: 404,
					data: { message: "Charger is not connected or unavailable." },
					message: "Not Found",
				});
			}

			let sendChangeConfiguration = [
				2,
				connectedChargers.get(charger_identity).unique_id,
				"ChangeConfiguration",
				{
					key,
					value,
				},
			];

			try {
				logger.info(`API: ${req.url}`);
				ws.send(JSON.stringify(sendChangeConfiguration));

				const messageListener = (message) => {
					try {
						const parsedMessage = JSON.parse(message);

						// Check if the response corresponds to this request
						if (
							parsedMessage[1] ===
							connectedChargers.get(charger_identity).unique_id
						) {
							// Cleanup the listener after processing
							ws.off("message", messageListener);

							// Handle the response
							if (parsedMessage[0] === 3) {
								let message = undefined;

								message = parsedMessage[2]?.status;

								if (message === "Rejected")
									return res.status(400).json({
										statusCode: 400,
										data: {
											charger_identity,
											action: "ChangeConfiguration",
											key,
											value,
											message:
												"Configuration key is supported, but setting could not be changed.",
										},
										message,
									});

								if (message === "NotSupported")
									return res.status(400).json({
										statusCode: 400,
										data: {
											charger_identity,
											action: "ChangeConfiguration",
											key,
											value,
											message: "Configuration key is not supported.",
										},
										message,
									});

								if (message === "RebootRequired")
									return res.status(200).json({
										statusCode: 200,
										data: {
											charger_identity,
											action: "ChangeConfiguration",
											key,
											value,
											message:
												"Configuration key is supported and setting has been changed, but change will be available after reboot (Charge Point will not reboot itself)",
										},
										message,
									});

								return res.status(200).json({
									statusCode: 200,
									data: {
										charger_identity,
										action: "ChangeConfiguration",
										key,
										value,
									},
									message: "Change configuration successful.",
								});
							} else if (parsedMessage[0] === 4) {
								// Error response
								logger.error(
									`Reservation failed: ${JSON.stringify(parsedMessage)}`
								);
								res.status(400).json({
									statusCode: 400,
									data: { error: parsedMessage[2] },
									message: "Reservation failed.",
								});
							}
						}
					} catch (error) {
						logger.error("Error parsing WebSocket message:", error);
					}
				};

				// Attach the listener
				ws.on("message", messageListener);
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
		"/ocpp/1.6/api/v1/reserve-now",
		[],

		/**
		 * @param {import('express').Request} req
		 * @param {import('express').Response} res
		 * @returns
		 */
		(req, res) => {
			const { charger_identity, connector_id, id_tag } = req.body;

			const ws = connectedChargers.get(charger_identity)?.ws;

			if (!ws || ws.readyState !== WebSocket.OPEN) {
				return res.status(404).json({
					statusCode: 404,
					data: { message: "Charger is not connected or unavailable." },
					message: "Not Found",
				});
			}

			const date = new Date();
			const offsetDate = new Date(date.getTime() + 8 * 60 * 60 * 1000); // Add 8 hours (UTC+8)
			const expiryDate = new Date(offsetDate.getTime() + 2 * 60 * 1000); // Add 1 minute for expiry date
			const isoStringWithOffset = expiryDate.toISOString();

			let reservationId = Math.floor(Date.now() / 1000);

			let sendReservation = [
				2,
				connectedChargers.get(charger_identity).unique_id,
				"ReserveNow",
				{
					connectorId: connector_id,
					expiryDate: isoStringWithOffset,
					idTag: id_tag,
					reservationId,
				},
			];

			try {
				logger.info(`API: ${req.url}`);
				ws.send(JSON.stringify(sendReservation));

				// Listen for WebSocket messages
				const messageListener = (message) => {
					try {
						const parsedMessage = JSON.parse(message);

						// Check if the response corresponds to this request
						if (
							parsedMessage[1] ===
							connectedChargers.get(charger_identity).unique_id
						) {
							// Cleanup the listener after processing
							ws.off("message", messageListener);

							// Handle the response
							if (parsedMessage[0] === 3) {
								let message = undefined;

								message = parsedMessage[2]?.status;

								if (message !== "Accepted")
									return res
										.status(400)
										.json({ statusCode: 400, data: null, message });

								return res.status(200).json({
									statusCode: 200,
									data: {
										charger_identity,
										action: "ReserveNow",
										connector_id,
										id_tag,
										reservation_id: reservationId,
									},
									message: "Reservation successful.",
								});
							} else if (parsedMessage[0] === 4) {
								// Error response
								logger.error(
									`Reservation failed: ${JSON.stringify(parsedMessage)}`
								);
								res.status(400).json({
									statusCode: 400,
									data: { error: parsedMessage[2] },
									message: "Reservation failed.",
								});
							}
						}
					} catch (error) {
						logger.error("Error parsing WebSocket message:", error);
					}
				};

				// Attach the listener
				ws.on("message", messageListener);
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

	app.post("/ocpp/1.6/api/v1/cancel-reservation", [], (req, res) => {
		const { charger_identity, reservation_id } = req.body;

		const ws = connectedChargers.get(charger_identity)?.ws;

		if (!ws || ws.readyState !== WebSocket.OPEN) {
			return res.status(404).json({
				statusCode: 404,
				data: { message: "Charger is not connected or unavailable." },
				message: "Not Found",
			});
		}

		let cancelReservation = [
			2,
			connectedChargers.get(charger_identity).unique_id,
			"CancelReservation",
			{
				reservationId: reservation_id,
			},
		];

		try {
			logger.info(`API: ${req.url}`);
			ws.send(JSON.stringify(cancelReservation));

			const messageListener = (message) => {
				try {
					const parsedMessage = JSON.parse(message);

					// Check if the response corresponds to this request
					if (
						parsedMessage[1] ===
						connectedChargers.get(charger_identity).unique_id
					) {
						// Cleanup the listener after processing
						ws.off("message", messageListener);

						logger.info(`API: ${parsedMessage}`);
						// Handle the response
						if (parsedMessage[0] === 3) {
							let message = undefined;

							message = parsedMessage[2]?.status;

							if (message !== "Accepted")
								return res.status(400).json({
									statusCode: 400,
									data: {
										message: "Reservation ID is not found",
									},
									message,
								});

							return res.status(200).json({
								statusCode: 200,
								data: {
									charger_identity,
									action: "CancelReservation",
									reservation_id,
								},
								message: "Reservation cancellation successful.",
							});
						} else if (parsedMessage[0] === 4) {
							logger.error(
								`Cancellation error: ${JSON.stringify(parsedMessage)}`
							);
							res.status(400).json({
								statusCode: 400,
								data: { error: parsedMessage[2] },
								message: "Reservation cancellation failed.",
							});
						}
					}
				} catch (error) {
					logger.error("Error parsing WebSocket message:", error);
				}
			};

			// Attach the listener
			ws.on("message", messageListener);
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
