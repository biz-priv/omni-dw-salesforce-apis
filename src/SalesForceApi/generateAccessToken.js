const axios = require('axios');

async function generateAccessToken(tokenUrl) {
    // console.info("Access Token Url : \n", JSON.stringify(tokenUrl));
    let response = await axios.post(tokenUrl);
    return response.data;
}

module.exports = { generateAccessToken}