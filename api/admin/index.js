import connectDB from "../../lib/db.js";
import Admin from "../../models/admin.js";
import { authMiddleware, roleCheck } from "../../lib/auth.js";

// Input validation
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
const protectRoute = (handler, roles = ["super-admin"]) => {
	return async (req, res) => {
		// Set a timeout to prevent long-running functions
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error("Request timed out")), 25000)
		);

		try {
			// Race between auth middleware and timeout
			await Promise.race([authMiddleware(req, res), timeoutPromise]);

			// Race between role check and timeout
			await Promise.race([roleCheck(roles)(req, res), timeoutPromise]);

			// Call the handler with timeout protection
			return await Promise.race([handler(req, res), timeoutPromise]);
		} catch (error) {
			console.error("Route protection error:", error);

			if (error.message === "Request timed out") {
				return res.status(504).json({
					success: false,
					message: "Permintaan memakan waktu terlalu lama",
				});
			}

			return res.status(500).json({
				success: false,
				message: "Terjadi kesalahan pada server",
			});
		}
	};
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

	// Handle OPTIONS request for CORS preflight
	if (req.method === "OPTIONS") {
		res.status(200).end();
		return;
	}

	try {
		// Establish database connection with a timeout
		const connectionPromise = connectDB();
		const timeoutPromise = new Promise((_, reject) =>
			setTimeout(() => reject(new Error("Database connection timed out")), 5000)
		);

		await Promise.race([connectionPromise, timeoutPromise]);

		// Route handling
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
		console.error("Global handler error:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
}

// Handler functions (same as before, but with added error logging)
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

// Response helpers (unchanged)
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
