import mongoose from "mongoose";

const BannerSchema = new mongoose.Schema(
	{
		image: {
			type: String,
			required: true,
		},
		cloudinary_id: {
			type: String,
			required: true,
		},
		location: {
			type: String,
			enum: ["homepage", "productpage"],
			required: true,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
	},
	{ timestamps: true }
);

const Banner = mongoose.models.Banner || mongoose.model("Banner", BannerSchema);
export default Banner;
