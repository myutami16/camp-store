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

	const authHeader = req.headers.authorization;
	const token = authHeader?.split(" ")[1];

	console.log("🔍 Extracted token:", token);

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
		return res.status(401).json({
			success: false,
			message: "Unauthorized - Invalid token",
		});
	}

	try {
		const { tags = [], paths = [] } = req.body;

		console.log("✅ Token validated successfully");
		console.log("🔍 Request body:", { tags, paths });

		const results = {
			tags: { success: [], failed: [] },
			paths: { success: [], failed: [] },
		};

		// Revalidate tags with individual error handling
		for (const tag of tags) {
			console.log(`🔁 Revalidating tag: ${tag}`);
			try {
				// Add delay to prevent race conditions
				await new Promise((resolve) => setTimeout(resolve, 100));

				// Wrap in try-catch to handle individual failures
				await Promise.resolve(revalidateTag(tag));
				console.log(`✅ Tag revalidated: ${tag}`);
				results.tags.success.push(tag);
			} catch (tagError) {
				console.error(`❌ Error revalidating tag ${tag}:`, tagError.message);
				results.tags.failed.push({ tag, error: tagError.message });
				// Continue with other tags instead of failing completely
			}
		}

		// Revalidate paths with individual error handling
		for (const path of paths) {
			console.log(`🔁 Revalidating path: ${path}`);
			try {
				// Add delay to prevent race conditions
				await new Promise((resolve) => setTimeout(resolve, 100));

				// Wrap in try-catch to handle individual failures
				await Promise.resolve(revalidatePath(path));
				console.log(`✅ Path revalidated: ${path}`);
				results.paths.success.push(path);
			} catch (pathError) {
				console.error(`❌ Error revalidating path ${path}:`, pathError.message);
				results.paths.failed.push({ path, error: pathError.message });
				// Continue with other paths instead of failing completely
			}
		}

		// Check if any revalidation succeeded
		const hasSuccess =
			results.tags.success.length > 0 || results.paths.success.length > 0;
		const hasFailures =
			results.tags.failed.length > 0 || results.paths.failed.length > 0;

		let status = 200;
		let message = "Revalidation completed";

		if (hasFailures && !hasSuccess) {
			status = 500;
			message = "All revalidations failed";
		} else if (hasFailures && hasSuccess) {
			status = 207; // Multi-status
			message = "Partial revalidation success";
		}

		console.log("✅ Revalidation process completed");
		return res.status(status).json({
			success: hasSuccess,
			message,
			results,
			revalidated: {
				tags: results.tags.success,
				paths: results.paths.success,
			},
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
