import { connectDB } from "../../lib/db";

export default async function handler(req, res) {
	// Hanya izinkan metode GET untuk handler ini
	if (req.method !== "GET") {
		return res.status(405).json({ error: "Method Not Allowed" });
	}

	try {
		await connectDB();
		res.status(200).json({ message: "✅ MongoDB connected successfully!" });
	} catch (err) {
		res.status(500).json({ error: err.message });
	}
}
