import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI || 'mongodb://admin:secret_password_123@localhost:27017';
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

const globalForMongo = global as unknown as { _mongoClientPromise: Promise<MongoClient> };

if (process.env.NODE_ENV === 'development') {
  if (!globalForMongo._mongoClientPromise) {
    client = new MongoClient(uri, options);
    globalForMongo._mongoClientPromise = client.connect();
  }
  clientPromise = globalForMongo._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export default clientPromise;
