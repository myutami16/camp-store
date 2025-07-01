// app/api/revalidate/route.js
import { revalidatePath, revalidateTag } from "next/cache";

export async function POST(request) {
	const { slug, category } = await request.json();

	try {
		revalidatePath("/produk");
		if (slug) revalidatePath(`/produk/${slug}`);
		if (slug) revalidateTag(`product-${slug}`);
		if (category)
			revalidateTag(`category-${category.toLowerCase().replace(/\s+/g, "-")}`);

		revalidateTag("products");
		revalidateTag("all-products");
		revalidateTag("filtered-products");
		revalidateTag("categories");

		return Response.json({ success: true });
	} catch (error) {
		console.error("Error in revalidation route:", error);
		return Response.json(
			{ success: false, error: error.message },
			{ status: 500 }
		);
	}
}
