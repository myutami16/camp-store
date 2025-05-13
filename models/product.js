import mongoose from "mongoose";

const ProductSchema = new mongoose.Schema({
	namaProduk: {
		type: String,
		required: [true, "Nama produk wajib diisi"],
		trim: true,
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
				"Tenda",
				"Sleeping Bag",
				"Cooking Set",
				"Peralatan Penerangan",
				"Aksesoris",
				"Perlengkapan Keselamatan",
				"Lainnya",
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
	// Tambahkan cloudinary_id untuk memudahkan penghapusan gambar dari Cloudinary
	cloudinary_id: {
		type: String,
	},
});

// Middleware untuk validasi isForRent dan isForSale
ProductSchema.pre("save", function (next) {
	if (!this.isForRent && !this.isForSale) {
		const error = new Error("Produk harus bisa disewa atau dijual");
		return next(error);
	}
	next();
});

// Middleware untuk validasi update
ProductSchema.pre("findOneAndUpdate", function (next) {
	const update = this.getUpdate();

	// Hanya lakukan validasi jika kedua field diubah
	if (update.isForRent === false && update.isForSale === false) {
		const error = new Error("Produk harus bisa disewa atau dijual");
		return next(error);
	}
	next();
});

// Method untuk mencari produk berdasarkan kategori
ProductSchema.statics.findByCategory = function (category) {
	return this.find({ kategori: category });
};

// Method untuk mencari produk berdasarkan type (sewa/jual)
ProductSchema.statics.findByType = function (type) {
	if (type === "sewa") {
		return this.find({ isForRent: true });
	} else if (type === "jual") {
		return this.find({ isForSale: true });
	}
	return this.find({});
};

// Check if the model exists before creating a new one
// This is important for hot reloading in development
const Product =
	mongoose.models.Product || mongoose.model("Product", ProductSchema);

export default Product;
