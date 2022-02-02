const sgMail = require('@sendgrid/mail')
require('dotenv').config()

const { SENDGRID_API_KEY, MY_MAIL } = process.env

sgMail.setApiKey(SENDGRID_API_KEY)

const sendEmail = async (data) => {
  // eslint-disable-next-line no-useless-catch
  try {
    const email = { ...data, from: MY_MAIL }
    await sgMail.send(email)
    return true
  } catch (error) {
    throw error
  }
}
module.exports = sendEmail
