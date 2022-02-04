const axios = require('axios');
async function getOwnerID(OWNER_USER_ID_BASE_URL, options, owner) {
    try {
        let ownerIdUrl = OWNER_USER_ID_BASE_URL + owner.replace(/\//g,'%2F').replace(/\\/g,'%5C');
        console.info("Owner Id Url : \n", JSON.stringify(ownerIdUrl));
        const OWNER_USER_ID = await axios.get(ownerIdUrl, options);
        let ownerIdRes = OWNER_USER_ID['data']['Id'];
        if (typeof ownerIdRes != 'undefined') {
            return ownerIdRes;
        }
        return false;
    } catch (error) {
        console.info("Owner Id Error. Processing With Crm Admin : \n", error)
        return getCrmAdminOwnerID(OWNER_USER_ID_BASE_URL, options);
    }
}

async function getCrmAdminOwnerID(OWNER_USER_ID_BASE_URL, options) {
    try {
        let ownerIdUrl = OWNER_USER_ID_BASE_URL + 'crm admin';
        console.info("Crm Admin Owner Id Url : \n", JSON.stringify(ownerIdUrl));
        const OWNER_USER_ID = await axios.get(ownerIdUrl, options);
        let ownerIdRes = OWNER_USER_ID['data']['Id'];
        if (typeof ownerIdRes != 'undefined') {
            return ownerIdRes;
        }
        return false;
    } catch (ownerIderror) {
        console.error("Crm Admin Owner Id Error : \n", ownerIderror);
        return false;
    }
}

module.exports = { getOwnerID, getCrmAdminOwnerID }