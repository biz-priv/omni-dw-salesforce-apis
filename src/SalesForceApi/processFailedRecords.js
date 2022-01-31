const { generateAccessToken } = require('./generateAccessToken');
const { createChildAccount } = require('./handleCreateChildAccount');
const { fetchSalesForecastRecordId, upsertSalesForecastDetails } = require('./handleSaleForcastDetail');
const { sendEmail, sendProcessedRecordsEmail } = require('../shared/sendEmail/index');
const Dynamo = require('../shared/dynamoDb/index');
const { Client } = require("pg");
const axios = require('axios');

const TOKEN_BASE_URL = process.env.TOKEN_BASE_URL;
const PARENT_ACCOUNT_RECORD_TYPE_ID = process.env.PARENT_RECORDS_TYPE_ID;
const CHILD_ACCOUNT_RECORD_TYPE_ID = process.env.CHILD_RECORD_TYPE_ID;
const CHILD_ACCOUNT_TABLE = process.env.CHILD_ACCOUNT_DYNAMO_TABLE;
const SALE_FORECAST_TABLE = process.env.SALE_FORECAST_DYNAMO_TABLE;
module.exports.handler = async (event) => {
    // console.info("Event: ", JSON.stringify(event));

    let childTableName = `salesforce_child_accounts_records`;
    let parentTableName = `salesforce_parent_account_records`;
    let forecastTableName = `sales_forecast_records`;
    let parentReqNamesArr = [];
    let forecastDetailsReqNamesArr = [];

    let loopCount = 0;
    let DbDataCount = 0;
    let hasMoreData = "false";
    
    try {
        let childFailedRecords = await Dynamo.scanTableData(childTableName);
        let parentFailedRecords = await Dynamo.scanTableData(parentTableName);
        let forecastFailedRecords = await Dynamo.scanTableData(forecastTableName);

        const parentAccountFailureCount = parentFailedRecords.length;
        const childAccountFailureCount = childFailedRecords.length;
        const forecastDetailsFailureCount = forecastFailedRecords.length;

        DbDataCount = parentAccountFailureCount + childAccountFailureCount + forecastDetailsFailureCount;
        // console.info("Child account records : \n", childFailedRecords);
        // console.info("Parent account records : \n", parentFailedRecords);
        // console.info("Forecast Details records : \n", forecastFailedRecords);
        if (parentFailedRecords.length > 0 || childFailedRecords.length > 0 || forecastFailedRecords.length > 0) {
            let token = await generateAccessToken(TOKEN_BASE_URL);
            accessToken = token['access_token'];
            instanceUrl = token['instance_url'];

            const PARENT_ACCOUNT_BASE_URL = instanceUrl + process.env.PARENT_ACCOUNT_BASE_URL;
            const OWNER_USER_ID_BASE_URL = instanceUrl + process.env.OWNER_USER_ID_BASE_URL;
            const CHILD_ACCOUNT_BASE_URL = instanceUrl + process.env.CHILD_ACCOUNT_BASE_URL;
            const SALES_FORECAST_RECORD_ID_URL = instanceUrl + process.env.SALES_FORECAST_RECORD_ID_BASE_URL;
            const UPSERT_SALES_FORECAST_DETAILS_BASE_URL = instanceUrl + process.env.UPSERT_SALES_FORECAST_DETAILS_BASE_URL;

            let options = {
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${accessToken}`,
                }
            };
            const [childRecords,childLoopCount] = await handleChildFailedRecords(OWNER_USER_ID_BASE_URL, CHILD_ACCOUNT_BASE_URL, childFailedRecords, options);
            loopCount += childLoopCount;
            if (childRecords.length > 0) {
                Dynamo.itemInsert(CHILD_ACCOUNT_TABLE, childRecords)
            }

            const [forecastRecords,forecastLoopCount] = await handleForecastFailedRecords(SALES_FORECAST_RECORD_ID_URL, UPSERT_SALES_FORECAST_DETAILS_BASE_URL, forecastFailedRecords, options)
            loopCount += forecastLoopCount;
            if (forecastRecords.length > 0) {
                Dynamo.itemInsert(SALE_FORECAST_TABLE, forecastRecords)
            }

            
            let mailSubject = "SalesForce Processed Records";
            let mailBody = "Hello,<br>Total Parent Account Processed Failed Records Count : <b>" + parentAccountFailureCount + "</b><br>" + "Total Child Account Processed Failed Records Count : <b>" + childAccountFailureCount + "</b><br>" + "Total Sale Forecast Detail Processed Failed Records Count : <b>" + forecastDetailsFailureCount + "</b><br>" + "</b><Br>Thanks."
            await sendProcessedRecordsEmail(mailSubject, mailBody);
        }
    }
    catch (error) {
        console.info(error);

    }
    if (loopCount == DbDataCount) {
        hasMoreData = "false";
    } else {
        hasMoreData = "true";
    }
    return { hasMoreData };
}

async function handleChildFailedRecords(OWNER_USER_ID_BASE_URL, CHILD_ACCOUNT_BASE_URL, childFailedRecords, options) {
    let childReqNamesArr = [];
    let childParentIdsArr = [];
    let childDataArr = [];
    let childLoopCount = 0;
    if (childFailedRecords.length != 0) {

        for (key in childFailedRecords) {
            let sourceSystem = childFailedRecords[key]['req_Source_System__c'];
            let billToNumber = childFailedRecords[key]['req_Bill_To_Number__c'];
            let controllingCustomerNumber = childFailedRecords[key]['req_Controlling_Number__c'];
            let childName = childFailedRecords[key]['req_Name'];
            let ownerId = childFailedRecords[key]['req_OwnerId'];
            let billingStreet = childFailedRecords[key]['req_BillingStreet'];
            let city = childFailedRecords[key]['req_BillingCity'];
            let state = childFailedRecords[key]['req_BillingState'];
            let country = childFailedRecords[key]['req_BillingCountry'];
            let postalCode = childFailedRecords[key]['req_BillingPostalCode'];
            let parentDataId = childFailedRecords[key]['req_ParentId'];

            const CHILD_ACCOUNT_URL = CHILD_ACCOUNT_BASE_URL + `${sourceSystem}-${billToNumber}-${controllingCustomerNumber}`;

            console.info("Child Account Id Url : \n", CHILD_ACCOUNT_URL);

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

            console.info("Child Account Params : \n" + JSON.stringify(childAccountBody));

            const [createChildAccountRes, createChildExecutionStatus] = await createChildAccount(OWNER_USER_ID_BASE_URL, CHILD_ACCOUNT_URL, childAccountBody, options);
            // console.info("createChildAccountRes :\n", createChildAccountRes);
            console.info("createChildExecutionStatus :\n", createChildExecutionStatus);
            if (createChildExecutionStatus != false) {
                let createdAt = new Date().toISOString();
                console.log(parentDataId);
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
                            res_child_account_id: createChildAccountRes,
                            api_insert_Status: true,
                            created_At: createdAt
                        }
                    }
                };
                // if (!childReqNamesArr.includes(childName) && !childParentIdsArr.includes(parentDataId)) {
                childDataArr.push(childDynamoData);
                childReqNamesArr.push(childName);
                childParentIdsArr.push(parentDataId);
                // }
            }
            // if(childLoopCount >= 12){
            //     break;
            // }
            childLoopCount += 1;
        }
    }
    return [childDataArr,childLoopCount];
}

async function handleForecastFailedRecords(SALES_FORECAST_RECORD_ID_URL, UPSERT_SALES_FORECAST_DETAILS_BASE_URL, forecastDetailsFailedRecords, options) {
    let forecastDetailsReqNamesArr = [];
    let forecastDetailsParentIdsArr = [];
    let forecastDetailsDataArr = [];
    let forecastLoopCount = 0;
    if (forecastDetailsFailedRecords.length != 0) {
        for (key in forecastDetailsFailedRecords) {
            let customerUniqueId = forecastDetailsFailedRecords[key]['unique_Record_ID'];
            let sourceSystem = forecastDetailsFailedRecords[key]['sourceSystem'];
            let billToNumber = forecastDetailsFailedRecords[key]['billToNumber'];
            let controllingCustomerNumber = forecastDetailsFailedRecords[key]['controllingCustomerNumber'];
            let year = forecastDetailsFailedRecords[key]['req_Year__c'];
            let childName = forecastDetailsFailedRecords[key]['req_ChildName'];
            let month = forecastDetailsFailedRecords[key]['req_Month__c'];
            let totalCharge = forecastDetailsFailedRecords[key]['req_Total_Charge__c'];
            let totalCost = forecastDetailsFailedRecords[key]['req_Total_Cost__c'];

            let selecselectedSaleForcastIdEndpoint = `${sourceSystem}${billToNumber}${controllingCustomerNumber}${year}`;
            const [selectedSaleForcastId, fetchSalesForecastIdStatus] = await fetchSalesForecastRecordId(options, selecselectedSaleForcastIdEndpoint, SALES_FORECAST_RECORD_ID_URL);
            if (fetchSalesForecastIdStatus != false) {

                const [upsertSalesForecastDetail, upsertForecastStatus, upsertForecastPayload] = await upsertSalesForecastDetails(options, customerUniqueId, childName, year, month, totalCharge, totalCost, selectedSaleForcastId, UPSERT_SALES_FORECAST_DETAILS_BASE_URL);
                if (upsertForecastStatus != false) {
                    let createdAt = new Date().toISOString();
                    let forecastDetailsDynamoData = {
                        PutRequest: {
                            Item: {
                                unique_Record_ID: customerUniqueId,
                                sourceSystem: sourceSystem,
                                billToNumber: billToNumber,
                                controllingCustomerNumber: controllingCustomerNumber,
                                req_Name: `${childName} ${year} ${month}`,
                                req_ChildName: childName,
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
                    };
                    // if (!childReqNamesArr.includes(childName) && !childParentIdsArr.includes(parentDataId)) {
                    forecastDetailsDataArr.push(forecastDetailsDynamoData);
                    // forecastDetailsReqNamesArr.push(forecastDetailsName);
                    // forecastDetailsParentIdsArr.push(parentDataId);
                    // }
                }
            }
            // if(forecastLoopCount >= 12){
            //     break;
            // }
            forecastLoopCount += 1;

        }
    }
    return [forecastDetailsDataArr, forecastLoopCount];
}