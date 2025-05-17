import connectDB from "../../../lib/db.js";
import Admin from "../../../models/admin.js";

// Validate login input parameters
const validateLoginInput = (username, password) => {
	const errors = {};

	if (!username) errors.username = "Username wajib diisi";
	else if (username.length < 6) errors.username = "Username minimal 6 karakter";

	if (!password) errors.password = "Password wajib diisi";
	else if (password.length < 8) errors.password = "Password minimal 8 karakter";

	return { errors, isValid: Object.keys(errors).length === 0 };
};

// Format admin response to avoid sending sensitive data
const formatAdminResponse = (admin) => ({
	id: admin._id,
	username: admin.username,
	name: admin.name,
	role: admin.role,
});

export default async function handler(req, res) {
	res.setHeader("Access-Control-Allow-Credentials", true);
	res.setHeader("Access-Control-Allow-Origin", "*");
	res.setHeader("Access-Control-Allow-Methods", "POST,OPTIONS");
	res.setHeader(
		"Access-Control-Allow-Headers",
		"X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization"
	);

	if (req.method === "OPTIONS") {
		return res.status(200).end();
	}

	if (req.method !== "POST") {
		res.setHeader("Allow", ["POST", "OPTIONS"]);
		return res.status(405).json({
			success: false,
			message: `Method ${req.method} tidak diizinkan`,
		});
	}

	try {
		await connectDB();

		const { username, password } = req.body;
		console.log("Login attempt for:", username);

		const { errors, isValid } = validateLoginInput(username, password);
		if (!isValid) {
			return res.status(400).json({
				success: false,
				errors,
			});
		}

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
		console.log("Generated token for:", admin.username);

		return res.status(200).json({
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
