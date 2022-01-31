const nodemailer = require("nodemailer");
const fs = require('fs')
const sftpClient = require('ssh2').Client;
// const { resolve } = require('path');


async function sendEmail(mailSubject,body) {
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
                    subject: mailSubject,
                    html: body,
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

async function sendProcessedRecordsEmail(mailSubject,body) {
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
                    subject: mailSubject,
                    html: body,
                },
                (error, info) => {
                    if (error) {
                        console.error("Email Error occurred : \n" + JSON.stringify(err));
                        reject(err)
                    }
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
module.exports = { sendEmail,sendProcessedRecordsEmail }

