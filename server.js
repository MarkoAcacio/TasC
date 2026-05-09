const express = require('express')
const mysql = require('mysql2')
const path = require('path')
const app = express()

app.use(express.json())

const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: 'TasC'
}

let db

function handleDisconnect() {
    console.log('Attempting to connect to database')
    db = mysql.createConnection(dbConfig)

    db.connect((err) => {
        if (err) {
            console.log(' error connecting to database... ', err.message)
            setTimeout(handleDisconnect, 5000)
        } else {
            console.log("CONNECTED TO DATABASE")
            
            // QUERY THE SQL STUFF HERE

        }
    })


    db.on('error', (err) => {
        if (err.code === 'PROTOCOL_CONNECTION_LOST') {
            handleDisconnect()
        } else {
            throw err
        }
    })
}

//REMOVE COMMENT AFTER SETUP DATABASE

//handleDisconnect()

