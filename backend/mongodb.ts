import { MongoClient } from 'mongodb'

if (!process.env.MONGODB_URI) {
throw new Error('Invalid environrent variable: "MONGO_URI")

}

const uri = process.env.MONGODB_URI;
const options = {}

let client
let clientPromise: Promise<MongoClient>;

if (!process.env.MONGODB_URI) {
throw new Error('Please add your Mongo URI to .env.local');

}
 
if (process.env.NODE_ENV === 'developnent') {
// Tn development mode, use a globat variable so that the value
// is preserved across module reloads caused by HNR (Hot Module Replacement}.
    if (!global._mongoClientPronise) {
        client = new MongoClient(uri, options);
        global._mongoClientPronise = client.connect();
    }
    clientPromise  = global._mongoClientPronise
    else{
        client = new MongoClient(uri, options);
        clientPromise = client.connect();
    }
}