const { createLogger, format, transports, addColors } = require("winston");
const path = require("path");
const { splat, combine, timestamp, printf, json } = format;
const myFormat = printf(({ timestamp, level, message, meta }) => {
	if (meta && meta instanceof Error) {
		return `[${timestamp}] [${level}] : ${message} ${meta.stack}`;
	}
	if (typeof message === "object" && message !== null) {
		return `[${timestamp}] [${level}] : ${JSON.stringify(message, null, 2)}`;
	}
	return `[${timestamp}] [${level}] : ${message}`;
});

require("winston-daily-rotate-file");

const colors = {
	error: "red",
	warn: "yellow",
	info: "green",
	http: "magenta",
	debug: "white",
};

addColors(colors);

const LOGS_FOLDER_NAME = `ocpp_nads`;

const options = {
	info: {
		level: "info",
		filename: `${LOGS_FOLDER_NAME}-%DATE%.log`,
		dirname: path.join(__dirname, "..", "logs", LOGS_FOLDER_NAME),
		handleExceptions: true,
		json: false,
		colorize: true,
		zippedArchive: true,
		maxSize: "30m",
		maxFiles: "90d",
	},
	error: {
		level: "error",
		filename: `${LOGS_FOLDER_NAME}-%DATE%.log`,
		dirname: path.join(__dirname, "..", "logs", LOGS_FOLDER_NAME),
		handleExceptions: true,
		json: false,
		colorize: true,
		zippedArchive: true,
		maxSize: "30m",
		maxFiles: "90d",
	},
	console: {
		level: "debug",
		handleExceptions: true,
		json: false,
		colorize: true,
	},
};

const logger = createLogger({
	transports: [
		new transports.DailyRotateFile(options.info),
		new transports.DailyRotateFile(options.error),
		new transports.Console(options.console),
	],
	format: combine(
		timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
		splat(),
		json({ stable: true }),
		format.colorize({ all: false }),
		myFormat
	),
	exitOnError: false,
});

logger.silent = process.env.NODE_ENV === "test" ? true : false; // CHANGE THIS to 'true' when testing

logger.stream = {
	write: function (message, encoding) {
		if (!message.includes("ELB-HealthChecker")) {
			logger.info(message);
		}
	},
};

module.exports = logger;
