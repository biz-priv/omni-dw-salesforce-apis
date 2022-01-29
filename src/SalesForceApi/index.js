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
        let sqlQuery = `select * from datamart.sf_sales_summary where year >= '2022' and (load_create_date >= '${queryTime}' or load_update_date >= '${queryTime}' )`;
        let dbResponse = await client.query(sqlQuery);
        let result = dbResponse.rows;

        await client.end();
        if (!result.length) {
            console.info("No Records Found");
            return send_response(400, JSON.stringify("No Records Found"));
        }
        let count = 0;
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
            parentDataExcellObj['Status'] = 'success'
            parentDataExcellObj['Request Params'] = PARENT_ACCOUNT_PARAMS;
            parentDataExcellObj['Response'] = createParent['data'];

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
            let createChildAccountRes = await createChildAccount(CHILD_ACCOUNT_URL, childAccountBody, options, childDataExcellObj);
            // console.info("createChildAccountRes :\n", createChildAccountRes);
            let childDynamoData = {};
            let saleForecastData = {};
            if (createChildAccountRes != false) {
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

                // parent objects for excel sheets 


                // console.info("Child Dynamo Data : \n", childDynamoData)

                let selecselectedSaleForcastIdEndpoint = `${sourceSystem}${billToNumber}${controllingCustomerNumber}${year}`;
                let selectedSaleForcastId = await fetchSalesForecastRecordId(options, selecselectedSaleForcastIdEndpoint, SALES_FORECAST_RECORD_ID_URL);
                // console.info("selectedSaleForcastId : \n", JSON.stringify(selectedSaleForcastId));
                if (selectedSaleForcastId != null) {
                    customerUniqueId = `${sourceSystem}${billToNumber}${controllingCustomerNumber}${year}${month}`;
                    let upsertSalesForecastDetail = await upsertSalesForecastDetails(options, customerUniqueId, childName, year, month, totalCharge, totalCost, selectedSaleForcastId, UPSERT_SALES_FORECAST_DETAILS_BASE_URL, forecastDataExcellObj);
                    if (upsertSalesForecastDetail != false) {
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
                                    req_Name: `${childName} ${year} ${month}`,
                                    req_Year__c: year,
                                    req_Month__c: month,
                                    req_Date__c: `${year}-${month}-01`,
                                    req_Total_Charge__c: totalCharge,
                                    req_Total_Cost__c: totalCost,
                                    req_Sales_Forecast__c: selectedSaleForcastId,
                                    res_Sale_Forcast_Id: "Null",
                                    res_Forcast_Data: "Null",
                                    api_insert_Status: false,
                                    created_At: createdAt
                                }
                            }
                        }

                        parentDataExcellArr.push(parentDataExcellObj);
                        childDataExcellArr.push(childDataExcellObj);
                        forecastDataExcellArr.push(forecastDataExcellObj);

                        // console.info("Unable to send Forecast Detail Payload : " + JSON.stringify(saleForecastData));
                    }
                }
                else {
                    saleForecastData = {
                        PutRequest: {
                            Item: {
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
                    }

                    forecastDataExcellObj['Status'] = "failed";
                    forecastDataExcellObj['Request Params'] = {
                        req_Name: `${childName} ${year} ${month}`,
                        req_Year__c: year,
                        req_Month__c: month,
                        req_Date__c: `${year}-${month}-01`,
                        req_Total_Charge__c: totalCharge,
                        req_Total_Cost__c: totalCost,
                        api_insert_Status: false,
                        created_At: createdAt
                    };
                    forecastDataExcellObj['Response'] = {
                        req_Sales_Forecast__c: "Null",
                        res_Sale_Forcast_Id: "Null",
                        res_Forcast_Data: "Null"
                    };

                    parentDataExcellArr.push(parentDataExcellObj);
                    childDataExcellArr.push(childDataExcellObj);
                    forecastDataExcellArr.push(forecastDataExcellObj);

                    // console.info("Unable to send Forecast Detail Payload : " + JSON.stringify(saleForecastData));
                }
            }
            else {
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
                            res_child_account_id: "Null",
                            api_insert_Status: false,
                            created_At: createdAt
                        }
                    }
                }
                // console.info("Child Dynamo Data : \n", childDynamoData);

                forecastDataExcellObj['Status'] = "failed";
                forecastDataExcellObj['Request Params'] = {
                    "Name": `${childName} ${year} ${month}`,
                    "Year__c": year,
                    "Month__c": month,
                    "Date__c": `${year}-${month}-01`,
                    "Total_Charge__c": totalCharge,
                    "Total_Cost__c": totalCost,
                    "Sales_Forecast__c": "Null"
                }
                forecastDataExcellObj['Response'] = "Null";

                parentDataExcellArr.push(parentDataExcellObj);
                childDataExcellArr.push(childDataExcellObj);
                forecastDataExcellArr.push(forecastDataExcellObj);
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
            // if (count == 25) {
            //     break;
            // }
            // count += 1;
        }

        // console.info("Parent Data Arr", JSON.stringify(parentDataArr));

        // console.info("Child DAta Arr", JSON.stringify(childDataArr));

        // console.info("Forecast details arr", JSON.stringify(forecastDetailsArr));

        // console.info("Parent Excel Data : \n", parentDataExcellArr);
        // console.info("Child Excel Data : \n", childDataExcellArr);
        // console.info("Forecast Excel Data : \n", forecastDataExcellArr);

        await Promise.all([
            Dynamo.itemInsert(PARENT_ACCOUNT_TABLE, parentDataArr),
            Dynamo.itemInsert(CHILD_ACCOUNT_TABLE, childDataArr),
            Dynamo.itemInsert(SALE_FORECAST_TABLE, forecastDetailsArr)
        ]);
        await EXCEL.itemInsertintoExcel(parentDataArr, childDataArr);
        await SENDEMAIL.sendEmail();
        createdAt = new Date().toISOString();
        // let updateTimestamp = await SSM.updateLatestTimestampToSSM(createdAt);
        return send_response(200);
    } catch (error) {
        console.error("Error Error : \n" + error);
        return send_response(400, error);
    }
}

async function getOwnerID(OWNER_USER_ID_BASE_URL, options, owner) {
    try {
        let ownerIdUrl = OWNER_USER_ID_BASE_URL + owner;

        // console.info("Owner User ID Endpoint : \n", JSON.stringify(ownerIdUrl));
        const OWNER_USER_ID = await axios.get(ownerIdUrl, options);
        // console.info('executed db owner id query');
        // console.info("Owner User ID Response : \n", OWNER_USER_ID['data']);
        let ownerIdRes = OWNER_USER_ID['data']['Id'] ? OWNER_USER_ID['data']['Id'] : "Not Available";
        // console.info("ownerIdRes : \n", JSON.stringify(ownerIdRes));
        // console.info("\n \n");
        return ownerIdRes;
    } catch (error) {
        // console.info("catch owner id error : \n", error)
        try {
            let ownerIdUrl = OWNER_USER_ID_BASE_URL + 'crm admin';
            console.info("Owner User crm admin Endpoint : \n", JSON.stringify('crm admin'));
            const OWNER_USER_ID = await axios.get(ownerIdUrl, options);
            console.info('executed crm admin owner id query')
            // console.info("Owner User ID Response : \n", OWNER_USER_ID['data']);
            let ownerIdRes = OWNER_USER_ID['data']['Id'] ? OWNER_USER_ID['data']['Id'] : "Not Available";
            console.info("Catch ownerIdRes : \n", JSON.stringify(ownerIdRes));
            console.info("\n \n");
            return ownerIdRes;
        } catch (ownerIderror) {
            console.error("ownerIderror : \n", ownerIderror);
            return null;
        }
    }

}

async function createChildAccount(CHILD_ACCOUNT_URL, childAccountBody, options, childDataExcellObj) {
    let resChildAccountId = "";
    try {
        const createChildAccountReq = await axios.patch(CHILD_ACCOUNT_URL, childAccountBody, options);
        // console.info("Child Account Response: \n", createChildAccountReq.data);
        resChildAccountId = createChildAccountReq.data.id;
        childDataExcellObj['Status'] = 'success';
        childDataExcellObj['Request Params'] = childAccountBody;
        childDataExcellObj['Response'] = createChildAccountReq.data;
        return resChildAccountId;
    } catch (error) {

        // console.error("Error : \n" + error.response.data);
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
                        return resChildAccountId;
                    }
                } catch (newError) {
                    console.error("Error : \n" + newError);
                    return false;
                    // return send_response(401, newError);
                }
            }
        }
        else {
            childDataExcellObj['Status'] = 'failed';
            childDataExcellObj['Response'] = error;
            return false;
            // console.error("Error : \n", error);
        }
        childDataExcellObj['Status'] = 'failed';
        childDataExcellObj['Response'] = error.response;
        return false;
        // return send_response(400, error);
    }
}

function checkDuplicateEntry(findValue) {
    if (findValue.errorCode != "undefined" && findValue.errorCode.toUpperCase().trim() == "DUPLICATES_DETECTED") {
        childDataExcellObj['Status'] = 'success';
        childDataExcellObj['Response'] = findValue.errorCode;
    }
    return null;
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
        let forecastId = forecastRecordsData['data']['Id'] ? forecastRecordsData['data']['Id'] : null;
        // console.info("Forecast ID : \n", JSON.stringify(forecastId));
        return forecastId;
        // return (validateForecastRecordsData(forecastRecordsData) ? forecastRecordsData['data']['Id'] : null);
    } catch (error) {
        // console.error("Error from sale forecast record fetch id api: ", error);
        return null;
    }
}

async function upsertSalesForecastDetails(options, customerUniqueId, childAccountName, year, month, totalCharge, totalCost, selectedSaleForcastId, UPSERT_SALES_FORECAST_DETAILS_BASE_URL, forecastDataExcellObj) {
    try {
        let upsertSalesForecastDetailUrl = UPSERT_SALES_FORECAST_DETAILS_BASE_URL + customerUniqueId;
        // console.info("Upsert Sales Forecast Detail Url : \n", JSON.stringify(upsertSalesForecastDetailUrl));
        let upsertSalesForecastDetailBody = {
            "Name": `${childAccountName} ${year} ${month}`,
            "Year__c": year,
            "Month__c": month,
            "Date__c": `${year}-${month}-01`,
            "Total_Charge__c": totalCharge,
            "Total_Cost__c": totalCost,
            "Sales_Forecast__c": selectedSaleForcastId
        };
        // console.info("Upsert Sales Forcast Params : \n" + JSON.stringify(upsertSalesForecastDetailBody));
        let upsertSalesForecastDetail = await axios.patch(upsertSalesForecastDetailUrl, upsertSalesForecastDetailBody, options);
        // console.info("Upsert Sales Forcast Response : \n" + JSON.stringify(upsertSalesForecastDetail.data));

        forecastDataExcellObj['Status'] = "success";
        forecastDataExcellObj['Request Params'] = upsertSalesForecastDetailBody;
        forecastDataExcellObj['Response'] = upsertSalesForecastDetail.data;

        return upsertSalesForecastDetail.data;
    }
    catch (error) {
        // console.error("Error from sale forecast api: " + JSON.stringify(error));
        forecastDataExcellObj['Status'] = "failed";
        forecastDataExcellObj['Request Params'] = upsertSalesForecastDetailBody;
        forecastDataExcellObj['Response'] = error;
        return false;
    }
}