const axios = require('axios');
async function getOwnerID(OWNER_USER_ID_BASE_URL, options, owner) {
    try {
        let ownerIdUrl = OWNER_USER_ID_BASE_URL + owner;

        // console.info("Owner User ID Endpoint : \n", JSON.stringify(ownerIdUrl));
        const OWNER_USER_ID = await axios.get(ownerIdUrl, options);
        // console.info('executed db owner id query');
        // console.info("Owner User ID Response : \n", OWNER_USER_ID['data']);
        let ownerIdRes = OWNER_USER_ID['data']['Id'];
        if(typeof ownerIdRes != 'undefined'){
            return ownerIdRes;
        }
        return false;
    } catch (error) {
        // console.info("catch owner id error : \n", error)
        return getCrmAdminOwnerID(OWNER_USER_ID_BASE_URL, options);
    }
}

async function getCrmAdminOwnerID(OWNER_USER_ID_BASE_URL, options) {
    try {
        let ownerIdUrl = OWNER_USER_ID_BASE_URL + 'crm admin';
        // console.info("Owner User crm admin Endpoint : \n", JSON.stringify('crm admin'));
        const OWNER_USER_ID = await axios.get(ownerIdUrl, options);
        // console.info('executed crm admin owner id query')
        // console.info("Owner User ID Response : \n", OWNER_USER_ID['data']);
        let ownerIdRes = OWNER_USER_ID['data']['Id'];
        // console.info("Catch ownerIdRes : \n", JSON.stringify(ownerIdRes));
        if(typeof ownerIdRes != 'undefined'){
        return ownerIdRes;
        }
        return false;
    } catch (ownerIderror) {
        console.error("ownerIderror : \n", ownerIderror);
        return false;
    }
}


module.exports = { getOwnerID,getCrmAdminOwnerID }