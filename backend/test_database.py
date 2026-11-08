from pymongo import MongoClient

# Connect to MongoDB
client = MongoClient('mongodb://localhost:30000/e-commerce')

# Access a database
db = client['e-commerce']

# Access a collection (replace 'my_collection' with your collection name)
collection = db['products']

# Retrieve and print all documents in the collection
documents = collection.find()

print("Documents in the collection:")
for document in documents:
    print(document)
