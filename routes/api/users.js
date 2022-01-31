const express = require('express')
const { NotFound, BadRequest } = require('http-errors')
const path = require('path')
const fs = require('fs/promises')
const Jimp = require('jimp')

const { SITE_NAME } = process.env

const { User } = require('../../models')
const { patchSubscriptionJoiSchema } = require('../../models/user')
const { authenticate, upload } = require('../../middlewares')
const { sendEmail } = require('../../helpers')

const router = express.Router()

const avatarsDir = path.join(__dirname, '../../', 'public', 'avatars')

router.get('/logout', authenticate, async (req, res) => {
  const { _id } = req.user
  await User.findByIdAndUpdate(_id, { token: null })
  res.sendStatus(204)
})

router.get('/current', authenticate, async (req, res) => {
  const { _id, email } = req.user
  res.json({
    user: {
      _id,
      email,
    },
  })
})

router.get('/verify/:verificationToken', async (req, res, next) => {
  try {
    const { verificationToken } = req.params
    const user = await User.findOne({ verificationToken })
    if (!user) {
      throw new NotFound('User not found')
    }
    await User.findByIdAndUpdate(user._id, {
      verificationToken: null,
      verify: true,
    })
    res.json({
      message: 'Verification successful',
    })
  } catch (error) {
    next(error)
  }
})

router.post('/verify', async (req, res, next) => {
  try {
    const { email } = req.body
    if (!email) {
      throw new BadRequest('missing required field email')
    }
    const user = await User.findOne({ email })
    if (!user) {
      throw new NotFound('User not found')
    }
    if (user.verify) {
      throw new BadRequest('Verification has already been passed')
    }

    const { verificationToken } = user
    const data = {
      to: email,
      subject: 'email confirmation',
      html: `<a target="_blank" href="${SITE_NAME}/users/verify/${verificationToken}">please, confirm your email</a>`,
    }

    await sendEmail(data)

    res.json({ message: 'Verification email sent' })
  } catch (error) {
    next(error)
  }
})

router.patch('/', authenticate, async (req, res, next) => {
  try {
    const { error } = patchSubscriptionJoiSchema.validate(req.body)
    if (error) {
      throw new BadRequest(error.message)
    }
    const { _id } = req.user
    const updated = await User.findOneAndUpdate(_id, req.body, { new: true })
    if (!updated) {
      throw new NotFound()
    }
    res.json(updated)
  } catch (error) {
    next(error)
  }
})
router.patch(
  '/avatars',
  authenticate,
  upload.single('avatar'),
  async (req, res, next) => {
    try {
      const { path: tempUpload, filename } = req.file
      const [extension] = await squeeze(tempUpload, filename)
      const newFleName = `${req.user._id}.${extension}`
      const fileUpload = path.join(avatarsDir, newFleName)
      await fs.rename(tempUpload, fileUpload)
      const avatarURL = path.join('avatars', newFleName)
      await User.findByIdAndUpdate(req.user._id, { avatarURL }, { new: true })
      res.json({ avatarURL })
    } catch (error) {
      next(error)
    }
  })

async function squeeze(pathToFile, filename) {
  const image = await Jimp.read(`${pathToFile}`)
  await image.resize(256, 256)
  await image.writeAsync(`${pathToFile}`)
  return filename.split('.').reverse()
}
module.exports = router
