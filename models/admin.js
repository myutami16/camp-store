import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

const AdminSchema = new mongoose.Schema({
	username: {
		type: String,
		required: [true, "Username wajib diisi"],
		unique: true,
		trim: true,
		minlength: [6, "Username minimal 6 karakter"],
	},
	password: {
		type: String,
		required: [true, "Password wajib diisi"],
		minlength: [8, "Password minimal 8 karakter"],
		select: false,
	},
	name: {
		type: String,
		required: [true, "Nama wajib diisi"],
	},
	role: {
		type: String,
		enum: ["super-admin", "admin", "editor"],
		default: "admin",
	},
	createdAt: {
		type: Date,
		default: Date.now,
	},
	lastLogin: {
		type: Date,
		default: null,
	},
});

// Password hashing middleware
AdminSchema.pre("save", async function (next) {
	if (!this.isModified("password")) return next();

	try {
		const salt = await bcrypt.genSalt(10);
		this.password = await bcrypt.hash(this.password, salt);
		next();
	} catch (error) {
		next(error);
	}
});

// Instance methods
AdminSchema.methods = {
	async matchPassword(enteredPassword) {
		return await bcrypt.compare(enteredPassword, this.password);
	},

	generateAuthToken() {
		return jwt.sign(
			{ id: this._id, username: this.username, role: this.role },
			process.env.JWT_SECRET,
			{ expiresIn: process.env.JWT_EXPIRES }
		);
	},
};

AdminSchema.statics = {
	findByRole(role) {
		return this.find({ role });
	},
};

export default mongoose.models.Admin || mongoose.model("Admin", AdminSchema);
