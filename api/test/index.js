import { cloudinary } from "../../lib/cloudinary.js";

export default async function handler(req, res) {
	try {
		const result = await cloudinary.uploader.upload(
			"https://upload.wikimedia.org/wikipedia/commons/a/ae/Olympic_flag.jpg"
		);
		res.status(200).json({ message: "Upload sukses", url: result.secure_url });
	} catch (error) {
		res.status(500).json({ message: "Upload gagal", error: error.message });
	}
}
