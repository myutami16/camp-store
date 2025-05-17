import mongoose from "mongoose";

let cachedConnection = null;
let connectionPromise = null;

const connectDB = async () => {
	if (cachedConnection) {
		return cachedConnection;
	}

	if (connectionPromise) {
		return connectionPromise;
	}

	connectionPromise = new Promise(async (resolve, reject) => {
		try {
			const options = {
				serverSelectionTimeoutMS: 5000,
				socketTimeoutMS: 5000,
				maxPoolSize: 5,
				connectTimeoutMS: 5000,
				useNewUrlParser: true,
				useUnifiedTopology: true,
			};

			if (!process.env.MONGODB_URI) {
				throw new Error("MONGODB_URI is not defined");
			}

			const conn = await mongoose.connect(process.env.MONGODB_URI, options);

			cachedConnection = conn;
			connectionPromise = null;

			console.log(`MongoDB connected: ${conn.connection.host}`);
			resolve(conn);
		} catch (error) {
			connectionPromise = null;
			console.error("MongoDB connection error:", error.message);

			if (process.env.NODE_ENV === "production") {
				reject(error);
			} else {
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
