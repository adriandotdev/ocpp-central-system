const express = require("express");
const morgan = require("morgan");
const logger = require("./config/logger");
const helmet = require("helmet");

const app = express();

app.use(helmet());
app.use(express.urlencoded({ extended: false }));
app.use(express.json());
app.use(morgan("combined", { stream: logger.stream }));

app.get(
	"/api/1.6/ocpp/:charger_identity",

	/**
	 * @param {import('express').Request} req
	 * @param {import('express').Response} res
	 */
	(req, res) => {
		logger.info({
			data: {
				url: req.url,
				baseUrl: req.baseUrl,
			},
		});
		return res.status(200).json({ message: "Success" });
	}
);

app.use("*", (req, res, next) => {
	logger.error({
		API_NOT_FOUND: {
			api: req.baseUrl,
			status: 404,
		},
	});
	return res.status(404).json({ status: 404, data: [], message: "Not Found" });
});

module.exports = app;
