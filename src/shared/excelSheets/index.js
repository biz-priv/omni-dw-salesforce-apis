const excel = require('excel4node');

//Some logic
function generateExcelSheet(array, worksheet, styleForData) {
    console.info("array",array);
    let row = 2;//Row starts from 2 as 1st row is for headers.
    for (let i in array) {
        let o = 1;
        //This depends on numbers of columns to fill.
        worksheet.cell(row, o).string(array[i]['Status']).style(styleForData);
        worksheet.cell(row, o + 1).string(array[i]['Request Params']).style(styleForData);
        worksheet.cell(row, o + 2).string(array[i]['Response']).style(styleForData);
        row = row + 1;
    }
}



async function itemInsertintoExcel(parentDataArr, childDataArr, forecastDetailsArr) {

    try {
        console.info('creating sheets')
        
        let workbook = new excel.Workbook();
        // Add Worksheets to the workbook
        let worksheet = workbook.addWorksheet('Parent Data');
        let worksheet1 = workbook.addWorksheet('Child Data');
        let worksheet2 = workbook.addWorksheet('Forecast Data');
        let style = workbook.createStyle({
            font: {
                color: '#47180E',
                size: 12
            },
            numberFormat: '$#,##0.00; ($#,##0.00); -'
        });

        let styleForData = workbook.createStyle({
            font: {
                color: '#47180E',
                size: 10
            },
            alignment: {
                wrapText: true,
                horizontal: 'center',
            },
            numberFormat: '$#,##0.00; ($#,##0.00); -'
        });
        //Tab 1 headers
        worksheet.cell(1, 1).string('Status').style(style);
        worksheet.cell(1, 2).string('Request Params').style(style);
        worksheet.cell(1, 3).string('Response').style(style);


        //Tab 2 headers
        worksheet1.cell(1, 1).string('Status').style(style);
        worksheet1.cell(1, 2).string('Request Params').style(style);
        worksheet1.cell(1, 3).string('Response').style(style);

        //Tab 3 headers 
        worksheet2.cell(1, 1).string('Status').style(style);
        worksheet2.cell(1, 2).string('Request Params').style(style);
        worksheet2.cell(1, 3).string('Response').style(style);

        generateExcelSheet(parentDataArr, worksheet, styleForData);
        generateExcelSheet(childDataArr, worksheet1, styleForData)
        generateExcelSheet(forecastDetailsArr, worksheet2, styleForData)
        workbook.write('/tmp/salesforceFailedRecords.xlsx');

    } catch (e) {
        console.error("itemInsert in Excel Error: ", e);
        return e;
    }

    // console.info(params)

}

module.exports = { itemInsertintoExcel }