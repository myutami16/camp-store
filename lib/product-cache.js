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
		console.log("🔍 NEXTAUTH_URL:", process.env.NEXTAUTH_URL);
		console.log("🔍 VERCEL_URL:", process.env.VERCEL_URL);

		// Use environment variable with fallback
		const token =
			process.env.REVALIDATE_SECRET_TOKEN || "adzracamp-revalidate-token-2025";
		console.log("🔍 Token available:", !!token);
		console.log("🔍 Token from env:", !!process.env.REVALIDATE_SECRET_TOKEN);

		const requestBody = {
			tags: tags.filter(Boolean),
			paths: paths.filter(Boolean),
		};

		console.log("🔍 Request body:", JSON.stringify(requestBody, null, 2));

		const headers = {
			"Content-Type": "application/json",
			Authorization: `Bearer ${token}`,
		};

		console.log("🔍 Request headers:", headers);

		const response = await fetch(revalidateURL, {
			method: "POST",
			headers,
			body: JSON.stringify(requestBody),
		});

		console.log("🔍 Response status:", response.status);
		console.log(
			"🔍 Response headers:",
			Object.fromEntries(response.headers.entries())
		);

		if (!response.ok) {
			const errorText = await response.text();
			console.log("❌ Response error text:", errorText);

			// Try to parse as JSON for better error info
			try {
				const errorJson = JSON.parse(errorText);
				console.log("❌ Response error JSON:", errorJson);
			} catch (e) {
				console.log("❌ Could not parse error as JSON");
			}

			throw new Error(
				`Revalidate API responded with status: ${response.status} - ${errorText}`
			);
		}

		const result = await response.json();
		console.log("✅ Cache invalidation successful:", result);
		return result;
	} catch (error) {
		console.error("❌ Error calling revalidate API:", error);
		console.error("❌ Error stack:", error.stack);
		// Don't throw error to prevent breaking the main operation
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

	return await callRevalidateAPI(tags, paths);
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

	return await callRevalidateAPI(tags, paths);
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

	return await callRevalidateAPI(tags, paths);
};

/**
 * Invalidate search-related cache
 * Useful when products are updated and search results might change
 */
export const invalidateSearchCache = async () => {
	const tags = ["search-products", "filtered-products", "products"];

	const paths = ["/produk"];

	return await callRevalidateAPI(tags, paths);
};
