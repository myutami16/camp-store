import jwt from "jsonwebtoken";
import Admin from "../models/admin.js";
import TokenBlacklist from "../models/tokenBlacklist.js";
import connectDB from "./db.js";

export const verifyToken = async (token) => {
	try {
		if (!token) return null;

		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		if (!decoded || !decoded.id) return null;

		await connectDB();

		const TokenBlacklist = (await import("../models/tokenBlacklist.js"))
			.default;

		const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
		if (isBlacklisted) {
			console.log("Token is blacklisted (user logged out)");
			return null;
		}

		return decoded;
	} catch (error) {
		console.error("Token verification error:", error.message);
		return null;
	}
};
export async function authMiddleware(req) {
	const token = req.headers.authorization?.split(" ")[1];
	if (!token) return { ok: false, error: "Token tidak ditemukan" };

	const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
	if (isBlacklisted) {
		return { ok: false, error: "Token is blacklisted (user logged out)" };
	}

	try {
		const decoded = jwt.verify(token, process.env.JWT_SECRET);
		const admin = await Admin.findById(decoded.id).select("-password");
		if (!admin) return { ok: false, error: "Admin tidak ditemukan" };

		req.admin = admin;
		return { ok: true };
	} catch (err) {
		return { ok: false, error: "Token tidak valid" };
	}
}

// Utility to invalidate a token (add to blacklist)
export const invalidateToken = async (token) => {
	try {
		const blacklistEntry = new TokenBlacklist({ token });
		await blacklistEntry.save();
		return true;
	} catch (error) {
		console.error("Error invalidating token:", error);

		if (error.code === 11000) {
			return true;
		}
		throw error;
	}
};

// Role check middleware with improved type checking
export const roleCheck = (roles) => {
	return async (req, res) => {
		const validRoles = Array.isArray(roles) ? roles : [roles];

		if (!req.admin || !validRoles.includes(req.admin.role)) {
			return res.status(403).json({
				success: false,
				message: `Role ${
					req.admin?.role || "tidak dikenal"
				} tidak memiliki izin untuk akses`,
			});
		}

		return true;
	};
};
