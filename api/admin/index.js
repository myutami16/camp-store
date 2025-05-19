import connectDB from "../../lib/db.js";
import Admin from "../../models/admin.js";
import { authMiddleware, roleCheck } from "../../lib/auth.js";
import formidable from "formidable";

const validateAdminInput = (data, isCreate = true) => {
	const errors = {};

	if (isCreate) {
		if (!data.username) {
			errors.username = "Username wajib diisi";
		} else if (data.username.length < 4) {
			errors.username = "Username minimal 4 karakter";
		}
	}

	if (isCreate || data.password) {
		if (!data.password && isCreate) {
			errors.password = "Password wajib diisi";
		} else if (data.password?.length < 6) {
			errors.password = "Password minimal 6 karakter";
		}
	}

	if (!data.name) errors.name = "Nama wajib diisi";

	if (data.role && !["super-admin", "admin", "editor"].includes(data.role)) {
		errors.role = "Role tidak valid";
	}

	return { errors, isValid: !Object.keys(errors).length };
};

// Route protection middleware with timeout handling
export function protectRoute(handler, allowedRoles = []) {
	return async (req, res) => {
		const authResult = await authMiddleware(req);

		if (!authResult.ok) {
			return res.status(401).json({
				success: false,
				message: authResult.error,
			});
		}

		const role = req.admin.role;
		if (!allowedRoles.includes(role)) {
			return res.status(403).json({
				success: false,
				message: "Akses ditolak",
			});
		}

		return handler(req, res);
	};
}

// Parse form data using formidable
const parseFormData = async (req) => {
	const form = formidable({
		multiples: true,
		keepExtensions: true,
	});

	return new Promise((resolve, reject) => {
		form.parse(req, (err, fields, files) => {
			if (err) {
				console.error("🔥 Formidable error:", err);
				return reject(err);
			}

			const parsedFields = Object.keys(fields).reduce((acc, key) => {
				acc[key] = Array.isArray(fields[key]) ? fields[key][0] : fields[key];
				return acc;
			}, {});

			resolve({ fields: parsedFields, files });
		});
	});
};

// Format admin response
const formatAdminResponse = (admin) => ({
	id: admin._id,
	username: admin.username,
	name: admin.name,
	role: admin.role,
	createdAt: admin.createdAt,
});

// Export main handler with connection management
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

	try {
		if (req.method === "POST" || req.method === "PUT") {
			try {
				const { fields, files } = await parseFormData(req);

				req.body = fields;

				req.files = files;

				console.log("Files received:", files);
				console.log("Body received:", fields);
			} catch (error) {
				console.error("Form parsing error:", error);
				return res.status(400).json({
					success: false,
					message: "Gagal memproses form data",
				});
			}
		}

		if (req.method === "GET") {
			try {
				await connectDB();

				const authResult = await authMiddleware(req);
				if (!authResult.ok) {
					return res.status(401).json({
						success: false,
						message: authResult.error,
					});
				}

				// ✅ Jika akses ke /stats
				if (req.url.includes("/stats")) {
					const stats = await getDashboardStats(); // ← pastikan ini sudah kamu buat
					return res.status(200).json({
						success: true,
						data: stats,
					});
				}

				// ✅ Kalau bukan ke /stats → berarti ambil semua admin
				const admins = await Admin.find().select("-password");
				return res.status(200).json({
					success: true,
					count: admins.length,
					data: admins,
				});
			} catch (error) {
				console.error("Error admin GET:", error);
				return res.status(500).json({
					success: false,
					message: "Server error",
				});
			}
		}

		const connectionPromise = connectDB();
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error("Database connection timed out")), 5000)
		);
		await Promise.race([connectionPromise, timeoutPromise]);

		switch (req.method) {
			case "GET":
				return protectRoute(handleGetAdmin, ["super-admin", "admin"])(req, res);
			case "POST":
				return protectRoute(handleCreateAdmin, ["super-admin"])(req, res);
			case "PUT":
				return protectRoute(handleUpdateAdmin, ["super-admin"])(req, res);
			case "DELETE":
				return protectRoute(handleDeleteAdmin, ["super-admin"])(req, res);
			default:
				res.setHeader("Allow", ["GET", "POST", "PUT", "DELETE"]);
				return res.status(405).json({
					success: false,
					message: `Method ${req.method} tidak diizinkan`,
				});
		}
	} catch (error) {
		console.error("API Error:", error);
		res.status(500).json({ success: false, message: "Internal Server Error" });
	}
}

// Handler functions
const handleGetAdmin = async (req, res) => {
	try {
		const { id } = req.query;

		if (id) {
			const admin = await Admin.findById(id);
			if (!admin) return notFoundResponse(res, "Admin");

			return successResponse(res, formatAdminResponse(admin));
		}

		const admins = await Admin.find().select("-password");
		return successResponse(res, admins, admins.length);
	} catch (error) {
		console.error("Get admin error:", error);
		return serverErrorResponse(res);
	}
};

const handleCreateAdmin = async (req, res) => {
	try {
		const { errors, isValid } = validateAdminInput(req.body);
		if (!isValid) return validationErrorResponse(res, errors);

		const existingAdmin = await Admin.findOne({ username: req.body.username });
		if (existingAdmin) {
			return conflictResponse(res, "Username sudah digunakan");
		}

		const newAdmin = await Admin.create(req.body);
		return createdResponse(res, formatAdminResponse(newAdmin));
	} catch (error) {
		console.error("Create admin error:", error);

		if (error.name === "ValidationError") {
			return mongooseValidationErrorResponse(res, error);
		}

		return serverErrorResponse(res);
	}
};

const handleUpdateAdmin = async (req, res) => {
	try {
		const { id } = req.query;
		if (!id) return badRequestResponse(res, "ID admin wajib disertakan");

		const admin = await Admin.findById(id);
		if (!admin) return notFoundResponse(res, "Admin");

		const { errors, isValid } = validateAdminInput(req.body, false);
		if (!isValid) return validationErrorResponse(res, errors);

		const updatedAdmin = await Admin.findByIdAndUpdate(id, req.body, {
			new: true,
			runValidators: true,
		});

		return successResponse(res, formatAdminResponse(updatedAdmin));
	} catch (error) {
		console.error("Update admin error:", error);

		if (error.name === "ValidationError") {
			return mongooseValidationErrorResponse(res, error);
		}

		return serverErrorResponse(res);
	}
};

const handleDeleteAdmin = async (req, res) => {
	try {
		const { id } = req.query;
		if (!id) return badRequestResponse(res, "ID admin wajib disertakan");

		const admin = await Admin.findById(id);
		if (!admin) return notFoundResponse(res, "Admin");

		if (admin._id.toString() === req.admin.id) {
			return badRequestResponse(res, "Tidak dapat menghapus akun sendiri");
		}

		await Admin.findByIdAndDelete(id);
		return successResponse(res, null, "Admin berhasil dihapus");
	} catch (error) {
		console.error("Delete admin error:", error);
		return serverErrorResponse(res);
	}
};

// Response helpers
const successResponse = (res, data, count) =>
	res.status(200).json({
		success: true,
		count,
		data,
	});

const createdResponse = (res, data) =>
	res.status(201).json({
		success: true,
		data,
	});

const badRequestResponse = (res, message) =>
	res.status(400).json({
		success: false,
		message,
	});

const validationErrorResponse = (res, errors) =>
	res.status(400).json({
		success: false,
		errors,
	});

const notFoundResponse = (res, item) =>
	res.status(404).json({
		success: false,
		message: `${item} tidak ditemukan`,
	});

const conflictResponse = (res, message) =>
	res.status(409).json({
		success: false,
		message,
	});

const serverErrorResponse = (res) =>
	res.status(500).json({
		success: false,
		message: "Terjadi kesalahan pada server",
	});

const mongooseValidationErrorResponse = (res, error) => {
	const errors = Object.keys(error.errors).reduce((acc, key) => {
		acc[key] = error.errors[key].message;
		return acc;
	}, {});

	return validationErrorResponse(res, errors);
};
