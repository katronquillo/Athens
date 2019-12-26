const http = require('http');
const fs = require('fs');
const request = require('request');
const options = {
	url: "https://opentdb.com/api.php?amount=5",
	method: "GET",
	headers: {
		"Accept": "application/json",
		"Accept-Charset": "utf-8",
	}
};

let rooms = {};

/* Handles any errors that occur when retrieving info. */
function send404(res) {
	res.writeHead(404, {'Content-Type': 'text/plain'});
	res.write('Error 404: Resource Not Found');
	res.end();
}

/* Resets server data to original if no current game, or 
resets the server data for a new round */
function resetData(roomCode) {
	let room = rooms[roomCode];
	if (room['gameOn'] == false) {
		room = {'players': {}, 'test': [], 
				'currentQuestion': -1, 
				'gameOn': false, 'answered': []};
	}
	else {
		let players = Object.keys(room['players']);
		for (let i = 0; i < players.length; i++) {
			room['players'][players[i]] = 0;
		}
		
		room['gameOn'] = false;
		room['answered'] = [];
		room['currentQuestion'] = 0;
		
		request(options, function (err, res, body) {
			if (res.statusCode != 200) {
				send404(res);
			}
			else {
				let quest = JSON.parse(body);
				room["test"] = quest["results"];
			}
		});
	}
}

/* Returns an array of the winner(s) for current game. */
function getWinner(roomCode) {
	let room = rooms[roomCode];
	let usernames = Object.keys(room['players']);
	let score = room['players'];
	let winners = [usernames[0]];
	
	for (let i = 1; i < usernames.length; i++) {
		let user = usernames[i];
		let currWin = winners[0];
		
		if (score[user] > score[currWin]) {
			winners = [];
			winners.push(user);
		}
		else if (score[user] == score[currWin]) {
			winners.push(user);
		}
	}
	
	return winners;
}

/* Returns a unique 16-digit code for game room */
function generateCode() {
	let chars = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
	let code = "";
	
	for (let i = 0; i < 16; i++) {
		let randIndex = (Math.floor(Math.random() * 100)) % chars.length;
		code = code.concat(chars.slice(randIndex, randIndex + 1));
	}
	
	return code.trim();
}

/* Server that retrieves Javascript, HTML, and CSS files */
let server = http.createServer(function (req, res) {
	console.log(req.url);
	if (req.method == 'GET') {
		if(req.url == '/') {  // Trivia Page
			fs.readFile('athens.html', function getData(err, data) {
				res.writeHead(200, {'Content-Type': 'text/html'});
				res.write(data);
				res.end();
			});
		}
		else if (req.url == '/triviaScript.js') {   // Client JS
			fs.readFile('triviaScript.js', function getData(err, data) {
				res.writeHead(200, {'Content-Type': 'appplication/javascript'});
				res.write(data);
				res.end();
			});
		}
		else if (req.url == '/athens.css') { // Join CSS
			fs.readFile('athens.css', function getData(err, data) {
				res.writeHead(200, {'Content-Type': 'text/css'});
				res.write(data);
				res.end();
			});
		}
		else {
			send404(res);
		}	
	}
	else {
		send404(res);
	}
});

server.listen(3000);
console.log('Trivia server running on port 3000');

/* --- SOCKET.IO PORTION --- */
const io = require('socket.io')(server);

io.on('connection', socket => { 
	console.log('new connection detected');
	socket.username = generateCode();
	socket.join('joinPage');
	io.emit('updateRoomState', rooms);
	
	/* Adds new username to server data and updates
	socket username. Sends back updated data */
	socket.on('toJoin', (data) => {
		console.log("toJoin");
		let username = data[0];
		let roomCode = data[1];
		
		socket.username = username;
		socket.room = roomCode;
		rooms[roomCode]["gameOn"] = true;
		rooms[roomCode]["players"][username] = 0;
		
		socket.leave('joinPage');
		socket.join(roomCode);
		socket.join(username);
		
		io.to(roomCode).emit('updateStatList', [rooms, roomCode]);
		io.emit('updateRoomState', rooms);
		socket.emit('joined', [rooms, roomCode]);
		socket.emit('highlightUser', rooms[roomCode]['answered']);
	});
	
	/* Creates a unique code for new room and 
	updates server room data. Sends back updated */
	socket.on('toCreate', (username) => {
		console.log("toCreate");
		socket.username = username;
		
		let roomCode = generateCode();
		while (Object.keys(rooms).indexOf(roomCode) != -1) {
			roomCode = generateCode();
		}
		
		rooms[roomCode] = {'players': {}, 'test': [], 'currentQuestion': -1, 'gameOn': true, 'answered': []};
		rooms[roomCode]['players'][username] = 0;
		socket.leave('joinPage');
		socket.join(roomCode);
		socket.join(username);
		socket.room = roomCode;
		
		console.log(rooms);
		console.log(roomCode);
		
		io.emit('updateRoomState', rooms);
		socket.emit('joined', [rooms, roomCode]);
	});
	
	/* Uses request module to get 5 question test 
	from Open TDB for game with given roomCode */
	socket.on('requestGame', (roomCode) => {
		console.log("requestGame");
		rooms[roomCode]['currentQuestion'] = 0;
		request(options, function (err, res, body) {
			if (res.statusCode != 200) {
				send404(res);
			}
			else {
				let quest = JSON.parse(body);
				rooms[roomCode]["test"] = quest["results"];
				socket.emit('requested', [rooms, roomCode]);
				io.emit('updateRoomState', rooms);
			}
		});
	});
	
	/* Updates player's score and server data (if necessary)
	Sends back updated data. */
	socket.on('toAnswer', (answer) => {
		console.log("toAnswer");
		let user = socket.username;
		let roomCode = socket.room; 
		
		let room = rooms[roomCode];
		if (room['answered'].indexOf(user) == -1 && room['gameOn'] == true) {
			let currQ = room['currentQuestion'];
			let correct = room['test'][currQ]['correct_answer'];
			if (correct === answer) {
				room['players'][user] += 100;
			}
			else {
				room['players'][user] -= 100;
			}
			room['answered'].push(user);
		}
		io.emit('updateRoomState', rooms);
		io.to(roomCode).emit('updateStatList', [rooms, roomCode]);
		io.to(roomCode).emit('highlightUser', room['answered']);
	});
	
	/* Moves round to the next question or to the end of game. */
	socket.on('toContinue', (roomCode) => {
		console.log("toContinue");
		let room = rooms[roomCode];
		let players = Object.keys(room['players']);
		let lastPlayer = room['answered'][players.length - 1];
		
		io.to(roomCode).emit('unhighlightUsers', roomCode);
		
		if (socket.username == lastPlayer) {
			room['currentQuestion']++;
			room['answered'] = [];
			if (room['currentQuestion'] > 4) {
				let winners = getWinner(roomCode);
				resetData(roomCode);
				io.to(roomCode).emit('ended', [winners, rooms]);
			}
			else {
				io.to(roomCode).emit('requested', [rooms, roomCode]);
			}
		}
		io.emit('updateRoomState', rooms);
	});
	
	/* Starts a new round for players remaining in the game */
	socket.on('newRound', () => {
		console.log("newRound");
		let roomCode = socket.room;
		
		if (Object.keys(rooms[roomCode]['players']).length > 0) {
			rooms[roomCode]['gameOn'] = true;
			io.to(roomCode).emit('updateStatList', [rooms, roomCode]);
			io.to(roomCode).emit('requested', [rooms, roomCode]);
		}
		io.emit('updateRoomState', rooms);
	});
	
	/* Updates server data to remove the player to leave. 
	Sends back updated data. */
	socket.on('toLeave', () => {
		console.log("toLeave");
		let user = socket.username;
		let roomCode = socket.room;
		
		if (rooms[roomCode]) {
			socket.leave(roomCode);
			socket.leave(user);
			socket.join('joinPage');
			
			delete rooms[roomCode]['players'][user];
			
			let index = rooms[roomCode]['answered'].indexOf(user);
			if (index != -1) {
				rooms[roomCode]['answered'].splice(index, 1);
			}
			
			if (Object.keys(rooms[roomCode]['players']).length == 0) {
				delete rooms[roomCode];
			}
			else {
				io.to(roomCode).emit('updateStatList', [rooms, roomCode]);
			}
		}
		
		io.emit('updateRoomState', rooms);
	});
	
	/* Updates server data to remove player that left 
	(not through Exit button). Sends back updated data. */
	socket.on('disconnect', () => {
		console.log("Disconnect");
		let user = socket.username;
		let roomCode = socket.room;
		
		if (rooms[roomCode]) {
			socket.leave(roomCode);
			socket.leave(user);
			socket.join('joinPage');
			delete rooms[roomCode]['players'][user];
			
			let index = rooms[roomCode]['answered'].indexOf(user);
			if (index != -1) {
				rooms[roomCode]['answered'].splice(index, 1);
			}
			
			if (Object.keys(rooms[roomCode]['players']).length == 0) {
				delete rooms[roomCode];
			}
			else {
				io.to(roomCode).emit('updateStatList', [rooms, roomCode]);
				socket.emit('disconnected', [rooms, roomCode]);
			}
		}
		io.emit('updateRoomState', rooms);
	});
	
	/* Displays a message to all players to show that
	a new player has joined the chat */
	socket.on('newChatter', (username) => {
		console.log("newChatter");
		socket.username = username;
		let roomCode = socket.room;
		let welcome = username.concat(" has joined the chat!");
		io.to(roomCode).emit('displayMessage', [welcome, "Trivia Game", "public"]);
	})
	
	/* Displays new message to all players. */
	socket.on('sendMessage', (newMessage) => {
		console.log("sendMessage");
		let roomCode = socket.room;
		let sender = socket.username;
		
		let room = rooms[roomCode];
		if (roomCode == 'joinPage') {
			socket.emit('chatError', 'notPlayer');
		}
		else {
			io.to(roomCode).emit('displayMessage', [newMessage, sender, "public"]);
		}
	
	});
	
	/* Displays a new private message to the given user */
	socket.on('sendPM', (messageData) => {
		console.log("sendPM");
		let sender = socket.username;
		let roomCode = socket.room;
		let msg = messageData[0];
		let recipient = messageData[1];
		
		let room = rooms[socket.room];
		if (roomCode == 'joinPage') {
			socket.emit('chatError', 'notPlayer');
		}
		else {
			if (Object.keys(room['players']).indexOf(recipient) == -1) {
				socket.emit('chatError', 'noSuchPlayer');
			}
			else {
				io.to(sender).emit('displayMessage', [msg, sender, "PMsend", recipient])
				io.to(recipient).emit('displayMessage', [msg, sender, "PMreceive", recipient]);
			}
		}
	});
});