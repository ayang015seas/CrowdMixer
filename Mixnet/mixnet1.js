/*
This is the code for an mixnet server 
The purpose of this server is to act as a middleman between 
the mailbox and the entry servers, further adding laplace noise
and doing another shuffle of the messages

The presence of the mixnet allows for the "anytrust model", whereby 
only one honest server is necessary due to the independent noise generation
of every single server 
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
var shuffle = require('array-shuffle');
var crypto = require("crypto");
var uuid = require('uuid');
var PD = require("probability-distributions");


var objectArray = [];
var shuffledObjArray = [];

var shuffleArray = [];
var objCounter = 0;
var noiseCounter = 0;
var globalCounter = 0;


/*
These are the parameters for the laplacian noise
These can be changed around to meet different standards of differential privacy
*/
var laplaceU = 315000;
var laplaceB = 15000;

var listening = false;

/*
This resets all objects to initial state at the beginning of each round
*/
function reset() {
	objectArray = [];
	shuffledObjArray = [];
	shuffleArray = [];

	objCounter = 0;
	noiseCounter = 0;
}

/*
Function to calculate the laplacian noise for each round 
*/

function generateLaplace(u, b) {
	return new Promise(function(resolve, reject) {
		resolve(Math.floor(PD.rlaplace(1, u, b)));
	})
}

/*
In order to minimize memory usage per server, we connect to mongoDB 
and create 6 collections (one for each round, as the server operates on 
rounds of 6. The mongoDB servers store the noise requests that need to be 
retrieved in the future 
*/

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

 /*
Function to delete a collection
*/
  function deleteCollection(name) {
  	  db.collection(name).drop(function(err, delOK) {
	    if (err) throw err;
	    if (delOK) console.log("Collection deleted");
	    return delOK;
  });
  }

/*
Function to delete contents of all collections
*/
  function clearAll() {
  	for (var i = 0; i < allCollections.length; i++) {
  		clearCollection(allCollections[i]);
  	}
  }

  // make sure collections are clear upon startup 
  clearAll();

/*
Insert items into mongo collection
*/
  function insertItems(items, name) {
  	return new Promise(function (resolve, reject) {
	db.collection(name).insertMany(items, (err, result) => {
		if (err) {
			resolve(false);
		}
		else {
			resolve(true);
		}
	});
	});
  }

/*
Get items from a mongo collection 
*/
  function getItems(name) {
  	return new Promise(function (resolve, reject) {

  	if (err) throw err;
	  db.collection(name).find({}).toArray(function(err, result) {
    if (err) throw err;
    resolve(result);
  	});
	  })
  }

/*
Clear a specific mongo collection 
*/
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
Function that adds the noise based on the laplacian
The three different types of noise are get, send, and exchange
Get noise retrieves noise that was designed to be retrieved in the current round 
by past rounds

Send noise generates a send request that will later be retrieved by a get request 

Exchange noise causes 2 requests to be sent to the same mailbox, resulting in a message exchange
*/


async function addNoise(noiseInterval, type, targetCollection, addCollection) {
	return new Promise(async function (resolve, reject) {
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
			for (var i = 0; i < array.length; i++) {
				var item = array[i];
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
	resolve();
	});
}

/*
This removes the noise from the array when it gets back 
*/
function removeNoise(array) {
	return array.slice(0, array.length - noiseCounter);
}

/*
Sends post using axios
*/
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


/*
This is a higher level function that determines how much laplacian noise is needed per round,
generates all the noise requests, shuffles the requests, and then sends them to the next server
*/

async function sendPackages(initCode, finCode, sendAddr, verifyAddr, array, shuffleBool) {
	// console.log(objectArray);
	await sendPost(initCode, verifyAddr);

	if (shuffleBool) {
		for (var i = 0; i < objectArray.length; i++) {
			shuffleArray.push(i);
		}
		var m2Noise = await generateLaplace(laplaceU / 2, laplaceB / 2);
		var m1Noise = await generateLaplace(laplaceU, laplaceB);

		await addNoise(1, 'get', globalCounter, globalCounter);
		await addNoise(Math.floor(m1Noise / 6), 'send', globalCounter + 1, globalCounter + 1);
		await addNoise(Math.floor(m1Noise / 6), 'send', globalCounter + 1, globalCounter + 2);
		await addNoise(Math.floor(m1Noise / 6), 'send', globalCounter + 1, globalCounter + 3);
		await addNoise(Math.floor(m1Noise / 6), 'send', globalCounter + 1, globalCounter + 4);
		await addNoise(Math.floor(m1Noise / 6), 'send', globalCounter + 1, globalCounter + 5);
		await addNoise(Math.floor(m1Noise / 6), 'send', globalCounter + 1, globalCounter + 6);
		await addNoise(m2Noise, 'exchange', 'n/a', 'n/a');

		shuffleArray = shuffle(shuffleArray);
		for (var i = 0; i < shuffleArray.length; i++) {
			array[i] = objectArray[shuffleArray[i]];
		}
	}
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

/*
This unshuffles the array after it gets back
*/
async function unshuffle() {
	return new Promise(function (resolve, reject) {
		for (var i = 0; i < shuffleArray.length; i++) {
		objectArray[shuffleArray[i]] = shuffledObjArray[i];
	}
	objectArray = removeNoise(objectArray);
	resolve();
	});
}


/*
Here is the route for the server to receive messages from the entry server, not for client 
interaction
*/
app.post('/deposit', async function(req, res) {
	res.setHeader('Access-Control-Allow-Origin', 'http://localhost:8080');
	objectArray = objectArray.concat(req.body.data);
	objCounter = objCounter + req.body.data.length;
	res.send("Received");
});


/*
Here, we handle all of the communications between the mixnet and the mailbox as well as
between the mixnet and the entry servers
*/
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

/*
Here is the route for the server to receive messages from the mailbox server, not for client 
interaction
*/

app.post('/receive', async function(req, res) {
	shuffledObjArray = shuffledObjArray.concat(req.body.data);
	res.send("Received");
});

/*
Determines the port that the server will listen on 
*/

app.listen(8081, function () {
    console.log('Example app listening on port 8081.');
});

});

/*

The code that has been commented out below is a scheme for onion encryption 
for increased security in case of compromise
However, while the functions themselves work, they added too much overhead for the purposes of this demo,
so the code was not incorporated in the final iteration of the prototype 

*/

/*
var token1 = 'fe35d82600ee82b2a6e12132cd4417c5';
var token2 = 'c7893f172dbb92656e44d534557bf767';
var token3 = 'f8a516a520801604cdf61d0bd1660f06';

var priv2 = '-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIC3TBXBgkqhkiG9w0BBQ0wSjApBgkqhkiG9w0BBQwwHAQI357/hVZIk40CAggA\nMAwGCCqGSIb3DQIJBQAwHQYJYIZIAWUDBAEqBBCa22+tuLJI3XJ3KTM/ut4zBIIC\ngA8woMWh5J/QyQwrMQzMs4x3Gjpdi81/xwYV/MIUxnF6YaW9GBN9+9ymiWjFxfzd\nTE0Slf2KcojoMvtAOlBOab8aQ88ix0ZSV8ggEVQ8dNc6FrjIfz5kG9XJO38M24gg\nUrclVR/Z8NT1ziRFsaWXpTuEGbVCyOzb5oHQMNAgR4umYuB9vUp5e+yD8/vEHa8H\nJ42aG53ofZDfbgrylKnrjWs0/HApax70PHgyXfUO9W2tkC36/VUOkjsiA5m6rneL\nSuprazZtQK+WII92sjoY/aU3tdtYraaLAlKO0iPDzPZ7hF1FuzTvWGhdDVoyywkI\naFBjlBe1XREs/vX5sJ5KEGcQ5A0BNjZYaJpygtRyl/9x+HIcfImDq37bBG0w6Tza\nv+Q/A+c5/d05ouscgO6JBl/g4LTOvKepLXzi/ymcb4B9ZrZuTfKQPChxVOBsyHQ/\nqyPySN956NcpOn40v0RyCCqkIo7sAe7qpEUNmT0G+sE0/LdTZBkaycb3kS2PduV5\nHr2qTRt878cXcyFYUfC9tOLaSKaTlTlA9dcR3iS5yw0rKQpV3+N0NxWAzaG08fub\n6EpVUr10e/0ohIYg9rf7BFdZxIah+WbQl4JzNBUriRqbw8deypNeVc/DTGSZG6m3\nNJZV7WhqDVN1yyQHcgoahQp0q3z8Z9jjSEtAKFkSHC9sW2beWlekTv3dEfLh2dFd\nZqIWhMgobbtgMo8CdFJS8sR/EyPQ/+4f1p9Knfvl4aXtRbXU7jmJcnmFn4jtl5pU\nDlx+R2THiG2gzj5auxiUmM0sSZj88OeHmpOZenQNBJk3rk41Z+WD9V8/O9NbFNCW\ndA5TJ+4r3KLnhjqjtWGE6vE=\n-----END ENCRYPTED PRIVATE KEY-----\n';
var pub2 = '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDJztjgAlYzMFG4X+Ufa98699JO\nxLQRIGRx3tWP0tdHVdgd5jzOxY75+m9UyqXUW51Ac5mUlGc3Y8Y6r1oBWl5LFG2O\n5CubAn+z/PfkRF+IjfdLlfbif5nct/LE8Bt+Vt5Kj3mKS+Xp2mlBgOiuLJgojaQg\nTvE+3avTUARKB+odmwIDAQAB\n-----END PUBLIC KEY-----\n';

var priv3 = '-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIC3TBXBgkqhkiG9w0BBQ0wSjApBgkqhkiG9w0BBQwwHAQI8gpmvs3sxDgCAggA\nMAwGCCqGSIb3DQIJBQAwHQYJYIZIAWUDBAEqBBAxkPUF1buYYYyGOK5D46jqBIIC\ngALyXfmIbEfbo+0BTryEqf0uzPUsWWAfDjBQN2AIN1X41gtuEj7ZmqfRI+HClxp4\nOxxI/RYJ6GWexZ7/Y5h5wD7RX58ZLkDiynXEArV6jgBwrN8OKB6hqsJ2AA917xdx\nXYLJr6dpKfmAMWoYJhZ+bl/wjp1NOzIC92R7DQ4Dblob6TCNZu7OsN0d/AQcToBD\n7k+BXn/+GsVUeMSlboaxmlIDk8Xre7ezqYsUzNh60/W96kB2d/Sbk10d49I+3Ttb\ntcMtbLSNLleli3Ykhep9+AYx28RiimU2/P0E9/hlSJQRoyvOaxDLACbLZGbVviSI\nP504pa8cKIm+BWkcufizgQdmbVgVgAlSUCfSB6nbGXgjlGbYZuKZ16Y0l1y/Cha4\nHoOFD9tz1bLevrhVEOamJKZJbnYgTvvgQpegcw2TGOamLrd4hibF3w+lbQJds8kk\nAsvnJBKXcf+N1fnB6HrukcU9M0/8JATdgAcbHs3qBYJc7zKjL3iZgCJE9wfd0jUv\nrFY7Js3sVMy9GDT6tfZSTb1ZkwB1WHoUACgwsi0+A5AAbUroK0kJdqczN537ZNAO\nI1ua2JNYcCglheMFZ/CyB2ZAETgxdiScGSsR+shIU+8xjCMBUeANLOzOzqhCeCM3\nAoL+3nqRwHzkoOhjIA4s1ROJJrSF2NvuNqU/wR07XIY/XujJQFISiQfAyP5ZV3h8\nSOIynGGifbVVdfmpHod43Ee7hfDk53d+XU1XRT2qWViDGUNnKKvLu+pu2jNJVoF2\nLFCPXQYuImrpHsHjmf+A4ULCRA5NohoyyhOqGqMOH448cfDHI5HOtanrp3aAbxRC\n3olFwnGPgploPJr29jpnb+g=\n-----END ENCRYPTED PRIVATE KEY-----\n';
var pub3 = '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDE/w2spOd0DvwWwUZ/8rvZIwMm\nXN0jnITw7zFsgO5f/sR4QzMBuVOocz74iREbc16i1oR41gfYWpkd7rO2oIntCESb\nvI0z/I78yXB+4weI7QzSGsETET8sz2MWxKueKKiNutlZuSq9yBm5K7kRXtCBhlkw\nhjYO2+YHaERiSXaT3QIDAQAB\n-----END PUBLIC KEY-----\n';

var priv4 = '-----BEGIN ENCRYPTED PRIVATE KEY-----\nMIIC3TBXBgkqhkiG9w0BBQ0wSjApBgkqhkiG9w0BBQwwHAQITDdFLczwxngCAggA\nMAwGCCqGSIb3DQIJBQAwHQYJYIZIAWUDBAEqBBAYdGHN+WGiI/NuihOqbMwKBIIC\ngBh04jnGnevZxZIdmehA+rG5oY4fLjFrXL0pV3vzFOLih1fJ3sqQKqdIk3L5Yrqo\nBxab7RxJ5vTlPyECyERtC3yrYTkJYelT/Ig7Nb+mxmrCMva29d3Lz4GqURdMn/Od\nje4c1ygJgyA8ZG3PERIJrT7wkD9YmzK9IMAd6LtQtGMBq5d8rnDkjJ8XP+RcZ7ps\nxx13ZQIjPSZF5RuB1t3MD4/UAn5uRbC6fcs9h/giRCyOBBrl3MnR2ZGWSM8OaYTX\n4im4cvbPppw6JMQ2z/D4mdgmk/k6L+zrl87Rh7Uj/gfK6IJ+WCmYExPiX4jeoDj4\n2myG5NcUFlOLkwiR3cEDYHRt4WMzbkM6/0lhivvdO9rUdXrahl+ouCo2ASep//tz\neKmtLW5lRYeM2aIcmI021CvMLYxG41FvCwuLabt8BiYtbzmQzmXWl0JRhrCBVMjY\nm9Qx0GKJnXzU/jiv2oJdtUhXLUkTPEkn6W+iGKkHSVxutnMVqbShvEeYkhpzBTec\nz6xVXIYCEk1PG6HiomlTIXyZyrWZRslWlsNKaYrlpgWU9AsdUoLgFRnoV82fUXXw\nLmj+TLX5VMwDrfSDCpv3r8EVQg+9GGOepb0yRjt7zisQGzwJxRJKZqR5GFGY12sh\nzef6+Xb9e49ABaGQIe9pbljl3JRZ6HYRNeE4VyO2sgh3NQsk0sux0gNpnG8iZDFc\njVLZ//aKTYiOel0l2SvCIi76DzgPtcuyBS9Pf+whRXsy4m0qWoDd6roH0Ck1N4tV\nx2Svjo4ph66APRO4Oj3xqjXdYOj3lUftsU8AGd1O2lNDkLAoPE1GXRZ1gMTMjcfR\n+7FETUp322mSKvjK8U0btsY=\n-----END ENCRYPTED PRIVATE KEY-----\n';
var pub4 = '-----BEGIN PUBLIC KEY-----\nMIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQDXoGwcyuJ1QVXLmsclqTxIGy6R\njsBnHHp0Y/JQJGxdygmJd8dfZgeVtm6G2XB5pOKOxFWiSXpexz/qk8yCRWZqzjmL\ncqOaD1sVmu5RT730d3Mvd9RuWnko6FqdK5LW9CRYFdsaJVJtINuZOptWm5Lv/nVg\nsdR3ZsHZKeI3F57ZgQIDAQAB\n-----END PUBLIC KEY-----\n';
var encryptStringWithRsaPublicKey = function(toEncrypt, relativeOrAbsolutePathToPublicKey) {
    // var absolutePath = path.resolve(relativeOrAbsolutePathToPublicKey);
    // var publicKey = fs.readFileSync(absolutePath, "utf8");
    var publicKey = relativeOrAbsolutePathToPublicKey;
    
    var buffer = new Buffer.from(toEncrypt, 'utf-8');
    var encrypted = crypto.publicEncrypt(publicKey, buffer);
    return encrypted.toString("base64");
};

var decryptStringWithRsaPrivateKey = function(toDecrypt, relativeOrAbsolutePathtoPrivateKey) {
    // var absolutePath = path.resolve(relativeOrAbsolutePathtoPrivateKey);
    var privateKey = relativeOrAbsolutePathtoPrivateKey;
    // var privateKey = fs.readFileSync(absolutePath, "utf8");
    var buffer = new Buffer.from(toDecrypt, "base64");
    //var decrypted = crypto.privateDecrypt(privateKey, buffer);
    const decrypted = crypto.privateDecrypt(
        {
            key: privateKey.toString(),
            passphrase: passphrase,
        },
        buffer,
    )
    return decrypted.toString("utf8");
};


function generateToken() {
	return new Promise(function(resolve, reject) {
		var key = crypto.randomBytes(16).toString('hex');
		// console.log(key);
		resolve(key);
	});
}

async function rsaEncrypt(token1, msg, pubKey) {
	return new Promise(async function (resolve, reject) {
	// var key = new NodeRSA({b: 512});
	var encrypted = encryptStringWithRsaPublicKey(token1, pubKey);
	// console.log(key);
	// var encrypted = key.encrypt(token1, 'base64');
	// console.log(encrypted);

	var encryptor = new Encryptor({ password: token1});
	var addon = (msg.length + "").padStart(3, '0');
	var x = encryptor.encrypt(addon + msg);
	// console.log("This is the package: " + x + encrypted);
	encryptor = null;
	// console.log(encrypted.length)
	// console.log("KEY  " + encrypted);
	// console.log("TOTAL  " + x + encrypted);
	resolve(x + encrypted);
	})
}

async function rsaDecrypt(privkey, msg) {
	return new Promise(async function (resolve, reject) {
		// console.log("SYMKEY " + symmetricKey);
		try {
			var symmetricKey = await msg.slice(msg.length - 172, msg.length);
			var content = await msg.slice(0, msg.length - 172);
			symmetricKey = decryptStringWithRsaPrivateKey(symmetricKey, privkey);
			var decryptor = new Encryptor({ password: symmetricKey});
			var decrypted = decryptor.decrypt(msg);
			decrypted = decrypted.slice(3, 3 + parseInt(decrypted.slice(0, 3)));
			// console.log("This is the message: " + decrypted);
			decryptor = null;
			resolve(decrypted);
		}
		catch (err) {
			resolve(false);
		}
		//  console.log("CHECK " + symmetricKey);
	});
}

async function rsaOnionEncrypt(msg, pub1, pub2, pub3, token1, token2, token3) {
	return new Promise(async function (resolve, reject) {
	var tokena = await generateToken();
	var tokenb = await generateToken();
	var layer2 = await rsaEncrypt(tokena, msg, pub2);
	var layer3 = await rsaEncrypt(tokenb, layer2, pub3);
	resolve(layer3);
});
};

*/

