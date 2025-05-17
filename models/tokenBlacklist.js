import mongoose from "mongoose";

const TokenBlacklistSchema = new mongoose.Schema({
	token: {
		type: String,
		required: true,
		unique: true,
	},
	createdAt: {
		type: Date,
		default: Date.now,
		expires: "1d",
	},
});

// Add the static method directly to the schema
TokenBlacklistSchema.statics.isBlacklisted = async function (token) {
	try {
		if (mongoose.connection.readyState !== 1) {
			await mongoose.connect(process.env.MONGODB_URI);
		}

		const count = await this.countDocuments({ token });
		return count > 0;
	} catch (error) {
		console.error("Blacklist check error:", error);
		return false;
	}
};

const TokenBlacklist =
	mongoose.models.TokenBlacklist ||
	mongoose.model("TokenBlacklist", TokenBlacklistSchema);

export default TokenBlacklist;
