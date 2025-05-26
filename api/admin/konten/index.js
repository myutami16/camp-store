import { IncomingForm } from "formidable";
import connectDB from "../../../lib/db.js";
import { authMiddleware, roleCheck } from "../../../lib/auth.js";
import { cloudinary } from "../../../lib/cloudinary.js";
import Content from "../../../models/content.js";
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
				if (err.code === "LIMIT_FILE_SIZE") {
					return reject(new Error("Ukuran file melebihi 500KB"));
				}
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
			folder: "camping-store/content",
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

// POST /api/admin/konten - Admin only route to create content
export const createContent = async (req, res) => {
	try {
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

		const title = fields.title?.[0];
		const description = fields.description?.[0];
		const contentType = fields.contentType?.[0];
		const summary = fields.summary?.[0] || "";

		const tags = fields.tags?.[0] ? JSON.parse(fields.tags[0]) : [];
		const publishDate = fields.publishDate?.[0]
			? new Date(fields.publishDate[0])
			: new Date();
		const expiryDate = fields.expiryDate?.[0]
			? new Date(fields.expiryDate[0])
			: null;
		const isActive = fields.isActive?.[0] === "true";

		if (!title || !description || !contentType) {
			return res.status(400).json({
				success: false,
				message: "Judul, deskripsi, dan tipe konten wajib diisi",
			});
		}

		const imageFile = files.image?.[0];
		if (!imageFile) {
			return res.status(400).json({
				success: false,
				message: "Field 'image' (file) tidak ditemukan dalam request",
			});
		}

		try {
			const { url, public_id } = await uploadToCloudinary(
				imageFile.filepath,
				imageFile.mimetype
			);

			// Create new content
			const content = await Content.create({
				title,
				description,
				contentType,
				summary,
				tags,
				publishDate,
				expiryDate,
				isActive,
				image: url,
				cloudinary_id: public_id,
				author: req.admin.id,
			});

			return res.status(201).json({
				success: true,
				data: content,
			});
		} catch (uploadError) {
			console.error("Error in upload or content creation:", uploadError);
			return res.status(500).json({
				success: false,
				message: uploadError.message || "Gagal membuat konten",
			});
		} finally {
			if (imageFile && imageFile.filepath) {
				fs.unlink(imageFile.filepath, (err) => {
					if (err) console.error("Error deleting temp file:", err);
				});
			}
		}
	} catch (error) {
		console.error("Error creating content:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// PUT /api/admin/konten/:id - Admin only route to update content
export const updateContent = async (req, res) => {
	try {
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		const content = await Content.findById(req.query.id);

		if (!content) {
			return res.status(404).json({
				success: false,
				message: "Konten tidak ditemukan",
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

		if (fields.title?.[0]) updateData.title = fields.title[0];
		if (fields.description?.[0]) updateData.description = fields.description[0];
		if (fields.contentType?.[0]) updateData.contentType = fields.contentType[0];
		if (fields.summary?.[0]) updateData.summary = fields.summary[0];

		if (fields.tags?.[0]) {
			try {
				updateData.tags = JSON.parse(fields.tags[0]);
			} catch (e) {
				return res.status(400).json({
					success: false,
					message: "Format tags tidak valid (harus array JSON)",
				});
			}
		}

		if (fields.publishDate?.[0]) {
			updateData.publishDate = new Date(fields.publishDate[0]);
		}

		if (fields.expiryDate?.[0]) {
			updateData.expiryDate = new Date(fields.expiryDate[0]);
		} else if (fields.expiryDate === "") {
			updateData.expiryDate = null;
		}

		if (fields.isActive !== undefined) {
			updateData.isActive = fields.isActive[0] === "true";
		}
		const imageFile = files.image?.[0];
		if (imageFile) {
			try {
				if (content.cloudinary_id) {
					await cloudinary.uploader.destroy(content.cloudinary_id);
				}

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
					message: "Gagal mengupdate gambar konten",
				});
			} finally {
				if (imageFile.filepath) {
					fs.unlink(imageFile.filepath, (err) => {
						if (err) console.error("Error deleting temp file:", err);
					});
				}
			}
		}

		try {
			const updatedContent = await Content.findByIdAndUpdate(
				req.query.id,
				updateData,
				{ new: true, runValidators: true }
			);

			return res.status(200).json({
				success: true,
				data: updatedContent,
			});
		} catch (updateError) {
			console.error("Error updating content:", updateError);
			return res.status(500).json({
				success: false,
				message: updateError.message || "Gagal mengupdate konten",
			});
		}
	} catch (error) {
		console.error("Error updating content:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// DELETE /api/admin/konten/:id - Admin only route to delete content
export const deleteContent = async (req, res) => {
	try {
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		const content = await Content.findById(req.query.id);

		if (!content) {
			return res.status(404).json({
				success: false,
				message: "Konten tidak ditemukan",
			});
		}

		if (content.cloudinary_id) {
			await cloudinary.uploader.destroy(content.cloudinary_id);
		}

		await Content.findByIdAndDelete(req.query.id);

		return res.status(200).json({
			success: true,
			message: "Konten berhasil dihapus",
		});
	} catch (error) {
		console.error("Error deleting content:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
};

// GET /api/admin/konten - Admin only route to get all content (including inactive)
export const getAllContent = async (req, res) => {
	try {
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		const query = {};

		if (req.query.type) {
			query.contentType = req.query.type;
		}

		if (req.query.isActive !== undefined) {
			query.isActive = req.query.isActive === "true";
		}

		if (req.query.tag) {
			query.tags = { $in: [req.query.tag] };
		}

		if (req.query.search) {
			query.$or = [
				{ title: { $regex: req.query.search, $options: "i" } },
				{ description: { $regex: req.query.search, $options: "i" } },
				{ tags: { $regex: req.query.search, $options: "i" } },
			];
		}

		const page = parseInt(req.query.page) || 1;
		const limit = parseInt(req.query.limit) || 10;
		const skip = (page - 1) * limit;

		let sort = { createdAt: -1 };

		if (req.query.sort) {
			switch (req.query.sort) {
				case "publishDate_asc":
					sort = { publishDate: 1 };
					break;
				case "publishDate_desc":
					sort = { publishDate: -1 };
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
			.limit(limit);

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

// GET /api/admin/konten/:id - Admin only route to get content by ID
export const getContentById = async (req, res) => {
	try {
		await authMiddleware(req, res);
		if (res.statusCode === 401 || res.statusCode === 403) return;

		await roleCheck(["admin", "super_admin"])(req, res);
		if (res.statusCode === 403) return;

		await connectDB();

		const content = await Content.findById(req.query.id).populate(
			"author",
			"username"
		);

		if (!content) {
			return res.status(404).json({
				success: false,
				message: "Konten tidak ditemukan",
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

// Main handler function for API routes
export default async function handler(req, res) {
	try {
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

		const allowed = await rateLimit(req, res, 30); // max 30 req/IP/menit
		if (!allowed) {
			return res.status(429).json({
				success: false,
				message: "Terlalu banyak permintaan. Coba lagi nanti.",
			});
		}

		switch (req.method) {
			case "GET":
				if (req.query.id) {
					await getContentById(req, res);
				} else {
					await getAllContent(req, res);
				}
				break;
			case "POST":
				await createContent(req, res);
				break;
			case "PUT":
				await updateContent(req, res);
				break;
			case "DELETE":
				await deleteContent(req, res);
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
