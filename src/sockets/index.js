import { Server } from "socket.io";


const setupSocketServer = (server) => {
  const io = new Server(server, {
    cors: {
      origin: "*", // cho phép tất cả các nguồn gốc (origins) truy cập vào server
      methods: ["GET", "POST"], // các phương thức được phép
      credentials: true, // cho phép gửi cookie từ client đến server
    },
  });

  const userSocketMap = new Map(); // Lưu trữ socketId theo userId

  const disconnect = (socket) => {
    console.log("Client disconnected", socket.id);
    for (const [userId, socketId] of userSocketMap.entries()) { // Duyệt qua tất cả các userId trong userSocketMap
      if (socketId === socket.id) {
        userSocketMap.delete(userId); // Xóa socketId khỏi userSocketMap
        break;
      }
    } 
  }

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId; // Lấy userId từ query params
    
    if(userId) {
      userSocketMap.set(userId, socket.id); // Lưu socketId vào userSocketMap theo userId
      console.log("User connected:", userId, "with socketID", socket.id);
    } else {
      console.log("UserId not found in query params"); // Không tìm thấy userId trong query params
    }
  });


  io.on("disconnect", (socket) => {
    disconnect(socket);
  });

}