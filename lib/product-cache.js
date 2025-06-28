const callRevalidateAPI = async (tags = [], paths = []) => {
	try {
		// Build the revalidate URL - prioritize NEXTAUTH_URL for production
		let baseURL;

		if (process.env.NEXTAUTH_URL) {
			baseURL = process.env.NEXTAUTH_URL;
		} else if (process.env.VERCEL_URL) {
			// Ensure https protocol for Vercel URLs
			baseURL = process.env.VERCEL_URL.startsWith("http")
				? process.env.VERCEL_URL
				: `https://${process.env.VERCEL_URL}`;
		} else {
			baseURL = "http://localhost:3000";
		}

		const revalidateURL = `${baseURL}/api/revalidate`;

		console.log("🔄 Calling revalidate API:", revalidateURL);
		console.log("🔍 Environment:", process.env.NODE_ENV);

		// Use environment variable with fallback
		const token =
			process.env.REVALIDATE_SECRET_TOKEN || "adzracamp-revalidate-token-2025";

		const requestBody = {
			tags: tags.filter(Boolean),
			paths: paths.filter(Boolean),
		};

		console.log("🔍 Request body:", JSON.stringify(requestBody, null, 2));

		const headers = {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		};

		// Add retry logic with exponential backoff
		const maxRetries = 3;
		let lastError;

		for (let attempt = 1; attempt <= maxRetries; attempt++) {
			try {
				console.log(
					`🔄 Attempt ${attempt}/${maxRetries} - Calling revalidate API`
				);

				const controller = new AbortController();
				const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

				const response = await fetch(revalidateURL, {
					method: "POST",
					headers,
					body: JSON.stringify(requestBody),
					signal: controller.signal,
				});

				clearTimeout(timeoutId);

				console.log("🔍 Response status:", response.status);

				if (!response.ok) {
					const errorText = await response.text();
					console.log("❌ Response error text:", errorText);

					// If it's a server error and we have retries left, continue
					if (response.status >= 500 && attempt < maxRetries) {
						console.log(`⏳ Server error, retrying in ${attempt * 1000}ms...`);
						await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
						continue;
					}

					throw new Error(
						`Revalidate API responded with status: ${response.status} - ${errorText}`
					);
				}

				const result = await response.json();
				console.log("✅ Cache invalidation successful:", result);
				return result;
			} catch (error) {
				lastError = error;

				if (error.name === "AbortError") {
					console.log(`⏰ Timeout on attempt ${attempt}`);
				} else {
					console.log(`❌ Error on attempt ${attempt}:`, error.message);
				}

				// If this is the last attempt, break out of the loop
				if (attempt === maxRetries) {
					break;
				}

				// Wait before retrying (exponential backoff)
				const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
				console.log(`⏳ Waiting ${delay}ms before retry...`);
				await new Promise((resolve) => setTimeout(resolve, delay));
			}
		}

		// If we get here, all retries failed
		throw lastError;
	} catch (error) {
		console.error("❌ Error calling revalidate API after all retries:", error);
		console.error("❌ Error stack:", error.stack);

		// Don't throw error to prevent breaking the main operation
		return { success: false, error: error.message };
	}
};

/**
 * Safe wrapper for cache invalidation that doesn't throw errors
 */
const safeInvalidateCache = async (tags = [], paths = []) => {
	try {
		// Skip revalidation in development if not needed
		if (
			process.env.NODE_ENV === "development" &&
			!process.env.FORCE_REVALIDATE
		) {
			console.log("⏭️ Skipping revalidation in development mode");
			return { success: true, skipped: true };
		}

		const result = await callRevalidateAPI(tags, paths);
		return result;
	} catch (error) {
		console.error("❌ Safe invalidate cache error:", error);
		return { success: false, error: error.message };
	}
};

/**
 * Invalidate product-related cache tags
 * This function will trigger revalidation for all product-related cached data
 */
export const invalidateProductCache = async () => {
	const tags = [
		"products",
		"categories",
		"all-products",
		"filtered-products",
		"product-by-id",
		"product-by-slug",
		"search-products",
	];

	const paths = [
		"/produk",
		"/", // Homepage if it shows products
	];

	return await safeInvalidateCache(tags, paths);
};

/**
 * Invalidate product cache by ID or Slug
 * @param {string} identifier - product ID or slug
 */
export const invalidateProductByIdOrSlug = async (identifier) => {
	const tags = [
		`product-${identifier}`,
		"products",
		"all-products",
		"filtered-products",
		"product-by-id",
		"product-by-slug",
		"search-products",
	];

	const paths = [
		`/produk/${identifier}`, // jika ada halaman detail by slug
		"/produk",
		"/",
	];

	return await safeInvalidateCache(tags, paths);
};

/**
 * Invalidate category-specific cache
 * @param {string} category - The category to invalidate
 */
export const invalidateCategoryCache = async (category) => {
	const tags = [
		`category-${category}`,
		"categories",
		"products",
		"all-products",
		"filtered-products",
		"product-by-id",
		"product-by-slug",
		"search-products",
	];

	const paths = ["/produk", "/"];

	return await safeInvalidateCache(tags, paths);
};

/**
 * Invalidate search-related cache
 * Useful when products are updated and search results might change
 */
export const invalidateSearchCache = async () => {
	const tags = ["search-products", "filtered-products", "products"];

	const paths = ["/produk"];

	return await safeInvalidateCache(tags, paths);
};
