import multer from "multer";

export const config = {
	api: {
		bodyParser: false,
	},
};

const upload = multer({ storage: multer.memoryStorage() });

export default async function handler(req, res) {
	return upload.single("gambar")(req, res, function (err) {
		if (err) {
			console.error("❌ Multer error:", err);
			return res.status(400).json({ success: false, message: err.message });
		}

		console.log("📦 File:", req.file);
		console.log("📝 Body:", req.body);

		return res.status(200).json({
			success: true,
			message: "Upload berhasil",
			filename: req.file?.originalname,
		});
	});
}
