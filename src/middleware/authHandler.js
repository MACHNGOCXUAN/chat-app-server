import jwt from 'jsonwebtoken';
import userModel from '../models/userModel.js';

const authHandler = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    // Kiểm tra có token hay không
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'Không có token truy cập' });
    }

    const token = authHeader.split(' ')[1];

    // Kiểm tra token có hợp lệ không (ví dụ: độ dài token)
    if (token.length < 10) {
      return res.status(401).json({ success: false, message: 'Token không hợp lệ' });
    }

    // Giải mã token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Tìm user từ DB (tuỳ bạn có muốn lấy thông tin đầy đủ hay không)
    const user = await userModel.findById(decoded.id).select('-password');

    if (!user) {
      return res.status(401).json({ success: false, message: 'Người dùng không tồn tại' });
    }

    // Gán thông tin user vào req để dùng ở controller
    req.user = user;

    next(); // Cho phép đi tiếp
  } catch (error) {
    console.error('authHandler error:', error);

    // Nếu token hết hạn
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ success: false, message: 'Token đã hết hạn' });
    }

    // Nếu token không hợp lệ hoặc lỗi khác
    return res.status(401).json({ success: false, message: 'Xác thực thất bại' });
  }
};

export default authHandler;
