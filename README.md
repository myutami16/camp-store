# API Documentation

# Overview

This document provides details on the available API endpoints for the application, including authentication, admin management, products, and content.

# Base URL

```
https://your-api-domain.com
```

# Authentication

# Login

Authenticate as an admin user and receive an authentication token.

- URL: `/api/auth/login`
- Method: `POST`
- Access: Admin
- Authentication: Not required
- Request Body:
  ```json
  {
  	"username": "admin123",
  	"password": "secure_password"
  }
  ```
- Response:
  ```json
  {
  	"status": "success",
  	"message": "Login successful",
  	"data": {
  		"token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  		"user": {
  			"id": 1,
  			"name": "Admin User",
  			"username": "admin123",
  			"role": "admin"
  		}
  	}
  }
  ```

# Verify Token

Verify if the current token is valid.

- URL: `/api/auth/verify`
- Method: `GET`
- Access: Admin
- Authentication: Required (Bearer token)
- Response:
  ```json
  {
  	"status": "success",
  	"message": "Token is valid",
  	"data": {
  		"user": {
  			"id": 1,
  			"name": "Admin User",
  			"username": "admin123",
  			"role": "admin"
  		}
  	}
  }
  ```

# Logout

End the current admin session.

- URL: `/api/auth/logout`
- Method: `POST`
- Access: Admin
- Authentication: Required (Bearer token)
- Request Body:
  ```json
  {
  	"action": "logout"
  }
  ```
- Response:
  ```json
  {
  	"status": "success",
  	"message": "Logged out successfully"
  }
  ```

# Admin Dashboard

# Get Statistics

Get dashboard statistics (admin only, super-admin for all stats).

- URL: `/api/admin/stats`
- Method: `GET`
- Access: Admin
- Authentication: Required (Bearer token)
- Response:
  ```json
  {
  	"status": "success",
  	"data": {
  		"productCount": 120,
  		"contentCount": 45,
  		"userCount": 15 // Only for super-admin
  	}
  }
  ```

# Admin Management (Super-Admin Only)

# Create Admin

Create a new admin user.

- URL: `/api/admin`
- Method: `POST`
- Access: Super-Admin
- Authentication: Required (Bearer token)
- Request Body:
  ```json
  {
  	"username": "admin1234",
  	"password": "secure_password",
  	"name": "Second Admin",
  	"role": "admin" // 'admin' or 'super-admin'
  }
  ```
- Response:
  ```json
  {
  	"status": "success",
  	"message": "Admin created successfully",
  	"data": {
  		"id": 2,
  		"name": "Second Admin",
  		"username": "admin1234",
  		"role": "admin"
  	}
  }
  ```

# List All Admins

Get a list of all admin users.

- URL: `/api/admin`
- Method: `GET`
- Access: Super-Admin
- Authentication: Required (Bearer token)
- Response:
  ```json
  {
  	"status": "success",
  	"data": [
  		{
  			"id": 1,
  			"name": "Super Admin",
  			"username": "superadmin",
  			"role": "super-admin"
  		},
  		{
  			"id": 2,
  			"name": "Admin User",
  			"username": "admine1234",
  			"role": "admin"
  		}
  	]
  }
  ```

# Get Admin Details

Get details for a specific admin by ID.

- URL: `/api/admin?id={id}`
- Method: `GET`
- Access: Super-Admin
- Authentication: Required (Bearer token)
- Response:
  ```json
  {
  	"status": "success",
  	"data": {
  		"id": 2,
  		"name": "Admin User",
  		"username": "admin1234",
  		"role": "admin",
  		"createdAt": "2023-07-15T14:30:00Z",
  		"updatedAt": "2023-08-01T10:15:22Z"
  	}
  }
  ```

# Update Admin

Update an existing admin user.

- URL: `/api/admin?id={id}`
- Method: `PUT`
- Access: Super-Admin
- Authentication: Required (Bearer token)
- Request Body:
  ```json
  {
  	"name": "Updated Admin Name",
  	"username": "updatedemail",
  	"role": "admin"
  }
  ```
- Response:
  ```json
  {
  	"status": "success",
  	"message": "Admin updated successfully",
  	"data": {
  		"id": 2,
  		"name": "Updated Admin Name",
  		"username": "updatedemail",
  		"role": "admin"
  	}
  }
  ```

# Delete Admin

Remove an admin user.

- URL: `/api/admin?id={id}`
- Method: `DELETE`
- Access: Super-Admin
- Authentication: Required (Bearer token)
- Response:
  ```json
  {
  	"status": "success",
  	"message": "Admin deleted successfully"
  }
  ```

# Product Management

# Create Product

Create a new product (admin only).

- URL: `/api/admin/produk`
- Method: `POST`
- Access: Admin
- Authentication: Required (Bearer token)
- Request Body (multipart/form-data):
  ```
  namaProduk: "Product Name"
  deskripsi: "Product description with details"
  harga: 150000
  stok: 25
  isForRent : false
  isForSale : true
  kategori: "Lampu"
  gambar: file1 //max 5 mb
  ```
- Response:
  ```json
  {
    "status": "success",
    "message": "Product created successfully",
    "data": {
      "id": 101,
      "namaProduk": "Product Name",
      "slug": "product-name",
      "deskripsi": "Product description with details",
      "harga": 150000,
      "stok": 25,
      "isForRent" : false
      "isForSale" : true
      "kategori": "Lampu",
      "gambar": "urlImages",
      "specifications": {...},
      "createdAt": "2023-09-10T08:15:30Z"
    }
  }
  ```

# Get All Products

List all products (public access).

- URL: `/api/products`
- Method: `GET`
- Access: Public
- Authentication: Not required
- Query Parameters:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
  - `sort`: Sorting criterion (e.g., `price_asc`, `price_desc`, `newest`, `oldest`)
- Response:
  ```json
  {
  	"status": "success",
  	"data": {
  		"products": [
  			{
  				"id": 101,
  				"name": "Product Name",
  				"slug": "product-name",
  				"price": 150000,
  				"category": "Peralatan penerangan",
  				"thumbnailImage": "url"
  			}
  			// More products...
  		],
  		"pagination": {
  			"currentPage": 1,
  			"totalPages": 12,
  			"totalItems": 120,
  			"itemsPerPage": 10
  		}
  	}
  }
  ```

# Get Product by ID

Get details for a specific product by ID (public access).

- URL: `/api/products?id={id}`
- Method: `GET`
- Access: Public
- Authentication: Not required
- Response:
  ```json
  {
    "status": "success",
    "data": {
      "id": 101,
      "name": "Product Name",
      "slug": "product-name",
      "description": "Product description with details",
      "price": 150000,
      "stock": 25,
      "category": "Peralatan penerangan",
      "images": ["url1", "url2"],
      "specifications": {...},
      "createdAt": "2023-09-10T08:15:30Z"
    }
  }
  ```

# Get Product by Slug

Get details for a specific product by slug (public access).

- URL: `/api/products?slug={slug}`
- Method: `GET`
- Access: Public
- Authentication: Not required
- Response: Same as Get Product by ID

# Get Product Categories

Get all product categories (public access).

- URL: `/api/products?path=categories`
- Method: `GET`
- Access: Public
- Authentication: Not required
- Response:
  ```json
  {
  	"status": "success",
  	"data": [
  		"Peralatan penerangan",
  		"Peralatan listrik",
  		"Peralatan elektronik"
  		// More categories...
  	]
  }
  ```

# Search Products

Search for products by keyword (public access).

- URL: `/api/products?search?q={query}`
- Method: `GET`
- Access: Public
- Authentication: Not required
- Response:
  ```json
  {
  	"status": "success",
  	"data": {
  		"products": [
  			// Matching products
  		],
  		"pagination": {
  			"currentPage": 1,
  			"totalPages": 3,
  			"totalItems": 25,
  			"itemsPerPage": 10
  		}
  	}
  }
  ```

# Filter and Paginate Products

Get products with filtering and pagination (public access).

- URL: `/api/products?page=1&limit=4&kategori=Peralatan penerangan&sort=price_asc&q=besar`
- Method: `GET`
- Access: Public
- Authentication: Not required
- Query Parameters:
  - `page`: Page number
  - `limit`: Items per page
  - `kategori`: Filter by category
  - `sort`: Sorting criterion
  - `q`: Search query
- Response: Similar to Get All Products

# Update Product

Update an existing product (admin only).

- URL: `/api/admin/produk?id={id}`
- Method: `PUT`
- Access: Admin
- Authentication: Required (Bearer token)
- Request Body (multipart/form-data):
  ```
  namaProduk: "Updated Product Name"
  deskripsi: "Updated description"
  harga: 180000
  stok: 20
  kategori: "Peralatan penerangan"
  gambar: file1  // Optional, new images
  specifications: JSON string of updated specs
  ```
- Response:
  ```json
  {
  	"status": "success",
  	"message": "Product updated successfully",
  	"data": {
  		"id": 101,
  		"namaProduk": "Updated Product Name"
  		// Other updated fields...
  	}
  }
  ```

# Delete Product

Remove a product (admin only).

- URL: `/api/admin/produk?id={id}`
- Method: `DELETE`
- Access: Admin
- Authentication: Required (Bearer token)
- Response:
  ```json
  {
  	"status": "success",
  	"message": "Product deleted successfully"
  }
  ```

# Content Management

# Create Content

Create new content (admin only).

- URL: `/api/admin/konten`
- Method: `POST`
- Access: Admin
- Authentication: Required (Bearer token)
- Request Body (multipart/form-data):
  ```
  title: "Content Title"
  description: "Content body in HTML or markdown"
  image : file  // Image file
  contentType: "article"  // Type of content (article, news, etc.)
  isActive : true
  expiryDate : 2025-06-30T23:59:00
  tags: ["tag1", "tag2"]  // Optional tags
  ```
- Response:
  ```json
  {
  	"status": "success",
  	"message": "Content created successfully",
  	"data": {
  		"id": 45,
  		"title": "Content Title",
  		"slug": "content-title",
  		"body": "Content body...",
  		"thumbnailUrl": "url",
  		"contentType": "article",
  		"tags": ["tag1", "tag2"],
  		"createdAt": "2023-09-12T14:20:15Z"
  	}
  }
  ```

# Get All Content

List all content (public access).

- URL: `/api/content`
- Method: `GET`
- Access: Public
- Authentication: Not required
- Query Parameters:
  - `page`: Page number (default: 1)
  - `limit`: Items per page (default: 10)
- Response:
  ```json
  {
  	"status": "success",
  	"data": {
  		"content": [
  			{
  				"id": 45,
  				"title": "Content Title",
  				"slug": "content-title",
  				"thumbnailUrl": "url",
  				"contentType": "article",
  				"createdAt": "2023-09-12T14:20:15Z"
  			}
  			// More content items...
  		],
  		"pagination": {
  			"currentPage": 1,
  			"totalPages": 5,
  			"totalItems": 45,
  			"itemsPerPage": 10
  		}
  	}
  }
  ```

# Get Content by Slug

Get details for specific content by slug (public access).

- URL: `/api/content?slug={slug}`
- Method: `GET`
- Access: Public
- Authentication: Not required
- Response:
  ```json
  {
  	"status": "success",
  	"data": {
  		"id": 45,
  		"title": "Content Title",
  		"slug": "content-title",
  		"body": "Content body in HTML or markdown",
  		"thumbnailUrl": "url",
  		"contentType": "article",
  		"tags": ["tag1", "tag2"],
  		"createdAt": "2023-09-12T14:20:15Z"
  	}
  }
  ```

# Filter Content by Type

Get content filtered by type (public access).

- URL: `/api/content?type={contentType}`
- Method: `GET`
- Access: Public
- Authentication: Not required
- Response:
  ```json
  {
  	"status": "success",
  	"data": {
  		"content": [
  			// Content items of specified type
  		],
  		"pagination": {
  			"currentPage": 1,
  			"totalPages": 3,
  			"totalItems": 25,
  			"itemsPerPage": 10
  		}
  	}
  }
  ```

# Update Content

Update existing content (admin only).

- URL: `/api/admin/konten?id={id}`
- Method: `PUT`
- Access: Admin
- Authentication: Required (Bearer token)
- Request Body (multipart/form-data):
  ```
  title: "Updated Content Title"
  description : "Updated content body"
  image : file  // Optional, new thumbnail
  contentType: "news"  // Updated content type
  tags: ["newtag1", "newtag2"]  // Updated tags
  ```
- Response:
  ```json
  {
  	"status": "success",
  	"message": "Content updated successfully",
  	"data": {
  		"id": 45,
  		"title": "Updated Content Title"
  		// Other updated fields...
  	}
  }
  ```

# Delete Content

Remove content (admin only).

- URL: `/api/admin/konten?id={id}`
- Method: `DELETE`
- Access: Admin
- Authentication: Required (Bearer token)
- Response:
  ```json
  {
  	"status": "success",
  	"message": "Content deleted successfully"
  }
  ```

# Error Responses

# Authentication Errors

```json
{
	"status": "error",
	"code": 401,
	"message": "Unauthorized: Invalid credentials"
}
```

or

```json
{
	"status": "error",
	"code": 401,
	"message": "Unauthorized: Authentication token is missing or invalid"
}
```

# Permission Errors

```json
{
	"status": "error",
	"code": 403,
	"message": "Forbidden: You do not have sufficient permissions"
}
```

# Resource Not Found

```json
{
	"status": "error",
	"code": 404,
	"message": "Not found: The requested resource does not exist"
}
```

# Validation Errors

```json
{
	"status": "error",
	"code": 422,
	"message": "Validation failed",
	"errors": {
		"name": ["Name is required"],
		"email": ["Email format is invalid"]
	}
}
```

# Server Errors

```json
{
	"status": "error",
	"code": 500,
	"message": "Internal server error"
}
```
