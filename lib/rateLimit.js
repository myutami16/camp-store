// lib/rateLimit.js
const WINDOW_SIZE = 60 * 1000; // 1 minute window
const WINDOW_LOG_INTERVAL = 5 * 1000; // Log rate limit info every 5 seconds
const MAX_WINDOW_REQUEST_COUNT = {}; // Default is 10 requests per IP per minute

// In-memory store for rate limiting
// In a production environment, consider using Redis or another distributed cache
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
		// Get client IP
		const clientIp =
			req.headers["x-forwarded-for"] ||
			req.connection.remoteAddress ||
			"0.0.0.0";

		// Update max window count for this IP if a limit was specified
		MAX_WINDOW_REQUEST_COUNT[clientIp] = limit;

		// Create timestamp for current request
		const now = Date.now();

		// Create new record for this IP if it doesn't exist
		if (!ipRequestCounter[clientIp]) {
			ipRequestCounter[clientIp] = [
				{
					requestTimeStamp: now,
					requestCount: 1,
				},
			];
			return true;
		}

		// Get last window for this IP
		const windowStart = now - WINDOW_SIZE;
		const requestsInWindow = ipRequestCounter[clientIp].filter((entry) => {
			return entry.requestTimeStamp > windowStart;
		});

		// Clean up old entries outside window
		ipRequestCounter[clientIp] = requestsInWindow;

		// Calculate total requests in current window
		const totalRequests = requestsInWindow.reduce((acc, entry) => {
			return acc + entry.requestCount;
		}, 0);

		// Check if total requests exceed the limit
		if (totalRequests >= MAX_WINDOW_REQUEST_COUNT[clientIp]) {
			// Log rate limiting events at intervals to avoid log spam
			if (now - lastLogTime > WINDOW_LOG_INTERVAL) {
				console.log(`Rate limit exceeded for IP: ${clientIp}`);
				lastLogTime = now;
			}

			return false;
		}

		// Record this request
		requestsInWindow.push({
			requestTimeStamp: now,
			requestCount: 1,
		});

		return true;
	} catch (error) {
		console.error("Rate limit error:", error);
		// Don't rate limit on errors
		return true;
	}
};

// Clean up old rate limit data periodically
setInterval(() => {
	const now = Date.now();
	const windowStart = now - WINDOW_SIZE;

	// For each IP, remove entries outside the current window
	Object.keys(ipRequestCounter).forEach((ip) => {
		ipRequestCounter[ip] = ipRequestCounter[ip].filter((entry) => {
			return entry.requestTimeStamp > windowStart;
		});

		// Remove IP completely if no entries remain
		if (ipRequestCounter[ip].length === 0) {
			delete ipRequestCounter[ip];
			delete MAX_WINDOW_REQUEST_COUNT[ip];
		}
	});
}, WINDOW_SIZE);

export default rateLimit;
