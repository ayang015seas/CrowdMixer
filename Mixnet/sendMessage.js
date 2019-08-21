/*
The purpose of this code is to showcase what happens when real active users 
want to send a message to each other 
However, in this case we are simplifying the actual protocol

To use this, simply run "node sendMessage.js" during one of the 
mixnet's depositing periods 
*/

var axios = require('axios');
var crypto = require("crypto");
var uuid = require('uuid');
const Encryptor = require('node-fpe-ascii');

/*
These represent shared client secrets
*/
var secret1 = "test1";
var secret2 = "test2";
var round = 0;

var id1;
var id2; 

/*
Standard function for sending posts to the mixnet through axios
*/

function sendPost(data, url) {
	// console.log("sending");
	return new Promise(function (resolve, reject){
		axios.post(url, {
			data
	  	}).then(function (response) {
	  		console.log(response.data);
	  		resolve(response);
	  	})
	  	.catch(function (error) {
	  		console.log(error);
	  	})
  });
}

/*
Generates a mailbox hash using client secret and round number
*/
function hashSecret(secret) {
	return crypto.createHash('md5').update(secret + round).digest('hex');
}

/*
This function pads the client message so that it is the same length as the dummy messages
*/

function generateMessage(msg, secret) {
	var encryptor = new Encryptor({ password: secret});
	var paddingLength =(800 - msg.length) / 2;
	var padding = crypto.randomBytes(paddingLength).toString('hex');
	var encryptedMsg = encryptor.encrypt(msg + padding);
	console.log(encryptedMsg);
	return encryptedMsg;
}

/*
URLs to entry server deposit 
*/
const url1 = "http://localhost:8080/deposit";
const url2 = "http://localhost:8083/deposit";

/*
URLs for message retrieval 
*/
const url1retrieve = "http://localhost:8080/retrieve";
const url2retrieve = "http://localhost:8083/retrieve";

/*
	Example Messages 
*/
var data1 = {id: "1234", addr: hashSecret(secret1 + round), message: "test1"}
var data2 = {id: "abcd", addr: hashSecret(secret1 + round), message: "test2"}

var data3 = {id: "1234", addr: hashSecret(secret1 + round), message: "test3"}
var data4 = {id: "abcd", addr: hashSecret(secret2 + round), message: "test4"}

// initial
sendPost(data1, url1);
sendPost(data2, url2);

// sendPost(data4, url1);
// sendPost(data3, url2);

/*
45 minutes after depositing the message, the message will then be able to be 
retrieved with the same id as before

In a production implementation, the exact time between message deposit and retrieval
would be randomized - this is just for demo purposes 

*/

setTimeout(function(){
	sendPost({id: "1234"}, url1retrieve);
	sendPost({id: "abcd"}, url2retrieve);
}, 45 * 60 * 1000);








