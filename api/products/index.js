import multer from "multer";
import connectDB from "../../lib/db.js";
import { authMiddleware, roleCheck } from "../../lib/auth.js";
import { cloudinary } from "../../lib/cloudinary.js";
import Product from "../../models/product.js";

// Multer setup for memory storage (we'll upload to Cloudinary later)
const storage = multer.memoryStorage();
const upload = multer({
	storage,
	limits: {
		fileSize: 5 * 1024 * 1024, // 5MB limit
	},
	fileFilter: (req, file, cb) => {
		// Accept only jpeg and png
		if (file.mimetype === "image/jpeg" || file.mimetype === "image/png") {
			cb(null, true);
		} else {
			cb(
				new Error("Format file tidak didukung. Gunakan format JPEG atau PNG."),
				false
			);
		}
	},
});

// Helper function to upload image to Cloudinary
const uploadToCloudinary = async (file) => {
	try {
		// Convert buffer to base64
		const fileStr = `data:${file.mimetype};base64,${file.buffer.toString(
			"base64"
		)}`;

		// Upload to Cloudinary
		const uploadResult = await cloudinary.uploader.upload(fileStr, {
			folder: "camping-store/products",
		});

		return {
			url: uploadResult.secure_url,
			public_id: uploadResult.public_id,
		};
	} catch (error) {
		console.error("Error uploading to Cloudinary:", error);
		throw new Error("Gagal mengupload gambar");
	}
};

// This is the handler for GET /api/products - Public route to get all products
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

		const products = await Product.find(query).sort({ createdAt: -1 });

		return res.status(200).json({
			success: true,
			count: products.length,
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
		// Route to specific ID if provided, otherwise get all products
		if (req.query.id) {
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
