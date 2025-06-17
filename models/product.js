import mongoose from "mongoose";
import slugify from "slugify";

const ProductSchema = new mongoose.Schema({
	namaProduk: {
		type: String,
		required: [true, "Nama produk wajib diisi"],
		trim: true,
	},
	slug: {
		type: String,
		unique: true,
		index: true,
	},
	deskripsi: {
		type: String,
		required: [true, "Deskripsi produk wajib diisi"],
		trim: true,
	},
	harga: {
		type: Number,
		required: [true, "Harga produk wajib diisi"],
		min: [0, "Harga tidak boleh negatif"],
	},
	stok: {
		type: Number,
		required: [true, "Stok produk wajib diisi"],
		min: [0, "Stok tidak boleh negatif"],
	},
	isForRent: {
		type: Boolean,
		default: false,
	},
	isForSale: {
		type: Boolean,
		default: true,
	},
	kategori: {
		type: String,
		required: [true, "Kategori produk wajib diisi"],
		enum: {
			values: [
				"Tenda Camping",
				"Matras & Sleeping Kit",
				"Sleeping Bag",
				"Carrier & Daypack",
				"Flysheet & Aksesorinya",
				"Meja & Kursi Lipat",
				"Peralatan Masak Outdoor & Grill Kit",
				"Trekking Pole",
				"Lampu & Penerangan Outdoor",
				"Pisau Lipat & Peralatan Survival",
				"Aksesori Tambahan",
				"Paket Komplit Camping",
				"Paket Komplit Adzra Camp",
				"Lain-lain",
			],
			message: "Kategori {VALUE} tidak tersedia",
		},
	},
	gambar: {
		type: String,
		required: [true, "URL gambar produk wajib diisi"],
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},

	cloudinary_id: {
		type: String,
	},
});

// Middleware slug otomatis
ProductSchema.pre("save", function (next) {
	if (this.isModified("namaProduk") || this.isNew) {
		const baseSlug = slugify(this.namaProduk, {
			lower: true,
			strict: true,
			locale: "id",
		});
		this.slug = `${baseSlug}-${Date.now().toString().slice(-6)}`;
	}

	if (!this.isForRent && !this.isForSale) {
		const error = new Error("Produk harus bisa disewa atau dijual");
		return next(error);
	}
	next();
});

// Validasi update
ProductSchema.pre("findOneAndUpdate", function (next) {
	const update = this.getUpdate();
	if (update.isForRent === false && update.isForSale === false) {
		const error = new Error("Produk harus bisa disewa atau dijual");
		return next(error);
	}
	next();
});

// Static methods
ProductSchema.statics.findByCategory = function (category) {
	return this.find({ kategori: category });
};

ProductSchema.statics.findByType = function (type) {
	if (type === "sewa") return this.find({ isForRent: true });
	if (type === "jual") return this.find({ isForSale: true });
	return this.find({});
};

const Product =
	mongoose.models.Product || mongoose.model("Product", ProductSchema);

export default Product;
