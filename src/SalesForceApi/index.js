const { send_response } = require('../shared/utils/responses');
const axios = require('axios');
const { Client } = require("pg");
const Dynamo = require("../shared/dynamoDb/index");
const SSM = require("../shared/ssm/index");
const EXCEL = require("../shared/excelSheets/index");
const { sendEmail, sendProcessedRecordsEmail } = require('../shared/sendEmail/index');
const { generateAccessToken } = require('./generateAccessToken');
const { getOwnerID, getCrmAdminOwnerID } = require('./getOwnerId');
const { createChildAccount } = require('./handleCreateChildAccount');
const { createParentAccount } = require('./handleCreateParentAccount');
const { fetchSalesForecastRecordId, upsertSalesForecastDetails } = require('./handleSaleForcastDetail');
const { startXlsxS3Process, fetchAllKeysFromS3, moveS3ObjectToArchive, readS3Object } = require('./handleS3Requests');


const PARENT_ACCOUNT_RECORD_TYPE_ID = process.env.PARENT_RECORDS_TYPE_ID;
const CHILD_ACCOUNT_RECORD_TYPE_ID = process.env.CHILD_RECORD_TYPE_ID;
const PARENT_ACCOUNT_TABLE = process.env.PARENT_ACCOUNT_DYNAMO_TABLE;
const CHILD_ACCOUNT_TABLE = process.env.CHILD_ACCOUNT_DYNAMO_TABLE;
const SALE_FORECAST_TABLE = process.env.SALE_FORECAST_DYNAMO_TABLE;
const TOKEN_BASE_URL = process.env.TOKEN_BASE_URL;
const s3BucketName = process.env.S3_BUCKET_NAME;

async function handleDBOperation(queryTime) {
    // executing sql queries
    const client = new Client({
        database: process.env.DB_DATABASE,
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        user: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
    });
    await client.connect();
    let sqlQuery = `select * from datamart.sf_sales_summary where (load_create_date >= '${queryTime}' or load_update_date >= '${queryTime}')`;
    let dbResponse = await client.query(sqlQuery);
    let result = dbResponse.rows;
    await client.end();

    return result;
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

        let token = await generateAccessToken(TOKEN_BASE_URL);
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

        if (
            event &&
            event.hasOwnProperty("hasMoreData") &&
            event.hasMoreData == "true"
        ) {
            hasMoreData = "false";
        } else {
            hasMoreData = "true";

            let result = await handleDBOperation(queryTime);
            if (result.length > 0) {
                await startXlsxS3Process(s3BucketName, result);
            }
            else {
                hasMoreData = "false";
                console.info("No Records Found");
                return { hasMoreData };
            }
        }

        let s3Keys = await fetchAllKeysFromS3(s3BucketName);
        console.info("S3 Keys : \n", s3Keys);
        if (!s3Keys.length) {
            hasMoreData = false;
            return { hasMoreData };
        }
        let s3FileName = s3Keys[0]['Key'];
        let s3Results = await readS3Object(s3BucketName, s3FileName);
        // console.info("S3 Results : \n ", s3Results);
        // return {result : "true"};
        let result = s3Results;
        if (!result.length) {
            hasMoreData = false;
            console.info("No Records Found");
            return { hasMoreData };
        }
        DbDataCount = s3Keys.length;
        let currentLoadCreateDate = "";
        let currentLoadUpdateDate = "";
        let lastInsertDate = ssmTimestamp;
        //2022-01-24T11:06:50.428Z
        //2022-01-27T12:15:13.621Z
        for (let key in result) {
            owner = result[key]['owner'] ? result[key]['owner'] : "crm admin";
            //owner = result[key]['owner'] ? encodeURIComponent(result[key]['owner']) : "crm admin";
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
            currentLoadCreateDate = result[key]['load_create_date'];
            currentLoadUpdateDate = result[key]['load_update_date'];
            // if (currentLoadCreateDate != null && currentLoadUpdateDate == null) {
            //     lastInsertDate = new Date(currentLoadCreateDate).toISOString();
            // }
            // else if (currentLoadCreateDate == null && currentLoadUpdateDate != null) {
            //     lastInsertDate = new Date(currentLoadUpdateDate).toISOString();
            // }
            // else if (currentLoadCreateDate != null && currentLoadUpdateDate != null) {
            //     lastInsertDate = new Date(currentLoadUpdateDate).toISOString();
            // }

            // return;
            // creating parent account
            const PARENT_ACCOUNT_PARAMS = {
                "Name": parentName,
                "RecordTypeId": PARENT_ACCOUNT_RECORD_TYPE_ID,
            }

            const PARENT_ACCOUNT_URL = PARENT_ACCOUNT_BASE_URL + parentName.replace(/\//g,'%2F').replace(/\\/g,'%5C');
            const [createParentRes, parentIdStatus] = await createParentAccount(PARENT_ACCOUNT_URL, PARENT_ACCOUNT_PARAMS, options);
            if (parentIdStatus == false) {
                let parentResData = createParentRes;
                createdAt = new Date().toISOString();
                let parentData = {
                    PutRequest: {
                        Item: {
                            req_Name: parentName,
                            req_record_type_id: PARENT_ACCOUNT_RECORD_TYPE_ID,
                            res_id: "Null",
                            res_data: parentResData,
                            api_insert_Status: false,
                            created_At: createdAt
                        }
                    }
                };

                if (!parentReqNamesArr.includes(parentName)) {
                    parentReqNamesArr.push(parentName);
                    parentDataArr.push(parentData);
                };

                parentDataExcellObj['Status'] = 'Failed'
                parentDataExcellObj['Request Params'] = JSON.stringify(PARENT_ACCOUNT_PARAMS);
                parentDataExcellObj['Response'] = parentResData;
            }
            else {
                let parentDataId = createParentRes['id'];
                let parentResData = createParentRes;
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
                const [createChildAccountRes, createChildExecutionStatus] = await createChildAccount(OWNER_USER_ID_BASE_URL, CHILD_ACCOUNT_URL, childAccountBody, options,FETCH_CHILD_ACCOUNT_BASE_URL);
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
                    const [selectedSaleForcastId, fetchSalesForecastIdStatus] = await fetchSalesForecastRecordId(options, selecselectedSaleForcastIdEndpoint, SALES_FORECAST_RECORD_ID_URL);
                    if (fetchSalesForecastIdStatus != false) {
                        const [upsertSalesForecastDetail, upsertForecastStatus, upsertForecastPayload] = await upsertSalesForecastDetails(options, customerUniqueId, childName, year, month, totalCharge, totalCost, selectedSaleForcastId, UPSERT_SALES_FORECAST_DETAILS_BASE_URL);
                        // console.info(upsertForecastStatus);
                        if (upsertForecastStatus != false) {
                            saleForecastData = {
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
                            sourceSystem: sourceSystem,
                            billToNumber: billToNumber,
                            controllingCustomerNumber: controllingCustomerNumber,
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
            }
            if (parentDataArr.length >= 20) {
                // console.info(JSON.stringify(parentDataArr));
                console.info("Inserting Parent Data to Dynamo Table");
                await Dynamo.itemInsert(PARENT_ACCOUNT_TABLE, parentDataArr);
                parentDataArr = [];
                parentReqNamesArr = [];

            }
            if (childDataArr.length >= 20) {
                // console.info(JSON.stringify(childDataArr));
                console.info("Inserting Child Data to Dynamo Table");
                await Dynamo.itemInsert(CHILD_ACCOUNT_TABLE, childDataArr);
                childDataArr = [];
                childReqNamesArr = [];
                childParentIdsArr = [];

            }
            if (forecastDetailsArr.length >= 20) {
                // console.info(JSON.stringify(forecastDetailsArr));
                console.info("Inserting Forecast Data to Dynamo Table");
                await Dynamo.itemInsert(SALE_FORECAST_TABLE, forecastDetailsArr);
                forecastDetailsArr = [];
                forecastDetailsReqNamesArr = [];

            }
            // if (loopCount == 100) {
            //     break;
            // }
            loopCount += 1;
        }
        if (parentDataArr.length > 0) {
            console.info("Inserting Parent Data to Dynamo Table");
            await Dynamo.itemInsert(PARENT_ACCOUNT_TABLE, parentDataArr)
        }
        if (childDataArr.length > 0) {
            console.info("Inserting Child Data to Dynamo Table");
            await Dynamo.itemInsert(CHILD_ACCOUNT_TABLE, childDataArr)
        }
        if (forecastDetailsArr.length > 0) {
            console.info("Inserting Forecast Data to Dynamo Table");
            await Dynamo.itemInsert(SALE_FORECAST_TABLE, forecastDetailsArr)
        }

        if (parentDataExcellArr.length > 0 || childDataExcellArr.length > 0 || forecastDataExcellArr.length > 0) {
            try {
                console.info("Preparing Spreadsheet....");
                const parentAccountFailureCount = parentDataExcellArr.length;
                const childAccountFailureCount = childDataExcellArr.length;
                const forecastDetailsFailureCount = forecastDataExcellArr.length;
                console.info("Preparing Spreadsheet for Mail.");
                console.info("Parent Account Error Records Count : " + parentAccountFailureCount);
                console.info("Child Account Error Records Count : " + childAccountFailureCount);
                console.info("Sale Forecast Detail Error Records Count : " + forecastDetailsFailureCount);

                await EXCEL.itemInsertintoExcel(parentDataExcellArr, childDataExcellArr, forecastDataExcellArr);
                let mailSubject = "SalesForce Failed Records";
                let mailBody = "Hello,<br>Total Parent Account Error Records Count : <b>" + parentAccountFailureCount + "</b><br>" + "Total Child Account Error Records Count : <b>" + childAccountFailureCount + "</b><br>" + "Total Sale Forecast Detail Error Records Count : <b>" + forecastDetailsFailureCount + "</b><br>" + "<b>PFA report for failed records for Salesforce APIs.</b><Br>Thanks."
                await sendEmail(mailSubject, mailBody);
            }
            catch (emailExcelError) {
                console.error(emailExcelError);
            }
        }
        createdAt = new Date().toISOString();
        console.info("Moving s3 file to archive");
        await moveS3ObjectToArchive(s3BucketName, s3FileName);
        lastInsertDate = new Date().toISOString();
        let updateTimestamp = await SSM.updateLatestTimestampToSSM(lastInsertDate);
    } catch (error) {
        console.error("Error Error : \n" + error);
    }

    if (DbDataCount <= 1) {
        hasMoreData = "false";
    } else {
        hasMoreData = "true";
    }
    return { hasMoreData };
}





