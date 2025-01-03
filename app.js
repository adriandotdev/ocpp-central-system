const express = require("express");
const morgan = require("morgan");
const logger = require("./config/logger");
const helmet = require("helmet");

const app = express();

app.use(helmet());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(morgan("combined", { stream: logger.stream }));

let CONNECTED_CHARGERS = [];
let connectedChargers = new Map();

require("./controllers/CentralSystemController")(
	app,
	CONNECTED_CHARGERS,
	connectedChargers
);

app.use("*", (req, res, next) => {
	logger.error({
		API_NOT_FOUND: {
			api: req.baseUrl,
			status: 404,
		},
	});
	return res
		.status(404)
		.json({ statusCode: 404, data: null, message: "Not Found" });
});

module.exports = { app, CONNECTED_CHARGERS, connectedChargers };
