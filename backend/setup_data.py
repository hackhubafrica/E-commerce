from pymongo import MongoClient

# Connect to MongoDB
client = MongoClient('mongodb://localhost:30000/')

# Create or access a database
db = client['my_database']

# Create or access a collection
collection = db['my_collection']

# Dummy data
dummy_data = [
    {"name": "John Doe", "age": 30, "email": "john@example.com"},
    {"name": "Jane Smith", "age": 25, "email": "jane@example.com"},
    {"name": "Alice Johnson", "age": 28, "email": "alice@example.com"},
    {"name": "Bob Brown", "age": 35, "email": "bob@example.com"}
]

# Insert dummy data into the collection
collection.insert_many(dummy_data)

print("Dummy data inserted successfully!")
