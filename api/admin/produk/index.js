// Fix multipart form data handling in serverless environment
import { IncomingForm } from "formidable";
import connectDB from "../../../lib/db.js";
import { authMiddleware, roleCheck } from "../../../lib/auth.js";
import { cloudinary } from "../../../lib/cloudinary.js";
import Product from "../../../models/product.js";
import fs from "fs";

// Configure API route to disable body parsing (we'll handle it with formidable)
export const config = {
	api: {
		bodyParser: false,
	},
};

// Helper function to parse form data using formidable
const parseForm = async (req) => {
	return new Promise((resolve, reject) => {
		const form = new IncomingForm({
			keepExtensions: true,
			maxFileSize: 5 * 1024 * 1024, // 5MB limit
			filter: (part) => {
				return part.mimetype === "image/jpeg" || part.mimetype === "image/png";
			},
		});

		form.parse(req, (err, fields, files) => {
			if (err) {
				console.error("Form parsing error:", err);
				return reject(err);
			}
			resolve({ fields, files });
		});
	});
};

// Helper function to upload image to Cloudinary
const uploadToCloudinary = async (filePath, mimetype) => {
	try {
		// Upload to Cloudinary
		const uploadResult = await cloudinary.uploader.upload(filePath, {
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

		// Parse the multipart form data
		let fields, files;
		try {
			const formData = await parseForm(req);
			fields = formData.fields;
			files = formData.files;

			console.log("✅ Form parsed successfully:");
			console.log("📦 Files:", Object.keys(files));
			console.log("📝 Fields:", fields);
		} catch (err) {
			console.error("❌ Form parsing error:", err);
			return res.status(400).json({
				success: false,
				message: err.message || "Error parsing form data",
			});
		}

		// Validate required fields
		const namaProduk = fields.namaProduk?.[0];
		const deskripsi = fields.deskripsi?.[0];
		const harga = fields.harga?.[0];
		const stok = fields.stok?.[0];
		const isForRent = fields.isForRent?.[0] || "false";
		const isForSale = fields.isForSale?.[0] || "true";
		const kategori = fields.kategori?.[0];

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
		const gambarFile = files.gambar?.[0];
		if (!gambarFile) {
			return res.status(400).json({
				success: false,
				message: "Field 'gambar' (file) tidak ditemukan dalam request",
			});
		}

		try {
			// Upload image to Cloudinary
			const { url, public_id } = await uploadToCloudinary(
				gambarFile.filepath,
				gambarFile.mimetype
			);

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
		} finally {
			// Clean up temporary files
			if (gambarFile && gambarFile.filepath) {
				fs.unlink(gambarFile.filepath, (err) => {
					if (err) console.error("Error deleting temp file:", err);
				});
			}
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

		// Parse the multipart form data
		let fields, files;
		try {
			const formData = await parseForm(req);
			fields = formData.fields;
			files = formData.files;
		} catch (err) {
			console.error("❌ Form parsing error:", err);
			return res.status(400).json({
				success: false,
				message: err.message || "Error parsing form data",
			});
		}

		// Prepare update data
		const updateData = {};

		// Extract and validate fields
		if (fields.namaProduk?.[0]) updateData.namaProduk = fields.namaProduk[0];
		if (fields.deskripsi?.[0]) updateData.deskripsi = fields.deskripsi[0];
		if (fields.kategori?.[0]) updateData.kategori = fields.kategori[0];

		// Handle numeric fields
		if (fields.harga?.[0]) updateData.harga = Number(fields.harga[0]);
		if (fields.stok?.[0]) updateData.stok = Number(fields.stok[0]);

		// Handle boolean fields
		if (fields.isForRent !== undefined) {
			updateData.isForRent = fields.isForRent[0] === "true";
		}

		if (fields.isForSale !== undefined) {
			updateData.isForSale = fields.isForSale[0] === "true";
		}

		// Validate that product can be either for rent or for sale
		if (updateData.isForRent === false && updateData.isForSale === false) {
			return res.status(400).json({
				success: false,
				message: "Produk harus bisa disewa atau dijual",
			});
		}

		// Handle image upload if there's a new image
		const gambarFile = files.gambar?.[0];
		if (gambarFile) {
			try {
				// Delete old image from Cloudinary if it exists
				if (product.cloudinary_id) {
					await cloudinary.uploader.destroy(product.cloudinary_id);
				}

				// Upload new image
				const { url, public_id } = await uploadToCloudinary(
					gambarFile.filepath,
					gambarFile.mimetype
				);

				// Add image data to update
				updateData.gambar = url;
				updateData.cloudinary_id = public_id;
			} catch (uploadError) {
				console.error("Error updating image:", uploadError);
				return res.status(500).json({
					success: false,
					message: "Gagal mengupdate gambar produk",
				});
			} finally {
				// Clean up temporary files
				if (gambarFile.filepath) {
					fs.unlink(gambarFile.filepath, (err) => {
						if (err) console.error("Error deleting temp file:", err);
					});
				}
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
