import connectDB from "../../lib/db.js";
import Content from "../../models/content.js";
import Admin from "../../models/admin.js";
import rateLimit from "../../lib/rateLimit.js";

// GET /api/content - Public route to get all content with filtering
export const getAllContent = async (req, res) => {
	try {
		await connectDB();

		const query = { isActive: true };

		if (req.query.type) {
			query.contentType = req.query.type;
		}

		if (req.query.tag) {
			query.tags = { $in: [req.query.tag] };
		}

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

		query.$or = [{ expiryDate: { $gt: new Date() } }, { expiryDate: null }];

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

		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		let sort = { publishDate: -1 };

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

		const content = await Content.find(query)
			.populate("author", "username")
			.sort(sort)
			.skip(skip)
			.limit(limit)
			.select("-cloudinary_id");

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

	const allowed = await rateLimit(req, res, 30);
	if (!allowed) {
		return res.status(429).json({
			success: false,
			message: "Terlalu banyak permintaan. Coba lagi nanti.",
		});
	}

	if (req.method === "GET") {
		res.setHeader(
			"Cache-Control",
			"public, max-age=60, stale-while-revalidate=300"
		);

		if (req.query.path === "types") {
			return await getContentTypes(req, res);
		} else if (req.query.path === "tags") {
			return await getTags(req, res);
		} else if (req.query.slug) {
			return await getContentBySlug(req, res);
		} else {
			return await getAllContent(req, res);
		}
	} else {
		return res.status(405).json({
			success: false,
			message: "Method Not Allowed",
		});
	}
}
