// Schema người dùng đơn giản
const userSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
});

// API Đăng ký
app.post('/api/register', async (req, res) => {
  const { email, password } = req.body;
  
  // 1. Mã hóa mật khẩu
  const hashedPassword = await bcrypt.hash(password, 10);
  
  // 2. Lưu vào DB
  const newUser = await User.create({ email, password: hashedPassword });
  
  // 3. Tạo Token để người dùng đăng nhập ngay
  const token = jwt.sign({ userId: newUser._id }, 'SECRET_KEY');
  
  res.json({ message: "Tạo tài khoản thành công!", token });
});