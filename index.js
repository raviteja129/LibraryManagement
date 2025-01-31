const express = require('express')
const http = require('http')
const PORT = process.env.PORT || 3000;

const server = http.createServer((req,res) => {
    res.statusCode =200
    const msg = "Welcome!!"
    res.end(msg)
})

server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`)
})
