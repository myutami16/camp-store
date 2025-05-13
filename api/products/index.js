// Fixed products public API route
import connectDB from "../../lib/db.js";
import Product from "../../models/product.js";

// GET /api/products - Public route to get all products with filtering
export const getAllProducts = async (req, res) => {
	try {
		await connectDB();

		// Build query based on filters
		const query = {};

		// Filter by kategori if provided
		if (req.query.kategori) {
			query.kategori = req.query.kategori;
		}

		// Filter by type (rent or sale)
		if (req.query.isForRent === "true") {
			query.isForRent = true;
		}

		if (req.query.isForSale === "true") {
			query.isForSale = true;
		}

		// Pagination
		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		// Sort options
		let sort = { createdAt: -1 }; // Default: newest first

		if (req.query.sort) {
			switch (req.query.sort) {
				case "price_asc":
					sort = { harga: 1 };
					break;
				case "price_desc":
					sort = { harga: -1 };
					break;
				case "newest":
					sort = { createdAt: -1 };
					break;
				case "oldest":
					sort = { createdAt: 1 };
					break;
			}
		}

		// Text search if provided
		if (req.query.search) {
			query.$or = [
				{ namaProduk: { $regex: req.query.search, $options: "i" } },
				{ deskripsi: { $regex: req.query.search, $options: "i" } },
			];
		}

		// Execute query with pagination
		const products = await Product.find(query)
			.sort(sort)
			.skip(skip)
			.limit(limit);

		// Get total count for pagination info
		const totalCount = await Product.countDocuments(query);

		return res.status(200).json({
			success: true,
			count: products.length,
			totalCount,
			totalPages: Math.ceil(totalCount / limit),
			currentPage: page,
			data: products,
		});
	} catch (error) {
		console.error("Error getting products:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// GET /api/products/:id - Public route to get a specific product
export const getProductById = async (req, res) => {
	try {
		await connectDB();

		const product = await Product.findById(req.query.id);

		if (!product) {
			return res.status(404).json({
				success: false,
				message: "Produk tidak ditemukan",
			});
		}

		return res.status(200).json({
			success: true,
			data: product,
		});
	} catch (error) {
		console.error("Error getting product:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// GET /api/products/categories - Get unique product categories
export const getCategories = async (req, res) => {
	try {
		await connectDB();

		// Find unique categories across all products
		const categories = await Product.distinct("kategori");

		return res.status(200).json({
			success: true,
			count: categories.length,
			data: categories,
		});
	} catch (error) {
		console.error("Error getting categories:", error);
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

	// Route handling based on HTTP method
	if (req.method === "GET") {
		// Special route for categories
		if (req.query.path === "categories") {
			return await getCategories(req, res);
		}
		// Route to specific ID if provided, otherwise get all products
		else if (req.query.id) {
			return await getProductById(req, res);
		} else {
			return await getAllProducts(req, res);
		}
	} else {
		// Method not allowed for this endpoint (POST, PUT, DELETE are in admin routes)
		return res.status(405).json({
			success: false,
			message: "Method Not Allowed",
		});
	}
}
