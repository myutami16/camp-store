// api/revalidate.js - Pages Router API Route
export default async function handler(req, res) {
	try {
		// Only allow POST requests
		if (req.method !== "POST") {
			return res.status(405).json({
				success: false,
				error: "Method not allowed",
			});
		}

		// ✅ Add proper error handling for JSON parsing
		let body;
		try {
			body = req.body;
		} catch (jsonError) {
			console.error("❌ Invalid JSON in request body:", jsonError);
			return res.status(400).json({
				success: false,
				error: "Invalid JSON in request body",
			});
		}

		const { slug, category } = body;

		console.log("🔄 Revalidating with slug:", slug, "category:", category);

		// ✅ Pages Router: Trigger fresh fetch for cached pages
		const pathsToRevalidate = [
			"/produk", // Main products page
		];

		// Add specific product page if slug exists
		if (slug) {
			pathsToRevalidate.push(`/produk/${slug}`);
		}

		// ✅ Make HEAD requests to trigger ISR revalidation
		const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;

		for (const path of pathsToRevalidate) {
			try {
				const fullUrl = `${baseUrl}${path}`;
				const response = await fetch(fullUrl, {
					method: "HEAD",
					headers: {
						"Cache-Control": "no-cache",
						Pragma: "no-cache",
					},
				});
				console.log(
					`✅ Triggered ISR revalidation for: ${path} (${response.status})`
				);
			} catch (err) {
				console.error(`❌ Failed to trigger revalidation for ${path}:`, err);
				// Continue with other paths even if one fails
			}
		}

		console.log("✅ Revalidation process completed successfully");
		return res.status(200).json({ success: true });
	} catch (error) {
		console.error("❌ Error in revalidation route:", error);
		return res.status(500).json({
			success: false,
			error: error.message,
		});
	}
}
