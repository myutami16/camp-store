export async function revalidateViaRoute(slug, category) {
	try {
		const res = await fetch(`${process.env.NEXTAUTH_URL}/api/revalidate`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
			},
			body: JSON.stringify({ slug, category }),
		});

		const data = await res.json();
		if (!res.ok) throw new Error(data.error || "Unknown error");

		console.log("✅ Revalidation triggered via route.ts");
		return { success: true };
	} catch (err) {
		console.error("❌ Error calling revalidate route:", err);
		return { success: false, error: err.message };
	}
}
