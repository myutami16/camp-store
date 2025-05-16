// api/auth/verify/index.js
import connectDB from "../../../lib/db.js";
import Admin from "../../../models/admin.js";
import { authMiddleware } from "../../../lib/auth.js";

// Format admin response to avoid sending sensitive data
const formatAdminResponse = (admin) => ({
	id: admin._id,
	username: admin.username,
	name: admin.name,
	role: admin.role,
});

export default async function handler(req, res) {
	// Set CORS headers
	res.setHeader("Access-Control-Allow-Credentials", true);
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
	res.setHeader(
		"Access-Control-Allow-Headers",
		"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
	);

	// Handle CORS preflight
	if (req.method === "OPTIONS") {
		return res.status(200).end();
	}

	// Only allow GET method
	if (req.method !== "GET") {
		res.setHeader("Allow", ["GET", "OPTIONS"]);
		return res.status(405).json({
			success: false,
			message: `Method ${req.method} tidak diizinkan`,
		});
	}

	try {
		await connectDB();

		console.log("Authorization header:", req.headers.authorization); // Debug log

		// Call authMiddleware to verify token
		const verified = await authMiddleware(req, res);
		if (!verified) return; // If authentication fails, response has already been sent

		// Find admin by ID (added by authMiddleware to req object)
		const admin = await Admin.findById(req.admin.id);
		if (!admin) {
			return res.status(404).json({
				success: false,
				message: "Admin tidak ditemukan",
			});
		}

		// Return admin data
		return res.status(200).json({
			success: true,
			admin: formatAdminResponse(admin),
		});
	} catch (error) {
		console.error("Auth verification error:", error);
		return res.status(500).json({
			success: false,
			message: "Gagal memverifikasi token",
		});
	}
}
