const { send_response } = require('../shared/utils/responses');
const axios = require('axios');
const { Client } = require("pg");
const Dynamo = require("../shared/dynamoDb/index");
const SSM = require("../shared/ssm/index");
const EXCEL = require("../shared/excelSheets/index");
const SENDEMAIL = require('../shared/sendEmail/index');

const PARENT_ACCOUNT_RECORD_TYPE_ID = process.env.PARENT_RECORDS_TYPE_ID;
const CHILD_ACCOUNT_RECORD_TYPE_ID = process.env.CHILD_RECORD_TYPE_ID;
const PARENT_ACCOUNT_TABLE = process.env.PARENT_ACCOUNT_DYNAMO_TABLE;
const CHILD_ACCOUNT_TABLE = process.env.CHILD_ACCOUNT_DYNAMO_TABLE;
const SALE_FORECAST_TABLE = process.env.SALE_FORECAST_DYNAMO_TABLE;
const TOKEN_BASE_URL = process.env.TOKEN_BASE_URL;

async function generateAccessToken() {
    // generate access token 
    let tokenUrl = TOKEN_BASE_URL;
    // console.info("Access Token Url : \n", JSON.stringify(tokenUrl));
    let response = await axios.post(tokenUrl);
    return response.data;
}

module.exports.handler = async (event) => {
    // console.info("Event: \n", JSON.stringify(event));
    let accessToken = "";
    let instanceUrl = "";
    let sourceSystem = "";
    let billToNumber = "";
    let controllingCustomerNumber = "";
    let year = "";
    let month = "";
    let childName = "";
    let totalCharge = "";
    let totalCost = "";
    let parentName = "";
    let billingStreet = "";
    let city = "";
    let state = "";
    let country = "";
    let postalCode = "";
    let owner = "";

    let createdAt = new Date().toISOString();
    let parentDataArr = [];
    let childDataArr = [];
    let forecastDetailsArr = [];

    let parentReqNamesArr = [];
    let childReqNamesArr = [];
    let childParentIdsArr = [];
    let forecastDetailsReqNamesArr = [];

    let parentDataExcellArr = [];
    let childDataExcellArr = [];
    let forecastDataExcellArr = [];

    let parentDataExcellObj = {};
    let childDataExcellObj = {};
    let forecastDataExcellObj = {};

    let loopCount = 0;
    let DbDataCount = 0;
    let hasMoreData = "false";
    try {

        let token = await generateAccessToken();
        accessToken = token['access_token'];
        instanceUrl = token['instance_url'];
        // console.info("Access Token Response : \n", token);

        const SALES_FORECAST_RECORD_ID_URL = instanceUrl + process.env.SALES_FORECAST_RECORD_ID_BASE_URL;
        const UPSERT_SALES_FORECAST_DETAILS_BASE_URL = instanceUrl + process.env.UPSERT_SALES_FORECAST_DETAILS_BASE_URL;
        const OWNER_USER_ID_BASE_URL = instanceUrl + process.env.OWNER_USER_ID_BASE_URL;
        const PARENT_ACCOUNT_BASE_URL = instanceUrl + process.env.PARENT_ACCOUNT_BASE_URL;
        const CHILD_ACCOUNT_BASE_URL = instanceUrl + process.env.CHILD_ACCOUNT_BASE_URL;
        const FETCH_CHILD_ACCOUNT_BASE_URL = instanceUrl + process.env.FETCH_CHILD_ACCOUNT_BASE_URL;

        let options = {
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            }
        };

        let ssmTimestamp = await SSM.getLatestTimestampFromSSM();
        let assumeTime = new Date(Date.now() - 46800 * 1000).toISOString();
        ssmTimestamp = ssmTimestamp['Parameter']['Value'] ? ssmTimestamp['Parameter']['Value'] : assumeTime;
        let ssmTime = ssmTimestamp.replace("T", " ");
        let queryTime = ssmTime.replace("Z", "");
        // executing sql queries
        const client = new Client({
            database: process.env.DB_DATABASE,
            host: process.env.DB_HOST,
            port: process.env.DB_PORT,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
        });
        await client.connect();
        let sqlQuery = `select * from datamart.sf_sales_summary where year = '2022' and (load_create_date >= '${queryTime}' or load_update_date >= '${queryTime}') limit 15`;
        let dbResponse = await client.query(sqlQuery);
        let result = dbResponse.rows;
        await client.end();
        if (!result.length) {
            console.info("No Records Found");
            return { hasMoreData };
        }
        DbDataCount = result.length;
        let currentLoadCreateDate = "";
        let currentLoadUpdateDate = "";
        let lastInsertDate = "";
        //2022-01-24T11:06:50.428Z
        for (let key in result) {
            owner = result[key]['owner'] ? result[key]['owner'] : "crm admin";
            billingStreet = result[key]['addr1'] ? result[key]['addr1'] : "Not Available";
            city = result[key]['city'] ? result[key]['city'] : "Not Available";
            state = result[key]['state'] ? result[key]['state'] : "Not Available";
            country = result[key]['country'] ? result[key]['country'] : "Not Available";
            postalCode = result[key]['zip'] ? result[key]['zip'] : "Not Available";
            parentName = result[key]['parent'] ? result[key]['parent'] : "Not Available";
            sourceSystem = result[key]['source system'] ? result[key]['source system'] : "Not Available";
            sourceSystem = sourceSystem.trim();
            billToNumber = result[key]['bill to number'] ? result[key]['bill to number'] : "Not Available";
            childName = result[key]['bill to customer'] ? result[key]['bill to customer'] : "Not Available";
            controllingCustomerNumber = result[key]['cntrolling customer number'] ? result[key]['cntrolling customer number'] : "Not Available";
            year = result[key]['year'] ? result[key]['year'] : "Not Available";
            month = result[key]['month'] ? result[key]['month'] : "Not Available";
            totalCharge = result[key]['total charge'] ? result[key]['total charge'] : "Not Available";
            totalCost = result[key]['total cost'] ? result[key]['total cost'] : "Not Available";
            currentLoadCreateDate = result[key]['load_create_date'] ;
            currentLoadUpdateDate = result[key]['load_update_date'] ;
            if(currentLoadCreateDate != null && currentLoadUpdateDate == null){
                lastInsertDate = new Date(currentLoadCreateDate).toISOString();
            }
            else if(currentLoadCreateDate == null && currentLoadUpdateDate != null){
                lastInsertDate = new Date(currentLoadUpdateDate).toISOString();
            }
            else if(currentLoadCreateDate != null && currentLoadUpdateDate != null){
                lastInsertDate = new Date(currentLoadUpdateDate).toISOString();
            }
            
            // return;
            // creating parent account
            const PARENT_ACCOUNT_PARAMS = {
                "Name": parentName,
                "RecordTypeId": PARENT_ACCOUNT_RECORD_TYPE_ID,
            }

            const PARENT_ACCOUNT_URL = PARENT_ACCOUNT_BASE_URL + parentName;
            let createParent = await axios.patch(PARENT_ACCOUNT_URL, PARENT_ACCOUNT_PARAMS, options);
            let parentDataId = createParent.data['id'] ? createParent.data['id'] : "Not Available";
            let parentResData = createParent.data ? createParent.data : "No Response";
            // console.info("Parent Account Params : " + JSON.stringify(PARENT_ACCOUNT_PARAMS));
            // console.info("Parent Account Url : " + JSON.stringify(PARENT_ACCOUNT_URL));
            // console.info("Create Parent Response : " + JSON.stringify(createParent.data));

            createdAt = new Date().toISOString();

            let parentData = {
                PutRequest: {
                    Item: {
                        req_Name: parentName,
                        req_record_type_id: PARENT_ACCOUNT_RECORD_TYPE_ID,
                        res_id: parentDataId,
                        res_data: parentResData,
                        api_insert_Status: true,
                        created_At: createdAt
                    }
                }
            };

            // parent objects for excel sheets 
            // parentDataExcellObj['Status'] = 'success'
            // parentDataExcellObj['Request Params'] = JSON.stringify(PARENT_ACCOUNT_PARAMS);
            // parentDataExcellObj['Response'] = createParent['data'];

            if (!parentReqNamesArr.includes(parentName)) {
                parentReqNamesArr.push(parentName);
                parentDataArr.push(parentData);
            };

            // generating owner id 

            const ownerId = await getOwnerID(OWNER_USER_ID_BASE_URL, options, owner);
            // console.info("Owner User ID returned from function : \n", ownerId);

            const CHILD_ACCOUNT_URL = CHILD_ACCOUNT_BASE_URL + `${sourceSystem}-${billToNumber}-${controllingCustomerNumber}`;

            // console.info("Child Account Id Url : \n", CHILD_ACCOUNT_URL);

            let childAccountBody = {
                "Name": childName,
                "Source_System__c": sourceSystem,
                "OwnerId": ownerId,
                "BillingStreet": billingStreet,
                "BillingCity": city,
                "BillingState": state,
                "BillingCountry": country,
                "BillingPostalCode": postalCode,
                "Bill_To_Only__c": true,
                "Controlling_Only__c": true,
                "Bill_To_Number__c": billToNumber,
                "Controlling_Number__c": controllingCustomerNumber,
                "ParentId": parentDataId,
                "RecordTypeId": CHILD_ACCOUNT_RECORD_TYPE_ID
            };


            // console.info("Child Account Params : \n" + JSON.stringify(childAccountBody));
            const [createChildAccountRes,createChildExecutionStatus] = await createChildAccount(OWNER_USER_ID_BASE_URL,CHILD_ACCOUNT_URL, childAccountBody, options);
            // console.info("createChildAccountRes :\n", createChildAccountRes);
            let childDynamoData = {
                PutRequest: {
                    Item: {
                        req_Name: childName,
                        req_Source_System__c: sourceSystem,
                        req_OwnerId: ownerId,
                        req_BillingStreet: billingStreet,
                        req_BillingCity: city,
                        req_BillingState: state,
                        req_BillingCountry: country,
                        req_BillingPostalCode: postalCode,
                        req_Bill_To_Only__c: true,
                        req_Controlling_Only__c: true,
                        req_Bill_To_Number__c: billToNumber,
                        req_Controlling_Number__c: controllingCustomerNumber,
                        req_ParentId: parentDataId,
                        req_RecordTypeId: CHILD_ACCOUNT_RECORD_TYPE_ID,
                        res_child_account_id: "Null",
                        api_insert_Status: false,
                        created_At: createdAt
                    }
                }
            };
            let customerUniqueId = `${sourceSystem}${billToNumber}${controllingCustomerNumber}${year}${month}`;
            let saleForecastData = {
                PutRequest: {
                    Item: {
                        unique_Record_ID: customerUniqueId,
                        req_Name: `${childName} ${year} ${month}`,
                        req_Year__c: year,
                        req_Month__c: month,
                        req_Date__c: `${year}-${month}-01`,
                        req_Total_Charge__c: totalCharge,
                        req_Total_Cost__c: totalCost,
                        req_Sales_Forecast__c: "Null",
                        res_Sale_Forcast_Id: "Null",
                        res_Forcast_Data: "Null",
                        api_insert_Status: false,
                        created_At: createdAt
                    }
                }
            };
            // console.info(createChildExecutionStatus);
            if (createChildExecutionStatus != false) {
                childDynamoData = {
                    PutRequest: {
                        Item: {
                            req_Name: childName,
                            req_Source_System__c: sourceSystem,
                            req_OwnerId: ownerId,
                            req_BillingStreet: billingStreet,
                            req_BillingCity: city,
                            req_BillingState: state,
                            req_BillingCountry: country,
                            req_BillingPostalCode: postalCode,
                            req_Bill_To_Only__c: true,
                            req_Controlling_Only__c: true,
                            req_Bill_To_Number__c: billToNumber,
                            req_Controlling_Number__c: controllingCustomerNumber,
                            req_ParentId: parentDataId,
                            req_RecordTypeId: CHILD_ACCOUNT_RECORD_TYPE_ID,
                            res_child_account_id: createChildAccountRes,
                            api_insert_Status: true,
                            created_At: createdAt
                        }
                    }
                }
                let selecselectedSaleForcastIdEndpoint = `${sourceSystem}${billToNumber}${controllingCustomerNumber}${year}`;
                const [selectedSaleForcastId,fetchSalesForecastIdStatus] = await fetchSalesForecastRecordId(options, selecselectedSaleForcastIdEndpoint, SALES_FORECAST_RECORD_ID_URL);
                if (fetchSalesForecastIdStatus != false) {
                    const [upsertSalesForecastDetail,upsertForecastStatus, upsertForecastPayload] = await upsertSalesForecastDetails(options, customerUniqueId, childName, year, month, totalCharge, totalCost, selectedSaleForcastId, UPSERT_SALES_FORECAST_DETAILS_BASE_URL, forecastDataExcellObj);
                    // console.info(upsertForecastStatus);
                    if (upsertForecastStatus != false) {
                        saleForecastData = {
                            PutRequest: {
                                Item: {
                                    req_Name: `${childName} ${year} ${month}`,
                                    req_Year__c: year,
                                    req_Month__c: month,
                                    req_Date__c: `${year}-${month}-01`,
                                    req_Total_Charge__c: totalCharge,
                                    req_Total_Cost__c: totalCost,
                                    req_Sales_Forecast__c: selectedSaleForcastId,
                                    res_Sale_Forcast_Id: upsertSalesForecastDetail.id,
                                    res_Forcast_Data: upsertSalesForecastDetail,
                                    api_insert_Status: true,
                                    created_At: createdAt
                                }
                            }
                        }
                        parentDataExcellObj = {};
                        childDataExcellObj = {};
                        forecastDataExcellObj = {};
                    }
                    else {
                        saleForecastData = {
                            PutRequest: {
                                Item: {
                                    unique_Record_ID: customerUniqueId,
                                    req_Name: `${childName} ${year} ${month}`,
                                    req_Year__c: year,
                                    req_Month__c: month,
                                    req_Date__c: `${year}-${month}-01`,
                                    req_Total_Charge__c: totalCharge,
                                    req_Total_Cost__c: totalCost,
                                    req_Sales_Forecast__c: selectedSaleForcastId,
                                    res_Forcast_Data: upsertSalesForecastDetail,
                                    api_insert_Status: false,
                                    created_At: createdAt
                                }
                            }
                        }

                        forecastDataExcellObj['Status'] = "Failed";
                        forecastDataExcellObj['Request Params'] = JSON.stringify(upsertForecastPayload);
                        forecastDataExcellObj['Response'] = upsertSalesForecastDetail;
                        forecastDataExcellArr.push(forecastDataExcellObj);

                        console.info("Line 311 ==> Unable to send Forecast Detail Payload : " + JSON.stringify(saleForecastData));
                    }
                }
                else {
                    forecastDataExcellObj['Status'] = "Failed";
                    forecastDataExcellObj['Request Params'] = JSON.stringify({
                        unique_Record_ID: customerUniqueId,
                        req_Name: `${childName} ${year} ${month}`,
                        req_Year__c: year,
                        req_Month__c: month,
                        req_Date__c: `${year}-${month}-01`,
                        req_Total_Charge__c: totalCharge,
                        req_Total_Cost__c: totalCost,
                        api_insert_Status: false,
                        created_At: createdAt
                    });
                    forecastDataExcellObj['Response'] = selectedSaleForcastId;
                    forecastDataExcellArr.push(forecastDataExcellObj);

                    console.info("Line 330 ==> Unable to send Forecast Detail Payload : " + JSON.stringify(saleForecastData));
                }
            }
            else {
                childDataExcellObj['Status'] = "Failed";
                childDataExcellObj['Request Params'] = JSON.stringify(childAccountBody);
                childDataExcellObj['Response'] = createChildAccountRes;
                childDataExcellArr.push(childDataExcellObj);
            }

            if (!childReqNamesArr.includes(childName) && !childParentIdsArr.includes(parentDataId)) {
                childDataArr.push(childDynamoData);
                childReqNamesArr.push(childName);
                childParentIdsArr.push(parentDataId);
            }

            if (!forecastDetailsReqNamesArr.includes(`${childName} ${year} ${month}`)) {
                forecastDetailsArr.push(saleForecastData);
                forecastDetailsReqNamesArr.push(`${childName} ${year} ${month}`);
            }

            if (parentReqNamesArr.length >= 20) {
                // console.info(JSON.stringify(parentDataArr));
                await Dynamo.itemInsert(PARENT_ACCOUNT_TABLE, parentDataArr);
                parentDataArr = [];
                parentReqNamesArr = [];
                break;
            }
            if (childReqNamesArr.length >= 20) {
                // console.info(JSON.stringify(childDataArr));
                await Dynamo.itemInsert(CHILD_ACCOUNT_TABLE, childDataArr);
                childDataArr = [];
                childReqNamesArr = [];
                childParentIdsArr = [];
                break;
            }
            if (forecastDetailsReqNamesArr.length >= 20) {
                // console.info(JSON.stringify(forecastDetailsArr));
                await Dynamo.itemInsert(SALE_FORECAST_TABLE, forecastDetailsArr);
                forecastDetailsArr = [];
                forecastDetailsReqNamesArr = [];
                break;
            }
            if (loopCount == 2) {
                break;
            }
            loopCount += 1;
        }
        await Promise.all([
            Dynamo.itemInsert(PARENT_ACCOUNT_TABLE, parentDataArr),
            Dynamo.itemInsert(CHILD_ACCOUNT_TABLE, childDataArr),
            Dynamo.itemInsert(SALE_FORECAST_TABLE, forecastDetailsArr)
        ]);
        if(parentDataExcellArr.length > 0 || childDataExcellArr.length > 0 || forecastDataExcellArr.length > 0){
            const parentAccountFailureCount = parentDataExcellArr.length;
            const childAccountFailureCount = childDataExcellArr.length;
            const forecastDetailsFailureCount = forecastDataExcellArr.length;
            console.info("Preparing Spreadsheet for Mail.");
            console.info("Parent Account Error Records Count : " + parentAccountFailureCount);
            console.info("Child Account Error Records Count : " + childAccountFailureCount);
            console.info("Sale Forecast Detail Error Records Count : " + forecastDetailsFailureCount);

            await EXCEL.itemInsertintoExcel(parentDataExcellArr, childDataExcellArr,forecastDataExcellArr);
            await SENDEMAIL.sendEmail(parentAccountFailureCount,childAccountFailureCount,forecastDetailsFailureCount);
        }
        createdAt = new Date().toISOString();
        let updateTimestamp = await SSM.updateLatestTimestampToSSM(lastInsertDate);
    } catch (error) {
        console.error("Error Error : \n" + error);
    }

    if(loopCount == DbDataCount){
        hasMoreData = "false";
      } else {
        hasMoreData = "true";
      }
      return { hasMoreData };
}

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
        return getCrmAdminOwnerID(OWNER_USER_ID_BASE_URL, options, );
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

async function createChildAccount(OWNER_USER_ID_BASE_URL,CHILD_ACCOUNT_URL, childAccountBody, options) {
    let resChildAccountId = "";
    try {
        // console.info(CHILD_ACCOUNT_URL);
        // console.info(JSON.stringify(childAccountBody));
        const createChildAccountReq = await axios.patch(CHILD_ACCOUNT_URL, childAccountBody, options);
        // console.info("Child Account Response: \n", createChildAccountReq.data);
        resChildAccountId = createChildAccountReq.data.id;
        return [resChildAccountId,true];
    } catch (error) {
        console.error("****Error : \n" + error);
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
                    // console.error("Error : \n" + newError);
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
                console.error("**********Failed Error : \n", error.response.data[0]);
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

function validateForecastRecordsData(forecastRecordsData) {
    return ('data' in forecastRecordsData ? (forecastRecordsData.data.id ? true : false) : false);
}

async function fetchSalesForecastId(options) {
    // console.info("Sales Forecast Id Url : \n", JSON.stringify(SALES_FORECAST_RECORD_ID_URL));
    let forecastRecordsData = await axios.get(SALES_FORECAST_RECORD_ID_URL, options);
    // console.info("Sales Forecast Id Response : \n", JSON.stringify(forecastRecordsData['data']['recentItems'][0]['Id']));
    return (validateForecastRecordsData(forecastRecordsData) ? forecastRecordsData['data']['recentItems'][1]['Id'] : null);
}

async function fetchSalesForecastRecordId(options, selecselectedSaleForcastIdEndpoint, SALES_FORECAST_RECORD_ID_URL) {
    try {
        let forecastRecordsDataURl = SALES_FORECAST_RECORD_ID_URL + selecselectedSaleForcastIdEndpoint;
        // console.info("Sales Forecast Id Url : \n", JSON.stringify(forecastRecordsDataURl));
        let forecastRecordsData = await axios.get(forecastRecordsDataURl, options);
        // console.info("Sales Forecast Id Response : \n", forecastRecordsData);
        let forecastId = forecastRecordsData['data']['Id'];
        if(typeof forecastId != 'undefined'){
            // console.info("Forecast ID : \n", forecastId);
            return [forecastId,true];
        }
        return ["Unable to fetch forecast ID",false];
        // return (validateForecastRecordsData(forecastRecordsData) ? forecastRecordsData['data']['Id'] : null);
    } catch (error) {
        console.error("Error from sale forecast record fetch id api: ", error);
        return [JSON.stringify(error), false];
    }
}

async function upsertSalesForecastDetails(options, customerUniqueId, childAccountName, year, month, totalCharge, totalCost, selectedSaleForcastId, UPSERT_SALES_FORECAST_DETAILS_BASE_URL) {
    
    let upsertSalesForecastDetailBody = {
        "Name": `${childAccountName} ${year} ${month}`,
        "Year__c": year,
        "Month__c": month,
        "Date__c": `${year}-${month}-01`,
        "Total_Charge__c": totalCharge,
        "Total_Cost__c": totalCost,
        "Sales_Forecast__c": selectedSaleForcastId
    };

    try {
        let upsertSalesForecastDetailUrl = UPSERT_SALES_FORECAST_DETAILS_BASE_URL + customerUniqueId;
        
        let upsertSalesForecastDetail = await axios.patch(upsertSalesForecastDetailUrl, upsertSalesForecastDetailBody, options);
        // console.info("Upsert Sales Forcast URL : \n" + upsertSalesForecastDetailUrl);
        // console.info("Upsert Sales Forcast Body : \n" + JSON.stringify(upsertSalesForecastDetailBody));
        // console.info("Upsert Sales Forcast Response : \n" + JSON.stringify(upsertSalesForecastDetail.data));
        return [upsertSalesForecastDetail.data,true,upsertSalesForecastDetailBody];
    }
    catch (error) {
        console.error("Error from sale forecast api: " + JSON.stringify(error.response.data));
        return [JSON.stringify(error.response.data),false,upsertSalesForecastDetailBody];
    }
}