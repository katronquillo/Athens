# Author: Katrina Ronquillo (101143104)
# ATHENS

Simple trivia web application with multi-room and private/group chat
functionality.

TOOLS: Javascript, HTML/CSS, Socket.io

# DESIGN DECISIONS

~ USERNAMES AND ROOMS ~

- For the purposes of private messaging, usernames within game 
rooms must be unique. However it is possible for clients in 
different game rooms to have the same username. 

- Upon connecting to the server, each socket is given a random,
default username and is connected to the JoinPage room

- Once client joins/creates game, their username changes to
the one provided by user input and they are disconnected from 
the JoinPage room and enter the room for their specific game

- Once client joins/creates game, they are also connected 
to a room unique to their username. This allows for private 
messaging functionality. 

~ ANSWERING QUESTIONS ~

- When a client answers a question, they are highlighted in the
game statistics by changing their colour to orange. 
	- Colours of players are reset when game advances 

~ REQUEST MODULE ~	

- The request module is used to obtain 5 questions from OPEN TDB at
the start of every round.

- Requests are made when a new game room has been initialized, or
when a round has ended and there are players remaining for another round

~ ROUND END ~

- After winners are shown, a new round will start after 5 seconds. 
	- Buffering period gives players time to leave the game 
	before a new round, and allows players to view final winners/scores

~ CHAT EXTENSION ~

- Clients that are not currently in a game are not permitted to
use the chatbox. If attempted, an alert is shown.

- Once connected to a game, clients can only chat with other
clients in their game room. 

- Once connected to a game, client is introduced to the chat 
with a welcome message from "Trivia Page" (representing the
website)

- Private and Public messaging are shown in the same chat box,
but private messages are differentiated with "PM from" and "PM to"
labels 

~ ROOM EXTENSION ~

- When a client creates a game, the server provides a unique 
16 character alphanumeric Game ID
	- Game ID is shown at the top of the box containing 
	game statistics
	- Game rooms are identified by their Game ID in server's
	rooms object. This object keeps track of existing games and
	their game state
	
- To enter a game, a client must provide an existing Game ID
and a unique username for that specific game