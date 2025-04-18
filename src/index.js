import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import connectDB from './configs/dbConfig.js';
import userRoute from './routes/userRoute.js';
import cookieParser from 'cookie-parser'
import { Server } from "socket.io"
import friendRoute from './routes/friendRoute.js'
import http from 'http'
import socketServer from './sockets/index.js';
import conversationRoute from './routes/conversationRoute.js'
import messageRoute from "./routes/messageRoute.js"
dotenv.config();

const app = express();
const server = http.createServer(app)

const PORT = process.env.PORT || 5000;
const HOST = process.env.HOST || 'localhost'
// const corsOptions = {
//   origin: 'http://localhost:3000',
//   methods: ['GET', 'POST'],
//   credentials: true,
// }

const io = new Server(server, {
  cors: {
    origin: "*"
  }
})

global._io = io

// app.use(cors(corsOptions));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser());


app.use("/api/auth", userRoute)
app.use("/api/friend", friendRoute)
app.use("/api/conversation", conversationRoute)
app.use("/api/message", messageRoute)

socketServer(io)

connectDB()
  .then(() => {
    // app.listen(PORT, HOST, () => {
    //   console.log(`Server is running on http://${HOST}:${PORT}`)
    // })

    server.listen(PORT, () => {
      console.log(`Server is running on http://${HOST}:${PORT}`)
    })
  })
  .catch((error) => {
    console.error(`Error connecting to database: ${error.message}`)
    exit(1)
  })
