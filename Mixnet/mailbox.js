/*
This is the mailbox server
It takes in messages from both mixnets, combines them, and then processes them

First, it stores single get requests for up to six rounds before deletion
Second, it swaps the exchange requests in a single round
Finally, it also allows for hte retrieval of stored requests within the six round constraint

This server does not know who any of the users are, so if it is compromised by an adversary 
metadata leakage doesn't occur

After message processing, the server sends the requests back down the chain. 
*/

var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
var https = require('https');
var axios = require('axios');
var cors = require('cors');
app.use(cors());
app.use(bodyParser.json({ limit: '1000mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1000mb' }));
var HashMap = require('hashmap');
var crypto = require("crypto");

/*
All of the data structures used in every round are here
*/
var incoming1 = [];
var incoming2 = [];
var splitPoint;
var firstRecieved = false;
var secondRecieved = false;

var incomingArray = [];
var listening = false;
var requests = 0;

/*
Due to the amount of data being processed, we do not use MongoDB for this server,
as that would increase latency significantly
Instead, we use hashmaps, which lead to increased processing speed but also increased
Memory usage by the server 

*/
var globalMap = new HashMap();
var swapHash = new HashMap();

var globalCounter = 0;
var deleteCounter = 1;

/*
Reset function to return to initial state each round, notwithstanding long term hash maps 
*/
function reset() {
	listening = false;
	requests = 0;
	incomingArray = [];
	incoming1 = [];
	incoming2 = [];
	splitPoint = 0;
	firstRecieved = false;
	secondRecieved =false;
}

/*
Function that searches the long term "storage" hashmap
*/
function searchMap(key, object) {
	return new Promise(function(resolve, reject) {
		var result = globalMap.get(key);
		if (result != undefined) {
			resolve(result);
		}
		else {
			globalMap.set(key, [0, object]);
			resolve(undefined);
		}
	});
};
/*
Function that searches the short term "local" hashmap
*/
function searchLocal(key, object, index) {
	return new Promise(function(resolve, reject) {
		var result = swapHash.get(key);
		if (result != undefined) {
			resolve(result);
		}
		else {
			swapHash.set(key, [index, object]);
			resolve(undefined);
		}
	});
}

/*
Function to send axios posts to mixnet servers 
*/
function sendPost(data, url) {
	return new Promise(function (resolve, reject) {
		axios.post(url, {
			data
	  	}).then(function (response) {
	  		resolve();
	  	})
	  	.catch(function (error) {
	  		console.log(error);
	  	})
  });
}

/*
Function that handles all of the message processing
This is optimal because the entire function uses hashmaps for searching and only 
needs to iterate through the message array one time

First, it determines if the requests is a swap request
Second, if it is not a swap request, then it searches the globalmap to check if it is a stored request

Finally, if that is not the case, the function stores the request in the globalmap and then
returns a randomly generated string to not reveal anything to the adversaries 
*/
async function swapMessages() {
	return new Promise(async function (resolve, reject) {
		for (var i = 0; i < incomingArray.length; i++) {
			var object = incomingArray[i];
			await searchLocal(object.addr, object.msg, i).then(async function(result) {
				if (result != undefined) {
					incomingArray[i] = result[1];
					incomingArray[result[0]] = object.msg;
				}
				else {
					await searchMap(object.addr, object.msg).then(
					async function(res) {
						if (res != undefined) {
							incomingArray[i] = res[1];
							globalMap.delete(object.addr);
						}
						else {
							incomingArray[i] = crypto.randomBytes(430).toString('hex');
						}
					});
				}
			});

		}
		console.log("Processing Finished");
		resolve();
	});
}


// obsolete search function
/*
async function searchCollection(object) {
	return new Promise(function (resolve, reject) {
	console.log("SEARCHING")
	var target;
		for (var i = 0; i < allBoxes.length; i++) {
			// console.log("AllBox" + allBoxes[i]);
			target = allBoxes[i].find( message => message.addr === object.addr);
			if (target != undefined) {
				// console.log("Trigger")
				// console.log("Target: " + target.msg);
				var targetIndex = allBoxes[i].map(function(e) { return e.addr; }).indexOf(object.addr);
				allBoxes[i][targetIndex] = object;
				resolve(target.msg);
				break;
			}
			
		}
		// resolve(false);
	})
}
*/

/*
Function that updates the hash map after each round, deleting 
messages that have stored for more than 6 hours and clearing the entire
local hash 
*/

async function updateHash() {
	return new Promise(function (resolve, reject) {
		globalMap.forEach(function(value, key){
			value[0] = value[0] + 1;
			if (value[0] == 6) {
				globalMap.delete(key);
			}
		});
		swapHash.forEach(function(value, key){
			swapHash.delete(key);
		});
		console.log("Hash Updated");
		resolve(true);
	});
};


/*
This is the highest level function to meld the two incoming packages
from the mixnet servers together, process them, and then send them back to the 
mixnet servers 
*/

async function sendPackages() {
	return new Promise(async function(resolve, reject) {
	await sendPost("init3-2", "http://localhost:8081/verify");
	await sendPost("init3-2", "http://localhost:8084/verify");


	objCounter = incoming1.length + incoming2.length;

	console.log("START CONCAT");
	incomingArray = incomingArray.concat(incoming1);
	incomingArray = incomingArray.concat(incoming2);
	splitPoint = incoming1.length;
	console.log("END CONCAT");

	await swapMessages().then(
		async function() {
					var temp1 = [];
					incoming1 = incomingArray.slice(0, splitPoint);
					incoming2 = incomingArray.slice(splitPoint);
						for (var i = 1; i < incoming1.length + 1; i++) {
							temp1.push(incoming1[i - 1]);
							if ((i % 100 == 0 && i > 0) || i == incoming1.length) {
								await sendPost(temp1, "http://localhost:8081/receive");
								temp1 = [];
							}
						}
						var temp2 = [];
						for (var i = 1; i < incoming2.length + 1; i++) {
							temp2.push(incoming2[i - 1]);
							if ((i % 100 == 0 && i > 0) || i == incoming2.length) {
								await sendPost(temp2, "http://localhost:8084/receive");
								temp2 = [];
							}
						}
					console.log("FINISHED PROCESSING");
					resolve();
			// })
		})
		});

		};

/*
This is the deposit route for incoming requests from the first mixnet chain
*/

app.post('/deposit', async function(req, res) {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8081');
	requests++;
	incoming1 = incoming1.concat(req.body.data);
	res.send("Received");
});

/*
This is the deposit route for incoming requests from the second mixnet chain
*/

app.post('/deposit1', async function(req, res) {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8081');
	requests++;
	incoming2 = incoming2.concat(req.body.data);
	res.send("Received");
});

/*
This is the route that handles all of the server c2, for communication
with itself and the two mixnet servers it is exposed to 
*/

app.post('/verify', async function(req, res) {
	console.log(req.body.data);
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8081');
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8084');
	if (req.body.data.status == "init2-3a") {
		globalCounter = req.body.data.round;
		console.log("GLOBALCOUNTER: " + globalCounter);
		if (globalCounter == 6) {
			deleteCounter = 1;
		}
		else {
			deleteCounter = globalCounter + 1;
		}
		console.log("2-3a Transmission Start");
		listening == true;
		res.send("Initiated");
	}
	else if (req.body.data == "fin2-3a") {
		console.log("2-3a Transmission End");
		firstRecieved = true;
		res.send('closed');
		if (firstRecieved && secondRecieved) {
			sendPackages().then(
			function(){
				sendPost("fin3-2", "http://localhost:8081/verify");
				sendPost("fin3-2", "http://localhost:8084/verify").then(updateHash());
				listening = false;
				reset();
			});
		}
	}
	if (req.body.data.status == "init2-3b") {
		globalCounter = req.body.data.round;
		console.log("GLOBALCOUNTER: " + globalCounter);
		if (globalCounter == 6) {
			deleteCounter = 1;
		}
		else {
			deleteCounter = globalCounter + 1;
		}
		console.log("2-3b Transmission Start");
		listening == true;
		res.send("Initiated");
	}
	else if (req.body.data == "fin2-3b") {
		console.log("2-3b Transmission End");
		secondRecieved = true;
		res.send('closed');
		if (firstRecieved && secondRecieved) {
			sendPackages().then(
			function(){
				sendPost("fin3-2", "http://localhost:8081/verify");
				sendPost("fin3-2", "http://localhost:8084/verify").then(updateHash());
				listening = false;
				reset();
			});
	}
	}
});

/*
Port number the server is listening to 
*/

app.listen(8082, function () {
    console.log('Example app listening on port 8082.');
});

