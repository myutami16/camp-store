import connectDB from "../../../lib/db.js";
import { invalidateToken } from "../../../lib/auth.js";
import TokenBlacklist from "../../../models/tokenBlacklist.js";

export default async function handler(req, res) {
	res.setHeader("Access-Control-Allow-Credentials", true);
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
	res.setHeader(
		"Access-Control-Allow-Headers",
		"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
	);

	if (req.method === "OPTIONS") {
		return res.status(200).end();
	}

	if (req.method !== "POST") {
		res.setHeader("Allow", ["POST", "OPTIONS"]);
		return res.status(405).json({
			success: false,
			message: `Method ${req.method} tidak diizinkan`,
		});
	}

	try {
		await connectDB();

		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			return res.status(401).json({
				success: false,
				message: "Akses ditolak. Token tidak tersedia",
			});
		}

		const token = authHeader.split(" ")[1];

		await invalidateToken(token);

		return res.status(200).json({
			success: true,
			message: "Logout berhasil",
		});
	} catch (error) {
		console.error("Logout error:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan saat logout",
		});
	}
}
