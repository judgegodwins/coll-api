const express = require('express');
const socketio = require('socket.io');
const http = require('http');
const { v4: uuidV4 } = require('uuid');

const app = express();
const server = http.createServer(app);

const io = socketio(server);

const port = process.env.PORT || 8080

var activeSockets = [];

io.on('connection', socket => {
    console.log('socket connected');

    socket.on('setusername', ({username}) => {
        socket.username = username;

        activeSockets.push({
            username: socket.username,
            id: socket.id,
        });
        console.log('activesockets: ', activeSockets);

        io.emit('people', { people: activeSockets })
    })

    socket.on('get_room', async callback => {
        const roomId = uuidV4();
        await socket.join(roomId);
        callback(roomId)
    })

    socket.on('search', ({ keyword }, callback) => {
        if(keyword.length === 0) return callback([]);
        
        let searched = activeSockets.filter(person => person.username.includes(keyword));
        callback(searched);
    })
    
    socket.on('new_call', async ({ to, room }) => {

            await socket.join(to);

            socket.emit('connecting');

            await socket.to(to).emit('new_call', { id: socket.id, from: socket.username, room });

            socket.leave(to);

    })

    socket.on('ready', ({ room }, callback) => {
        if(io.sockets.adapter.rooms[room].length < 2) {
            socket.join(room);
            socket.to(room).emit('ready', { room });
        } else {
            socket.emit('full');
        }
    })

    socket.on('offer', ({ room, sdp }) => {

        socket.broadcast.to(room).emit('offer', { sdp, room: room });
        // socket.to(to).emit('bla', {type: 'bla'})
    })

    socket.on('answer', ({ room, sdp }) => {
        // console.log('answer ', sdp)
        socket.to(room).emit('answer', { room, sdp });
    })

    socket.on('candidate', (data) => {
        socket.to(data.room).emit('candidate', data);
    })

    socket.on('end_call', (data) => {
        socket.to(data.room).emit('end_call', data);
    })

    socket.on('decline_call', ({ to }, callback) => {
        // socket.join(to);
        socket.to(to).emit('decline_call', { id: socket.id });
        callback(true)
    })

    socket.on('busy', ({ id }) => {
        socket.to(id).emit('busy', { id: socket.id });
    })

    socket.on('disconnect', () => {
        activeSockets = activeSockets.filter(person => person.id != socket.id)
        console.log('disconnect: ', activeSockets);

        socket.emit('people', { people: activeSockets })

    })
})

server.listen(port, () => console.log('listening on ', port))