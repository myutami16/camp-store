import { revalidatePath, revalidateTag } from "next/cache.js";

export async function POST(request) {
	try {
		// ✅ Add proper error handling for JSON parsing
		let body;
		try {
			body = await request.json();
		} catch (jsonError) {
			console.error("❌ Invalid JSON in request body:", jsonError);
			return Response.json(
				{ success: false, error: "Invalid JSON in request body" },
				{ status: 400 }
			);
		}

		const { slug, category } = body;

		console.log("🔄 Revalidating with slug:", slug, "category:", category);

		// Revalidate paths
		revalidatePath("/produk");
		if (slug) revalidatePath(`/produk/${slug}`);

		// Revalidate tags
		if (slug) revalidateTag(`product-${slug}`);
		if (category) {
			revalidateTag(`category-${category.toLowerCase().replace(/\s+/g, "-")}`);
		}

		revalidateTag("products");
		revalidateTag("all-products");
		revalidateTag("filtered-products");
		revalidateTag("categories");

		console.log("✅ Revalidation completed successfully");
		return Response.json({ success: true });
	} catch (error) {
		console.error("❌ Error in revalidation route:", error);
		return Response.json(
			{ success: false, error: error.message },
			{
				status: 500,
				headers: {
					"Content-Type": "application/json", // ✅ Ensure JSON content type
				},
			}
		);
	}
}
