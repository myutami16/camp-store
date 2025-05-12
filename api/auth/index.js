import connectDB from "../../lib/db.js";
import Admin from "../../models/admin.js";
import { authMiddleware } from "../../lib/auth.js"; // Now this works as expected

const validateLoginInput = (username, password) => {
	const errors = {};

	if (!username) errors.username = "Username wajib diisi";
	else if (username.length < 6) errors.username = "Username minimal 6 karakter";

	if (!password) errors.password = "Password wajib diisi";
	else if (password.length < 8) errors.password = "Password minimal 8 karakter";

	return { errors, isValid: Object.keys(errors).length === 0 };
};

const formatAdminResponse = (admin) => ({
	id: admin._id,
	username: admin.username,
	name: admin.name,
	role: admin.role,
});

export default async function handler(req, res) {
	// Handle CORS preflight
	if (req.method === "OPTIONS") {
		return res.status(200).end();
	}

	try {
		await connectDB();

		switch (req.method) {
			case "POST":
				return await handleLogin(req, res);
			case "GET":
				return await handleGetAdmin(req, res);
			default:
				res.setHeader("Allow", ["POST", "GET", "OPTIONS"]);
				return res.status(405).json({
					success: false,
					message: `Method ${req.method} tidak diizinkan`,
				});
		}
	} catch (error) {
		console.error("Server error:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan pada server",
		});
	}
}

async function handleLogin(req, res) {
	try {
		const { username, password } = req.body;
		console.log("Login attempt for:", username); // Debug log

		const { errors, isValid } = validateLoginInput(username, password);
		if (!isValid) return res.status(400).json({ success: false, errors });

		const admin = await Admin.findOne({ username }).select("+password");
		if (!admin || !(await admin.matchPassword(password))) {
			return res.status(401).json({
				success: false,
				message: "Username atau password salah",
			});
		}

		admin.lastLogin = new Date();
		await admin.save();

		const token = admin.generateAuthToken();
		console.log("Generated token for:", admin.username); // Debug log

		return res.json({
			success: true,
			token,
			admin: formatAdminResponse(admin),
		});
	} catch (error) {
		console.error("Login error:", error);
		return res.status(500).json({
			success: false,
			message: "Terjadi kesalahan saat login",
		});
	}
}

async function handleGetAdmin(req, res) {
	try {
		console.log("Authorization header:", req.headers.authorization); // Debug log

		// Panggil authMiddleware dari imported module
		const verified = await authMiddleware(req, res);
		if (!verified) return; // Jika autentikasi gagal, respons sudah dikirim

		const admin = await Admin.findById(req.admin.id);
		if (!admin) {
			return res.status(404).json({
				success: false,
				message: "Admin tidak ditemukan",
			});
		}

		return res.json({
			success: true,
			admin: formatAdminResponse(admin),
		});
	} catch (error) {
		console.error("Auth verification error:", error);
		return res.status(500).json({
			success: false,
			message: "Gagal memverifikasi token",
		});
	}
}
