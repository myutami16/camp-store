export async function revalidateViaRoute(slug, category) {
	try {
		// ✅ Add better URL validation
		const baseUrl = process.env.NEXTAUTH_URL || process.env.NEXT_PUBLIC_APP_URL;
		if (!baseUrl) {
			console.error(
				"❌ Missing NEXTAUTH_URL or NEXT_PUBLIC_APP_URL environment variable"
			);
			return { success: false, error: "Missing base URL configuration" };
		}

		const revalidateUrl = `${baseUrl}/api/revalidate`;
		console.log("🔄 Calling revalidate endpoint:", revalidateUrl);

		const res = await fetch(revalidateUrl, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ slug, category }),
		});

		// ✅ Check if response is actually JSON
		const contentType = res.headers.get("content-type");
		if (!contentType || !contentType.includes("application/json")) {
			const textResponse = await res.text();
			console.error(
				"❌ Non-JSON response from revalidate endpoint:",
				textResponse
			);
			throw new Error(
				`Expected JSON response but got: ${contentType}. Response: ${textResponse.substring(
					0,
					200
				)}...`
			);
		}

		const data = await res.json();
		if (!res.ok) {
			throw new Error(data.error || `HTTP ${res.status}: ${res.statusText}`);
		}

		console.log("✅ Revalidation triggered via route.ts");
		return { success: true };
	} catch (err) {
		console.error("❌ Error calling revalidate route:", err.message);
		// ✅ Don't throw error, just return failure result
		return { success: false, error: err.message };
	}
}
