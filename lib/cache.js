const callRevalidateAPI = async (tags = [], paths = []) => {
	try {
		// Build the revalidate URL
		const baseURL =
			process.env.NEXTAUTH_URL ||
			(process.env.VERCEL_URL
				? `https://${process.env.VERCEL_URL}`
				: "http://localhost:3000");

		const revalidateURL = `${baseURL}/api/revalidate`;

		console.log("🔄 Calling revalidate API:", revalidateURL);

		const response = await fetch(revalidateURL, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${
					process.env.REVALIDATE_SECRET_TOKEN || "your-secret-token"
				}`,
			},
			body: JSON.stringify({
				tags: tags.filter(Boolean), // Remove any falsy values
				paths: paths.filter(Boolean),
			}),
		});

		if (!response.ok) {
			throw new Error(
				`Revalidate API responded with status: ${response.status}`
			);
		}

		const result = await response.json();
		console.log("✅ Cache invalidation successful:", result);
		return result;
	} catch (error) {
		console.error("❌ Error calling revalidate API:", error);
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
 * Invalidate specific product cache by ID
 * @param {string} productId - The product ID to invalidate
 */
export const invalidateProductById = async (productId) => {
	const tags = [
		`product-${productId}`,
		"products",
		"all-products",
		"filtered-products",
		"product-by-id",
		"product-by-slug",
		"search-products",
	];

	const paths = [
		"/produk",
		`/produk/${productId}`, // If you have individual product pages
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
