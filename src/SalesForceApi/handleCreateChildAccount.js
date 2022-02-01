
const axios = require('axios');
const {getOwnerID,getCrmAdminOwnerID} = require('./getOwnerId');

async function createChildAccount(OWNER_USER_ID_BASE_URL,CHILD_ACCOUNT_URL, childAccountBody, options) {
    let resChildAccountId = "";
    try {
        const createChildAccountReq = await axios.patch(CHILD_ACCOUNT_URL, childAccountBody, options);
        resChildAccountId = createChildAccountReq.data.id;
        return [resChildAccountId,true];
    } catch (error) {
        console.error("Create Child Account Error : \n" + error);
        if (error.response.data.length >= 1) {
            let errorResponse = error.response.data[0];
            let childAccountId = checkDuplicateEntry(errorResponse);
            if (childAccountId != null) {
                // childDynamoData['res_child_account_id'] = childAccountId;

                try {
                    let fetchChildAccountsList = await axios.get(FETCH_CHILD_ACCOUNT_BASE_URL, options);
                    let childAccountsApiRecentItems = fetchChildAccountsList.data.recentItems;
                    let checkExistingAccount = findExistingChildAccount(childAccountId, childAccountsApiRecentItems);

                    if (checkExistingAccount.length > 0) {

                        resChildAccountId = childAccountId;
                        return [resChildAccountId,true];
                    }
                } catch (newError) {
                    console.error("Find Existing Child Account Error : \n" + newError);
                    return [JSON.stringify(newError),false];
                    // return send_response(401, newError);
                }
            }
            else if(checkInactiveUserEntry(errorResponse)){
                    console.error("Inactive Owner Account. Fetching ID from CRM Admin");
                    let crmAdminOwnerID = await getCrmAdminOwnerID(OWNER_USER_ID_BASE_URL, options)
                    if(crmAdminOwnerID != false){
                        childAccountBody['OwnerId'] = crmAdminOwnerID;
                        return await createChildAccount(OWNER_USER_ID_BASE_URL,CHILD_ACCOUNT_URL, childAccountBody, options);
                    }
                console.error("Failed Error : \n", error.response.data[0]);
                return [JSON.stringify(error.response.data[0]),false];
            }
        }
        else {
            // console.error("Error : \n", error.response.data[0]);
            return [JSON.stringify(error.response.data[0]),false];
            
        }
        console.error("Line 492 ==> Error : \n", error.response.data[0]);
        return [JSON.stringify(error.response.data[0]),false];
        // return send_response(400, error);
    }
}

function checkDuplicateEntry(findValue) {
    if (typeof findValue.errorCode != "undefined" && findValue.errorCode.toUpperCase().trim() == "DUPLICATES_DETECTED") {
        return findValue.duplicateResut.matchResults[0].matchRecords[0].record.Id;
    }
    return null;
}

function checkInactiveUserEntry(findValue) {
    if (typeof findValue.errorCode != "undefined" && findValue.errorCode.toUpperCase().trim() == "INACTIVE_OWNER_OR_USER") {
        return true;
    }
    return false;
}


function findExistingChildAccount(childAccountID, accountRecords) {
    return accountRecords.filter(
        function (record) { return record.Id == childAccountID }
    );
}


module.exports = { createChildAccount }