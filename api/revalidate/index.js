import { revalidatePath, revalidateTag } from "next/cache.js";

export default async function handler(req, res) {
	if (req.method !== "POST") {
		console.log("❌ Method not allowed:", req.method);
		return res
			.status(405)
			.json({ success: false, message: "Method not allowed" });
	}

	// Enhanced debug logging
	console.log("🔍 Revalidate API called");
	console.log("🔍 Headers received:", req.headers);
	console.log("🔍 Authorization header:", req.headers.authorization);
	console.log("🔍 Environment vars check:");
	console.log("🔍 - NODE_ENV:", process.env.NODE_ENV);
	console.log(
		"🔍 - REVALIDATE_SECRET_TOKEN exists:",
		!!process.env.REVALIDATE_SECRET_TOKEN
	);
	console.log(
		"🔍 - REVALIDATE_SECRET_TOKEN value:",
		process.env.REVALIDATE_SECRET_TOKEN
	);

	const authHeader = req.headers.authorization;
	const token = authHeader?.split(" ")[1];

	console.log("🔍 Extracted token:", token);
	console.log("🔍 Expected token:", process.env.REVALIDATE_SECRET_TOKEN);

	// Use environment variable with fallback for development
	const expectedToken =
		process.env.REVALIDATE_SECRET_TOKEN || "adzracamp-revalidate-token-2025";

	if (!token) {
		console.log("❌ No token provided");
		return res.status(401).json({
			success: false,
			message: "No token provided",
			debug: { authHeader, extractedToken: token },
		});
	}

	if (token !== expectedToken) {
		console.log("❌ Token mismatch!");
		console.log("❌ Received token:", token);
		console.log("❌ Expected token:", expectedToken);
		console.log(
			"❌ Token length - received:",
			token?.length,
			"expected:",
			expectedToken?.length
		);
		console.log("❌ Token comparison:", token === expectedToken);

		return res.status(401).json({
			success: false,
			message: "Unauthorized - Invalid token",
			debug: {
				receivedToken: token,
				expectedToken: expectedToken,
				tokenMatch: token === expectedToken,
			},
		});
	}

	try {
		const { tags = [], paths = [] } = req.body;

		console.log("✅ Token validated successfully");
		console.log("🔍 Request body:", { tags, paths });

		// Revalidate tags
		for (const tag of tags) {
			console.log(`🔁 Revalidating tag: ${tag}`);
			try {
				revalidateTag(tag);
				console.log(`✅ Tag revalidated: ${tag}`);
			} catch (tagError) {
				console.error(`❌ Error revalidating tag ${tag}:`, tagError);
			}
		}

		// Revalidate paths
		for (const path of paths) {
			console.log(`🔁 Revalidating path: ${path}`);
			try {
				revalidatePath(path);
				console.log(`✅ Path revalidated: ${path}`);
			} catch (pathError) {
				console.error(`❌ Error revalidating path ${path}:`, pathError);
			}
		}

		console.log("✅ Revalidation completed successfully");
		return res.status(200).json({
			success: true,
			message: "Revalidation triggered",
			revalidated: { tags, paths },
		});
	} catch (error) {
		console.error("❌ Error during revalidation:", error);
		console.error("❌ Error stack:", error.stack);
		return res.status(500).json({
			success: false,
			message: error.message,
			error: process.env.NODE_ENV === "development" ? error.stack : undefined,
		});
	}
}
