import express from 'express'
import dotenv from 'dotenv'
import dayjs from 'dayjs'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import joi from 'joi'
import utf8 from "utf8"
import encodeUtf8 from 'encode-utf8'
import bodyParser from 'body-parser'
import e from 'cors'


dotenv.config()

const dayjS = dayjs()

let mongoClient = new MongoClient(process.env.DATABASE_URL)
const app = express()

app.use(express.json())
app.use(cors())




let db

try {
    await mongoClient.connect()
    db = mongoClient.db()
} catch (error) {
    console.log('Erro no servidor')
}

setInterval(async () => {
    const endDate = new Date()
    const startDate = new Date(endDate - 10 * 1000)
    try {
        let listDeleteds = await db.collection('participants').find({ lastStatus: { $lt: Math.round(new Date(startDate).getTime()) } }).toArray()
        await db.collection('participants').deleteMany({ lastStatus: { $lt: Math.round(new Date(startDate).getTime()) } })

        listDeleteds.map(async item => {
            await db.collection('messages')
                .insertOne({
                    from: item.name,
                    to: 'Todos',
                    text: 'sai da sala...',
                    type: 'status',
                    time: dayjS.format('HH:mm:ss')
                })
        })
    } catch (error) {
        console.log(error)
    }

}, 15000)

app.post('/participants', async (req, res) => {
    const { name } = req.body


    const nameSchema = joi.object({
        name: joi.string().required()
    })
    const validation = nameSchema.validate({ name: (name) }, { abortEarly: false })

    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message)
        return res.status(422).send(errors)
    }


    try {
        const usuarioExiste = await db.collection('participants').findOne({ name: name }, { name: 1 })

        if (usuarioExiste) {
            res.sendStatus(409)
        } else {
            const timer = dayjS.format('HH:mm:ss')
            await db.collection('participants').insertOne({ name: name, lastStatus: Date.now() })
            await db.collection('messages').insertOne({ from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: timer })
            res.sendStatus(201)
        }
    } catch (error) {
        console.log(error)
        res.sendStatus(500)
    }

})
app.get('/participants', async (req, res) => {
    try {
        const todosOsParticipantes = await db.collection('participants').find({}).toArray()
        res.send(todosOsParticipantes)
    } catch (error) {
        console.log(error)
    }

})

app.post('/messages', async (req, res) => {
    const { to, text, type } = req.body
    const { user } = req.headers



    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message').required()
    })

    if (user === "" || user === undefined) return res.status(422).send('Usuário inválido')

    const userDecoded = Buffer.from(user, 'utf8').toString()

    console.log(userDecoded)

    const validation = messageSchema.validate({ to, text, type }, { abortEarly: false })
    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message)
        return res.status(422).send(errors)
    }
    try {
        const result = await db.collection('participants').findOne({ name: userDecoded })
        if (!result) {
            res.status(422).send('usuário não encontrado')
        } else {
            await db.collection('messages')
            .insertOne({
                    from: userDecoded,
                    to,
                    text,
                    type,
                    time: dayjS.format('HH:mm:ss')
                })
            res.sendStatus(201)
        }
    } catch (error) {
        res.status(500).send('Ocorreu um erro no banco de dados')
    }


    //res.send('Ok')

})

app.get('/messages', async (req, res) => {
    const encode = utf8
    let { limit } = req.query
    const { user } = req.headers
    let lastmessages
    const userDecoded = Buffer.from(user, 'utf8').toString()

    if (limit === undefined) {
        try {
            lastmessages = await db.collection('messages')
                .find({ type: 'message' })
                .toArray()
            return res.send([...lastmessages].reverse())
        } catch (error) {
            return res.status(500).send('Ocorreu um erro no banco de dados')
        }

    }

    limit = Number(limit)

    if (limit === 0 || limit < 0 || isNaN(limit))
        return res.status(422).send('Limite inválido')

    try {


        if (limit) {
            lastmessages = await db.collection('messages')
                .find({
                    $or: [{
                        from: userDecoded
                    }, {
                        to: userDecoded
                    }, {
                        type: 'message'
                    }]
                })
                
                .toArray()
            res.send([...lastmessages].slice(-limit).reverse())
        } else {
            lastmessages = await db.collection('messages')
                .find({
                    $or: [{
                        type: 'message'
                    }]
                })
                .toArray()
            res.send([...lastmessages].reverse())
        }

    } catch (error) {
        console.log(error)
        res.status(500).send(error)
    }






})
app.post('/status', async (req, res) => {
    const { user } = req.headers
    const { decode } = utf8
    const userDecoded = Buffer.from(user, 'utf8').toString()


    try {
        const result = await db.collection('participants').findOne({ name: userDecoded })
        if (!result) {
            res.sendStatus(404)
        } else {
            const updateResult = await db.collection('participants').updateOne({ name: userDecoded }, { $set: { lastStatus: Date.now() } })

            res.send('ok')
        }



    } catch (error) {
        console.log(error)
        res.status(500).send('Ocorreu um erro no banco de dados')
    }
})

app.listen(5000)