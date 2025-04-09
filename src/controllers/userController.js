
import uploadFile from '../utils/file.service.js'
import userModel from '../models/userModel.js'
import bcryptjs from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from "dotenv"

dotenv.config()


const generateAccessToken  = async (user) => {

  const token = await jwt.sign(user, process.env.SECRET_KEY, {
    expiresIn: "15m"
  })

  return token
}


const generateRefreshToken = async (user) => {
  const refreshToken = await jwt.sign(user, process.env.REFRESH_TOKEN_SECRET, {
    expiresIn: '7d'
  })

  return refreshToken
};

// viet giup toi ham check email da ton tai hay chua
// kiem tra xem email da ton tai hay chua
const checkEmailExists = async (req, res) => {
  const { email } = req.body;
  try {
    const user = await userModel.findOne({ email });
    if (user) {
      return res.status(409).json({ 
        success: true,
        message: "Email đã được đăng ký" 
      });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau!' 
    });
    
  }
}

const checkUserExists = async (req, res) => {
  const { phoneNumber, email } = req.body;

  console.log(email, phoneNumber);
  
  try {
    // Kiểm tra cả hai trường
    if (!phoneNumber && !email) {
      return res.status(400).json({ 
        success: false,
        message: "Vui lòng cung cấp số điện thoại hoặc email" 
      });
    }

    const conditions = [];
    if (phoneNumber) conditions.push({ phoneNumber });
    if (email) conditions.push({ email });

    // Tìm user với $or
    const existingUser = await userModel.findOne({ 
      $or: conditions 
    });

    if (existingUser) {
      // Kiểm tra xem trùng phone hay email
      let message = '';
      if (existingUser.phoneNumber === phoneNumber) {
        message = "Số điện thoại đã được đăng ký";
      } 
      if (existingUser.email === email) {
        message = message 
          ? "Số điện thoại và email đã được đăng ký" 
          : "Email đã được đăng ký";
      }

      return res.status(409).json({ // 409 Conflict
        success: false,
        message
      });
    }

    return res.status(200).json({
      success: true,
      message: "Có thể đăng ký tài khoản mới"
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      success: false,
      message: 'Lỗi server. Vui lòng thử lại sau!' 
    });
  }
}

const register = async (req, res) => {

  const { username, phoneNumber, dateOfBirth, gender, password, email } = req.body
  console.log(req.body);
  
  try {
    const existingUser = await userModel.findOne({ 
      $or: [{ email }, { phoneNumber }] 
    });

    if (existingUser) {
      return res.status(409).json({ 
        error: 'Số điện thoại hoặc email đã tồn tại' 
      });
    }

    const salt = await bcryptjs.genSalt(10)
    const hashpassword = await bcryptjs.hash(password,salt)

    // const avatar = await uploadFile(req.file)
    const newUser = new userModel({
      username, 
      phoneNumber,
      dateOfBirth: new Date(dateOfBirth),
      gender,
      password: hashpassword,
      email,
    })

    await newUser.save()

    const userResponse = {
      _id: newUser._id,
      username: newUser.username,
      phoneNumber: newUser.phoneNumber,
      avatarURL: newUser.avatarURL,
      status: newUser.status,
      createdAt: newUser.createdAt
    };
    

    res.status(201).json({message: "Đăng ký thành công", user: userResponse});
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server. Vui lòng thử lại sau!' });
  }
}


const login = async (req, res) => {
  const {phoneNumber, password} = req.body
  console.log(req.body);
  
  try {
    const existingUser = await userModel.findOne({phoneNumber})
    if(!existingUser) {
      return res.status(404).json({ error: "Không tồn tại người dùng!!!" })
    }

    const isMatchPassword = await bcryptjs.compare(password, existingUser.password)

    if(!isMatchPassword) {
      return res.status(401).json({ error: "Sai mật khẩu" })
    }

    const userpayload = {
      id: existingUser._id,
      phoneNumber: existingUser.phoneNumber
    }

    const accessToken = await generateAccessToken(userpayload);
    const refreshToken = await generateRefreshToken(userpayload);

     // Lưu refreshToken vào cookie
    //  res.cookie("refreshToken", refreshToken, {
    //   httpOnly: true,
    //   secure: false, // ở deverlopment thì dùng false, product thì dùng true
    //   path: "/", // Toàn bộ ứng dụng được sử dụng cooki này
    //   sameSite: "strict", // bảo mật
    // });

    res.status(200).json({
      message: "Login successfully",
      data: {
        user: existingUser,
        accessToken
      }
    })
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server. Vui lòng thử lại sau!' });
  }
}

const logout = async (req, res) => {
  try {
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: false, // Để true nếu là production và dùng HTTPS
      sameSite: "strict",
    });

    res.status(200).json({
      message: "Đăng xuất thành công!"
    });
  } catch (error) {
    console.error("Logout error:", error)
    res.status(500).json({
      message: "Lỗi server khi đăng xuất!"
    })
  }
}


const refreshToken = async (req, res) => {
  const token = req.cookies.refreshToken;

  if (!token) {
    return res.status(401).json({ message: "Bạn chưa đăng nhập hoặc phiên đăng nhập đã hết hạn!" });
  }

  try {
    const user = jwt.verify(token, process.env.REFRESH_TOKEN_SECRET);

    const newAccessToken = await generateAccessToken({
      id: user._id,
      phoneNumber: user.phoneNumber
    });

    res.status(200).json({
      accessToken: newAccessToken
    });
  } catch (error) {
    console.error("Refresh token error:", error);
    res.status(403).json({ message: "Refresh token không hợp lệ hoặc đã hết hạn!" });
  }
}

const getAllUser = async (req, res) => {
  try {
    const users = await userModel.find({})
    res.status(200).json(users)
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Lỗi server. Vui lòng thử lại sau!' });
  }
}



export const userController = {
  register,
  login,
  logout,
  refreshToken,
  checkUserExists,
  getAllUser
}