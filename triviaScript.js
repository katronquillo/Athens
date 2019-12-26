let socket = io();
let roomState = {};

/* --- JOIN PAGE --- */
function init() {
	// Socket.io Handlers
	socket.on('updateStatList', updateStatList);
	socket.on('updateRoomState', updateRoomState);
	socket.on('joined', sendToGame);
	socket.on('requested', starterToGame);
	socket.on('ended', endRound);
	socket.on('disconnected', cleanPage);
	socket.on('highlightUser', highlightUser);
	socket.on('unhighlightUsers', unhighlightUsers);
	socket.on('displayMessage', displayMessage);
	socket.on('chatError', throwChatError);
	
	let joinButton = document.getElementById("joinButton");
	joinButton.onclick = handleJoin;
	
	let createButton = document.getElementById("createButton");
	createButton.onclick = handleCreate; 
	
	let answerButton = document.getElementById("answerButton");
	answerButton.onclick = handleAnswer;
	
	let exitButton = document.getElementById("exitButton");
	exitButton.onclick = handleExit;
	
	let sendButton = document.getElementById("sendButton");
	sendButton.onclick = handleMessage;
}

/* Displays the given test data on the Join page*/
function updateStatList(data) {
	// Set Client's Game State to Given Test Data
	roomState = data[0];
	let roomCode = data[1];
	
	let msg = "Game ID: ".concat(roomCode);
	document.getElementById("statMsg").innerHTML = msg;
	
	// Display the usernames of players of current game
	let players = Object.keys(roomState[roomCode]["players"]);
	let statList = document.getElementById("statList");
	statList.innerHTML = "";
	
	if (players.length > 0) {
		for (let i = 0; i < players.length; i++) {
			let li = document.createElement("li");
			let inner = document.createElement("span");
			inner.id = players[i];
			let score = roomState[roomCode]['players'][players[i]];
			inner.innerHTML = players[i].concat(': ').concat(score.toString());
			
			li.appendChild(inner);
			statList.appendChild(li);
		}
	}
	
	/* If all players in game have answered, prompt server to 
	continue the game */
	if (roomState[roomCode]['gameOn'] == true && 
		players.length == roomState[roomCode]['answered'].length) {
		socket.emit('toContinue', roomCode);
	}
}

/* Updates the room state with the given data */
function updateRoomState(rooms) {
	console.log("updated");
	roomState = rooms;
	console.log(roomState);
}

/* Checks validity of username and room code and sends 
new player to be added to the server */
function handleJoin() {
	let username = document.getElementById("username").value.trim();
	let roomCode = document.getElementById("room").value.trim();
	
	/* If username and roomCode are unique and valid, then send
	otherwise, give alert */
	console.log(Object.keys(roomState));
	console.log(Object.keys(roomState).indexOf(roomCode));
	if (Object.keys(roomState).indexOf(roomCode) != -1){
		let existing = Object.keys(roomState[roomCode]["players"]);
		console.log(username.length > 0 && existing.indexOf(username) == -1);
		if (username.length > 0 && existing.indexOf(username) == -1) {
			socket.emit("toJoin", [username, roomCode]);
			showChat(username);
		}
		else {
			alert("Entered username is invalid, please try again!");
		}
	}
	else {
		alert("Entered game ID is invalid, please try again!");
	}
}

/* Checks validity of room name and sends new player/game to
be added to the server */
function handleCreate() {
	let username = document.getElementById("username").value.trim();
	
	/* If username is valid, then send to server to create 
	new room */
	if (username.length > 0) {
		socket.emit('toCreate', username);
		showChat(username);
	}
	else {
		alert("Entered username is invalid, please try again!");
	}
}

/* Requests for new test data if new player is the first to join,
otherwise, sends new player to game page */
function sendToGame(rooms) {
	console.log(rooms);
	roomState = rooms[0];
	roomCode = rooms[1];
	
	updateStatList(rooms);
	
	if (Object.keys(roomState[roomCode]["players"]).length == 1) {
		socket.emit('requestGame', roomCode);
	}
	else {
		while (roomState[roomCode]['test'].length === 0){
			console.log('Player waiting');
		}
		displayGame(roomCode);
	}
}

/* Sends to the game page and updates client's game state */
function starterToGame(rooms) {
	roomState = rooms[0];
	displayGame(rooms[1]);
}

/* --- GAME PAGE --- */

/* Changes UI to show current game state*/
function displayGame(roomCode) {
	document.getElementById("joinWrapper").hidden = true;
	document.getElementById("questionSpace").hidden = false;
	
	// Display current test question 
	let header = document.getElementById('questionHeader');
	let qText = document.getElementById('questionText');
	let ansList = document.getElementById('answerList');
	
	let currQ = roomState[roomCode]['currentQuestion'] + 1;
	
	header.innerHTML = "Question ".concat(currQ.toString());
	qText.innerHTML = roomState[roomCode]['test'][currQ - 1]['question'];
	
	ansList.innerHTML = "";
	let incorrectAnswers = roomState[roomCode]['test'][currQ - 1]['incorrect_answers'];
	let correctAnswer = roomState[roomCode]['test'][currQ - 1]['correct_answer'];
	let answers = shuffle(incorrectAnswers, correctAnswer);
	
	for (let i = 0; i < answers.length; i++) {
		let li = document.createElement("li");
		
		let radioBut = document.createElement("input");
		radioBut.type = "radio";
		radioBut.value = answers[i];
		radioBut.name = "q".concat(currQ.toString());
		
		let label = document.createElement("span");
		label.innerHTML = answers[i];
		
		li.appendChild(radioBut);
		li.appendChild(label);
		ansList.appendChild(li);
	}	
	
}

/* Return a randomized array containing all answers using
Fisher-Yates algorithm */
function shuffle(incorrectAnswers, correctAnswer) {
	let returnArray = Array.from(incorrectAnswers);
	returnArray.push(correctAnswer);
	
	let currentIndex = returnArray.length - 1;
	let range = returnArray.length
	
	while (currentIndex != 0) {
		let randomIndex = Math.floor(Math.random() * range);
		let temp = returnArray[randomIndex];
		returnArray[randomIndex] = returnArray[currentIndex];
		returnArray[currentIndex] = temp;
		
		currentIndex--;
		range--;
	}
	return(returnArray);
}

/* Checks validity of player's answer and sends data (if necessary)
to the server for updated score */
function handleAnswer() {
	let items = document.getElementById('answerList').children;
	let answer = "";
	
	for (let i = 0; i < items.length; i++) {
		let radioBut = items[i].firstChild;
		if (radioBut.checked == true) {
			answer = radioBut.value;
			break;
		}
	}
	
	if (answer.length == 0) {
		alert("Must choose an answer, please try again.");
	}
	else {
		socket.emit('toAnswer', answer);
	}
}

/* Changes the color of player's name/score in the stat list 
to indicate that the given user has answered the question. */
function highlightUser(answered) {
	console.log(answered);
	for (let i = 0; i < answered.length; i++) {
		let user = answered[i];
		let toHighlight = document.getElementById(user);
		toHighlight.style.color = "#E9744C";
	}

}

/* Resets the color of all player names/scores in the stat list. */
function unhighlightUsers(roomCode) {
	let players = Object.keys(roomState[roomCode]['players']);
	for (let i = 0; i < players.length; i++) {
		let toHighlight = document.getElementById(players[i]);
		toHighlight.style.color = "black";
	}
}

/* Displays the names of winners for this round. 
Starts a new round for any remaining players 
after 5 seconds */
function endRound(data) {
	roomState = data[1];
	
	// Display the winner(s) of this round
	let winnerDiv = document.getElementById('winnerDiv');
	let string = "Winner(s):\n";
	let winners = data[0];
	for (let i = 0; i < winners.length; i++) {
		string = string.concat(winners[i]);
		string = string.concat('\n');
	}
	
	winnerDiv.innerHTML = string;
	winnerDiv.hidden = false;
	
	// After 5 seconds, start a new round
	setTimeout(function () {
		document.getElementById('winnerDiv').hidden = true;
		socket.emit('newRound');
	}, 5000);
}

/* Prompts server to update testData by removing the player
to leave. Ensures player wants to leave the game with dialogue */
function handleExit() {
	if (confirm('Are you sure you want to leave the game?')) {
		socket.emit('toLeave');
		location.reload();
	}
}

/* Cleans the page to return to original Join Page state. */
function cleanPage(data) {
	document.getElementById("joinWrapper").hidden = false;
	document.getElementById("questionSpace").hidden = true;
	
	roomState = data[0]; 
	updateStatList(data);
}

/* --- CHAT EXTENSION --- */

/* Enables chat functionality for joined user */
function showChat(username) {
	socket.emit('newChatter', username);
}

/* Ensures user has entered a valid message. Sends message to
server to be shown to other users */
function handleMessage() {
	let newMessage = document.getElementById("messageBox").value.trim();
	document.getElementById("messageBox").value = "";
	if (newMessage.length > 0) {
		console.log(newMessage.indexOf('@') == 0);
		if (newMessage.indexOf('@') == 0) {
			let recipient = newMessage.slice(1, newMessage.indexOf(':')).trim();
			console.log(recipient);
			let msg = newMessage.slice(newMessage.indexOf(':') + 1).trim();
			console.log(msg);
			
			socket.emit('sendPM', [msg, recipient]);
		}
		else {
			socket.emit('sendMessage', newMessage);
		}
	}
}

/* Displays sent message in the chat section */
function displayMessage(messageData) {
	console.log(messageData);
	let newMsg = messageData[0];
	let sender = messageData[1];
	let privacy = messageData[2];
	let receive = messageData[3];
	console.log(privacy);
	
	let msgSpace = document.getElementById("messageSpace");
	
	let li = document.createElement("li");
	let msgText = sender.concat(": ").concat(newMsg);
	
	if (sender == "Trivia Game") {
		li.id = "system";
	}
	else if (privacy == "PMreceive") {
		li.id = "private";
		msgText = "PM from ".concat(msgText);
	}
	else if (privacy == "PMsend") {
		li.id = "private";
		console.log('in PMsend');
		msgText = "PM to ".concat(receive).concat(": ").concat(newMsg);
		console.log(msgText);
	}
	
	li.innerHTML = msgText;
	msgSpace.appendChild(li);
}

/* Shows an alert box for errors caused by chat. */
function throwChatError(cause) {
	if (cause == 'noSuchPlayer') {
		alert("The player you are trying to message does not exist!");
	}
	else if (cause == 'notPlayer') {
		alert("Join the game to enter the chat!");
	}
	else {
		alert("Something went wrong with the chat!");
	}
}