
import uploadFile from '../utils/file.service.js'
import userModel from '../models/userModel.js'
import bcryptjs from 'bcryptjs'
import jwt from 'jsonwebtoken'
import dotenv from "dotenv"

dotenv.config()


const generateAccessToken  = async (user) => {

  const token = await jwt.sign(user, process.env.SECRET_KEY, {
    expiresIn: "1d"
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
    if (!user) {
      return res.status(409).json({ 
        success: false,
        message: "Không tồn tại người dùng " + email 
      });
    }
    res.status(200).json({
      success: true,
      user: user
    })
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

  const { username, phoneNumber, dateOfBirth, gender, password, email, avatarURL  } = req.body
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
       avatarURL: avatarURL || ""
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
  const {email, password} = req.body
  
  try {
    const existingUser = await userModel.findOne({email})
    if(!existingUser) {
      return res.status(404).json({ error: "Không tồn tại người dùng!!!" })
    }

    const isMatchPassword = await bcryptjs.compare(password, existingUser.password)

    if(!isMatchPassword) {
      return res.status(401).json({ error: "Sai mật khẩu" })
    }

    const userpayload = {
      _id: existingUser._id,
      phoneNumber: existingUser.email
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

const forgotPassword = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Người dùng không tồn tại!!!' });
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(password, salt);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Mật khẩu đã được cập nhật thành công!',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server. Vui lòng thử lại sau!' });
  }
};

const updatePassword = async (req, res) => {
  const { email, password, newPassword } = req.body;

  try {
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Người dùng không tồn tại!!!' });
    }

    const isMatchPassword = await bcryptjs.compare(password, user.password)

    if(!isMatchPassword) {
      return res.status(401).json({ error: "Sai mật khẩu" })
    }

    const salt = await bcryptjs.genSalt(10);
    const hashedPassword = await bcryptjs.hash(newPassword, salt);

    user.password = hashedPassword;
    await user.save();

    res.status(200).json({
      success: true,
      message: 'Mật khẩu đã được cập nhật thành công!',
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server. Vui lòng thử lại sau!' });
  }
}

const updateImageCover = async (req, res) => {
  try {

    const imageURL = req.files?.coverImage?.[0]

    console.log("kbik: ", req.body);
    
    
    const coverimage = await uploadFile(imageURL)
    const email = req.body.email
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Người dùng không tồn tại!!!' });
    }

    user.coverImage = coverimage
    await user.save()
    res.status(200).json({
      success: true,
      coverimage: coverimage, 
      message: 'Cập nhật ảnh bìa thành công',
      user: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server. Vui lòng thử lại sau!' });
  }
}

const updateAvatar = async (req, res) => {
  try {

    const imageURL = req.files?.avatarURL?.[0]
    console.log(imageURL);
    
    
    const avatar = await uploadFile(imageURL)
    const email = req.body.email
    const user = await userModel.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Người dùng không tồn tại!!!' });
    }

    user.avatarURL = avatar
    await user.save()
    res.status(200).json({
      success: true,
      avatarURL: avatar,
      message: 'Cập nhật ảnh đại diện thành công',
      user: user
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server. Vui lòng thử lại sau!' });
  }
}

const updateProfile = async (req, res) => {
  try {
    // const userId = req.user._id;
    
    const userId = req.body._id
    const { email, username, gender, dateOfBirth } = req.body

    const updatedUser = await userModel.findByIdAndUpdate(
      userId,
      {
        email,
        username,
        gender,
        dateOfBirth,
      },
      { new: true, runValidators: true }
    )

    if (!updatedUser) {
      return res.status(404).json({ message: 'Người dùng không tồn tại' });
    }

    res.status(200).json({
      message: 'Cập nhật thông tin thành công',
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server. Vui lòng thử lại sau!' });
  }
}

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params
    await userModel.deleteOne({_id: id})

    res.status(200).json({
      message: 'Xóa tài khoản thành công'
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Lỗi server. Vui lòng thử lại sau!' });
  }
}

const searchUserByPhone = async (req, res) => {
  console.log(req.query);
  
  try {
    const { phoneNumber } = req.query;

    if (!phoneNumber) {
      return res.status(400).json({ message: "Số điện thoại chưa đăng ký tài khoản" });
    }

    const user = await userModel.findOne({ phoneNumber }).select("-password");

    if (!user) {
      return res.status(404).json({ message: "Không tìm thấy người dùng." });
    }

    return res.status(200).json(user);
  } catch (error) {
    console.error("Lỗi tìm kiếm người dùng:", error);
    return res.status(500).json({ message: "Đã xảy ra lỗi server." });
  }
};






export const userController = {
  register,
  login,
  logout,
  refreshToken,
  checkUserExists,
  getAllUser,
  checkEmailExists,
  forgotPassword,
  updatePassword,
  updateImageCover,
  updateAvatar,
  updateProfile,
  deleteUser,
  searchUserByPhone
}