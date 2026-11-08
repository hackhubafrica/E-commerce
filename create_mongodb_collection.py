#!/usr/bin/env python3
"""
Standalone script to create MongoDB Atlas collection.
Independent of Cloudflare Worker and Supabase — does NOT modify worker/index.js.
Requires: pymongo[srv] installed in the active Python virtual environment.
"""
import os
from pymongo import MongoClient
from pymongo.server_api import ServerApi

uri = os.getenv(
    "MONGODB_URI",
    "mongodb+srv://hackhubafrica_db_user:GwwBfvh51gFSOKS8@e-commerce.0aeczpq.mongodb.net/e-commerce?retryWrites=true&w=majority",
)
database_name = os.getenv("MONGODB_DATABASE", "e-commerce")
collection_name = os.getenv("MONGODB_COLLECTION", "orders")

client = MongoClient(uri, server_api=ServerApi("1"))

try:
    # Test connection
    client.admin.command("ping")
    print("✓ Connected to MongoDB Atlas successfully")

    # Create/use database and collection
    db = client[database_name]

    if collection_name not in db.list_collection_names():
        collection = db.create_collection(collection_name)
        print(f"✓ Collection '{collection_name}' created")
    else:
        collection = db[collection_name]
        print(f"✓ Collection '{collection_name}' already exists")

    # Create indexes for order lookups
    collection.create_index("order_id", unique=True)
    collection.create_index("status")
    collection.create_index("payment_method")
    print("✓ Indexes created: order_id (unique), status, payment_method")

except Exception as e:
    print(f"✗ Error: {e}")
finally:
    client.close()