const axios = require('axios');

async function fetchSalesForecastId(options) {
    // console.info("Sales Forecast Id Url : \n", JSON.stringify(SALES_FORECAST_RECORD_ID_URL));
    let forecastRecordsData = await axios.get(SALES_FORECAST_RECORD_ID_URL, options);
    // console.info("Sales Forecast Id Response : \n", JSON.stringify(forecastRecordsData['data']['recentItems'][0]['Id']));
    return (validateForecastRecordsData(forecastRecordsData) ? forecastRecordsData['data']['recentItems'][1]['Id'] : null);
}

function validateForecastRecordsData(forecastRecordsData) {
    return ('data' in forecastRecordsData ? (forecastRecordsData.data.id ? true : false) : false);
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

module.exports = { fetchSalesForecastRecordId,upsertSalesForecastDetails }