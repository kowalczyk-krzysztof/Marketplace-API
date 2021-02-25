import express from 'express';
import dotenv from 'dotenv';
import { connectDB } from './config/db';

dotenv.config({ path: 'config.env' });
connectDB();

const app = express();

app.get('/', (req, res) => {
  res.send(console.log('Hello world'));
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, (): void => {
  console.log(
    `Server is up and running @ http://localhost:${PORT} in ${process.env.NODE_ENV} mode`
  );
});