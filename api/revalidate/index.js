import { revalidatePath, revalidateTag } from "next/cache.js";

export default async function handler(req, res) {
	if (req.method !== "POST") {
		return res
			.status(405)
			.json({ success: false, message: "Method not allowed" });
	}

	// Debug logging
	console.log("🔍 Headers received:", req.headers.authorization);
	console.log("🔍 Expected token:", "adzracamp-revalidate-token-2025");

	const authHeader = req.headers.authorization;
	const token = authHeader?.split(" ")[1];

	console.log("🔍 Extracted token:", token);

	if (token !== "adzracamp-revalidate-token-2025") {
		console.log("❌ Token mismatch!");
		console.log("❌ Received token full:", token);
		console.log("❌ Expected token full:", "adzracamp-revalidate-token-2025");
		return res.status(401).json({ success: false, message: "Unauthorized" });
	}

	try {
		const { tags = [], paths = [] } = req.body;

		for (const tag of tags) {
			console.log(`🔁 Revalidating tag: ${tag}`);
			revalidateTag(tag);
		}

		for (const path of paths) {
			console.log(`🔁 Revalidating path: ${path}`);
			revalidatePath(path);
		}

		return res
			.status(200)
			.json({ success: true, message: "Revalidation triggered" });
	} catch (error) {
		console.error("❌ Error during revalidation:", error);
		return res.status(500).json({ success: false, message: error.message });
	}
}
