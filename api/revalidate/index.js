import { revalidatePath, revalidateTag } from "next/cache";

export async function POST(req) {
	const authHeader = req.headers.get("authorization");
	const token = authHeader?.split(" ")[1];

	if (token !== process.env.REVALIDATE_SECRET_TOKEN) {
		return new Response(
			JSON.stringify({ success: false, message: "Unauthorized" }),
			{ status: 401 }
		);
	}

	try {
		const { tags = [], paths = [] } = await req.json();

		for (const tag of tags) {
			console.log(`🔁 Revalidating tag: ${tag}`);
			revalidateTag(tag);
		}

		for (const path of paths) {
			console.log(`🔁 Revalidating path: ${path}`);
			revalidatePath(path);
		}

		return new Response(
			JSON.stringify({ success: true, message: "Revalidation triggered" }),
			{ status: 200 }
		);
	} catch (error) {
		console.error("❌ Error during revalidation:", error);
		return new Response(
			JSON.stringify({ success: false, message: error.message }),
			{ status: 500 }
		);
	}
}
