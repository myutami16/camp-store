import mongoose from "mongoose";
import slugify from "slugify";

const ContentSchema = new mongoose.Schema(
	{
		title: {
			type: String,
			required: [true, "Judul konten harus diisi"],
			trim: true,
			maxlength: [100, "Judul tidak boleh lebih dari 100 karakter"],
		},
		slug: {
			type: String,
			unique: true,
			index: true,
		},
		description: {
			type: String,
			required: [true, "Deskripsi konten harus diisi"],
			maxlength: [5000, "Deskripsi tidak boleh lebih dari 5000 karakter"],
		},
		summary: {
			type: String,
			maxlength: [300, "Ringkasan tidak boleh lebih dari 300 karakter"],
		},
		contentType: {
			type: String,
			required: [true, "Tipe konten harus diisi"],
			enum: {
				values: ["blog", "promo", "event", "announcement"],
				message: "Tipe konten harus blog, promo, event, atau announcement",
			},
		},
		image: {
			type: String,
			required: [true, "Gambar konten harus diisi"],
		},
		cloudinary_id: {
			type: String,
			required: true,
		},
		publishDate: {
			type: Date,
			default: Date.now,
		},
		expiryDate: {
			type: Date,
		},
		isActive: {
			type: Boolean,
			default: true,
		},
		tags: [
			{
				type: String,
				trim: true,
			},
		],
		author: {
			type: mongoose.Schema.Types.ObjectId,
			ref: "Admin",
			required: true,
		},
	},
	{
		timestamps: true,
	}
);

// Create slug from title before saving
ContentSchema.pre("save", function (next) {
	if (this.isModified("title") || this.isNew) {
		let baseSlug = slugify(this.title, {
			lower: true,
			strict: true,
			locale: "id",
		});

		this.slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;
	}
	next();
});

// Virtual for formatted dates
ContentSchema.virtual("formattedPublishDate").get(function () {
	return this.publishDate.toLocaleDateString("id-ID", {
		year: "numeric",
		month: "long",
		day: "numeric",
	});
});

// Instance methods
ContentSchema.methods.isExpired = function () {
	if (!this.expiryDate) return false;
	return new Date() > this.expiryDate;
};

// Static methods for querying
ContentSchema.statics.findActiveByType = async function (contentType) {
	return this.find({
		contentType,
		isActive: true,
		$or: [{ expiryDate: { $gt: new Date() } }, { expiryDate: null }],
	}).sort({ publishDate: -1 });
};

ContentSchema.statics.findBySlug = async function (slug) {
	return this.findOne({ slug, isActive: true }).populate("author", "username");
};

const Content =
	mongoose.models.Content || mongoose.model("Content", ContentSchema);

export default Content;
