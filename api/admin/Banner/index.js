import { IncomingForm } from "formidable";
import connectDB from "../../../lib/db.js";
import { authMiddleware, roleCheck } from "../../../lib/auth.js";
import { cloudinary } from "../../../lib/cloudinary.js";
import Banner from "../../../models/banner.js";
import fs from "fs";
import rateLimit from "../../../lib/rateLimit.js";

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
			maxFileSize: 500 * 1024,
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
		const uploadResult = await cloudinary.uploader.upload(filePath, {
			folder: "camping-store/banners",
			transformation: [
				{ width: 1200, height: 400, crop: "fill" },
				{ quality: "auto" },
				{ format: "auto" },
			],
		});

		return {
			url: uploadResult.secure_url,
			public_id: uploadResult.public_id,
		};
	} catch (error) {
		console.error("Error uploading to Cloudinary:", error);
		throw new Error("Gagal mengupload gambar banner");
	}
};

// POST /api/admin/banner - Admin only route to create banner
export const createBanner = async (req, res) => {
	try {
		// Use consistent auth pattern like produk and konten
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		let fields, files;
		try {
			const formData = await parseForm(req);
			fields = formData.fields;
			files = formData.files;

			console.log("Form parsed successfully:");
			console.log("Files:", Object.keys(files));
			console.log("Fields:", fields);
		} catch (err) {
			console.error("Form parsing error:", err);
			return res.status(400).json({
				success: false,
				message: err.message || "Error parsing form data",
			});
		}

		const location = fields.location?.[0];
		const isActive = fields.isActive?.[0] !== "false";

		if (!location) {
			return res.status(400).json({
				success: false,
				message: "Lokasi banner wajib diisi",
			});
		}

		if (!["homepage", "productpage"].includes(location)) {
			return res.status(400).json({
				success: false,
				message: "Lokasi banner tidak valid. Pilih: homepage atau productpage",
			});
		}

		// Check banner count limit per location
		const count = await Banner.countDocuments({ location });
		if (count >= 5) {
			return res.status(400).json({
				success: false,
				message: `Maksimal 5 banner per lokasi. ${location} sudah memiliki ${count} banner.`,
			});
		}

		// Validate image file
		const imageFile = files.image?.[0];
		if (!imageFile) {
			return res.status(400).json({
				success: false,
				message: "File gambar banner wajib diupload",
			});
		}

		try {
			const { url, public_id } = await uploadToCloudinary(
				imageFile.filepath,
				imageFile.mimetype
			);

			// Create new banner
			const banner = await Banner.create({
				image: url,
				cloudinary_id: public_id,
				location,
				isActive,
			});

			return res.status(201).json({
				success: true,
				message: "Banner berhasil dibuat",
				data: banner,
			});
		} catch (uploadError) {
			console.error("Error in upload or banner creation:", uploadError);
			return res.status(500).json({
				success: false,
				message: uploadError.message || "Gagal membuat banner",
			});
		} finally {
			// Clean up temp file
			if (imageFile && imageFile.filepath) {
				fs.unlink(imageFile.filepath, (err) => {
					if (err) console.error("Error deleting temp file:", err);
				});
			}
		}
	} catch (error) {
		console.error("Error creating banner:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// PUT /api/admin/banner/:id - Admin only route to update banner
export const updateBanner = async (req, res) => {
	try {
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		const banner = await Banner.findById(req.query.id);
		if (!banner) {
			return res.status(404).json({
				success: false,
				message: "Banner tidak ditemukan",
			});
		}

		let fields, files;
		try {
			const formData = await parseForm(req);
			fields = formData.fields;
			files = formData.files;
		} catch (err) {
			console.error("Form parsing error:", err);
			return res.status(400).json({
				success: false,
				message: err.message || "Error parsing form data",
			});
		}

		const updateData = {};

		// Update location if provided
		if (fields.location?.[0]) {
			const newLocation = fields.location[0];
			if (!["homepage", "productpage"].includes(newLocation)) {
				return res.status(400).json({
					success: false,
					message: "Lokasi banner tidak valid",
				});
			}

			// Check if changing location would exceed limit
			if (newLocation !== banner.location) {
				const count = await Banner.countDocuments({ location: newLocation });
				if (count >= 5) {
					return res.status(400).json({
						success: false,
						message: `Maksimal 5 banner per lokasi. ${newLocation} sudah memiliki ${count} banner.`,
					});
				}
			}
			updateData.location = newLocation;
		}

		// Update isActive status
		if (fields.isActive !== undefined) {
			updateData.isActive = fields.isActive[0] !== "false";
		}

		// Handle image update if provided
		const imageFile = files.image?.[0];
		if (imageFile) {
			try {
				// Delete old image from Cloudinary
				if (banner.cloudinary_id) {
					await cloudinary.uploader.destroy(banner.cloudinary_id);
				}

				// Upload new image
				const { url, public_id } = await uploadToCloudinary(
					imageFile.filepath,
					imageFile.mimetype
				);

				updateData.image = url;
				updateData.cloudinary_id = public_id;
			} catch (uploadError) {
				console.error("Error updating image:", uploadError);
				return res.status(500).json({
					success: false,
					message: "Gagal mengupdate gambar banner",
				});
			} finally {
				// Clean up temp file
				if (imageFile.filepath) {
					fs.unlink(imageFile.filepath, (err) => {
						if (err) console.error("Error deleting temp file:", err);
					});
				}
			}
		}

		try {
			const updatedBanner = await Banner.findByIdAndUpdate(
				req.query.id,
				updateData,
				{ new: true, runValidators: true }
			);

			return res.status(200).json({
				success: true,
				message: "Banner berhasil diupdate",
				data: updatedBanner,
			});
		} catch (updateError) {
			console.error("Error updating banner:", updateError);
			return res.status(500).json({
				success: false,
				message: updateError.message || "Gagal mengupdate banner",
			});
		}
	} catch (error) {
		console.error("Error updating banner:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// DELETE /api/admin/banner/:id - Admin only route to delete banner
export const deleteBanner = async (req, res) => {
	try {
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		const banner = await Banner.findById(req.query.id);
		if (!banner) {
			return res.status(404).json({
				success: false,
				message: "Banner tidak ditemukan",
			});
		}

		// Delete image from Cloudinary
		if (banner.cloudinary_id) {
			try {
				await cloudinary.uploader.destroy(banner.cloudinary_id);
			} catch (cloudinaryError) {
				console.error("Error deleting from Cloudinary:", cloudinaryError);
				// Continue with deletion even if Cloudinary fails
			}
		}

		// Delete banner from database
		await Banner.findByIdAndDelete(req.query.id);

		return res.status(200).json({
			success: true,
			message: "Banner berhasil dihapus",
		});
	} catch (error) {
		console.error("Error deleting banner:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// GET /api/admin/banner - Admin only route to get all banners
export const getAllBanners = async (req, res) => {
	try {
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		const query = {};

		// Filter by location if provided
		if (req.query.location) {
			query.location = req.query.location;
		}

		// Filter by active status if provided
		if (req.query.isActive !== undefined) {
			query.isActive = req.query.isActive === "true";
		}

		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 20;
		const skip = (page - 1) * limit;

		const sort = { createdAt: -1 }; // Newest first

		const banners = await Banner.find(query).sort(sort).skip(skip).limit(limit);

		const totalCount = await Banner.countDocuments(query);

		// Get banner count by location for admin dashboard
		const locationStats = await Banner.aggregate([
			{
				$group: {
					_id: "$location",
					count: { $sum: 1 },
					active: { $sum: { $cond: ["$isActive", 1, 0] } },
				},
			},
		]);

		return res.status(200).json({
			success: true,
			count: banners.length,
			totalCount,
			totalPages: Math.ceil(totalCount / limit),
			currentPage: page,
			locationStats: locationStats.reduce((acc, stat) => {
				acc[stat._id] = { total: stat.count, active: stat.active };
				return acc;
			}, {}),
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

// GET /api/admin/banner/:id - Admin only route to get banner by ID
export const getBannerById = async (req, res) => {
	try {
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		const banner = await Banner.findById(req.query.id);
		if (!banner) {
			return res.status(404).json({
				success: false,
				message: "Banner tidak ditemukan",
			});
		}

		return res.status(200).json({
			success: true,
			data: banner,
		});
	} catch (error) {
		console.error("Error getting banner:", error);
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

		if (req.method === "OPTIONS") {
			res.status(200).end();
			return;
		}

		// Rate limiting
		const allowed = await rateLimit(req, res, 20);
		if (!allowed) {
			return res.status(429).json({
				success: false,
				message: "Terlalu banyak permintaan. Coba lagi nanti.",
			});
		}

		switch (req.method) {
			case "GET":
				if (req.query.id) {
					await getBannerById(req, res);
				} else {
					await getAllBanners(req, res);
				}
				break;
			case "POST":
				await createBanner(req, res);
				break;
			case "PUT":
				await updateBanner(req, res);
				break;
			case "DELETE":
				await deleteBanner(req, res);
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
