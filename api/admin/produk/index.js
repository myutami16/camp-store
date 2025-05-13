import { createRouter } from "next/router";
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

// Router setup
const router = createRouter();

// POST /api/admin/products - Admin only route to create a product
router.post("/", async (req, res) => {
	try {
		// Authenticate admin
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		// Check admin role
		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		// Handle file upload using multer
		upload.single("gambar")(req, res, async (err) => {
			if (err) {
				return res.status(400).json({
					success: false,
					message: err.message,
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
					message: "Gambar produk wajib diupload",
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
		});
	} catch (error) {
		console.error("Error creating product:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
});

// PUT /api/admin/products/:id - Admin only route to update a product
router.put("/:id", async (req, res) => {
	try {
		// Authenticate admin
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		// Check admin role
		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		// Find product to update
		const product = await Product.findById(req.params.id);

		if (!product) {
			return res.status(404).json({
				success: false,
				message: "Produk tidak ditemukan",
			});
		}

		// Handle file upload if there's a new image
		upload.single("gambar")(req, res, async (err) => {
			if (err) {
				return res.status(400).json({
					success: false,
					message: err.message,
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
					req.params.id,
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
		});
	} catch (error) {
		console.error("Error updating product:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
});

// DELETE /api/admin/products/:id - Admin only route to delete a product
router.delete("/:id", async (req, res) => {
	try {
		// Authenticate admin
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		// Check admin role
		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		// Find product to delete
		const product = await Product.findById(req.params.id);

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
		await Product.findByIdAndDelete(req.params.id);

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
});

export default router.handler();
