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

const mongo = require('mongodb').MongoClient;
const url = 'mongodb://localhost:27017';

mongo.connect(url, (err, client) => {
  if (err) {
    console.error(err)
    return
  }
  const db = client.db('mailbox');
  const collection1 = db.collection('roundA');
  const collection2 = db.collection('roundB');
  const collection3 = db.collection('roundC');
  const collection4 = db.collection('roundD');
  const collection5 = db.collection('roundE');
  const collection6 = db.collection('roundF');


  var x = [{x: 'a'},{y: 'b'},{z: 'c'},{a: 'd'},{b: 'e'}, {c: 'f'}, {d: 'g'}];

  function deleteCollection(name) {
  	  db.collection(name).drop(function(err, delOK) {
	    if (err) throw err;
	    if (delOK) console.log("Collection deleted");
	    return delOK;
  });
  }

  function insertItems(items, name) {
  	return new Promise(function (resolve, reject) {
	db.collection(name).insertMany(items, (err, result) => {
		console.log("Insert Result");
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
 	console.log("Get Result");
    // console.log(result);
    resolve(result);
  	});
  	/*
	  db.collection(name).find({}).toArray(function(err, result) {
	    if (err) throw err;
	    // console.log(result);
	    return result;
	  });

	*/
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

/*
insertItems(x, 'collection1').then(
	function(z){
		getItems('collection1').then(
			function(y){
				console.log(y);
			})
	})

	*/
  /*

  insertItems(x, 'collection');
  clearCollection('collection').then(
  	function(y) {
  		getItems('collection').then(
  			function(z){
  				console.log(z);
  			})
  	})
*/


  // clearCollection('collection');

  // var x = delete('roundA');
  // console.log(x);



var incomingArray = [];
var listening = false;
var requests = 0;


function reset() {
	listening = false;
	requests = 0;
	incomingArray = [];
}


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

var collectionNames = ['collection1', 'collection2', 'collection3', 'collection4', 'collection5', 'collection6']

async function searchDB(dbName) {
	var collection = await getItems('collection1');
	var dbArrays = [a, b, c, d, e, f];
	for (var i = 0; i < dbArrays.length; i++) {
		dbArrays[i].indexOf()
	}
}

incomingArray = [{addr: 'a1', msg: 'alpha'}, {addr: 'b1', msg: 'bravo'}, {addr: 'a1', msg: 'charlie'}];


async function swapMessages() {
	return new Promise(function (resolve, reject) {
		var firstElem;
		var secondElem;
		var result;
		for (var i = 0; i < incomingArray.length; i++) {
			firstElem = incomingArray[i];
			// console.log(incomingArray);
			incomingArray[i] = 0;
			secondElem = incomingArray.find( address => address.addr === firstElem.addr);
			if (secondElem != undefined) {
				var secondElemIndex = incomingArray.map(function(e) { return e.addr; }).indexOf(firstElem.addr);
				incomingArray[secondElemIndex] = firstElem.msg;
				incomingArray[i] = secondElem.msg;
			}
			else {
				incomingArray[i] = firstElem;
			}
		}
		resolve(true);
	});
}


async function checkOld(databases) {
	return new Promise(async function (resolve, reject) {
		var messages = [];
		for (var i = 0; i < databases.length; i++) {
			var mailbox = await getItems(databases[i]);
			messages.push(mailbox);
		}
		for (var i = 0; i < incomingArray.length; i++) {
			var address = incomingArray[i].addr;
			if (address != undefined) {
				
			}
		}

	});
}

swapMessages().then(console.log("Result " + incomingArray));


async function sendPackages() {
	await sendPost("init3-2", "http://localhost:8081/verify");
	// send 
	var temp = [];
	for (var i = 1; i < incomingArray.length + 1; i++) {


		temp.push(incomingArray[i - 1]);


		if ((i % 100 == 0 && i > 0) || i == incomingArray.length) {
			// console.log(i);
			await sendPost(temp, "http://localhost:8081/receive");
			temp = [];
		}
	}
	await sendPost("fin3-2", "http://localhost:8081/verify");
	return;
}

// this is where incoming packages from server 2 are deposited 

app.post('/deposit', async function(req, res) {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8081');
	requests++;
	// console.log(req.body.data);
	incomingArray = incomingArray.concat(req.body.data);
	// console.log("Length: " + req.body.data.length);
	// console.log(requests)
	res.send("Received");
});

// this is where the verification codes from server 2 are processed 
app.post('/verify', async function(req, res) {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8081');
	if (req.body.data == "init2-3") {
		console.log("2-3 Transmission Start");
		listening == true;
		res.send("Initiated");
	}
	else if (req.body.data == "fin2-3") {
		// console.log(incomingArray);
		console.log("2-3 Transmission End");
		objCounter = incomingArray.length;
		sendPackages();
		listening = false;
		reset();
		res.send("Closed");
	}
});

app.listen(8082, function () {
    console.log('Example app listening on port 8082.');
});


});
