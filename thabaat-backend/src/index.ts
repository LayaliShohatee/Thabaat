import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

// Health check — confirms backend is running
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Thabaat backend is running' })
})


import notifyRouter from './routes/notify'
app.use('/notify', notifyRouter)

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Thabaat backend running on port ${PORT}`)
})

export default app