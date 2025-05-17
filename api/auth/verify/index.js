import connectDB from "../../../lib/db.js";
import { authMiddleware } from "../../../lib/auth.js";
import Admin from "../../..//models/admin.js";

export default async function handler(req, res) {
	res.setHeader("Access-Control-Allow-Credentials", true);
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader(
		"Access-Control-Allow-Methods",
		"GET,OPTIONS,PATCH,DELETE,POST,PUT"
	);
	res.setHeader(
		"Access-Control-Allow-Headers",
		"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
	);

	if (req.method === "OPTIONS") {
		return res.status(200).end();
	}

	if (req.method === "GET") {
		try {
			await connectDB();

			const verified = await authMiddleware(req, res);
			if (!verified) return;

			return res.status(200).json({
				success: true,
				admin: {
					id: req.admin.id,
					username: req.admin.username,
					role: req.admin.role,
				},
			});
		} catch (error) {
			console.error("Auth verification error:", error);
			return res.status(500).json({
				success: false,
				message: "Gagal memverifikasi token",
			});
		}
	}

	return res.status(405).json({
		success: false,
		message: `Method ${req.method} tidak diizinkan`,
	});
}
