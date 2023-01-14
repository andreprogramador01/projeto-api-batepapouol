import express from 'express'
import dotenv from 'dotenv'
import dayjs from 'dayjs'
import cors from 'cors'
import { MongoClient } from 'mongodb'
import joi from 'joi'
import utf8 from "utf8"
import encodeUtf8 from 'encode-utf8'


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



app.post('/participants', async (req, res) => {
    const { name } = req.body

    const nameSchema = joi.object({
        name: joi.string().required()
    })
    const validation = nameSchema.validate({ name }, { abortEarly: false })

    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message)
        return res.status(422).send(errors)
    }


    try {
        const usuarioExiste = await db.collection('participants').findOne({ name })
        if (usuarioExiste) {
            res.sendStatus(409)
        } else {
            const timer = dayjS.format('HH:mm:ss')
            await db.collection('participants').insertOne({ name: name, lastStatus: Date.now() })
            await db.collection('messages').insertOne({ from: name, to: 'Todos', text: 'entra na sala...', type: 'status', time: timer })
            res.sendStatus(201)
        }
    } catch (error) {
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
    const encode = utf8
    const messageSchema = joi.object({
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid('message', 'private_message').required()
    })

    if (user === "" || user === undefined) return res.status(422).send('Usuário inválido')

    const validation = messageSchema.validate({ to, text, type }, { abortEarly: false })
    if (validation.error) {
        const errors = validation.error.details.map(detail => detail.message)
        return res.status(422).send(errors)
    }
    try {
        const result = await db.collection('participants').findOne({ name: encode.decode(user) })
        console.log(encode.decode(user))
        if (!result) {
            res.status(422).send('usuário não encontrado')
        } else {
            await db.collection('messages').insertOne({ from: encode.decode(user), to, text, type, time: dayjS.format('HH:mm:ss') })
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
    limit = Number(limit)
    console.log(limit)

    if(limit === 0 || limit<0 || isNaN(limit))
    return res.status(422).send('Limite inválido')

    try {
        let lastmessages
        if (limit) {
            lastmessages = await db.collection('messages')
                .find({
                    $or: [{
                        from: encodeUtf8(user)
                    }, {
                        to: encodeUtf8(user)
                    }, {
                        type: 'message'
                    }]
                })
                .limit(Number(limit))
                .toArray()
            res.send(lastmessages)
        }else{
            lastmessages = await db.collection('messages')
            .find({
                $or: [{
                    from: encodeUtf8(user)
                }, {
                    to: encodeUtf8(user)
                }, {
                    type: 'message'
                }]
            })
            .toArray()
        res.send(lastmessages.reverse())
        }

    } catch (error) {
        console.log(error)
        res.status(500).send(error)
    }






})

app.listen(5000)