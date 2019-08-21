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
var shuffle = require('array-shuffle');
var crypto = require("crypto");
var uuid = require('uuid');

var objectArray = [];
var shuffledObjArray = [];

var shuffleArray = [];
var objCounter = 0;
var noiseCounter = 0;
var globalCounter = 0;

var listening = false;


function reset() {
	objectArray = [];
	shuffledObjArray = [];
	shuffleArray = [];

	objCounter = 0;
	noiseCounter = 0;
}

function addNoise(noiseInterval) {
	var decoy;
	for (var i = 0; i < noiseInterval; i++) {
		var id = uniqid();
		shuffleArray.push(objCounter);
		objCounter++;
		noiseCounter++;
		decoy = {addr: "B" + objCounter, msg: crypto.randomBytes(450).toString('hex')};
		objectArray.push(decoy);
	}
}

function removeNoise(array) {
	return array.slice(0, array.length - noiseCounter);
}

// sendPost back to the first server 

function sendPost(data, url) {
	return new Promise(function (resolve, reject){
		axios.post(url, {
			data
	  	}).then(function (response) {
	  		resolve(response);
	  	})
	  	.catch(function (error) {
	  		console.log(error);
	  	});
  });
}

// sending packages function 
async function sendPackages(initCode, finCode, sendAddr, verifyAddr, array, shuffleBool) {
	await sendPost(initCode, verifyAddr);
	// instantiate shuffle array 
	for (var i = 0; i < objectArray.length; i++) {
		shuffleArray[i] = i;
	}
	if (shuffleBool) {
		addNoise(0);
		shuffleArray = shuffle(shuffleArray);
		for (var i = 0; i < shuffleArray.length; i++) {
			array[i] = objectArray[shuffleArray[i]];
		}
	}
	// send 
	var temp = [];
	for (var i = 1; i < array.length + 1; i++) {
		temp.push(array[i - 1]);
		if ((i % 100 == 0 && i > 0) || i == array.length) {
			await sendPost(temp, sendAddr);
			temp = [];
		}
	}
	await sendPost(finCode, verifyAddr);
	return;
}

// unshuffle function 
async function unshuffle() {
	return new Promise(function (resolve, reject) {
		for (var i = 0; i < shuffleArray.length; i++) {
		objectArray[shuffleArray[i]] = shuffledObjArray[i];
		// console.log(objectArray[shuffleArray[i]]);
	}
	// console.log("Unshuffled: ")
	// console.log(objectArray)
	objectArray = removeNoise(objectArray);

	// console.log(objectArray);
	resolve();
	});
}

/*

setTimeout(function(){
	sendPackages("init3", "fin3", "http://localhost:8082/deposit",
	"http://localhost:8082/verify", shuffleArray, true);
}, 3000);
*/

app.post('/deposit', async function(req, res) {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
	objectArray = objectArray.concat(req.body.data);
//	console.log("RECIEVED")
// 	console.log(objectArray);
	// console.log("Length: " + req.body.data.length);
	res.send("Received");
});


// handle all the server C2
app.post('/verify', async function(req, res) {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
	if (req.body.data.status == "init1-2") {
		console.log("1-2 Transmission Start");
		globalCounter = req.body.data.round;
		console.log("GLOBALCOUNTER: " + globalCounter);
		listening == true;
		res.send("Initiated");
	}
	else if (req.body.data == "fin1-2") {
		console.log("1-2 Transmission End");
		objCounter = objectArray.length;
		sendPackages({status: "init2-3", round: globalCounter}, "fin2-3", "http://localhost:8082/deposit",
	"http://localhost:8082/verify", shuffledObjArray, true);
		shuffledObjArray = [];
		listening = false;
		res.send("Closed");
	}
	else if (req.body.data == "init3-2") {
		console.log("3-2 Transmission Start");
		listening = true;
		res.send("Initiated");
	}
	else if (req.body.data == "fin3-2") {
		console.log("3-2 Transmission End");
		unshuffle().then(function(){
			console.log(objectArray)
			sendPackages("init2-1", "fin2-1", "http://localhost:8080/receive",
	"http://localhost:8080/verify", objectArray, false).then(reset());
		});
		listening = false;
		res.send("Closed");
	}
});


app.post('/receive', async function(req, res) {
	shuffledObjArray = shuffledObjArray.concat(req.body.data);
	// remove all of the previous noise 
	console.log('objectArray');
	console.log(shuffledObjArray);
	res.send("Received");
});


app.listen(8081, function () {
    console.log('Example app listening on port 8081.');
});

