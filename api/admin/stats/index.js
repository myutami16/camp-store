// api/admin/stats.js
import connectDB from "../../../lib/db.js";
import Product from "../../../models/product.js";
import Content from "../../../models/content.js";
import Admin from "../../../models/admin.js";
import { authMiddleware, roleCheck } from "../../../lib/auth.js";

export default async function handler(req, res) {
	// Set CORS headers
	res.setHeader("Access-Control-Allow-Credentials", true);
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET,OPTIONS");
	res.setHeader(
		"Access-Control-Allow-Headers",
		"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
	);

	// Handle preflight requests
	if (req.method === "OPTIONS") {
		return res.status(200).end();
	}

	// Only allow GET method
	if (req.method !== "GET") {
		return res
			.status(405)
			.json({ success: false, message: "Method Not Allowed" });
	}

	try {
		// Connect to DB
		await connectDB();

		// Authentication middleware
		const authResult = await authMiddleware(req, res);
		if (authResult !== true) {
			// If authMiddleware returned a response object, it means auth failed
			// We don't need to do anything here as the middleware already sent the response
			return;
		}

		// Role check middleware
		const roleResult = await roleCheck(["super-admin", "admin"])(req, res);
		if (roleResult !== true) {
			// If roleCheck returned a response object, it means role check failed
			// We don't need to do anything here as the middleware already sent the response
			return;
		}

		// Count data
		const totalProducts = await Product.countDocuments();
		const totalContents = await Content.countDocuments();

		// Base response data
		const responseData = {
			totalProducts,
			totalContents,
		};

		// Only include totalAdmins if the user is a super-admin
		if (req.admin && req.admin.role === "super-admin") {
			// Count all admins (both regular admins and super-admins)
			const totalAdmins = await Admin.countDocuments();
			responseData.totalAdmins = totalAdmins;

			// Optionally, provide a breakdown by role
			const adminsByRole = await Admin.aggregate([
				{ $group: { _id: "$role", count: { $sum: 1 } } },
			]);

			// Convert to a more user-friendly format
			const adminRoleStats = {};
			adminsByRole.forEach((item) => {
				adminRoleStats[item._id] = item.count;
			});

			responseData.adminRoleStats = adminRoleStats;
		}

		return res.status(200).json({
			success: true,
			data: responseData,
		});
	} catch (error) {
		console.error("Error get admin stats:", error);
		return res.status(500).json({
			success: false,
			message: "Gagal mendapatkan data statistik admin",
		});
	}
}
