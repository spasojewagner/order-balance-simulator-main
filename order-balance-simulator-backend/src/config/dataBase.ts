import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import fs from "fs";

// Try to load environment variables from different potential locations
const envPaths = [
  path.resolve(process.cwd(), '.env'),
  path.resolve(__dirname, '../../.env'),
  path.resolve(__dirname, '../.env'),
];

// Try each path until we find an existing .env file
for (const envPath of envPaths) {
  if (fs.existsSync(envPath)) {
    console.log(`Loading environment from: ${envPath}`);
    dotenv.config({ path: envPath });
    break;
  }
}

const connectDB = async (): Promise<void> => {
  try {
    // Use a default connection string if MONGO_URI is not defined
    const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/crypto-wallet';
    
    console.log(`Attempting to connect to MongoDB at: ${mongoUri.replace(/:([^:@]+)@/, ':****@')}`); // Hide password if present
    
    const conn = await mongoose.connect(mongoUri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  }
};

export default connectDB;