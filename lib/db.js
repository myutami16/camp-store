import mongoose from "mongoose";

// Improved connection caching for serverless environments
let cachedConnection = null;
let connectionPromise = null;

const connectDB = async () => {
	// If there's a cached connection, return it immediately
	if (cachedConnection) {
		return cachedConnection;
	}

	// If a connection is already in progress, wait for it
	if (connectionPromise) {
		return connectionPromise;
	}

	// Create a new connection promise
	connectionPromise = new Promise(async (resolve, reject) => {
		try {
			// Connection options optimized for serverless
			const options = {
				serverSelectionTimeoutMS: 5000, // Shorter timeout
				socketTimeoutMS: 5000, // Limit socket connection time
				maxPoolSize: 5, // Reduced pool size for serverless
				connectTimeoutMS: 5000, // Limit initial connection time
				useNewUrlParser: true,
				useUnifiedTopology: true,
			};

			// Ensure MongoDB URI is set
			if (!process.env.MONGODB_URI) {
				throw new Error("MONGODB_URI is not defined");
			}

			// Attempt connection
			const conn = await mongoose.connect(process.env.MONGODB_URI, options);

			// Cache the connection
			cachedConnection = conn;
			connectionPromise = null;

			console.log(`MongoDB connected: ${conn.connection.host}`);
			resolve(conn);
		} catch (error) {
			connectionPromise = null;
			console.error("MongoDB connection error:", error.message);

			// In production, we want to fail fast rather than retry
			if (process.env.NODE_ENV === "production") {
				reject(error);
			} else {
				// In development, allow retries
				setTimeout(() => resolve(connectDB()), 5000);
			}
		}
	});

	return connectionPromise;
};

// Add a cleanup function for serverless environments
export const disconnectDB = async () => {
	if (cachedConnection) {
		await mongoose.disconnect();
		cachedConnection = null;
	}
};

export default connectDB;
