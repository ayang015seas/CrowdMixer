/*
Simple file to test the laplacian noise function
*/

var PD = require("probability-distributions");

function generateLaplace(u, b) {
	return new Promise(function(resolve, reject) {
		resolve(Math.floor(PD.rlaplace(1, u, b)));
	})
}

async function testLaplace() {
	generateLaplace(15000, 2425).then(function(res) {
		console.log(res);
	})
}

testLaplace();
