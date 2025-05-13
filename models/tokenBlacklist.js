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
		expires: "1d", // Automatically expire entries after token expiry (matches JWT_EXPIRES)
	},
});

// Create index for fast lookup
TokenBlacklistSchema.index({ token: 1 });

// Add static methods if needed
TokenBlacklistSchema.statics = {
	async isBlacklisted(token) {
		const count = await this.countDocuments({ token });
		return count > 0;
	},
};

export default mongoose.models.TokenBlacklist ||
	mongoose.model("TokenBlacklist", TokenBlacklistSchema);
