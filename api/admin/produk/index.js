export const config = {
	api: {
		bodyParser: false,
	},
};

import multer from "multer";
import connectDB from "../../../lib/db.js";
import { authMiddleware, roleCheck } from "../../../lib/auth.js";
import { cloudinary } from "../../../lib/cloudinary.js";
import Product from "../../../models/product.js";

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

// POST /api/admin/produk - Admin only route to create a product
export const createProduct = async (req, res) => {
	try {
		// Authenticate admin
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		// Check admin role
		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		// Handle file upload using multer
		const multerUpload = async () => {
			return new Promise((resolve, reject) => {
				upload.single("gambar")(req, res, (err) => {
					if (err) {
						console.error("🔥 Multer inner error:", err); // 🧠 Ini penting
						reject(err);
					} else {
						console.log("✅ Multer passed");
						resolve();
					}
				});
			});
		};

		try {
			await multerUpload();
			console.log("✔️ Upload success:");
			console.log("📦 req.file:", req.file);
			console.log("📝 req.body:", req.body);
		} catch (err) {
			console.error("❌ Multer error:", err); // 🔥 Tambahkan ini
			return res.status(400).json({
				success: false,
				message: err.message || "Error uploading file",
			});
		}

		// Validate required fields
		const {
			namaProduk,
			deskripsi,
			harga,
			stok,
			isForRent,
			isForSale,
			kategori,
		} = req.body;

		if (!namaProduk || !deskripsi || !harga || !stok || !kategori) {
			return res.status(400).json({
				success: false,
				message: "Semua field wajib diisi",
			});
		}

		// Validate that either isForRent or isForSale is true
		if (isForRent === "false" && isForSale === "false") {
			return res.status(400).json({
				success: false,
				message: "Produk harus bisa disewa atau dijual",
			});
		}

		// Validate image is uploaded
		if (!req.file) {
			return res.status(400).json({
				success: false,
				message: "Field 'gambar' (file) tidak ditemukan dalam request",
			});
		}

		try {
			// Upload image to Cloudinary
			const { url, public_id } = await uploadToCloudinary(req.file);

			// Create new product
			const product = await Product.create({
				namaProduk,
				deskripsi,
				harga: Number(harga),
				stok: Number(stok),
				isForRent: isForRent === "true",
				isForSale: isForSale === "true",
				kategori,
				gambar: url,
				cloudinary_id: public_id,
			});

			return res.status(201).json({
				success: true,
				data: product,
			});
		} catch (uploadError) {
			console.error("Error in upload or product creation:", uploadError);
			return res.status(500).json({
				success: false,
				message: uploadError.message || "Gagal membuat produk",
			});
		}
	} catch (error) {
		console.error("Error creating product:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// PUT /api/admin/produk/:id - Admin only route to update a product
export const updateProduct = async (req, res) => {
	try {
		// Authenticate admin
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		// Check admin role
		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		// Find product to update
		const product = await Product.findById(req.query.id);

		if (!product) {
			return res.status(404).json({
				success: false,
				message: "Produk tidak ditemukan",
			});
		}

		// Handle file upload if there's a new image
		const multerUpload = async () => {
			return new Promise((resolve, reject) => {
				upload.single("gambar")(req, res, (err) => {
					if (err) {
						console.error("🔥 Multer inner error:", err); // 🧠 Ini penting
						reject(err);
					} else {
						console.log("✅ Multer passed");
						resolve();
					}
				});
			});
		};

		try {
			await multerUpload();
			console.log("✔️ Upload success:");
			console.log("📦 req.file:", req.file);
			console.log("📝 req.body:", req.body);
		} catch (err) {
			console.error("❌ Multer error:", err); // 🔥 Tambahkan ini
			return res.status(400).json({
				success: false,
				message: err.message || "Error uploading file",
			});
		}

		// Prepare update data
		const updateData = { ...req.body };

		// Convert string booleans to actual booleans
		if (updateData.isForRent !== undefined) {
			updateData.isForRent = updateData.isForRent === "true";
		}

		if (updateData.isForSale !== undefined) {
			updateData.isForSale = updateData.isForSale === "true";
		}

		// Validate that product can be either for rent or for sale
		if (updateData.isForRent === false && updateData.isForSale === false) {
			return res.status(400).json({
				success: false,
				message: "Produk harus bisa disewa atau dijual",
			});
		}

		// Convert numeric strings to numbers
		if (updateData.harga) {
			updateData.harga = Number(updateData.harga);
		}

		if (updateData.stok) {
			updateData.stok = Number(updateData.stok);
		}

		// Handle image upload if there's a new image
		if (req.file) {
			try {
				// Delete old image from Cloudinary if it exists
				if (product.cloudinary_id) {
					await cloudinary.uploader.destroy(product.cloudinary_id);
				}

				// Upload new image
				const { url, public_id } = await uploadToCloudinary(req.file);

				// Add image data to update
				updateData.gambar = url;
				updateData.cloudinary_id = public_id;
			} catch (uploadError) {
				console.error("Error updating image:", uploadError);
				return res.status(500).json({
					success: false,
					message: "Gagal mengupdate gambar produk",
				});
			}
		}

		try {
			// Update product
			const updatedProduct = await Product.findByIdAndUpdate(
				req.query.id,
				updateData,
				{ new: true, runValidators: true }
			);

			return res.status(200).json({
				success: true,
				data: updatedProduct,
			});
		} catch (updateError) {
			console.error("Error updating product:", updateError);
			return res.status(500).json({
				success: false,
				message: updateError.message || "Gagal mengupdate produk",
			});
		}
	} catch (error) {
		console.error("Error updating product:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// DELETE /api/admin/produk/:id - Admin only route to delete a product
export const deleteProduct = async (req, res) => {
	try {
		// Authenticate admin
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		// Check admin role
		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		// Find product to delete
		const product = await Product.findById(req.query.id);

		if (!product) {
			return res.status(404).json({
				success: false,
				message: "Produk tidak ditemukan",
			});
		}

		// Delete image from Cloudinary if it exists
		if (product.cloudinary_id) {
			await cloudinary.uploader.destroy(product.cloudinary_id);
		}

		// Delete product from database
		await Product.findByIdAndDelete(req.query.id);

		return res.status(200).json({
			success: true,
			message: "Produk berhasil dihapus",
		});
	} catch (error) {
		console.error("Error deleting product:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// Main handler function for API routes
export default async function handler(req, res) {
	try {
		// Set CORS headers
		res.setHeader("Access-Control-Allow-Credentials", "true");
		res.setHeader("Access-Control-Allow-Origin", "*");
		// Alternatively for specific domains:
		// res.setHeader("Access-Control-Allow-Origin", "https://yourdomain.com");
		res.setHeader(
			"Access-Control-Allow-Methods",
			"GET, OPTIONS, PATCH, DELETE, POST, PUT"
		);
		res.setHeader(
			"Access-Control-Allow-Headers",
			"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
		);

		// Handle OPTIONS requests (pre-flight)
		if (req.method === "OPTIONS") {
			res.status(200).end();
			return;
		}

		// Route handling based on HTTP method
		switch (req.method) {
			case "POST":
				await createProduct(req, res);
				break;
			case "PUT":
				await updateProduct(req, res);
				break;
			case "DELETE":
				await deleteProduct(req, res);
				break;
			default:
				res.status(405).json({
					success: false,
					message: `Method ${req.method} Not Allowed`,
				});
		}
	} catch (error) {
		console.error("API Error:", error);
		res.status(500).json({
			success: false,
			message: "Internal Server Error",
			error: process.env.NODE_ENV === "development" ? error.message : undefined,
		});
	}
}
