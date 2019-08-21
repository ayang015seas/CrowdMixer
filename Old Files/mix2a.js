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


// mongoStuff 

const mongo = require('mongodb').MongoClient;
const url = 'mongodb://localhost:27017';

mongo.connect(url, (err, client) => {
  if (err) {
    console.error(err);
    return;
  }
  const db = client.db('mailboxB');
  const collection1 = db.collection('round2A');
  const collection2 = db.collection('round2B');
  const collection3 = db.collection('round2C');
  const collection4 = db.collection('round2D');
  const collection5 = db.collection('round2E');
  const collection6 = db.collection('round2F');

  var allCollections = ['collection1', 'collection2', 'collection3', 'collection4', 'collection5', 'collection6'];

  // var x = [{x: 'a'},{y: 'b'},{z: 'c'},{a: 'd'},{b: 'e'}, {c: 'f'}, {d: 'g'}];

  function deleteCollection(name) {
  	  db.collection(name).drop(function(err, delOK) {
	    if (err) throw err;
	    if (delOK) console.log("Collection deleted");
	    return delOK;
  });
  }

  function clearAll() {
  	for (var i = 0; i < allCollections.length; i++) {
  		clearCollection(allCollections[i]);
  	}
  }

  // make sure collections are clear upon startup 
  clearAll();

  function insertItems(items, name) {
  	return new Promise(function (resolve, reject) {
	db.collection(name).insertMany(items, (err, result) => {
		// console.log("Insert Result");
		// console.log(items);
		if (err) {
			resolve(false);
		}
		else {
			resolve(true);
		}
	});
	});
  }

  function getItems(name) {
  	return new Promise(function (resolve, reject) {

  	if (err) throw err;
	  db.collection(name).find({}).toArray(function(err, result) {
    if (err) throw err;
 	//console.log("Get Result");
    // console.log(result);
    resolve(result);
  	});
	  })
  }

  function clearCollection(name) {
  	return new Promise(function (resolve, reject) {
  	db.collection(name).deleteMany({}, function(err, result) {
            if (err) {
                console.log("Clear Error");
                resolve(false);
            }
            // console.log(result);
            resolve(true);
        });
  	});
  }



async function addNoise(noiseInterval, type, targetCollection, addCollection) {
	return new Promise(async function (resolve, reject) {
	// for (var i = 0; i < noiseInterval; i++) {
		// if (i % 100 == 0) {
		//	console.log("Check " + (Date.now() - d1));
		//}
		// do 430 random bytes for a standard configuration
		var retrieveRound = allCollections[targetCollection];
		var depositRound = allCollections[addCollection % 6];

		if (type == 'send') {
			var queuedItems = [];
			for (var i = 0; i < noiseInterval; i++) {
				var id = uuid.v1();
				decoy1 = {addr: id, msg: crypto.randomBytes(430).toString('hex')};
				objCounter++;
				noiseCounter++;
				shuffleArray.push(objCounter - 1);
				objectArray.push(decoy1);
				queuedItems.push({addr: id});
			}
			await insertItems(queuedItems, depositRound);

		}
		else if (type == 'get') {
			var array = await getItems(retrieveRound);
				// console.log("ITEM ARR");
				// console.log(array);
			for (var i = 0; i < array.length; i++) {
				// console.log("ITEM");
				var item = array[i];
				// console.log(item);
				decoy1 = {addr: item.addr, msg: crypto.randomBytes(430).toString('hex')};
				objCounter++;
				noiseCounter++;
				shuffleArray.push(objCounter - 1);
				objectArray.push(decoy1);
			}
			await clearCollection(retrieveRound);
		}
		else if (type == 'exchange') { 
			for (var i = 0; i < noiseInterval; i++) {
				var id = uuid.v1();
	 			decoy1 = {addr: id, msg: crypto.randomBytes(430).toString('hex')};
	 			decoy2 = {addr: id, msg: crypto.randomBytes(430).toString('hex')};
				objCounter++;
				noiseCounter++;
				shuffleArray.push(objCounter - 1);
				objectArray.push(decoy1);
			
				objCounter++;
				noiseCounter++;
				shuffleArray.push(objCounter - 1);
				objectArray.push(decoy2);
			}
		}
		else {
			resolve(false);
		}
		// var content = await rsaOnionEncrypt(crypto.randomBytes(185).toString('hex'), pub2, pub3, pub4, token1, token2, token3).then(
			// function(result) {
				// console.log(result);
				// decoy = {addr: "A" + objCounter, msg: crypto.randomBytes(450).toString('hex')};
				// objectArray.push(decoy);
			// }
		// 	);
	//}
	resolve();
	});
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

var noiseLevel = 0;
// sending packages function 
async function sendPackages(initCode, finCode, sendAddr, verifyAddr, array, shuffleBool) {
	// console.log(objectArray);
	await sendPost(initCode, verifyAddr);

	if (shuffleBool) {
		for (var i = 0; i < objectArray.length; i++) {
			shuffleArray.push(i);
		}
		//addNoise(noiseInterval, type, targetCollection, addCollection)
		await addNoise(1, 'get', globalCounter, globalCounter);
		await addNoise(noiseLevel, 'send', globalCounter + 1, globalCounter + 1);
		await addNoise(noiseLevel, 'send', globalCounter + 1, globalCounter + 2);
		await addNoise(noiseLevel, 'send', globalCounter + 1, globalCounter + 3);
		await addNoise(noiseLevel, 'send', globalCounter + 1, globalCounter + 4);
		await addNoise(noiseLevel, 'send', globalCounter + 1, globalCounter + 5);
		await addNoise(noiseLevel, 'send', globalCounter + 1, globalCounter + 6);

		// await addNoise(1, 'get', allCollections[globalCounter - 1], allCollections[globalCounter - 1]);

		// await addNoise(2, 'send', '', allCollections[Math.floor(Math.random() * 6)]);
		// await addNoise(2, 'send', '', allCollections[Math.floor(Math.random() * 6)]);
		// await addNoise(2, 'send', '', allCollections[Math.floor(Math.random() * 6)]);
		await addNoise(0, 'exchange', 'n/a', 'n/a');
		// await addNoise(2, 'send', '', allCollections[Math.floor(Math.random() * 6)]);
		// console.log('objectArray')
		// console.log(objectArray);
		// console.log('shuffleArray')
		// console.log(shuffleArray);
		shuffleArray = shuffle(shuffleArray);
		for (var i = 0; i < shuffleArray.length; i++) {
			array[i] = objectArray[shuffleArray[i]];
		}
	}
	// send 
	// console.log('array2')
	// console.log(array);
	var temp = [];
	for (var i = 1; i < array.length + 1; i++) {
		temp.push(array[i - 1]);
		// console.log("CHECK" + array[0])
		if ((i % 100 == 0 && i > 0) || i == array.length) {
			// console.log("TEMP")
			// console.log(array);
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
		// console.log(shuffleArray);
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
	objCounter = objCounter + req.body.data.length;
    console.log("RECIEVED")
    console.log(objectArray);
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
		sendPackages({status: "init2-3a", round: globalCounter}, "fin2-3a", "http://localhost:8082/deposit",
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
			// console.log(objectArray)
			sendPackages("init2-1", "fin2-1", "http://localhost:8080/receive",
	"http://localhost:8080/verify", objectArray, false).then(function() {
		reset();
		listening = false;
		res.send("Closed");
	});
		});

	}
});


app.post('/receive', async function(req, res) {
	shuffledObjArray = shuffledObjArray.concat(req.body.data);
	// remove all of the previous noise 
	// console.log('objectArray');
	// console.log(shuffledObjArray);
	res.send("Received");
});


app.listen(8081, function () {
    console.log('Example app listening on port 8081.');
});

});
