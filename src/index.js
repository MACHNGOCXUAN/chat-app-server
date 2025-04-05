import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './configs/dbConfig.js';
import router from './routes/userRoute.js';
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost';
const corsOptions = {
  origin: 'http://localhost:3000',
  methods: ['GET', 'POST'],
  credentials: true,
};
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


app.use("/api/auth", router)

connectDB()
  .then(() => {
    app.listen(PORT, HOST, () => {
      console.log(`Server is running on http://${HOST}:${PORT}`);
    });
  })
  .catch((error) => {
    console.error(`Error connecting to database: ${error.message}`);
    exit(1);
  });
