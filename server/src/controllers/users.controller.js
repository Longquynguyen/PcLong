const modelUser = require('../models/users.model');
const modelApiKey = require('../models/apiKey.model');
const modelProduct = require('../models/products.model');
const modelPayment = require('../models/payments.model');
const modelUserWatch = require('../models/userWatchProduct.model');
const modelOtp = require('../models/otp.model');

const { Op } = require('sequelize');

const { BadUserRequestError } = require('../core/error.response');
const { OK } = require('../core/success.response');
const { createApiKey, createRefreshToken, createToken, verifyToken } = require('../services/tokenServices');
const { BadRequestError } = require('../core/error.response');
const sendMailForgotPassword = require('../utils/sendMailForgotPassword');

const bcrypt = require('bcrypt');
const CryptoJS = require('crypto-js');
const { jwtDecode } = require('jwt-decode');
const jwt = require('jsonwebtoken');
const otpGenerator = require('otp-generator');

require('dotenv').config();

class controllerUser {
    async registerUser(req, res) {
        const { fullName, phone, address, email, password } = req.body;
        if (!fullName || !phone || !address || !email || !password) {
            throw new BadUserRequestError('Vui lòng nhập đầy đủ thông tin');
        }
        const findUser = await modelUser.findOne({ where: { email } });

        if (findUser) {
            throw new BadUserRequestError('Email đã tồn tại');
        }

        const saltRounds = 10;
        const salt = bcrypt.genSaltSync(saltRounds);
        const passwordHash = bcrypt.hashSync(password, salt);
        const dataUser = await modelUser.create({
            fullName,
            phone,
            address,
            email,
            password: passwordHash,
            typeLogin: 'email',
        });

        await dataUser.save();
        await createApiKey(dataUser.id);
        const token = await createToken({
            id: dataUser.id,
            isAdmin: dataUser.isAdmin,
            address: dataUser.address,
            phone: dataUser.phone,
        });
        const refreshToken = await createRefreshToken({ id: dataUser.id });
        res.cookie('token', token, {
            httpOnly: true, // Chặn truy cập từ JavaScript (bảo mật hơn)
            secure: true, // Chỉ gửi trên HTTPS (để đảm bảo an toàn)
            sameSite: 'Strict', // Chống tấn công CSRF
            maxAge: 15 * 60 * 1000, // 15 phút
        });

        res.cookie('logged', 1, {
            httpOnly: false, // Chặn truy cập từ JavaScript (bảo mật hơn)
            secure: true, // Chỉ gửi trên HTTPS (để đảm bảo an toàn)
            sameSite: 'Strict', // Chống tấn công CSRF
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
        });

        // Đặt cookie HTTP-Only cho refreshToken (tùy chọn)
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
        });

        new OK({ message: 'Đăng nhập thành công', metadata: { token, refreshToken } }).send(res);
    }

    async loginUser(req, res) {
        const { email, password } = req.body;
        if (!email || !password) {
            throw new BadUserRequestError('Vui lòng nhập đầy đủ thông tin');
        }
        const findUser = await modelUser.findOne({ where: { email } });
        if (!findUser) {
            throw new BadUserRequestError('Tài khoản hoặc mật khẩu không chính xác');
        }
        const isPasswordValid = bcrypt.compareSync(password, findUser.password);
        if (!isPasswordValid) {
            throw new BadUserRequestError('Tài khoản hoặc mật khẩu không chính xác');
        }
        await createApiKey(findUser.id);
        const token = await createToken({ id: findUser.id, isAdmin: findUser.isAdmin });
        const refreshToken = await createRefreshToken({ id: findUser.id });
        res.cookie('token', token, {
            httpOnly: true, // Chặn truy cập từ JavaScript (bảo mật hơn)
            secure: true, // Chỉ gửi trên HTTPS (để đảm bảo an toàn)
            sameSite: 'Strict', // Chống tấn công CSRF
            maxAge: 15 * 60 * 1000, // 15 phút
        });
        res.cookie('logged', 1, {
            httpOnly: false, // Chặn truy cập từ JavaScript (bảo mật hơn)
            secure: true, // Chỉ gửi trên HTTPS (để đảm bảo an toàn)
            sameSite: 'Strict', // Chống tấn công CSRF
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
        });
        res.cookie('refreshToken', refreshToken, {
            httpOnly: true,
            secure: true,
            sameSite: 'Strict',
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
        });
        new OK({ message: 'Đăng nhập thành công', metadata: { token, refreshToken } }).send(res);
    }

    async authUser(req, res) {
        const { id } = req.user;

        const findUser = await modelUser.findOne({ where: { id } });

        if (!findUser) {
            throw new BadRequestError('Tài khoản không tồn tại');
        }

        // Chỉ gửi những thông tin cần thiết
        const userInfo = {
            id: findUser.id,
            fullName: findUser.fullName,
            email: findUser.email,
            isAdmin: findUser.isAdmin,

            address: findUser.address,
            phone: findUser.phone,
            // Thêm các trường khác nếu cần
        };

        const auth = CryptoJS.AES.encrypt(JSON.stringify(userInfo), process.env.SECRET_CRYPTO).toString();

        new OK({ message: 'success', metadata: auth }).send(res);
    }

    async refreshToken(req, res) {
        const refreshToken = req.cookies.refreshToken;

        const decoded = await verifyToken(refreshToken);

        const user = await modelUser.findOne({ where: { id: decoded.id } });
        const token = await createToken({ id: user.id });
        res.cookie('token', token, {
            httpOnly: true, // Chặn truy cập từ JavaScript (bảo mật hơn)
            secure: true, // Chỉ gửi trên HTTPS (để đảm bảo an toàn)
            sameSite: 'Strict', // Chống tấn công CSRF
            maxAge: 15 * 60 * 1000, // 15 phút
        });

        res.cookie('logged', 1, {
            httpOnly: false, // Chặn truy cập từ JavaScript (bảo mật hơn)
            secure: true, // Chỉ gửi trên HTTPS (để đảm bảo an toàn)
            sameSite: 'Strict', // Chống tấn công CSRF
            maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
        });

        new OK({ message: 'Refresh token thành công', metadata: { token } }).send(res);
    }

    async logout(req, res) {
        const { id } = req.user;
        await modelApiKey.destroy({ where: { userId: id } });
        res.clearCookie('token');
        res.clearCookie('refreshToken');
        res.clearCookie('logged');

        new OK({ message: 'Đăng xuất thành công' }).send(res);
    }

    async updateInfoUser(req, res) {
        const { id } = req.user;
        const { fullName, address, phone } = req.body;

        const user = await modelUser.findOne({ where: { id } });

        if (!user) {
            throw new BadRequestError('Không tìm thấy tài khoản');
        }
        await user.update({ fullName, address, phone });

        new OK({ message: 'Cập nhật thông tin tài khoản thành cong' }).send(res);
    }

    async getDashboardStats(req, res) {
        try {
            // 1. Lấy thống kê cơ bản
            const totalUsers = await modelUser.count();
            const totalProducts = await modelProduct.count();
            const totalWatching = await modelUserWatch.count();

            // Tính tổng doanh thu từ các đơn hàng completed
            const totalRevenue = await modelPayment.sum('totalPrice', {
                where: {
                    status: 'delivered',
                },
            });

            // 2. Lấy đơn hàng gần đây (5 đơn hàng mới nhất)
            const recentOrders = await modelPayment.findAll({
                attributes: ['id', 'idPayment', 'fullName', 'totalPrice', 'status', 'typePayment', 'createdAt'],
                order: [['createdAt', 'DESC']],
                limit: 5,
            });

            // 3. Lấy top sản phẩm bán chạy
            // Đầu tiên lấy số lượng bán của từng sản phẩm
            const productSales = await modelPayment.findAll({
                attributes: [
                    'productId',
                    [modelPayment.sequelize.fn('SUM', modelPayment.sequelize.col('quantity')), 'totalSold'],
                ],
                where: {
                    status: 'delivered',
                },
                group: ['productId'],
                order: [[modelPayment.sequelize.fn('SUM', modelPayment.sequelize.col('quantity')), 'DESC']],
                limit: 5,
            });

            // Lấy thông tin chi tiết của các sản phẩm bán chạy
            const topProductIds = productSales.map((sale) => sale.productId);
            const topProducts = await modelProduct.findAll({
                where: {
                    id: {
                        [Op.in]: topProductIds,
                    },
                },
                attributes: ['id', 'name', 'componentType', 'price', 'stock'],
            });

            // Map số lượng bán vào thông tin sản phẩm
            const topProductsWithSales = topProducts.map((product) => {
                const sale = productSales.find((s) => s.productId === product.id);
                return {
                    ...product.toJSON(),
                    totalSold: sale ? parseInt(sale.getDataValue('totalSold')) : 0,
                };
            });

            // Trả về tất cả dữ liệu
            new OK({
                message: 'Get dashboard statistics successfully',
                metadata: {
                    statistics: {
                        totalUsers,
                        totalProducts,
                        totalRevenue: totalRevenue || 0,
                        totalWatching,
                    },
                    recentOrders,
                    topProducts: topProductsWithSales,
                },
            }).send(res);
        } catch (error) {
            console.error('Dashboard stats error:', error);
            throw error;
        }
    }

    async getUsers(req, res) {
        const users = await modelUser.findAll();
        new OK({ message: 'Lấy danh sách người dùng thành công', metadata: users }).send(res);
    }

    async loginGoogle(req, res) {
        const { credential } = req.body;
        const dataToken = jwtDecode(credential);
        const user = await modelUser.findOne({ where: { email: dataToken.email } });
        if (user) {
            await createApiKey(user.id);
            const token = await createToken({ id: user.id });
            const refreshToken = await createRefreshToken({ id: user.id });
            res.cookie('token', token, {
                httpOnly: true, // Chặn truy cập từ JavaScript (bảo mật hơn)
                secure: true, // Chỉ gửi trên HTTPS (để đảm bảo an toàn)
                sameSite: 'Strict', // Chống tấn công CSRF
                maxAge: 15 * 60 * 1000, // 15 phút
            });
            res.cookie('logged', 1, {
                httpOnly: false, // Chặn truy cập từ JavaScript (bảo mật hơn)
                secure: true, // Chỉ gửi trên HTTPS (để đảm bảo an toàn)
                sameSite: 'Strict', // Chống tấn công CSRF
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
            });
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: true,
                sameSite: 'Strict',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
            });
            new OK({ message: 'Đăng nhập thành công', metadata: { token, refreshToken } }).send(res);
        } else {
            const newUser = await modelUser.create({
                fullName: dataToken.name,
                email: dataToken.email,
                typeLogin: 'google',
            });
            await newUser.save();
            await createApiKey(newUser.id);
            const token = await createToken({ id: newUser.id });
            const refreshToken = await createRefreshToken({ id: newUser.id });
            res.cookie('token', token, {
                httpOnly: true, // Chặn truy cập từ JavaScript (bảo mật hơn)
                secure: true, // Chỉ gửi trên HTTPS (để đảm bảo an toàn)
                sameSite: 'Strict', // ChONGL tấn công CSRF
                maxAge: 15 * 60 * 1000, // 15 phút
            });
            res.cookie('logged', 1, {
                httpOnly: false, // Chặn truy cập từ JavaScript (bảo mật hơn)
                secure: true, // Chỉ gửi trên HTTPS (để đảm bảo an toàn)
                sameSite: 'Strict', // ChONGL tấn công CSRF
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
            });
            res.cookie('refreshToken', refreshToken, {
                httpOnly: true,
                secure: true,
                sameSite: 'Strict',
                maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
            });
            new OK({ message: 'Đăng nhập thành công', metadata: { token, refreshToken } }).send(res);
        }
    }

    async getOrderStats(req, res) {
        try {
            const { Op } = require('sequelize');
            const modelPayment = require('../models/payments.model');

            // Get the current date
            const today = new Date();
            today.setHours(23, 59, 59, 999);

            // Get date 7 days ago
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);
            sevenDaysAgo.setHours(0, 0, 0, 0);

            // Generate an array of dates for the last 7 days
            const dateArray = [];
            for (let i = 0; i < 7; i++) {
                const date = new Date(sevenDaysAgo);
                date.setDate(date.getDate() + i);
                dateArray.push(date);
            }

            // Get orders for the last 7 days
            const orders = await modelPayment.findAll({
                attributes: [
                    [modelPayment.sequelize.fn('DATE', modelPayment.sequelize.col('createdAt')), 'date'],
                    [modelPayment.sequelize.fn('COUNT', modelPayment.sequelize.col('id')), 'count'],
                ],
                where: {
                    createdAt: {
                        [Op.between]: [sevenDaysAgo, today],
                    },
                },
                group: [modelPayment.sequelize.fn('DATE', modelPayment.sequelize.col('createdAt'))],
                order: [[modelPayment.sequelize.fn('DATE', modelPayment.sequelize.col('createdAt')), 'ASC']],
            });

            // Format the results with all 7 days, including days with zero orders
            const formattedResults = dateArray.map((date) => {
                const dateStr = date.toISOString().split('T')[0];
                const orderData = orders.find((order) => order.getDataValue('date') === dateStr);
                return {
                    date: dateStr,
                    count: orderData ? parseInt(orderData.getDataValue('count')) : 0,
                };
            });

            new OK({
                message: 'Order statistics retrieved successfully',
                metadata: formattedResults,
            }).send(res);
        } catch (error) {
            console.error('Order stats error:', error);
            throw error;
        }
    }

    async forgotPassword(req, res) {
        try {
            const { email } = req.body;
            if (!email) {
                throw new BadUserRequestError('Vui lòng nhập email');
            }

            const user = await modelUser.findOne({ where: { email } });
            if (!user) {
                throw new BadUserRequestError('Email không tồn tại');
            }

            const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '15m' });
            const otp = await otpGenerator.generate(6, {
                digits: true,
                lowerCaseAlphabets: false,
                upperCaseAlphabets: false,
                specialChars: false,
            });

            const saltRounds = 10;

            bcrypt.hash(otp, saltRounds, async function (err, hash) {
                if (err) {
                    console.error('Error hashing OTP:', err);
                } else {
                    await modelOtp.create({
                        email: user.email,
                        otp: hash,
                    });
                    await sendMailForgotPassword(email, otp);

                    return res
                        .setHeader('Set-Cookie', [
                            `tokenResetPassword=${token};  Secure; Max-Age=300; Path=/; SameSite=Strict`,
                        ])
                        .status(200)
                        .json({ message: 'Gửi thành công !!!' });
                }
            });
        } catch (error) {
            console.error('Error forgot password:', error);
            return res.status(500).json({ message: 'Có lỗi xảy ra' });
        }
    }

    async resetPassword(req, res) {
        try {
            const token = req.cookies.tokenResetPassword;
            const { otp, newPassword } = req.body;

            if (!token) {
                throw new BadUserRequestError('Vui lòng gửi yêu cầu quên mật khẩu');
            }

            const decode = jwt.verify(token, process.env.JWT_SECRET);
            if (!decode) {
                throw new BadUserRequestError('Sai mã OTP hoặc đã hết hạn, vui lòng lấy OTP mới');
            }

            const findOTP = await modelOtp.findOne({
                where: { email: decode.email },
                order: [['createdAt', 'DESC']],
            });
            if (!findOTP) {
                throw new BadUserRequestError('Sai mã OTP hoặc đã hết hạn, vui lòng lấy OTP mới');
            }

            // So sánh OTP
            const isMatch = await bcrypt.compare(otp, findOTP.otp);
            if (!isMatch) {
                throw new BadUserRequestError('Sai mã OTP hoặc đã hết hạn, vui lòng lấy OTP mới');
            }

            // Hash mật khẩu mới
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

            // Tìm người dùng
            const findUser = await modelUser.findOne({ where: { email: decode.email } });
            if (!findUser) {
                throw new BadUserRequestError('Người dùng không tồn tại');
            }

            // Cập nhật mật khẩu mới
            findUser.password = hashedPassword;
            await findUser.save();

            // Xóa OTP sau khi đặt lại mật khẩu thành công
            await modelOtp.destroy({ where: { email: decode.email } });
            res.clearCookie('tokenResetPassword');
            return res.status(200).json({ message: 'Đặt lại mật khẩu thành công' });
        } catch (error) {
            console.error(error);
            return res.status(500).json({ message: 'Có lỗi xảy ra, vui lòng liên hệ ADMIN !!' });
        }
    }

    async updateRoleUser(req, res) {
        const { userId, role } = req.body;
        const findUser = await modelUser.findOne({ where: { id: userId } });
        if (!findUser) {
            throw new BadUserRequestError('Người dùng không tồn tại');
        }
        findUser.isAdmin = role;
        await findUser.save();
        new OK({ message: 'Cập nhật quyền người dùng thành công' }).send(res);
    }
}

module.exports = new controllerUser();
