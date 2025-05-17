const WINDOW_SIZE = 60 * 1000;
const WINDOW_LOG_INTERVAL = 5 * 1000;
const MAX_WINDOW_REQUEST_COUNT = {};

const ipRequestCounter = {};
let lastLogTime = Date.now();

/**
 * Rate limiting middleware for API routes
 * @param {Object} req - Request object
 * @param {Object} res - Response object
 * @param {Number} limit - Maximum requests per window (default: 10)
 * @returns {Boolean} false if rate limited, true otherwise
 */
const rateLimit = async (req, res, limit = 10) => {
	try {
		const clientIp =
			req.headers["x-forwarded-for"] ||
			req.connection.remoteAddress ||
			"0.0.0.0";

		MAX_WINDOW_REQUEST_COUNT[clientIp] = limit;

		const now = Date.now();

		if (!ipRequestCounter[clientIp]) {
			ipRequestCounter[clientIp] = [
				{
					requestTimeStamp: now,
					requestCount: 1,
				},
			];
			return true;
		}

		const windowStart = now - WINDOW_SIZE;
		const requestsInWindow = ipRequestCounter[clientIp].filter((entry) => {
			return entry.requestTimeStamp > windowStart;
		});

		ipRequestCounter[clientIp] = requestsInWindow;

		const totalRequests = requestsInWindow.reduce((acc, entry) => {
			return acc + entry.requestCount;
		}, 0);

		if (totalRequests >= MAX_WINDOW_REQUEST_COUNT[clientIp]) {
			if (now - lastLogTime > WINDOW_LOG_INTERVAL) {
				console.log(`Rate limit exceeded for IP: ${clientIp}`);
				lastLogTime = now;
			}

			return false;
		}

		requestsInWindow.push({
			requestTimeStamp: now,
			requestCount: 1,
		});

		return true;
	} catch (error) {
		console.error("Rate limit error:", error);

		return true;
	}
};

// Clean up old rate limit data periodically
setInterval(() => {
	const now = Date.now();
	const windowStart = now - WINDOW_SIZE;

	Object.keys(ipRequestCounter).forEach((ip) => {
		ipRequestCounter[ip] = ipRequestCounter[ip].filter((entry) => {
			return entry.requestTimeStamp > windowStart;
		});

		if (ipRequestCounter[ip].length === 0) {
			delete ipRequestCounter[ip];
			delete MAX_WINDOW_REQUEST_COUNT[ip];
		}
	});
}, WINDOW_SIZE).unref();

export default rateLimit;
