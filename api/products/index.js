import connectDB from "../../lib/db.js";
import Product from "../../models/product.js";

// GET /api/products - Public route to get all products with filtering
export const getAllProducts = async (req, res) => {
	try {
		await connectDB();

		const query = {};

		if (req.query.kategori) {
			query.kategori = req.query.kategori;
		}

		if (req.query.isForRent === "true") query.isForRent = true;
		if (req.query.isForSale === "true") query.isForSale = true;

		const searchKeyword = req.query.search || req.query.q;
		if (searchKeyword) {
			query.$or = [
				{ namaProduk: { $regex: searchKeyword, $options: "i" } },
				{ deskripsi: { $regex: searchKeyword, $options: "i" } },
			];
		}

		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		let sort = { createdAt: -1 };
		switch (req.query.sort) {
			case "price_asc":
				sort = { harga: 1 };
				break;
			case "price_desc":
				sort = { harga: -1 };
				break;
			case "oldest":
				sort = { createdAt: 1 };
				break;
			default:
				sort = { createdAt: -1 };
		}

		const products = await Product.find(query)
			.sort(sort)
			.skip(skip)
			.limit(limit);

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

	if (req.method === "GET") {
		await connectDB();
		if (req.query.q) {
			const keyword = req.query.q.trim();
			try {
				const results = await Product.find({
					$or: [
						{ name: { $regex: keyword, $options: "i" } },
						{ description: { $regex: keyword, $options: "i" } },
					],
				});

				return res.status(200).json({
					success: true,
					count: results.length,
					data: results,
				});
			} catch (error) {
				console.error("Error saat pencarian produk:", error);
				return res.status(500).json({
					success: false,
					message: "Gagal melakukan pencarian produk",
				});
			}
		}

		if (req.query.path === "categories") {
			return await getCategories(req, res);
		}

		if (req.query.id) {
			return await getProductById(req, res);
		}

		if (req.query.slug) {
			try {
				const product = await Product.findOne({ slug: req.query.slug });

				if (!product) {
					return res.status(404).json({
						success: false,
						message: "Produk tidak ditemukan berdasarkan slug",
					});
				}

				return res.status(200).json({
					success: true,
					data: product,
				});
			} catch (error) {
				console.error("Error getting product by slug:", error);
				return res.status(500).json({
					success: false,
					message: "Terjadi kesalahan saat mencari produk by slug",
				});
			}
		}

		return await getAllProducts(req, res);
	}

	return res.status(405).json({
		success: false,
		message: "Method Not Allowed",
	});
}
