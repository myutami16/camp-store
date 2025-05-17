import connectDB from "../../../lib/db.js";
import Product from "../../../models/product.js";
import Content from "../../../models/content.js";
import Admin from "../../../models/admin.js";
import jwt from "jsonwebtoken";

export default async function handler(req, res) {
	const requestTimeout = setTimeout(() => {
		console.log("🚨 API Request timed out");
		return res.status(504).json({
			success: false,
			message: "Permintaan memakan waktu terlalu lama",
		});
	}, 20000);

	res.setHeader("Access-Control-Allow-Credentials", true);
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
	res.setHeader(
		"Access-Control-Allow-Headers",
		"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
	);

	if (req.method === "OPTIONS") {
		clearTimeout(requestTimeout);
		return res.status(200).end();
	}

	if (req.method !== "GET") {
		clearTimeout(requestTimeout);
		return res.status(405).json({
			success: false,
			message: "Method Not Allowed",
		});
	}

	try {
		const authHeader = req.headers.authorization;
		if (!authHeader || !authHeader.startsWith("Bearer ")) {
			clearTimeout(requestTimeout);
			return res.status(401).json({
				success: false,
				message: "Authentication required",
			});
		}

		const token = authHeader.split(" ")[1];
		let decoded;

		try {
			decoded = jwt.verify(token, process.env.JWT_SECRET);
		} catch (error) {
			clearTimeout(requestTimeout);
			console.error("Token verification error:", error);
			return res.status(401).json({
				success: false,
				message: "Invalid or expired token",
			});
		}

		try {
			await Promise.race([
				connectDB(),
				new Promise((_, reject) =>
					setTimeout(() => reject(new Error("DB Connection timeout")), 5000)
				),
			]);
		} catch (error) {
			clearTimeout(requestTimeout);
			console.error("DB Connection error:", error);
			return res.status(503).json({
				success: false,
				message: "Database connection failed",
			});
		}

		const admin = await Admin.findById(decoded.id).select("role");

		if (!admin) {
			clearTimeout(requestTimeout);
			return res.status(401).json({
				success: false,
				message: "Admin not found",
			});
		}

		if (!["super-admin", "admin"].includes(admin.role)) {
			clearTimeout(requestTimeout);
			return res.status(403).json({
				success: false,
				message: "Access forbidden",
			});
		}

		const responseData = {};

		const [productCount, contentCount] = await Promise.all([
			Product.countDocuments().exec(),
			Content.countDocuments().exec(),
		]);

		responseData.totalProducts = productCount;
		responseData.totalContents = contentCount;

		if (admin.role === "super-admin") {
			const [adminCount, adminRoles] = await Promise.all([
				Admin.countDocuments().exec(),
				Admin.aggregate([
					{ $group: { _id: "$role", count: { $sum: 1 } } },
				]).exec(),
			]);

			responseData.totalAdmins = adminCount;

			const adminRoleStats = {};
			adminRoles.forEach((item) => {
				adminRoleStats[item._id] = item.count;
			});

			responseData.adminRoleStats = adminRoleStats;
		}

		clearTimeout(requestTimeout);

		return res.status(200).json({
			success: true,
			data: responseData,
		});
	} catch (error) {
		clearTimeout(requestTimeout);
		console.error("Error get admin stats:", error);
		return res.status(500).json({
			success: false,
			message: "Gagal mendapatkan data statistik admin",
		});
	}
}
