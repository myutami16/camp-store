import connectDB from "../../lib/db.js";
import Banner from "../../models/banner.js";
import rateLimit from "../../lib/rateLimit.js";

// GET /api/banner - Public route to get banners by location
export const getBannersByLocation = async (req, res) => {
	try {
		await connectDB();

		const query = { isActive: true };

		// Filter by location (required for public API)
		if (req.query.location) {
			if (!["homepage", "productpage"].includes(req.query.location)) {
				return res.status(400).json({
					success: false,
					message: "Lokasi tidak valid. Pilih: homepage atau productpage",
				});
			}
			query.location = req.query.location;
		}

		const limit = parseInt(req.query.limit) || 5;

		const sort = { createdAt: -1 };

		const banners = await Banner.find(query)
			.sort(sort)
			.limit(limit)
			.select("-cloudinary_id");

		return res.status(200).json({
			success: true,
			count: banners.length,
			location: req.query.location || "all",
			data: banners,
		});
	} catch (error) {
		console.error("Error getting banners:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// GET /api/banner/locations - Get available banner locations with counts
export const getBannerLocations = async (req, res) => {
	try {
		await connectDB();

		const locations = await Banner.aggregate([
			{ $match: { isActive: true } },
			{ $group: { _id: "$location", count: { $sum: 1 } } },
			{ $sort: { _id: 1 } },
		]);

		return res.status(200).json({
			success: true,
			count: locations.length,
			data: locations.map((loc) => ({
				location: loc._id,
				count: loc.count,
			})),
		});
	} catch (error) {
		console.error("Error getting banner locations:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// Main handler function for public API routes
export default async function handler(req, res) {
	// Set CORS headers
	res.setHeader("Access-Control-Allow-Credentials", "true");
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
	res.setHeader(
		"Access-Control-Allow-Headers",
		"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version,Authorization"
	);

	if (req.method === "OPTIONS") {
		res.status(200).end();
		return;
	}

	// Rate limiting for public API (more generous)
	const allowed = await rateLimit(req, res, 60);
	if (!allowed) {
		return res.status(429).json({
			success: false,
			message: "Terlalu banyak permintaan. Coba lagi nanti.",
		});
	}

	// Only allow GET requests for public API
	if (req.method !== "GET") {
		return res.status(405).json({
			success: false,
			message: "Method Not Allowed. Only GET requests are supported.",
		});
	}

	// Set cache headers for GET requests
	res.setHeader(
		"Cache-Control",
		"public, max-age=60, stale-while-revalidate=300"
	);

	// Route handling
	try {
		if (req.query.path === "locations") {
			// GET /api/banner?path=locations
			return await getBannerLocations(req, res);
		} else {
			// GET /api/banner or GET /api/banner?location=homepage
			return await getBannersByLocation(req, res);
		}
	} catch (error) {
		console.error("API Error:", error);
		return res.status(500).json({
			success: false,
			message: "Internal Server Error",
			error: process.env.NODE_ENV === "development" ? error.message : undefined,
		});
	}
}
