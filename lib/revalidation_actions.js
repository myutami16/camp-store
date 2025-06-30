// lib/revalidation-actions.ts
"use server";

import { revalidatePath, revalidateTag } from "next/cache.js";

export async function revalidateProducts() {
	try {
		// Revalidate products listing page
		revalidatePath("/produk");

		// Revalidate all product detail pages dynamically
		revalidatePath("/produk/[slug]", "page");

		// Revalidate specific tags
		revalidateTag("products");
		revalidateTag("all-products");
		revalidateTag("filtered-products");
		revalidateTag("categories");

		console.log("✅ Products revalidated successfully");
		return { success: true };
	} catch (error) {
		console.error("❌ Error revalidating products:", error);
		return { success: false, error: error.message };
	}
}

export async function revalidateProductBySlug(slug: string) {
	try {
		// Revalidate specific product detail page
		revalidatePath(`/produk/${slug}`);

		// Revalidate product-specific tags
		revalidateTag(`product-${slug}`);
		revalidateTag("product-by-slug");
		revalidateTag("product-detail");

		console.log(`✅ Product ${slug} revalidated successfully`);
		return { success: true };
	} catch (error) {
		console.error(`❌ Error revalidating product ${slug}:`, error);
		return { success: false, error: error.message };
	}
}

export async function revalidateProductById(productId: string, slug?: string) {
	try {
		// Revalidate products listing
		revalidatePath("/produk");

		// If slug is provided, revalidate specific product page
		if (slug) {
			revalidatePath(`/produk/${slug}`);
			revalidateTag(`product-${slug}`);
		}

		// Revalidate product-specific tags
		revalidateTag(`product-id-${productId}`);
		revalidateTag("product-by-id");
		revalidateTag("product-detail");
		revalidateTag("products");

		console.log(`✅ Product ID ${productId} revalidated successfully`);
		return { success: true };
	} catch (error) {
		console.error(`❌ Error revalidating product ID ${productId}:`, error);
		return { success: false, error: error.message };
	}
}

export async function revalidateCategories() {
	try {
		// Revalidate categories
		revalidateTag("categories");

		console.log("✅ Categories revalidated successfully");
		return { success: true };
	} catch (error) {
		console.error("❌ Error revalidating categories:", error);
		return { success: false, error: error.message };
	}
}

// Utility function to revalidate all product-related pages
export async function revalidateAllProducts() {
	try {
		// Revalidate main products page
		revalidatePath("/produk");

		// Revalidate all dynamic product pages
		revalidatePath("/produk/[slug]", "page");

		// Revalidate all product-related tags
		revalidateTag("products");
		revalidateTag("all-products");
		revalidateTag("filtered-products");
		revalidateTag("categories");
		revalidateTag("product-by-slug");
		revalidateTag("product-by-id");
		revalidateTag("product-detail");

		console.log("✅ All products revalidated successfully");
		return { success: true };
	} catch (error) {
		console.error("❌ Error revalidating all products:", error);
		return { success: false, error: error.message };
	}
}
