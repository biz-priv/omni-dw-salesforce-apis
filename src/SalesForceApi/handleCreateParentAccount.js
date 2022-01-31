
const axios = require('axios');

async function createParentAccount(PARENT_ACCOUNT_URL, PARENT_ACCOUNT_PARAMS, options) {
    try {
        let createParent = await axios.patch(PARENT_ACCOUNT_URL, PARENT_ACCOUNT_PARAMS, options);
        let createParentID = createParent['data'];
        if(typeof createParentID != 'undefined'){
            // console.info("Forecast ID : \n", createParentID);
            return [createParentID,true];
        }
        return ["Unable to fetch forecast ID",false];
    } catch (error) {
        console.error("****Error : \n" + error);
        return [error.response.data[0],false];
    }
}
module.exports = { createParentAccount }