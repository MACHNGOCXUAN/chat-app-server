const authHandler = (io, socket) => {
  socket.on('register', (userId) => {
    if (!userId) {
      console.error('Register event: userId is required');
      return;
    }
    
    socket.join(userId);
    console.log(`User ${userId} joined their room`);
    
    // Có thể emit sự kiện xác nhận nếu cần
    socket.emit('register_success', { userId })
  });

  // Thêm các sự kiện liên quan đến auth ở đây
  // socket.on('logout', ...);
};

export default authHandler;