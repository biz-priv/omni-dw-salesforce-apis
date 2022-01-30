const nodemailer = require("nodemailer");
const fs = require('fs')
const sftpClient = require('ssh2').Client;
// const { resolve } = require('path');


async function sendEmail(parentAccountFailureCount,childAccountFailureCount,forecastDetailsFailureCount) {
    return new Promise((resolve, reject) => {
        try {
            const TRANSPORTER = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASSWORD,
                },
            });
            TRANSPORTER.sendMail(
                {
                    from: process.env.SMTP_SENDER,
                    to: process.env.SMTP_RECEIVER,
                    subject: "SalesForce Failed Records",
                    text: "Hello,<br>Total Parent Account Error Records Count : " + parentAccountFailureCount + "<br>" + "Total Child Account Error Records Count : " + childAccountFailureCount + "<br>" + "Total Child Account Error Records Count : " + forecastDetailsFailureCount + "<br>" + "PFA report for failed records for Salesforce APIs.<Br>Thanks.",
                    html: "Hello,<br>Total Parent Account Error Records Count : <b>" + parentAccountFailureCount + "</b><br>" + "Total Child Account Error Records Count : <b>" + childAccountFailureCount + "</b><br>" + "Total Sale Forecast Detail Error Records Count : <b>" + forecastDetailsFailureCount + "</b><br>" + "<b>PFA report for failed records for Salesforce APIs.</b><Br>Thanks.",
                    attachments: [
                        {
                            filename: 'salesForceFailedRecords.xlsx',
                            path: '/tmp/salesforceFailedRecords.xlsx'
                        },
                    ],
                },
                (error, info) => {
                    if (error) {
                        fs.unlinkSync('/tmp/salesforceFailedRecords.xlsx')
                        console.error("Email Error occurred : \n" + JSON.stringify(err));
                        reject(err)
                    }
                    fs.unlinkSync('/tmp/salesforceFailedRecords.xlsx')
                    console.info("Email sent : \n", JSON.stringify(info));
                    resolve(info)
                }
            );
            return true;
        } catch (error) {
            console.error("Error : \n", error);
            return false;
        }
    })
}

module.exports = { sendEmail }

