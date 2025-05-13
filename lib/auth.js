import jwt from "jsonwebtoken";
import Admin from "../models/admin.js";
import TokenBlacklist from "../models/tokenBlacklist.js";

// Improved token verification with blacklist check
export const verifyToken = async (token) => {
	try {
		// Add additional validation
		if (!token) return null;

		// Check if token is blacklisted (logged out)
		const isBlacklisted = await TokenBlacklist.isBlacklisted(token);
		if (isBlacklisted) {
			console.log("Token is blacklisted (user logged out)");
			return null;
		}

		const decoded = jwt.verify(token, process.env.JWT_SECRET);

		// Optional: Add extra token validation checks
		if (!decoded || !decoded.id) return null;

		return decoded;
	} catch (error) {
		// Log token verification errors (optional)
		console.error("Token verification error:", error.message);
		return null;
	}
};

// Middleware for authentication with improved error handling
export const authMiddleware = async (req, res) => {
	try {
		// Validate Authorization header
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({
				success: false,
				message: "Akses ditolak. Token tidak tersedia",
			});
		}

		// Extract and verify token
		const token = authHeader.split(" ")[1];
		const decoded = await verifyToken(token);

		if (!decoded) {
			return res.status(401).json({
				success: false,
				message: "Token tidak valid atau sudah kadaluarsa",
			});
		}

		// Find admin with a timeout
		const adminPromise = Admin.findById(decoded.id);
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error("Admin lookup timed out")), 5000)
		);

		const admin = await Promise.race([adminPromise, timeoutPromise]);

		if (!admin) {
			return res.status(404).json({
				success: false,
				message: "Admin tidak ditemukan",
			});
		}

		// Attach admin info to request
		req.admin = {
			id: admin._id,
			username: admin.username,
			role: admin.role,
		};

		// Successfully authenticated
		return true;
	} catch (error) {
		console.error("Auth middleware error:", error);

		// Differentiate between timeout and other errors
		if (error.message === "Admin lookup timed out") {
			return res.status(504).json({
				success: false,
				message: "Waktu pencarian admin habis",
			});
		}

		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// Utility to invalidate a token (add to blacklist)
export const invalidateToken = async (token) => {
	try {
		const blacklistEntry = new TokenBlacklist({ token });
		await blacklistEntry.save();
		return true;
	} catch (error) {
		console.error("Error invalidating token:", error);
		// If duplicate key error, token is already blacklisted
		if (error.code === 11000) {
			return true;
		}
		throw error;
	}
};

// Role check middleware with improved type checking
export const roleCheck = (roles) => {
	return async (req, res) => {
		// Ensure roles is an array
		const validRoles = Array.isArray(roles) ? roles : [roles];

		// Check if admin's role is in the allowed roles
		if (!req.admin || !validRoles.includes(req.admin.role)) {
			return res.status(403).json({
				success: false,
				message: `Role ${
					req.admin?.role || "tidak dikenal"
				} tidak memiliki izin untuk akses`,
			});
		}

		// Allowed access
		return true;
	};
};
