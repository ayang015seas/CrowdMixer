var express = require('express');
var app = express();
var bodyParser = require('body-parser');
app.use(bodyParser.json()); // support json encoded bodies
app.use(bodyParser.urlencoded({ extended: true })); // support encoded bodies
var https = require('https');
var axios = require('axios');
var cors = require('cors');
app.use(cors());
var uniqid = require('uniqid');
var axios = require('axios');
var randomstring = require("randomstring");
app.use(bodyParser.json({ limit: '1000mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '1000mb' }));
var HashMap = require('hashmap');

// separateArrays
var incoming1 = [];
var incoming2 = [];
var splitPoint;
var firstRecieved = false;
var secondRecieved = false;

var incomingArray = [];
var listening = false;
var requests = 0;
var globalMap = new HashMap();

var globalCounter = 0;
var deleteCounter = 1;


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

function searchMap(key, object) {
	return new Promise(function(resolve, reject) {
		var result = globalMap.get(key);
		// console.log("MAP " + result);
		if (result != undefined) {
			resolve(result);
		}
		else {
			globalMap.set(key, [0, object]);
			resolve(undefined);
		}
	});
};


function sendPost(data, url) {
	// console.log("sending");
	return new Promise(function (resolve, reject){
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


async function swapMessages() {
	return new Promise(function (resolve, reject) {
		// console.log("swapped");
		var firstElem;
		var secondElem;
		var result;
		for (var i = 0; i < incomingArray.length; i++) {
			firstElem = incomingArray[i];
			if (firstElem.addr != undefined) {
			incomingArray[i] = 0;
			secondElem = incomingArray.find( address => address.addr === firstElem.addr);
			if (secondElem != undefined) {
				// console.log("swapped");
				var secondElemIndex = incomingArray.map(function(e) { return e.addr; }).indexOf(firstElem.addr);
				incomingArray[secondElemIndex] = firstElem.msg;
				incomingArray[i] = secondElem.msg;
			}
			else {
				incomingArray[i] = firstElem;
			}
		}

		}
		console.log("SWAP FINISHED");
		resolve(true);
	});
}

async function searchArchives() {
	return new Promise(async function (resolve, reject) {
		var finished = false;
		console.log("START SEARCHING")
		for (var i = 0; i < incomingArray.length; i++) {
			if (typeof(incomingArray[i]) !== 'string') {
			await searchMap(incomingArray[i].addr, incomingArray[i].msg).then(
				function(res) {
					// console.log("RES " + res)
					if (res != undefined) {
						incomingArray[i] = res[1];
					}
					else {
						incomingArray[i] = 'blank';
					}
				});
			
			
			
		}
	}
	console.log("FINISH SEARCH")
	resolve(false);
});
}

// takes in full object with address
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

async function updateHash() {
	return new Promise(function (resolve, reject) {
		globalMap.forEach(function(value, key){
			value[0] = value[0] + 1;
			if (value[0] == 6) {
				globalMap.delete(key);
			}
		});
		console.log("Hash Updated");
		resolve(true);
	});
};


// swapMessages().then(console.log("Result " + incomingArray));


async function sendPackages() {
	return new Promise(async function(resolve, reject) {
	await sendPost("init3-2", "http://localhost:8081/verify");
	await sendPost("init3-2", "http://localhost:8084/verify");
	// console.log("INITIAL ARRAY");
	// console.log(incomingArray);

	objCounter = incoming1.length + incoming2.length;

	console.log("START CONCAT");
	incomingArray = incomingArray.concat(incoming1);
	incomingArray = incomingArray.concat(incoming2);
	splitPoint = incoming1.length;
	console.log("END CONCAT");

	// send 
	await swapMessages().then(
		async function() {
			// console.log("SWAPPED")
			// console.log(incomingArray)
			await searchArchives().then(async function() {
					// console.log("FINISHED ARRAY")
					// console.log(incomingArray);
					var temp1 = [];
					incoming1 = incomingArray.slice(0, splitPoint);
					incoming2 = incomingArray.slice(splitPoint);
						for (var i = 1; i < incoming1.length + 1; i++) {
							temp1.push(incoming1[i - 1]);
							// console.log("TEMP" + temp);
							if ((i % 100 == 0 && i > 0) || i == incoming1.length) {
								// console.log('incoming1')
								// console.log(temp1);
								await sendPost(temp1, "http://localhost:8081/receive");
								temp1 = [];
							}
						}
						// await sendPost("fin3-2", "http://localhost:8081/verify");

						var temp2 = [];
						for (var i = 1; i < incoming2.length + 1; i++) {
							temp2.push(incoming2[i - 1]);
							// console.log("TEMP" + temp);
							if ((i % 100 == 0 && i > 0) || i == incoming2.length) {
								// console.log('incoming2')
								// console.log(temp2);
								await sendPost(temp2, "http://localhost:8084/receive");
								temp2 = [];
							}
						}
					console.log("FINISHED PROCESSING");
						// await sendPost("fin3-2", "http://localhost:8084/verify").then(updateHash());
					resolve();
			})
		})
		});

		};


// this is where incoming packages from server 2 are deposited 

app.post('/deposit', async function(req, res) {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8081');
	requests++;
	// console.log("DATA" + printObject(req.body.data));
	incoming1 = incoming1.concat(req.body.data);
	// console.log("INCOMING");
	// console.log(incoming1);
	// console.log("Length: " + req.body.data.length);
	// console.log(requests)
	res.send("Received");
});

app.post('/deposit1', async function(req, res) {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8081');
	requests++;
	// console.log("DEP1 RECIEVED");
	incoming2 = incoming2.concat(req.body.data);
	// console.log("INCOMING");
	// console.log(incoming2);
	// console.log("Length: " + req.body.data.length);
	// console.log(requests)
	res.send("Received");
});

// this is where the verification codes from server 2 are processed 
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
		// console.log(incomingArray);
		console.log("2-3a Transmission End");
		firstRecieved = true;
		res.send('closed');
		// objCounter = incomingArray.length;
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
		// console.log(incomingArray);
		console.log("2-3b Transmission End");
		secondRecieved = true;
		res.send('closed');
		// objCounter = incomingArray.length;
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

app.listen(8082, function () {
    console.log('Example app listening on port 8082.');
});


/*
// put stuff into the appropriate array 
async function storeMessages(storage, deleted) {
	return new Promise(function (resolve, reject) {

	for (var i = 0; i < incomingArray.length; i++) {
	 	if (incomingArray[i].addr != undefined) {
	 		// console.log(incomingArray[i].addr)
	 		allBoxes[storage].push(incomingArray[i]);
	 		//console.log("Storage" + storage);
	 		//console.log(allBoxes[storage]);
	 		incomingArray[i] = 'blank message';
	 	}
	};
	// allBoxes[deleted - 1] = null;
	// allBoxes[deleted - 1] = [];
	console.log('stored');
	resolve(true);
	});
}
*/

/*
	await swapMessages();
	var third = await storeMessages(globalCounter, deleteCounter).then(console.log("Incoming" + incomingArray));

	Promise.all(first, second, third).then(async function(){

		
	var temp = [];
	for (var i = 1; i < incomingArray.length + 1; i++) {
		temp.push(incomingArray[i - 1]);
		console.log("TEMP" + temp);
		if ((i % 100 == 0 && i > 0) || i == incomingArray.length) {
			// console.log(i);
			await sendPost(temp, "http://localhost:8081/receive");
			temp = [];
		}
	}
	await sendPost("fin3-2", "http://localhost:8081/verify");
	return;

	})
	*/

