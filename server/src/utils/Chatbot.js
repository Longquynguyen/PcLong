const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI('AIzaSyCprIVLzrbbw8-JTKbRABUfF-JvNq0jzcw');
const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

const modelProduct = require('../models/products.model');

async function askQuestion(question) {
    try {
        const products = await modelProduct.findAll({});
        const productData = products
            .map(
                (product) =>
                    `Tên ${product.name}, Giá gốc ${product.price}, Giá khuyến mại : ${
                        product.discount > 0 ? product.price - (product.price * product.discount) / 100 : product.price
                    }, Giảm: ${product.discount}`
            )
            .join('\n');

        const prompt = `
         Bạn là một trợ lý bán hàng chuyên nghiệp. 
        Đây là danh sách sản phẩm hiện có trong cửa hàng:
        ${productData}

        câu hỏi của khách hàng ${question}
        Hãy trả lời một cách tự nhiên và thân thiện
        `;

        const result = await model.generateContent(prompt);
        const answer = result.response.text();
        return answer;
    } catch (error) {
        console.log(error);
    }
}

module.exports = { askQuestion };
