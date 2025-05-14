// api/content/index.js
import connectDB from "../../lib/db.js";
import Content from "../../models/content.js";
import Admin from "../../models/admin.js"; // ← kamu tidak perlu simpan ke variabel
import rateLimit from "../../../lib/rateLimit.js";

// GET /api/content - Public route to get all content with filtering
export const getAllContent = async (req, res) => {
	try {
		await connectDB();

		// Build query based on filters
		const query = { isActive: true };

		// Filter by contentType if provided
		if (req.query.type) {
			query.contentType = req.query.type;
		}

		// Filter by tag if provided
		if (req.query.tag) {
			query.tags = { $in: [req.query.tag] };
		}

		// Filter by publish date range
		if (req.query.from) {
			query.publishDate = {
				...query.publishDate,
				$gte: new Date(req.query.from),
			};
		}

		if (req.query.to) {
			query.publishDate = {
				...query.publishDate,
				$lte: new Date(req.query.to),
			};
		}

		// Show only non-expired content
		query.$or = [{ expiryDate: { $gt: new Date() } }, { expiryDate: null }];

		// Text search if provided
		if (req.query.search) {
			query.$and = [
				{
					$or: [
						{ title: { $regex: req.query.search, $options: "i" } },
						{ description: { $regex: req.query.search, $options: "i" } },
						{ tags: { $regex: req.query.search, $options: "i" } },
					],
				},
			];
		}

		// Pagination
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		// Sort options
		let sort = { publishDate: -1 }; // Default: newest first

		if (req.query.sort) {
			switch (req.query.sort) {
				case "oldest":
					sort = { publishDate: 1 };
					break;
				case "title_asc":
					sort = { title: 1 };
					break;
				case "title_desc":
					sort = { title: -1 };
					break;
			}
		}

		// Execute query with pagination
		const content = await Content.find(query)
			.populate("author", "username")
			.sort(sort)
			.skip(skip)
			.limit(limit)
			.select("-cloudinary_id"); // No need to expose cloudinary IDs to public

		// Get total count for pagination info
		const totalCount = await Content.countDocuments(query);

		return res.status(200).json({
			success: true,
			count: content.length,
			totalCount,
			totalPages: Math.ceil(totalCount / limit),
			currentPage: page,
			data: content,
		});
	} catch (error) {
		console.error("Error getting content:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// GET /api/content/:slug - Public route to get a specific content by slug
export const getContentBySlug = async (req, res) => {
	try {
		await connectDB();

		const content = await Content.findBySlug(req.query.slug);

		if (!content) {
			return res.status(404).json({
				success: false,
				message: "Konten tidak ditemukan",
			});
		}

		// Check if content is expired
		if (content.isExpired()) {
			return res.status(410).json({
				success: false,
				message: "Konten sudah tidak tersedia",
			});
		}

		return res.status(200).json({
			success: true,
			data: content,
		});
	} catch (error) {
		console.error("Error getting content:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// GET /api/content/types - Get content types and counts
export const getContentTypes = async (req, res) => {
	try {
		await connectDB();

		// Find unique content types and count
		const types = await Content.aggregate([
			{ $match: { isActive: true } },
			{ $group: { _id: "$contentType", count: { $sum: 1 } } },
			{ $sort: { count: -1 } },
		]);

		return res.status(200).json({
			success: true,
			count: types.length,
			data: types.map((type) => ({ type: type._id, count: type.count })),
		});
	} catch (error) {
		console.error("Error getting content types:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// GET /api/content/tags - Get all unique tags
export const getTags = async (req, res) => {
	try {
		await connectDB();

		// Unwind the tags array and then count occurrences
		const tags = await Content.aggregate([
			{ $match: { isActive: true } },
			{ $unwind: "$tags" },
			{ $group: { _id: "$tags", count: { $sum: 1 } } },
			{ $sort: { count: -1 } },
		]);

		return res.status(200).json({
			success: true,
			count: tags.length,
			data: tags.map((tag) => ({ tag: tag._id, count: tag.count })),
		});
	} catch (error) {
		console.error("Error getting content tags:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// Main handler function for API routes
export default async function handler(req, res) {
	// Set CORS headers
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
		res.status(200).end();
		return;
	}

	const allowed = await rateLimit(req, res, 30); // max 30 req/IP/menit
	if (!allowed) {
		return res.status(429).json({
			success: false,
			message: "Terlalu banyak permintaan. Coba lagi nanti.",
		});
	}

	// Route handling based on HTTP method
	if (req.method === "GET") {
		// Special routes for metadata
		if (req.query.path === "types") {
			return await getContentTypes(req, res);
		} else if (req.query.path === "tags") {
			return await getTags(req, res);
		}
		// Route to specific slug if provided, otherwise get all content
		else if (req.query.slug) {
			return await getContentBySlug(req, res);
		} else {
			return await getAllContent(req, res);
		}
	} else {
		// Method not allowed for this endpoint (POST, PUT, DELETE are in admin routes)
		return res.status(405).json({
			success: false,
			message: "Method Not Allowed",
		});
	}
}
