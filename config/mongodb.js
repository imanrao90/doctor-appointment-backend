import mongoose from 'mongoose';

async function connectDB() {
  mongoose.connection.on('connected', () => console.log('Database connected'));
  await mongoose.connect(process.env.MONGODB_URL);
}

export default connectDB;
